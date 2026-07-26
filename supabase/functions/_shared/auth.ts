// M4 auth: verify the caller's JWT and load their role + permissions. Identity
// comes from the token (auth.uid()), NEVER from client-supplied ids.
import { admin } from "./supa.ts";
import { jwtVerify } from "npm:jose@5";

/**
 * Lấy user id (claim `sub`) từ JWT bằng GIẢI MÃ TẠI CHỖ — KHÔNG gọi mạng.
 * An toàn vì mọi function deploy với verify_jwt=true: cổng Supabase đã kiểm
 * chữ ký + hạn token TRƯỚC khi gọi function, nên payload chắc chắn hợp lệ.
 * Nhờ vậy bỏ được cú getUser() (một vòng mạng tới máy chủ auth ~200-400ms).
 */
function subFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: string; exp?: number };
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * PHÒNG THỦ THEO CHIỀU SÂU: nếu có secret SUPABASE_JWT_SECRET trong env thì
 * XÁC MINH CHỮ KÝ HS256 (jose) + kiểm exp/aud='authenticated'/iss TRƯỚC KHI tin
 * `sub`. Đây là lớp phòng khi cổng lỡ tắt verify_jwt (cấu hình sai) — không để
 * token giả/không ký lọt qua. Không có secret → giữ subFromJwt như cũ và DỰA
 * vào cổng (mảng F phải bật verify_jwt=true để cổng đã kiểm chữ ký + hạn).
 */
async function subFromJwtVerified(token: string): Promise<string | null> {
  const secret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) return subFromJwt(token);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const opts: { algorithms: string[]; audience: string; issuer?: string } = {
      algorithms: ["HS256"], // Supabase ký access token bằng HS256 + JWT secret
      audience: "authenticated",
    };
    // iss của Supabase là `${SUPABASE_URL}/auth/v1` — chỉ ràng buộc khi biết url.
    if (url) opts.issuer = `${url}/auth/v1`;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), opts);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Chữ ký sai / hết hạn / aud|iss sai → từ chối dứt khoát.
    return null;
  }
}

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

  const userId = await subFromJwtVerified(token);
  if (!userId) return null;

  const supa = admin();
  // profiles + user_roles độc lập → chạy SONG SONG (bớt một vòng mạng).
  const [{ data: prof }, { data: extra }] = await Promise.all([
    supa.from("profiles").select("role, tenant_id, full_name, grade, locale").eq("id", userId).single(),
    supa.from("user_roles").select("role_key").eq("user_id", userId),
  ]);
  if (!prof) return null;

  // Precise RBAC roles live in user_roles; union them with the base profile role.
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

/**
 * Active consent check for a purpose (PDPL: withdraw → stop).
 * ĐỒNG THUẬN KÉP (K3): bản ghi bật `dual_consent` (trẻ ≥7 — PDPL yêu cầu cả trẻ
 * lẫn người giám hộ) chỉ hợp lệ khi CÓ ĐỦ ưng thuận của trẻ (`student_assent`)
 * LẪN đồng ý của người giám hộ (`guardian_consent_by`). Bản ghi không bật
 * dual_consent (vd HS đủ tuổi tự quyết) chỉ cần `status = active`.
 */
export async function hasActiveConsent(studentId: string, purpose = "ai_tutoring"): Promise<boolean> {
  // CỜ PILOT — cổng đồng thuận PDPL TẮT MẶC ĐỊNH cho giai đoạn pilot/test nội bộ
  // (chủ dự án quyết định 2026-07-25). ⚠️ TRƯỚC KHI CHO HỌC SINH THẬT: đặt secret
  //   supabase secrets set PILOT_SKIP_CONSENT=false --project-ref <ref>
  // để KHÔI PHỤC đồng thuận kép (cổng bất biến PDPL theo CLAUDE.md — bảo vệ trẻ em).
  if (Deno.env.get("PILOT_SKIP_CONSENT") !== "false") return true;
  const supa = admin();
  const { data } = await supa
    .from("consent_records")
    .select("status, dual_consent, student_assent, guardian_consent_by")
    .eq("student_id", studentId)
    .eq("purpose", purpose)
    .maybeSingle();
  if (!data || data.status !== "active") return false;
  if (data.dual_consent) {
    return data.student_assent === true && data.guardian_consent_by != null;
  }
  return true;
}
