// Rate-limit dùng chung cho Edge Functions. Cửa sổ trượt + đếm nguyên tử được
// làm ở PHÍA POSTGRES qua RPC public.rl_hit (security definer) — client edge chỉ
// gọi và đọc kết quả boolean (true = CHO PHÉP lượt này). Nhờ đặt logic ở DB nên
// nhiều isolate/nhiều function dùng CHUNG một bộ đếm, không bị đua trạng thái.
//
// HỢP ĐỒNG (bám đúng để các mảng khớp):
//   rateLimit(admin, key, max, windowSec) -> { ok, retryAfter }
//   key kiểu 'answer:{userId}:{questionId}'. RPC: rl_hit(p_key, p_max, p_window_sec).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface RateLimitResult {
  /** true = được phép đi tiếp; false = đã vượt hạn mức trong cửa sổ. */
  ok: boolean;
  /** Số giây gợi ý client chờ trước khi thử lại (0 khi ok). */
  retryAfter: number;
}

/**
 * Ghi nhận một lượt cho `key` và trả về có được phép hay không.
 * @param admin  client service-role (bỏ qua RLS) — RPC chạy security definer.
 * @param key    khóa định danh hành động/người dùng, vd 'answer:{userId}:{qid}'.
 * @param max    số lượt tối đa cho phép trong cửa sổ.
 * @param windowSec  độ dài cửa sổ trượt (giây).
 *
 * FAIL-OPEN: nếu RPC lỗi (DB nghẽn/hàm chưa deploy) thì KHÔNG chặn học sinh —
 * thà chịu rủi ro vượt hạn mức tạm thời còn hơn khóa người dùng thật vì limiter
 * hỏng. Lỗi được log để còn lần theo. (Muốn siết fail-CLOSED thì đổi ở đây.)
 */
export async function rateLimit(
  admin: SupabaseClient,
  key: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc("rl_hit", {
      p_key: key,
      p_max: max,
      p_window_sec: windowSec,
    });
    if (error) throw error;
    const allowed = data === true;
    return { ok: allowed, retryAfter: allowed ? 0 : windowSec };
  } catch (e) {
    console.error(
      "rateLimit: rl_hit lỗi → fail-open (cho qua) —",
      e instanceof Error ? e.message : String(e),
    );
    return { ok: true, retryAfter: 0 };
  }
}
