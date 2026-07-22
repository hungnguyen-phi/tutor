// guide — ĐÃ VÔ HIỆU HOÁ (410 Gone). Trước đây nhận studentId/tenantId/studentMessage
// TỪ CLIENT rồi gọi LLM mà KHÔNG authenticate, KHÔNG kiểm quyền/tenant/consent,
// KHÔNG rate-limit → bất kỳ token đăng nhập nào cũng đốt được key LLM của trường và
// gán token_usage cho nạn nhân (khoá nạn nhân khi chạm trần ngày). Đường chat chính
// thức DUY NHẤT là chat-turn (authenticate + consent + rate-limit + ngân sách token
// theo ctx.userId). Giữ authenticate ở đầu để không lộ hành vi cho lời gọi vô danh.
import { handleOptions, json } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    return json(
      { error: "gone", message: "guide đã ngừng — dùng chat-turn (action='message') để trò chuyện." },
      410,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
