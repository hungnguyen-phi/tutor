// Public client config. The anon/publishable key is browser-safe by design.
const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://oonuzgnfoypibrssvmrt.supabase.co";

/**
 * URL the Supabase client (auth + edge functions + REST) talks to.
 *
 * PROD: the real Supabase origin, hit directly (its origin is whitelisted).
 *
 * DEV: `${window.origin}/__sb`, a SAME-ORIGIN path that the Next dev server
 * proxies to Supabase (see next.config.mjs `/__sb`). Same-origin means no CORS
 * preflight ever runs, so the app works on ANY localhost port or tunnel URL
 * without touching the backend CORS allowlist. Guarded by `window` so server
 * prerender (no window) keeps the direct origin — safe, since no Supabase call
 * happens during static prerender.
 */
function resolveSupabaseUrl(): string {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    return `${window.location.origin}/__sb`;
  }
  return SUPABASE_ORIGIN;
}

export const SUPABASE_URL = resolveSupabaseUrl();
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_A98gX2XKPU6IMp384GBvyw_WdlTNPW8";
export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// ── Cấu hình đăng nhập ────────────────────────────────────────────────────────
// Miền email trường cho Google SSO (tham số `hd` khoá đúng Workspace của trường).
export const SCHOOL_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_SCHOOL_EMAIL_DOMAIN ?? "vietanh.edu.vn";

// Cờ PILOT: cho đăng nhập email/mật khẩu (tài khoản admin cấp). Khi SSO đã cắm
// và muốn ép SSO-only, đặt NEXT_PUBLIC_PILOT_PASSWORD_LOGIN=false để ẩn.
// TẠM BẬT vì SSO chưa cấu hình (chủ dự án: "cứ dùng acc demo thôi").
export const PILOT_PASSWORD_LOGIN =
  (process.env.NEXT_PUBLIC_PILOT_PASSWORD_LOGIN ?? "true") !== "false";

// Nút "tài khoản thử" (điền nhanh) — CHỈ dev/pilot, KHÔNG bao giờ để trên
// production thật. Đặt NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS=false để tắt.
export const PILOT_DEMO_ACCOUNTS =
  (process.env.NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS ?? "true") !== "false";
