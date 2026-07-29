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

    // KHÔNG đọc `currentRung` / `thinkingQuality` từ body nữa (29/07): cả hai
    // giờ suy từ bảng attempts ở dưới. Nhận số client tự khai chính là cái lỗ
    // mà cổng nỗ lực sinh ra để bịt.
    const { sessionId, questionId, ladderId } = await req.json();
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

    // Đọc CẢ thinking_quality: cổng nỗ lực KHÔNG được tin số client tự khai —
    // đó đúng là thứ cả thiết kế này sinh ra để chặn. Suy từ dữ liệu server,
    // giống hệt nhánh chấm trong chat-turn.
    const { data: attRows } = await supa
      .from("attempts")
      .select("thinking_quality")
      .eq("tenant_id", sess.tenant_id)
      .eq("session_id", sessionId)
      .eq("question_id", questionId)
      .order("attempt_no", { ascending: true });
    const rows = (attRows ?? []) as Array<{ thinking_quality: number | null }>;
    const count = rows.length;

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

    // CẢ HAI trục suy từ SERVER (29/07), body chỉ còn dùng để định danh phiên/câu:
    //  · thinkingQuality = mức suy nghĩ CAO NHẤT em từng thể hiện ở câu này;
    //  · currentRung     = SỐ BẬC ĐÃ TRAO = số lượt (sau trần tối thiểu) mà em
    //                      thực sự trình bày. Kẹp bằng chính client thì gửi 99
    //                      thành gửi 4 — vẫn mở đáy; phải bỏ hẳn số client.
    const derivedThinking = rows.reduce((m, r) => Math.max(m, Number(r.thinking_quality ?? 0)), 0);
    const rungTurns = rows.slice(Math.max(0, minAttempts - 1));
    const rung = rungTurns.filter((r) => Number(r.thinking_quality ?? 0) >= 0.5).length;
    const decision = evaluateEffortGate({
      attempts: count,
      thinkingQuality: derivedThinking,
      currentRung: rung,
      totalRungs,
      minAttempts,
    });

    return json({ ...decision, attempts: count, currentRung: rung, totalRungs, minAttempts });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
