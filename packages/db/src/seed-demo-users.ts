/**
 * Demo login accounts for EVERY role, so all role UIs are reviewable.
 * Base profiles.role stays within the 5-value enum; the precise RBAC role is
 * attached via user_roles (authenticate() unions both). Idempotent.
 * Run: pnpm --filter @tutor/db seed:demo
 */
import postgres from "postgres";

const URL = process.env.SUPABASE_URL ?? "https://uksbvlkhcyhnpfamducc.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pw = process.env.SUPABASE_DB_PASSWORD;
if (!SERVICE || !pw) { console.error("✗ Need SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD."); process.exit(1); }
const sql = postgres({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER, password: pw, database: "postgres", ssl: "require", prepare: false, max: 1,
});

const PASSWORD = "VietAnh@2026";
// email, base profiles.role, extra RBAC role (user_roles), display name
const USERS: [string, string, string | null, string][] = [
  ["hs2@vietanh.edu.vn", "student", null, "Lê Minh"],
  ["tt@vietanh.edu.vn", "teacher", "subject_lead", "Thầy Phạm Văn Nam"],
  ["cvtl@vietanh.edu.vn", "teacher", "counselor", "Cô Đỗ Thị Hà"],
  ["dpo@vietanh.edu.vn", "teacher", "dpo", "Chị Nguyễn Thị Lan"],
  ["bgh@vietanh.edu.vn", "leadership", "leadership", "Thầy Hiệu trưởng"],
  ["admin@vietanh.edu.vn", "admin", "admin", "Quản trị hệ thống"],
];

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${URL}/auth/v1${path}`, { ...init, headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
}
async function ensureUser(email: string): Promise<string> {
  const res = await adminFetch("/admin/users", { method: "POST", body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }) });
  if (res.ok) return (await res.json()).id;
  const list = await adminFetch(`/admin/users?per_page=300`);
  const found = ((await list.json()).users ?? []).find((u: { email: string }) => u.email === email);
  if (!found) throw new Error(`cannot create/find ${email}: ${await res.text()}`);
  return found.id;
}

try {
  const [tenant] = await sql<{ id: string }[]>`select id from tenants where slug='viet-anh'`;
  const ids: Record<string, string> = {};
  for (const [email, role, extra, name] of USERS) {
    const id = await ensureUser(email);
    ids[email] = id;
    await sql`insert into profiles (id, tenant_id, role, full_name, locale)
      values (${id}, ${tenant.id}, ${role}::role, ${name}, 'vi')
      on conflict (id) do update set role=excluded.role, full_name=excluded.full_name`;
    await sql`delete from user_roles where user_id=${id}`;
    if (extra) await sql`insert into user_roles (user_id, role_key) values (${id}, ${extra})`;
    console.log(`· ${email} → ${role}${extra ? " + " + extra : ""}`);
  }
  // gv1 (coach) gets the homeroom_teacher RBAC role too.
  const [gv1] = await sql<{ id: string }[]>`
    select p.id from profiles p join auth.users u on u.id=p.id where u.email='gv1@vietanh.edu.vn'`;
  if (gv1) { await sql`delete from user_roles where user_id=${gv1.id}`; await sql`insert into user_roles (user_id, role_key) values (${gv1.id}, 'homeroom_teacher')`; }

  // Promote the buddy: point An's buddy link at the real hs2 login (drop placeholder).
  const [an] = await sql<{ id: string }[]>`select p.id from profiles p join auth.users u on u.id=p.id where u.email='hs1@vietanh.edu.vn'`;
  const minh = ids["hs2@vietanh.edu.vn"];
  if (an && minh) {
    await sql`update coaching_links set mentor_id=${minh} where student_id=${an.id} and kind='buddy'`;
    await sql`delete from coaching_links where mentor_id='00000000-0000-4000-8000-0000000000b2'`;
    await sql`delete from profiles where id='00000000-0000-4000-8000-0000000000b2'`;
  }

  console.log(`\n✓ Demo role accounts ready (password ${PASSWORD}). Buddy = hs2@vietanh.edu.vn.`);
} catch (e) {
  console.error("✗ seed-demo-users failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally { await sql.end(); }
