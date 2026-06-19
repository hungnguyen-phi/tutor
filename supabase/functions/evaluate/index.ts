// evaluate — the EVALUATE agent (separate from guide). Objective correctness is
// decided by CAS, NEVER by an LLM (PRD §5.3, Q11). Returns correctness + which
// misconception the student's answer matched (for diagnosis).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { checkAnswer } from "../_shared/cas.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const { questionId, studentAnswer, params } = await req.json();
    if (!questionId) return json({ error: "questionId required" }, 400);

    const supa = admin();
    const { data: q, error } = await supa
      .from("questions")
      .select("id, loai_danh_gia, dap_an, distractors, do_kho, dok, tham_so_hoa")
      .eq("id", questionId)
      .single();
    if (error || !q) return json({ error: "question not found" }, 404);
    if (q.loai_danh_gia !== "objective") {
      return json({ error: "evaluate is for objective questions; use evaluate-rubric" }, 400);
    }

    const result = checkAnswer(String(studentAnswer ?? ""), String(q.dap_an ?? ""), params);

    // Diagnose: did the answer match a known distractor's misconception?
    let matchedMisconception: string | null = null;
    for (const d of (q.distractors ?? []) as Array<{ phuong_an: string; quan_niem_sai: string }>) {
      if (checkAnswer(String(studentAnswer ?? ""), d.phuong_an, params).correct) {
        matchedMisconception = d.quan_niem_sai;
        break;
      }
    }

    return json({
      correct: result.correct,
      method: result.method,
      matchedMisconception,
      dok: q.dok,
      doKho: q.do_kho,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
