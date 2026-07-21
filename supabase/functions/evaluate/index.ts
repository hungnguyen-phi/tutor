// evaluate — ĐÃ VÔ HIỆU HOÁ (410 Gone). Trước đây đây là "answer-oracle":
// nhận questionId + studentAnswer rồi CHẤM ngay qua CAS mà KHÔNG kiểm danh
// tính, KHÔNG kiểm quyền sở hữu phiên, KHÔNG cổng nỗ lực — bất kỳ ai có id câu
// hỏi đều dò được đáp án đúng/sai và cả quan niệm sai của distractor. Đường
// chính thức duy nhất để chấm giờ là chat-turn (ENGINE ÁP CỨNG: cổng nỗ lực +
// thang Socratic + lan truyền ngược + ghi attempt/evidence). Giữ authenticate ở
// đầu để endpoint không lộ hành vi cho lời gọi vô danh; mọi lời gọi hợp lệ đều
// nhận 410 kèm hướng dẫn chuyển sang chat-turn.
import { handleOptions, json } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    // Vẫn bắt buộc auth: không tiết lộ gì cho lời gọi chưa đăng nhập.
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    // Đã khai tử — chuyển hướng người gọi sang đường chấm chính thức.
    return json(
      { error: "gone", message: "evaluate đã ngừng — dùng chat-turn (action='answer') để chấm câu khách quan." },
      410,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
