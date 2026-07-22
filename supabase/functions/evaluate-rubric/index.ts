// evaluate-rubric — ĐÃ VÔ HIỆU HOÁ (410 Gone). Trước đây chấm rubric qua LLM mà
// KHÔNG authenticate: bỏ qua ngân sách token + rate-limit, đọc câu hỏi XUYÊN tenant
// (chỉ .eq('id',questionId) không chốt tenant/version). Chấm viết chính thức đi qua
// chat-turn (action='writing') — có authenticate + consent + budget theo ctx.userId.
import { handleOptions, json } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    return json(
      { error: "gone", message: "evaluate-rubric đã ngừng — dùng chat-turn (action='writing') để chấm rubric." },
      410,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
