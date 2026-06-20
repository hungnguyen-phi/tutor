// M4 auth: verify the caller's JWT and load their role + permissions. Identity
// comes from the token (auth.uid()), NEVER from client-supplied ids.
import { admin } from "./supa.ts";

export interface AuthCtx {
  userId: string;
  role: string;
  tenantId: string;
  perms: Set<string>;
  fullName: string | null;
  grade: string | null;
  locale: string;
}

export async function authenticate(req: Request): Promise<AuthCtx | null> {
  const authz = req.headers.get("Authorization") ?? "";
  const token = authz.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supa = admin();
  const { data: u, error } = await supa.auth.getUser(token);
  if (error || !u?.user) return null;
  const userId = u.user.id;

  const { data: prof } = await supa
    .from("profiles")
    .select("role, tenant_id, full_name, grade, locale")
    .eq("id", userId)
    .single();
  if (!prof) return null;

  const { data: perms } = await supa
    .from("role_permissions")
    .select("perm_key")
    .eq("role_key", prof.role);

  return {
    userId,
    role: prof.role,
    tenantId: prof.tenant_id,
    fullName: prof.full_name,
    grade: prof.grade,
    locale: prof.locale ?? "vi",
    perms: new Set((perms ?? []).map((p) => p.perm_key)),
  };
}

export const can = (ctx: AuthCtx, perm: string) => ctx.perms.has(perm);

/** Active consent check for a purpose (PDPL: withdraw → stop). */
export async function hasActiveConsent(studentId: string, purpose = "ai_tutoring"): Promise<boolean> {
  const supa = admin();
  const { data } = await supa
    .from("consent_records")
    .select("status")
    .eq("student_id", studentId)
    .eq("purpose", purpose)
    .maybeSingle();
  return data?.status === "active";
}
