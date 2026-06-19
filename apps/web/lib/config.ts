// Public client config. The anon/publishable key is browser-safe by design.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://uksbvlkhcyhnpfamducc.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_ZLDlbkDCmpLDgsOQnfsG3w_lbavhh7S";
export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// Demo mode: a fixed seeded student until Auth + consent (M4) is wired.
export const DEMO_STUDENT_ID = "00000000-0000-4000-8000-000000000001";
