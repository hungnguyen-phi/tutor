import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Service-role client (bypasses RLS — trusted server writes only). */
export function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** The seed tenant slug for the pilot. */
export const PILOT_TENANT_SLUG = "viet-anh";
