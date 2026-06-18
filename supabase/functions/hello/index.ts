// M0 health Edge Function. Proves the Supabase Deno function deploy path.
// Deploy: supabase functions deploy hello
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve((req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  return json({
    ok: true,
    service: "tutor-edge",
    fn: "hello",
    milestone: "M0",
    ts: new Date().toISOString(),
  });
});
