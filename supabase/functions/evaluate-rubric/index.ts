// evaluate-rubric — Writing Coach (English). FORMATIVE feedback only, never an
// official grade, never rewrites the whole piece (PRD §5.5, §19).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { anonymize, rehydrate, callLLM } from "../_shared/llm.ts";
import { buildRubricSystem } from "../_shared/prompts.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const { questionId, text, studentNames, language } = await req.json();
    const supa = admin();
    const { data: q } = await supa
      .from("questions")
      .select("rubric, bai_mau, noi_dung, loai_danh_gia")
      .eq("id", questionId)
      .single();
    if (!q || q.loai_danh_gia !== "rubric") return json({ error: "rubric question not found" }, 404);

    const { text: safe, map } = anonymize(String(text ?? ""), studentNames ?? []);
    const system = buildRubricSystem(q.rubric, (q.bai_mau?.[0] as string) ?? "", language ?? "en");
    const res = await callLLM({
      system,
      user: `Đề: ${q.noi_dung}\nBài làm:\n${safe}`,
      agent: "evaluate-rubric",
      supa,
    });
    return json({ feedback: rehydrate(res.text, map), note: "formative — not an official grade" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
