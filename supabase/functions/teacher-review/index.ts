// teacher-review — M3.5 human-in-the-loop: a teacher approves/retires seed content
// so only approved content reaches students. (M4 binds to a teacher JWT + records
// reviewed_by; here it's service-role for the demo.)
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";

const QUESTION_STATUSES = ["active", "review", "retired"];
const LADDER_STATUSES = ["active", "review"];

/** Trạng thái nội dung → trạng thái review_queue tương ứng (đóng vòng lặp —
 *  trước đây duyệt xong mà không đóng dòng review_queue, khiến hàng đợi kẹt
 *  "pending" mãi dù nội dung đã active thật; audit 24/07 + migration 0013). */
function queueStatus(contentStatus: string): "approved" | "rejected" | "pending" {
  if (contentStatus === "retired") return "rejected";
  if (contentStatus === "review") return "pending";
  return "approved";
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "content:review:approve")) return json({ error: "forbidden" }, 403);

    const { kind, id, status } = await req.json();
    const supa = admin();

    if (kind === "question") {
      if (!QUESTION_STATUSES.includes(status)) return json({ error: "bad status" }, 400);
      // CHỐT tenant: chỉ đổi trạng thái nội dung THUỘC tenant của người duyệt.
      // .select("id") để xác nhận có đúng một hàng khớp — id lạ / khác tenant sẽ
      // KHÔNG khớp và trả 404 thay vì âm thầm "ok".
      const { data, error } = await supa
        .from("questions").update({ trang_thai: status })
        .eq("id", id).eq("tenant_id", ctx.tenantId).select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data || data.length === 0) return json({ error: "not found" }, 404);
      // Đóng vòng lặp review_queue — best-effort (không có dòng nào là bình
      // thường cho câu chưa từng qua hàng đợi; không chặn phản hồi duyệt).
      await supa.from("review_queue")
        .update({ status: queueStatus(status), reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() })
        .eq("tenant_id", ctx.tenantId).eq("content_type", "question").eq("content_id", id);
      await supa.from("audit_logs").insert({ action: "content_review", subject_type: "question", subject_id: id, actor_id: ctx.userId, tenant_id: ctx.tenantId, ai_decision: { status } });
      return json({ ok: true, kind, id, status });
    }
    if (kind === "ladder") {
      if (!LADDER_STATUSES.includes(status)) return json({ error: "bad status" }, 400);
      const { data, error } = await supa
        .from("socratic_ladders").update({ status })
        .eq("id", id).eq("tenant_id", ctx.tenantId).select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data || data.length === 0) return json({ error: "not found" }, 404);
      await supa.from("review_queue")
        .update({ status: queueStatus(status), reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() })
        .eq("tenant_id", ctx.tenantId).eq("content_type", "ladder").eq("content_id", id);
      await supa.from("audit_logs").insert({ action: "content_review", subject_type: "ladder", subject_id: id, actor_id: ctx.userId, tenant_id: ctx.tenantId, ai_decision: { status } });
      return json({ ok: true, kind, id, status });
    }
    return json({ error: "kind must be 'question' or 'ladder'" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
