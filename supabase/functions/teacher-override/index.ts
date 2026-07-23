// teacher-override — GV tạo/gỡ/liệt kê lớp phủ nội dung (H5). Gác vai giáo
// viên/admin. Nội dung gốc (Studio) không đổi; đây là lớp phủ tenant-cục-bộ áp
// lúc phục vụ (diagnose/chat-turn qua _shared/overrides.ts). Mọi thao tác ghi
// audit_logs kèm LÝ DO.
//   · list   : các override đang hiệu lực của tenant
//   · create : ẩn (hide) hoặc sửa (edit {noi_dung?, loi_giai?}) một câu — reason bắt buộc
//   · remove : gỡ override của một câu (active=false → câu trở lại như cũ)
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can, hasRole } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "content:review:approve") && !hasRole(ctx, "teacher", "admin", "leadership")) {
      return json({ error: "forbidden: cần vai giáo viên/admin" }, 403, req);
    }
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "list";
    const supa = admin();

    // ── LIST — override đang hiệu lực của tenant ──────────────────────────────
    if (action === "list") {
      const { data } = await supa
        .from("teacher_overrides")
        .select("id, content_id, action, patch, reason, created_at")
        .eq("tenant_id", ctx.tenantId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      return json({ overrides: data ?? [] }, 200, req);
    }

    // ── CREATE — ẩn/sửa một câu, kèm lý do (bắt buộc) ─────────────────────────
    if (action === "create") {
      const contentId = String(body.contentId ?? "");
      const ovAction = String(body.overrideAction ?? "hide");
      const reason = String(body.reason ?? "").trim();
      const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
      if (!contentId) return json({ error: "contentId required" }, 400, req);
      if (!reason) return json({ error: "cần LÝ DO cho điều chỉnh" }, 400, req);
      if (!["hide", "edit"].includes(ovAction)) return json({ error: "invalid action" }, 400, req);
      // Câu phải thuộc tenant này (không phủ chéo trường).
      const { data: q } = await supa
        .from("questions").select("id").eq("id", contentId).eq("tenant_id", ctx.tenantId).maybeSingle();
      if (!q) return json({ error: "không tìm thấy câu hỏi" }, 404, req);
      // Unique 1 override/câu đang hiệu lực → gỡ cái cũ rồi tạo mới.
      await supa.from("teacher_overrides").update({ active: false })
        .eq("tenant_id", ctx.tenantId).eq("content_id", contentId).eq("active", true);
      const { error } = await supa.from("teacher_overrides").insert({
        tenant_id: ctx.tenantId, content_type: "question", content_id: contentId,
        action: ovAction, patch, reason, created_by: ctx.userId, active: true,
      });
      if (error) return json({ error: error.message }, 500, req);
      await supa.from("audit_logs").insert({
        action: `content_override_${ovAction}`, subject_type: "question", subject_id: contentId,
        actor_id: ctx.userId, tenant_id: ctx.tenantId, ai_decision: { reason },
      });
      return json({ ok: true }, 200, req);
    }

    // ── REMOVE — gỡ override của một câu (câu trở lại như cũ) ──────────────────
    if (action === "remove") {
      const contentId = String(body.contentId ?? "");
      if (!contentId) return json({ error: "contentId required" }, 400, req);
      const { error } = await supa.from("teacher_overrides").update({ active: false })
        .eq("tenant_id", ctx.tenantId).eq("content_id", contentId).eq("active", true);
      if (error) return json({ error: error.message }, 500, req);
      await supa.from("audit_logs").insert({
        action: "content_override_remove", subject_type: "question", subject_id: contentId,
        actor_id: ctx.userId, tenant_id: ctx.tenantId,
      });
      return json({ ok: true }, 200, req);
    }

    return json({ error: "unknown action" }, 400, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
