// effort-gate — decides whether the tutor may escalate help / reveal anything.
// Hard minimum attempts can never be bypassed (the `cam` rule).
// M4 HARDENING: bắt buộc auth + CHỐT tenant. Trước đây function nhận sessionId /
// ladderId TÙY Ý từ client mà không kiểm quyền → đọc được socratic_ladders của
// tenant khác và đếm attempts của phiên không thuộc mình. Nay phải: (1) đăng
// nhập, (2) phiên thuộc đúng tenant của người gọi và do chính họ sở hữu (hoặc
// staff có scope), (3) mọi truy vấn phụ đều lọc theo tenant của phiên.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { evaluateEffortGate } from "../_shared/pedagogy.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);

    const { sessionId, questionId, ladderId, currentRung, thinkingQuality } = await req.json();
    if (!sessionId || !questionId) return json({ error: "sessionId & questionId required" }, 400);
    const supa = admin();

    // Chốt tenant + quyền sở hữu qua chính phiên học (identity từ JWT, KHÔNG tin
    // body). Phiên phải cùng tenant với người gọi; và phải do họ sở hữu hoặc họ
    // là staff có scope đọc phiên.
    const { data: sess } = await supa
      .from("learning_sessions")
      .select("tenant_id, student_id")
      .eq("id", sessionId)
      .single();
    if (!sess) return json({ error: "session not found" }, 404);
    if (sess.tenant_id !== ctx.tenantId) return json({ error: "forbidden" }, 403);
    if (sess.student_id !== ctx.userId && !can(ctx, "learn:session:read_scope")) {
      return json({ error: "forbidden" }, 403);
    }

    const { count } = await supa
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", sess.tenant_id)
      .eq("session_id", sessionId)
      .eq("question_id", questionId);

    let minAttempts = 2;
    let totalRungs = 4;
    if (ladderId) {
      // Thang phải thuộc đúng tenant của phiên — không cho dò thang tenant khác.
      const { data: ladder } = await supa
        .from("socratic_ladders")
        .select("rungs, cong_no_luc")
        .eq("id", ladderId)
        .eq("tenant_id", sess.tenant_id)
        .maybeSingle();
      if (ladder) {
        totalRungs = Array.isArray(ladder.rungs) ? ladder.rungs.length : 4;
        const cn = ladder.cong_no_luc as { so_lan_thu_toi_thieu?: number } | null;
        if (cn?.so_lan_thu_toi_thieu) minAttempts = cn.so_lan_thu_toi_thieu;
      }
    }

    // `currentRung` = SỐ BẬC ĐÃ TRAO (đổi nghĩa 29/07 cùng evaluateEffortGate).
    // Client tự khai nên PHẢI kẹp: gửi 99 là mở đáy vô điều kiện, gửi số âm là
    // lệch thang. Kẹp [0, totalRungs] giữ nguyên ngữ nghĩa mà không tin client.
    const rung = Math.max(0, Math.min(Number(currentRung) || 0, totalRungs));
    const decision = evaluateEffortGate({
      attempts: count ?? 0,
      thinkingQuality,
      currentRung: rung,
      totalRungs,
      minAttempts,
    });

    return json({ ...decision, attempts: count ?? 0, totalRungs, minAttempts });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
