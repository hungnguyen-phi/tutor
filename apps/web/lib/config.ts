// Public client config. The anon/publishable key is browser-safe by design.
const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://gxbxsdhvtwtjkfygetzb.supabase.co";

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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_BYthnvkNq8azqs_Xr-P_8w_itKKV-UQ";
export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// Demo mode: a fixed seeded student until Auth + consent (M4) is wired.
export const DEMO_STUDENT_ID = "00000000-0000-4000-8000-000000000001";
