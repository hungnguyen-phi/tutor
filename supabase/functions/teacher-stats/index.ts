// teacher-stats — M3.5 analytics (misconception / effort / mastery) + the
// review-seed list. Service-role read for the pilot tenant. (M4 binds this to a
// teacher JWT + RLS.)
import { handleOptions, json } from "../_shared/cors.ts";
import { admin, PILOT_TENANT_SLUG } from "../_shared/supa.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const supa = admin();
    const { data: tenant } = await supa.from("tenants").select("id").eq("slug", PILOT_TENANT_SLUG).single();
    if (!tenant) return json({ error: "tenant not found" }, 404);
    const t = tenant.id;

    const [{ data: attempts }, { data: states }, { data: questions }, { data: ladders }] = await Promise.all([
      supa.from("attempts").select("question_id, attempt_no, is_correct, matched_misconception").eq("tenant_id", t),
      supa.from("student_node_state").select("node_id, mastered, mastery_score").eq("tenant_id", t),
      supa.from("questions").select("id, question_key, node_key, loai_danh_gia, noi_dung, trang_thai").eq("tenant_id", t).order("question_key"),
      supa.from("socratic_ladders").select("id, ladder_key, node_key, misconception, status").eq("tenant_id", t).order("ladder_key"),
    ]);

    // Misconception frequency.
    const miscCount: Record<string, number> = {};
    for (const a of attempts ?? []) {
      if (a.matched_misconception) miscCount[a.matched_misconception] = (miscCount[a.matched_misconception] ?? 0) + 1;
    }
    const misconceptions = Object.entries(miscCount)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Effort: avg attempts taken to reach the first correct answer (per question/student chain).
    const correct = (attempts ?? []).filter((a) => a.is_correct);
    const avgEffort = correct.length
      ? correct.reduce((s, a) => s + (a.attempt_no ?? 1), 0) / correct.length
      : 0;
    const totalAttempts = attempts?.length ?? 0;
    const accuracy = totalAttempts ? correct.length / totalAttempts : 0;

    // Mastery.
    const masteredCount = (states ?? []).filter((s) => s.mastered).length;
    const masteryRate = states?.length ? masteredCount / states.length : 0;

    return json({
      metrics: {
        misconceptions,
        effort: { avgAttemptsToCorrect: Number(avgEffort.toFixed(2)), accuracy: Number(accuracy.toFixed(2)), totalAttempts },
        mastery: { mastered: masteredCount, tracked: states?.length ?? 0, rate: Number(masteryRate.toFixed(2)) },
      },
      review: {
        questions: (questions ?? []).map((q) => ({
          id: q.id,
          key: q.question_key,
          node: q.node_key,
          kind: q.loai_danh_gia,
          status: q.trang_thai,
          prompt: q.noi_dung.slice(0, 90),
        })),
        ladders: (ladders ?? []).map((l) => ({
          id: l.id,
          key: l.ladder_key,
          node: l.node_key,
          misconception: l.misconception,
          status: l.status,
        })),
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
