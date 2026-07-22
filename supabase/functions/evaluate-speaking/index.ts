// evaluate-speaking — ĐÃ VÔ HIỆU HOÁ (410 Gone). Lý do như evaluate-rubric: không
// authenticate → lộ ngân sách token + rate-limit + đọc câu XUYÊN tenant. Chấm nói
// chính thức đi qua chat-turn (action='speaking') — authenticate + budget theo user.
import { handleOptions, json } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    return json(
      { error: "gone", message: "evaluate-speaking đã ngừng — dùng chat-turn (action='speaking') để chấm nói." },
      410,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
