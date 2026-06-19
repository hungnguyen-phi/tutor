// guide — the GUIDE agent (separate from evaluate). Socratic only; never reveals
// the stored answer unless the orchestrator authorizes bottom-out.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { anonymize, rehydrate, callLLM } from "../_shared/llm.ts";
import { buildGuideSystem, type GuideCtx } from "../_shared/prompts.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const ctx: GuideCtx = {
      subject: body.subject ?? "Toan",
      grade: String(body.grade ?? "10"),
      language: body.language ?? "vi",
      nodeLabel: body.nodeLabel ?? "",
      question: body.question ?? "",
      misconception: body.misconception,
      rungQuestion: body.rungQuestion,
      bottomOut: body.bottomOut,
      attempts: body.attempts ?? 0,
    };
    const studentMessage: string = body.studentMessage ?? "";
    const names: string[] = body.studentNames ?? [];

    const { text: safeMsg, map } = anonymize(studentMessage, names);
    const system = buildGuideSystem(ctx);
    const user = safeMsg || "(Học sinh chưa nói gì — hãy mở đầu bằng một câu gợi mở.)";

    const res = await callLLM({
      system,
      user,
      agent: "guide",
      tier: "default",
      studentId: body.studentId,
      tenantId: body.tenantId,
      supa: admin(),
    });

    return json({ text: rehydrate(res.text, map), model: res.model });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
