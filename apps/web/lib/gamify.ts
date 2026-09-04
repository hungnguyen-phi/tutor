/**
 * XP, chuỗi ngày và hạng nỗ lực.
 *
 * Nguyên tắc sư phạm (PRODUCT.md): **nỗ lực là thứ được thưởng.** XP cộng khi
 * học sinh thử lại sau khi sai, không chỉ khi đúng. Không có "mạng", không có
 * hình phạt cho việc thử — hệ thống vốn BẮT BUỘC em thử ít nhất hai lần trước
 * khi được gợi ý (effort gate), nên trừng phạt việc thử là tự mâu thuẫn.
 *
 * ⚠️ NGUỒN-SỰ-THẬT (gia cố audit): localStorage ở đây CHỈ LÀ CACHE HIỂN THỊ.
 * Nó KHÔNG được phép là nguồn-sự-thật cho bất cứ thứ gì được XẾP HẠNG hay
 * KHEN THƯỞNG thật (bảng tuần, hạng nỗ lực trong lớp/khối, huy hiệu…), vì học
 * sinh sửa được localStorage. Số THẬT phải do server chấm và trả về:
 *   • HẠNG nỗ lực → đã server-authoritative: `getScoreboard().effort.rank`
 *     (lib/api.ts), Scoreboard.tsx ưu tiên số này thay cho vị trí suy từ XP máy.
 *   • MASTERY (điểm thành thạo node) → server: end-session / learning-path.
 * XP/chuỗi ngày dưới đây chỉ để giao diện phản hồi TỨC THÌ (optimistic) giữa các
 * lần đồng bộ — coi như số ước lượng, không dùng để phân định thắng/thua.
 *
 * TODO(server-authoritative XP): chưa có bảng `student_xp` / `student_streak`
 * hay endpoint trả XP tích luỹ trên Supabase. Khi có, đổi `load`/`save` sang
 * gọi API (server cộng XP theo attempts.created_at) là đủ — phần còn lại của
 * giao diện không cần biết. Tới lúc đó, MỌI chỗ hiện XP để "so kè" (aside bảng
 * tuần, ws-stats trong Scoreboard) phải đọc XP từ server thay vì `load()`.
 */

import { SUPABASE_URL } from "./config";

export const XP = {
  correct: 10, // trả lời đúng
  persistence: 5, // thử lại sau khi sai — thưởng cho việc không bỏ cuộc
  lessonDone: 20, // hoàn thành buổi học
  nodeMastered: 30, // thành thạo một điểm kiến thức
} as const;

export type Progress = {
  xp: number;
  streak: number;
  /** ISO date (YYYY-MM-DD) của ngày học gần nhất. */
  lastDay: string | null;
};

const KEY = "va-tutor-progress";
const EMPTY: Progress = { xp: 0, streak: 0, lastDay: null };

const today = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * KHOÁ CACHE PHẢI THEO HỌC SINH (vá 04/09). Trước đây `va-tutor-progress` /
 * `va-tutor-mastered` là khoá chung cho cả trình duyệt — máy dùng chung (phòng
 * máy trường, hai anh em một laptop, hay chỉ là đăng xuất rồi đăng nhập tài
 * khoản khác) là em SAU nhìn thấy XP/chuỗi ngày/node đã học của em TRƯỚC, tới
 * khi server kịp ghi đè. Đo được trong đợt 4 agent test song song: HUD nhảy
 * 215 → 18 XP đúng lúc phiên đổi chủ.
 *
 * Đọc uid ĐỒNG BỘ từ chính token mà supabase-js lưu (`sb-<ref>-auth-token`,
 * hoặc dò theo mẫu khi chạy qua proxy dev) — không cần React/async, nên mọi nơi
 * gọi `load()` cũ vẫn gọi y như cũ. Chưa đăng nhập → không đọc, không ghi (thà
 * hiện 0 rồi server điền, còn hơn hiện số của người khác).
 */
function currentUid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const ref = /^https?:\/\/([^./]+)\.supabase\.co/i.exec(SUPABASE_URL)?.[1];
    const key = ref
      ? `sb-${ref}-auth-token`
      : Object.keys(window.localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    const raw = key ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    const j = JSON.parse(raw) as { user?: { id?: string } };
    return typeof j?.user?.id === "string" ? j.user.id : null;
  } catch {
    return null;
  }
}

/** Khoá theo học sinh; null = chưa đăng nhập. Tiện thể XOÁ khoá chung đời cũ để
 *  không ai còn đọc được số của người khác từ nó. */
function keyFor(base: string): string | null {
  const uid = currentUid();
  try { window.localStorage.removeItem(base); } catch { /* bỏ qua */ }
  return uid ? `${base}:${uid}` : null;
}

