/**
 * Tuỳ chọn CÁ NHÂN trên máy (Cài đặt): giao diện sáng/tối, cỡ chữ, giảm
 * chuyển động, avatar, tên hiển thị.
 *
 * Trung thực dữ liệu (PRODUCT.md): đây là TUỲ CHỌN THIẾT BỊ — lưu localStorage
 * là đúng bản chất (như bookmark của trình duyệt), không phải "số liệu học
 * tập giả". Riêng tên: tên CHÍNH THỨC nằm ở profiles (server); tên hiển thị
 * cục bộ chỉ dùng khi trường chưa mở quyền tự đổi (SettingsView nói rõ).
 *
 * html nhận data-theme / data-font / data-motion — CSS token phản ứng theo.
 * layout.tsx có script bootstrap đọc localStorage TRƯỚC khi vẽ để không nháy
 * sáng→tối; các key ở đây phải khớp script đó.
 */

export type ThemeMode = "light" | "dark" | "system";
export type FontScale = "sm" | "md" | "lg";
export type AvatarKind = "initial" | "lion";
export type AvatarTone = "gold" | "navy" | "sky" | "ok" | "mane";

const KEYS = {
  theme: "va-theme",
  font: "va-font",
  motion: "va-motion",
  avatarKind: "va-avatar-kind",
  avatarTone: "va-avatar-tone",
  displayName: "va-display-name",
  presence: "va-presence",
} as const;

const get = (k: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* chế độ ẩn danh — tuỳ chọn chỉ sống trong phiên */
  }
};

// ── Giao diện sáng/tối ────────────────────────────────────────────────────
export function getTheme(): ThemeMode {
  const v = get(KEYS.theme);
  return v === "light" || v === "dark" ? v : "system";
}
export function setTheme(mode: ThemeMode) {
  set(KEYS.theme, mode === "system" ? null : mode);
  applyToHtml();
}

// ── Cỡ chữ ────────────────────────────────────────────────────────────────
export function getFont(): FontScale {
  const v = get(KEYS.font);
  return v === "sm" || v === "lg" ? v : "md";
}
export function setFont(s: FontScale) {
  set(KEYS.font, s === "md" ? null : s);
  applyToHtml();
}

// ── Giảm chuyển động (bổ sung cho prefers-reduced-motion của hệ điều hành) ─
export function getReduceMotion(): boolean {
  return get(KEYS.motion) === "reduce";
}
export function setReduceMotion(on: boolean) {
  set(KEYS.motion, on ? "reduce" : null);
  applyToHtml();
}

// ── Avatar (đĩa màu + chữ cái đầu, hoặc sư tử) ────────────────────────────
export function getAvatar(): { kind: AvatarKind; tone: AvatarTone } {
  const kind = get(KEYS.avatarKind) === "lion" ? "lion" : "initial";
  const t = get(KEYS.avatarTone);
  const tone: AvatarTone =
    t === "navy" || t === "sky" || t === "ok" || t === "mane" ? t : "gold";
  return { kind, tone };
}
export function setAvatar(kind: AvatarKind, tone: AvatarTone) {
  set(KEYS.avatarKind, kind === "initial" ? null : kind);
  set(KEYS.avatarTone, tone === "gold" ? null : tone);
}

// ── Tên hiển thị cục bộ (fallback khi server chưa cho tự đổi tên) ─────────
export function getDisplayName(): string | null {
  const v = get(KEYS.displayName);
  return v && v.trim() ? v.trim() : null;
}
export function setDisplayName(name: string | null) {
  set(KEYS.displayName, name && name.trim() ? name.trim() : null);
}
/** Tên để CHÀO/hiển thị: override cục bộ thắng tên server (nếu có). */
export function displayNameOf(serverName?: string | null): string | null {
  return getDisplayName() ?? (serverName?.trim() || null);
}

// ── Học cùng nhau (presence) — OPT-IN, mặc định TẮT ──────────────────────────
// Riêng tư cho trẻ vị thành niên: chỉ khi BẬT thì mới hiện mình đang online +
// thấy bạn cùng khối đang học. Tắt = không track, không thấy ai (mutual).
export function getPresenceOptIn(): boolean {
  return get(KEYS.presence) === "on";
}
export function setPresenceOptIn(on: boolean) {
  set(KEYS.presence, on ? "on" : null);
}

/** Đẩy tuỳ chọn lên <html> — gọi sau mỗi lần đổi và lúc mount (đề phòng
 *  script bootstrap bị chặn). data rỗng thì GỠ thuộc tính (về "theo máy"). */
export function applyToHtml() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const theme = getTheme();
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
  const font = getFont();
  if (font === "md") delete el.dataset.font;
  else el.dataset.font = font;
  if (getReduceMotion()) el.dataset.motion = "reduce";
  else delete el.dataset.motion;
}
