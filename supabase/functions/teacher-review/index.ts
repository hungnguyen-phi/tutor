// teacher-review — M3.5 human-in-the-loop: a teacher approves/retires seed content
// so only approved content reaches students. (M4 binds to a teacher JWT + records
// reviewed_by; here it's service-role for the demo.)
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";

const QUESTION_STATUSES = ["active", "review", "retired"];
const LADDER_STATUSES = ["active", "review"];

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const { kind, id, status } = await req.json();
    const supa = admin();

    if (kind === "question") {
      if (!QUESTION_STATUSES.includes(status)) return json({ error: "bad status" }, 400);
      const { error } = await supa.from("questions").update({ trang_thai: status }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      await supa.from("audit_logs").insert({ action: "content_review", subject_type: "question", subject_id: id, ai_decision: { status } });
      return json({ ok: true, kind, id, status });
    }
    if (kind === "ladder") {
      if (!LADDER_STATUSES.includes(status)) return json({ error: "bad status" }, 400);
      const { error } = await supa.from("socratic_ladders").update({ status }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      await supa.from("audit_logs").insert({ action: "content_review", subject_type: "ladder", subject_id: id, ai_decision: { status } });
      return json({ ok: true, kind, id, status });
    }
    return json({ error: "kind must be 'question' or 'ladder'" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
