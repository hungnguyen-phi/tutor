// question-stats — "thống kê là trọng tài" (quy tắc 1, KG schema v2):
// tính p_value (tỉ lệ đúng lần-đầu) + discrimination (corr điểm câu × năng lực
// học sinh) cho mọi câu có dữ liệu, rồi TỰ ĐƯA câu kém (quá dễ / quá khó /
// không phân biệt) về trạng thái 'review' + xếp hàng review_queue chờ giáo viên.
// KHÔNG tự retired — quyết định cuối thuộc giáo viên (human-in-the-loop).
// Toàn bộ tính toán nằm trong SQL recompute_question_stats (xp-stats.sql);
// pg_cron chạy đêm nếu bật được, function này là đường gọi TAY từ /teacher.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "content:review:approve")) return json({ error: "forbidden" }, 403);

    const supa = admin();
    // Quét là truy vấn nặng toàn bảng attempts — chặn spam nút.
    const rl = await rateLimit(supa, `qstats:${ctx.tenantId}`, 4, 60);
    if (!rl.ok) return json({ error: "rate_limited", retryAfter: rl.retryAfter }, 429);

    const { data, error } = await supa.rpc("recompute_question_stats", {
      p_tenant: ctx.tenantId,
    });
    if (error) return json({ error: error.message }, 500);
    const row = Array.isArray(data) ? data[0] : data;

    await supa.from("audit_logs").insert({
      action: "question_stats_recompute",
      subject_type: "question",
      subject_id: ctx.tenantId,
      actor_id: ctx.userId,
      tenant_id: ctx.tenantId,
      ai_decision: row ?? null,
    });

    return json({ ok: true, updated: row?.updated ?? 0, flagged: row?.flagged ?? 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
