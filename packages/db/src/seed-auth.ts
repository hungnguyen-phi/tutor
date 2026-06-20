/**
 * M4 demo auth users — creates Supabase Auth users + linked profiles, a teacher
 * assignment, a guardian link, and active consent for the student.
 * Idempotent. Run: pnpm --filter @tutor/db seed:auth
 */
import postgres from "postgres";

const URL = process.env.SUPABASE_URL ?? "https://uksbvlkhcyhnpfamducc.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pw = process.env.SUPABASE_DB_PASSWORD;
if (!SERVICE || !pw) {
  console.error("✗ Need SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD.");
  process.exit(1);
}
const sql = postgres({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER,
  password: pw,
  database: "postgres",
  ssl: "require",
  prepare: false,
  max: 1,
});

const PASSWORD = "VietAnh@2026";
const USERS = [
  { email: "hs1@vietanh.edu.vn", role: "student", name: "Nguyễn Văn An", grade: "10" },
  { email: "gv1@vietanh.edu.vn", role: "teacher", name: "Cô Trần Thị Bình", grade: null },
  { email: "ph1@vietanh.edu.vn", role: "parent", name: "Phụ huynh em An", grade: null },
];

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${URL}/auth/v1${path}`, {
    ...init,
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function ensureUser(email: string): Promise<string> {
  // Try create; if already exists, look it up.
  const res = await adminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (res.ok) {
    const u = await res.json();
    return u.id;
  }
  // Already registered → find by listing (filter client-side).
  const list = await adminFetch(`/admin/users?per_page=200`);
  const data = await list.json();
  const found = (data.users ?? []).find((u: { email: string }) => u.email === email);
  if (!found) throw new Error(`could not create or find user ${email}: ${await res.text()}`);
  return found.id;
}

try {
  const [tenant] = await sql<{ id: string }[]>`select id from tenants where slug='viet-anh'`;
  const ids: Record<string, string> = {};

  for (const u of USERS) {
    const id = await ensureUser(u.email);
    ids[u.role] = id;
    await sql`
      insert into profiles (id, tenant_id, role, full_name, grade, locale)
      values (${id}, ${tenant.id}, ${u.role}::role, ${u.name}, ${u.grade}, 'vi')
      on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, grade = excluded.grade`;
    console.log(`· ${u.role}: ${u.email} → ${id.slice(0, 8)}`);
  }

  // Teacher teaches both pilot subjects.
  await sql`delete from teacher_assignments where teacher_id = ${ids.teacher}`;
  for (const subj of ["Toan", "Anh"]) {
    await sql`insert into teacher_assignments (tenant_id, teacher_id, subject, class_id, is_homeroom)
      values (${tenant.id}, ${ids.teacher}, ${subj}, 'C10A', 'true')`;
  }
  // Parent ↔ student guardian link.
  await sql`insert into guardian_links (tenant_id, guardian_id, student_id)
    values (${tenant.id}, ${ids.parent}, ${ids.student})
    on conflict (guardian_id, student_id) do nothing`;
  // Active dual consent for the student (so the tutor consent gate passes).
  await sql`insert into consent_records (tenant_id, student_id, purpose, dual_consent, guardian_consent_by, student_assent, status)
    values (${tenant.id}, ${ids.student}, 'ai_tutoring', true, ${ids.parent}, true, 'active')
    on conflict (student_id, purpose) do update set status='active', dual_consent=true`;

  console.log(`\n✓ Auth users ready. Password for all: ${PASSWORD}`);
  console.log("  student hs1@vietanh.edu.vn · teacher gv1@vietanh.edu.vn · parent ph1@vietanh.edu.vn");
} catch (e) {
  console.error("✗ seed-auth failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
