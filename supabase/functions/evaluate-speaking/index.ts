// evaluate-speaking — speaking feedback from an in-browser STT transcript (pilot;
// Web Speech API). Phoneme-level pronunciation scoring is deferred to Azure F0.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { anonymize, rehydrate, callLLM } from "../_shared/llm.ts";
import { buildSpeakingSystem } from "../_shared/prompts.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const { questionId, transcript, studentNames, language } = await req.json();
    const supa = admin();
    const { data: q } = await supa
      .from("questions")
      .select("rubric, noi_dung, loai_danh_gia")
      .eq("id", questionId)
      .single();
    if (!q) return json({ error: "question not found" }, 404);

    const { text: safe, map } = anonymize(String(transcript ?? ""), studentNames ?? []);
    const system = buildSpeakingSystem(q.rubric, language ?? "en");
    const res = await callLLM({
      system,
      user: `Đề nói: ${q.noi_dung}\nTranscript:\n${safe}`,
      agent: "evaluate-speaking",
      supa,
    });
    return json({
      feedback: rehydrate(res.text, map),
      note: "transcript-based; pronunciation scoring deferred to Azure F0",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
