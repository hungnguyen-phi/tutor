// effort-gate — decides whether the tutor may escalate help / reveal anything.
// Hard minimum attempts can never be bypassed (the `cam` rule).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { evaluateEffortGate } from "../_shared/pedagogy.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const { sessionId, questionId, ladderId, currentRung, thinkingQuality } = await req.json();
    const supa = admin();

    const { count } = await supa
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("question_id", questionId);

    let minAttempts = 2;
    let totalRungs = 4;
    if (ladderId) {
      const { data: ladder } = await supa
        .from("socratic_ladders")
        .select("rungs, cong_no_luc")
        .eq("id", ladderId)
        .single();
      if (ladder) {
        totalRungs = Array.isArray(ladder.rungs) ? ladder.rungs.length : 4;
        const cn = ladder.cong_no_luc as { so_lan_thu_toi_thieu?: number } | null;
        if (cn?.so_lan_thu_toi_thieu) minAttempts = cn.so_lan_thu_toi_thieu;
      }
    }

    const decision = evaluateEffortGate({
      attempts: count ?? 0,
      thinkingQuality,
      currentRung: currentRung ?? 0,
      totalRungs,
      minAttempts,
    });

    return json({ ...decision, attempts: count ?? 0, totalRungs, minAttempts });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
