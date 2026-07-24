// Seed acc demo cho DB MỚI — tạo user qua Auth Admin API (service_role) + set
// vai/hồ sơ qua Management API (trỏ project hiện tại theo .env). Tự chứa, KHÔNG
// dùng pg pooler (tránh config stale). Idempotent.  node scripts/seed-demo.mjs
import fs from "node:fs";
const E = {};
for (const l of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  if (!l || l.startsWith("#") || !l.includes("=")) continue;
  const i = l.indexOf("="); E[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const URL = E.SUPABASE_URL, SERVICE = E.SUPABASE_SERVICE_ROLE_KEY, TOKEN = E.SUPABASE_ACCESS_TOKEN;
const REF = (URL || "").replace(/^https:\/\/([^.]+)\.supabase\.co.*$/, "$1");
const PW = "VietAnh@2026";
// email, profiles.role (enum), RBAC role phụ (user_roles | null), tên
const USERS = [
  ["hs1@vietanh.edu.vn", "student", null, "Nguyễn An"],
  ["gv1@vietanh.edu.vn", "teacher", "homeroom_teacher", "Cô Trần Thu"],
  ["ph1@vietanh.edu.vn", "parent", null, "Phụ huynh An"],
  ["admin@vietanh.edu.vn", "admin", "admin", "Quản trị hệ thống"],
];

async function auth(path, init) {
  return fetch(`${URL}/auth/v1${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
}
async function ensureUser(email) {
  const r = await auth("/admin/users", { method: "POST", body: JSON.stringify({ email, password: PW, email_confirm: true }) });
  if (r.ok) return (await r.json()).id;
  const list = await (await auth("/admin/users?per_page=500")).json();
  const f = (list.users ?? []).find((u) => u.email === email);
  if (!f) throw new Error(`không tạo/tìm được ${email}: ${await r.text()}`);
  return f.id;
}
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const b = await r.json(); if (!r.ok) throw new Error(JSON.stringify(b).slice(0, 200)); return b;
}
const q = (s) => s.replace(/'/g, "''");

async function main() {
  if (!URL || !SERVICE || !TOKEN) { console.error("Thiếu SUPABASE_URL / SERVICE_ROLE_KEY / ACCESS_TOKEN"); process.exit(1); }
  const [{ id: tenant }] = await sql("select id from tenants where slug='viet-anh'");
  for (const [email, role, extra, name] of USERS) {
    const id = await ensureUser(email);
    await sql(`insert into profiles (id, tenant_id, role, full_name, locale) values ('${id}','${tenant}','${role}'::role,'${q(name)}','vi') on conflict (id) do update set role=excluded.role, full_name=excluded.full_name, tenant_id=excluded.tenant_id`);
    await sql(`delete from user_roles where user_id='${id}'`);
    if (extra) await sql(`insert into user_roles (user_id, role_key, tenant_id) values ('${id}','${extra}','${tenant}')`);
    console.log(`· ${email} → ${role}${extra ? " + " + extra : ""}`);
  }
  console.log(`\n✓ Acc demo sẵn (mật khẩu ${PW}).`);
}
main().catch((e) => { console.error("✗", e.message || e); process.exit(1); });
