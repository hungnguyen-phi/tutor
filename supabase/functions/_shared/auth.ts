// M4 auth: verify the caller's JWT and load their role + permissions. Identity
// comes from the token (auth.uid()), NEVER from client-supplied ids.
import { admin } from "./supa.ts";

export interface AuthCtx {
  userId: string;
  role: string; // base profiles.role (student/teacher/parent/admin/leadership)
  roles: Set<string>; // base role ∪ extra RBAC roles from user_roles
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

  // Precise RBAC roles live in user_roles; union them with the base profile role.
  const { data: extra } = await supa.from("user_roles").select("role_key").eq("user_id", userId);
  const roles = new Set<string>([prof.role, ...((extra ?? []).map((r) => r.role_key))]);

  const { data: perms } = await supa
    .from("role_permissions")
    .select("perm_key")
    .in("role_key", [...roles]);

  return {
    userId,
    role: prof.role,
    roles,
    tenantId: prof.tenant_id,
    fullName: prof.full_name,
    grade: prof.grade,
    locale: prof.locale ?? "vi",
    perms: new Set((perms ?? []).map((p) => p.perm_key)),
  };
}

export const can = (ctx: AuthCtx, perm: string) => ctx.perms.has(perm);
export const hasRole = (ctx: AuthCtx, ...keys: string[]) => keys.some((k) => ctx.roles.has(k));

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
