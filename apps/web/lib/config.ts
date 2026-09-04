// Public client config. The anon/publishable key is browser-safe by design.
// `||` (không `??`): env RỖNG "" (vd build-arg Docker để trống) cũng phải rơi về
// fallback, nếu không createClient("") ném "supabaseUrl is required" lúc prerender.
const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://oonuzgnfoypibrssvmrt.supabase.co";

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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_A98gX2XKPU6IMp384GBvyw_WdlTNPW8";
export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// ── Cấu hình đăng nhập ────────────────────────────────────────────────────────
// MIỀN EMAIL TRƯỜNG cho Google SSO (chủ dự án chốt 04/09): HAI miền —
// truongvietanh.com (giáo viên/nhân viên) và student.truongvietanh.com (học
// sinh). Có thể là một Workspace với miền phụ hoặc hai Workspace — chưa chắc,
// nên KHÔNG dùng tham số `hd` (chỉ khoá được một miền, và client sửa được);
// chốt thật nằm ở trigger `handle_new_user` phía DB. Danh sách này chỉ để
// nói cho học sinh biết SỚM (ngay sau khi Google trả về) rằng tài khoản
// không phải của trường, thay vì để em vào rồi bị chặn ở cổng vai.
export const SCHOOL_EMAIL_DOMAINS: readonly string[] =
  (process.env.NEXT_PUBLIC_SCHOOL_EMAIL_DOMAINS ?? "truongvietanh.com,student.truongvietanh.com")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const SCHOOL_EMAIL_DOMAIN = SCHOOL_EMAIL_DOMAINS[0] ?? "truongvietanh.com";
export const isSchoolEmail = (email: string | null | undefined): boolean => {
  const d = (email ?? "").toLowerCase().split("@")[1] ?? "";
  return SCHOOL_EMAIL_DOMAINS.includes(d);
};

// SSO-ONLY (chủ dự án chốt 04/09 khi bật Google Workspace): đăng nhập mật
// khẩu và dải "tài khoản thử" MẶC ĐỊNH TẮT trên production. Dev/preview muốn
// dùng acc demo thì đặt NEXT_PUBLIC_PILOT_PASSWORD_LOGIN=true (và
// NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS=true) lúc build. Đảo mặc định so với trước
// (trước là bật, tắt bằng =false) — cố ý: quên đặt biến thì phía an toàn thắng.
export const PILOT_PASSWORD_LOGIN =
  process.env.NEXT_PUBLIC_PILOT_PASSWORD_LOGIN === "true";

export const PILOT_DEMO_ACCOUNTS =
  PILOT_PASSWORD_LOGIN && process.env.NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS === "true";