/** Đọc CACHE HIỂN THỊ ở máy. Không phải nguồn-sự-thật — xem chú thích đầu file.
 *  Khi có endpoint XP server-authoritative, hàm này đổi sang gọi API. */
export function load(): Progress {
  if (typeof window === "undefined") return EMPTY;
  try {
    const k = keyFor(KEY);
    const raw = k ? window.localStorage.getItem(k) : null;
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Progress;
    return { xp: p.xp ?? 0, streak: p.streak ?? 0, lastDay: p.lastDay ?? null };
  } catch {
    return EMPTY;
  }
}

export function save(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    const k = keyFor(KEY);
    if (k) window.localStorage.setItem(k, JSON.stringify(p));
  } catch {
    /* chế độ ẩn danh chặn localStorage — tiến độ chỉ mất phiên này, không chặn học */
  }
}

/** Chuỗi ngày "nguội" khi đã bỏ lỡ hôm qua — hiển thị xám thay vì âm thầm về 0. */
export function isCold(p: Progress): boolean {
  if (!p.lastDay || p.streak === 0) return true;
  return daysBetween(p.lastDay, today()) > 1;
}

/**
 * Ghi nhận một ngày có học. Trả về tiến độ mới và cờ `streakGrew` để giao diện
 * biết có nên nhấp ngọn lửa một nhịp hay không.
 */
export function recordStudyDay(p: Progress): { next: Progress; streakGrew: boolean } {
  const d = today();
  if (p.lastDay === d) return { next: p, streakGrew: false };

  const gap = p.lastDay ? daysBetween(p.lastDay, d) : Infinity;
  const streak = gap === 1 ? p.streak + 1 : 1;
  return { next: { ...p, streak, lastDay: d }, streakGrew: true };
}

export function addXp(p: Progress, amount: number): Progress {
  return { ...p, xp: p.xp + amount };
}

/**
 * Ghi đè cache bằng số THẬT server trả về (TurnResult.xp / EndResult.xp /
 * Scoreboard.xp — bảng student_xp, hàm award_xp). Từ khi server trả XP, đây là
 * đường cập nhật CHÍNH; addXp/grant chỉ còn là fallback khi function cũ chưa
 * kèm xp trong response.
 * `lastDay` truyền khi đồng bộ nguội (scoreboard); bỏ trống = vừa học xong hôm nay.
 */
export function syncFromServer(xp: {
  total: number;
  streak: number;
  lastDay?: string | null;
}): Progress {
  const next: Progress = { xp: xp.total, streak: xp.streak, lastDay: xp.lastDay ?? today() };
  save(next);
  return next;
}

/** Các node đã thành thạo, lưu tạm ở máy cho tới khi có endpoint lộ trình. */
const MASTERED_KEY = "va-tutor-mastered";

export function loadMastered(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const k = keyFor(MASTERED_KEY);
    return k ? (JSON.parse(window.localStorage.getItem(k) ?? "[]") as string[]) : [];
  } catch {
    return [];
  }
}

export function saveMastered(keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    const k = keyFor(MASTERED_KEY);
    if (k) window.localStorage.setItem(k, JSON.stringify(keys));
  } catch {
    /* localStorage bị chặn — tiến độ mastery thật vẫn nằm ở server */
  }
}

/** Hôm nay đã học chưa — cho nhiệm vụ ngày. */
export function studiedToday(p: Progress): boolean {
  return p.lastDay === today();
}

/**
 * Hạng nỗ lực — đặt tên theo thứ hạng trong lớp, KHÔNG theo năng lực.
 * Ngưỡng dựa trên XP tích luỹ, thứ mà mọi học sinh đều tăng được bằng cách quay lại.
 *
 * ⚠️ Đây là PHÉP CHIẾU HIỂN THỊ từ XP cache ở máy (Đồng/Bạc/Vàng/Ngọc), KHÔNG
 * phải hạng xếp trong lớp/khối. Hạng "so kè" giữa các học sinh là số THẬT từ
 * server: `getScoreboard().effort.rank`. Đừng dùng `leagueOf` để phân định
 * thắng/thua giữa người học — chỉ để tô một huy hiệu tiến độ cá nhân.
 */
export const LEAGUES = [
  { name: "Đồng", min: 0 },
  { name: "Bạc", min: 300 },
  { name: "Vàng", min: 900 },
  { name: "Ngọc", min: 2000 },
] as const;

export function leagueOf(xp: number): { name: string; next: number | null; progress: number } {
  let i = 0;
  while (i + 1 < LEAGUES.length && xp >= LEAGUES[i + 1]!.min) i++;
  const cur = LEAGUES[i]!;
  const nxt = LEAGUES[i + 1] ?? null;
  const progress = nxt ? (xp - cur.min) / (nxt.min - cur.min) : 1;
  return { name: cur.name, next: nxt?.min ?? null, progress };
}
