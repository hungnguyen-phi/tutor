// Sinh migration 0016_seed_rbac.sql từ CHÍNH dữ liệu RBAC trong
// packages/db/src/seed-rbac.ts (roles/permissions/grants) + tenant Trường Việt
// Anh. Chạy: node scripts/gen-rbac-migration.mjs  (chỉ tạo file, không ghi DB).
// Mục đích: catalog RBAC thành migration tracked cho nhà mới, không hardcode SQL tay.
import fs from "node:fs";

const ROLES = [
  ["student", "Học sinh"], ["parent", "Phụ huynh"], ["teacher", "Giáo viên bộ môn"],
  ["homeroom_teacher", "Giáo viên chủ nhiệm"], ["subject_lead", "Tổ trưởng chuyên môn"],
  ["counselor", "Cố vấn tâm lý"], ["content_author", "Đội nội dung — soạn"],
  ["content_reviewer", "Đội nội dung — duyệt"], ["campus_admin", "Quản lý cơ sở"],
  ["leadership", "Ban giám hiệu"], ["dpo", "Cán bộ bảo vệ dữ liệu"], ["admin", "Admin hệ thống"],
];
const PERMS = {
  "org:tenant:read": "org", "org:tenant:configure": "org", "org:campus:manage": "org",
  "org:class:manage": "org", "iam:user:manage": "iam", "iam:role:grant": "iam", "iam:permission:simulate": "iam",
  "privacy:consent:read": "privacy", "privacy:consent:grant": "privacy", "privacy:consent:withdraw": "privacy",
  "privacy:dsar:fulfill": "privacy", "privacy:dpia:manage": "privacy",
  "content:kg:read": "content", "content:node:write": "content", "content:question:read": "content",
  "content:question:write": "content", "content:ladder:write": "content", "content:review:approve": "content",
  "content:question:retire": "content",
  "learn:tutor:chat": "learn", "learn:session:read_own": "learn", "learn:session:read_scope": "learn",
  "learn:mastery:read_own": "learn", "learn:mastery:read_scope": "learn", "learn:attempt:read_scope": "learn",
  "config:tenant:update": "config", "config:subject:update": "config", "config:class:update": "config",
  "config:student:update": "config", "config:feature_flag:update": "config",
  "assess:summative:grade": "assess", "intervene:manage": "assess", "live:classroom:run": "assess",
  "report:student:read": "report", "report:class:read": "report", "report:school:read": "report", "report:parent:read": "report",
  "safety:flag:read": "safety", "safety:flag:verify": "safety", "safety:flag:resolve": "safety", "wellbeing:context:read": "safety",
  "ai:prompt:manage": "ai", "ai:model:configure": "ai", "ai:budget:read": "ai", "ai:eval:run": "ai",
  "audit:log:read": "audit", "ops:manage": "ops", "saas:manage": "saas",
};
const ALL = Object.keys(PERMS);
const GRANTS = {
  student: ["learn:tutor:chat", "learn:session:read_own", "learn:mastery:read_own", "privacy:consent:read"],
  parent: ["report:parent:read", "privacy:consent:read", "privacy:consent:grant", "privacy:consent:withdraw"],
  teacher: ["content:kg:read", "content:question:read", "content:question:write", "content:node:write", "content:ladder:write", "content:review:approve", "learn:session:read_scope", "learn:mastery:read_scope", "learn:attempt:read_scope", "config:class:update", "config:student:update", "assess:summative:grade", "intervene:manage", "live:classroom:run", "report:student:read", "report:class:read", "safety:flag:read"],
  homeroom_teacher: ["learn:session:read_scope", "learn:mastery:read_scope", "learn:attempt:read_scope", "intervene:manage", "report:student:read", "report:class:read", "safety:flag:read", "config:student:update"],
  subject_lead: ["content:kg:read", "content:question:read", "content:question:write", "content:node:write", "content:ladder:write", "content:review:approve", "content:question:retire", "config:subject:update", "learn:mastery:read_scope", "report:class:read", "ai:prompt:manage", "ai:budget:read"],
  counselor: ["safety:flag:read", "safety:flag:verify", "safety:flag:resolve", "wellbeing:context:read"],
  content_author: ["content:kg:read", "content:node:write", "content:question:write", "content:ladder:write"],
  content_reviewer: ["content:kg:read", "content:question:read", "content:review:approve", "content:question:retire"],
  campus_admin: ["org:campus:manage", "org:class:manage", "iam:user:manage", "config:tenant:update", "report:school:read", "audit:log:read"],
  leadership: ["report:school:read", "report:class:read", "ai:budget:read"],
  dpo: ["privacy:consent:read", "privacy:dsar:fulfill", "privacy:dpia:manage", "audit:log:read"],
  admin: ALL,
};

const q = (s) => s.replace(/'/g, "''");
let sql = `-- ─────────────────────────────────────────────────────────────────────────────
-- 0016 — SEED RBAC catalog (roles/permissions/grants) + tenant Trường Việt Anh.
-- SINH TỰ ĐỘNG bởi scripts/gen-rbac-migration.mjs từ packages/db/src/seed-rbac.ts
-- (nguồn chân lý). Đưa catalog RBAC vào migration tracked cho nhà mới. Idempotent.
-- KHÔNG seed người dùng thật ở đây (SSO/roster lo); acc demo do seed:demo.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tenant (một trường)
insert into public.tenants (name, slug) values ('Trường Việt Anh', 'viet-anh')
  on conflict (slug) do nothing;

-- Roles
`;
for (const [k, l] of ROLES) sql += `insert into public.roles (key, label) values ('${q(k)}', '${q(l)}') on conflict (key) do update set label = excluded.label;\n`;
sql += `\n-- Permissions\n`;
for (const [k, d] of Object.entries(PERMS)) sql += `insert into public.permissions (key, domain) values ('${q(k)}', '${q(d)}') on conflict (key) do update set domain = excluded.domain;\n`;
sql += `\n-- Role → permission grants (xoá sạch rồi cấp lại để khớp nguồn)\n`;
for (const [role, perms] of Object.entries(GRANTS)) {
  sql += `delete from public.role_permissions where role_key = '${q(role)}';\n`;
  for (const p of perms) sql += `insert into public.role_permissions (role_key, perm_key) values ('${q(role)}', '${q(p)}') on conflict do nothing;\n`;
}

fs.writeFileSync("supabase/migrations/0016_seed_rbac.sql", sql);
console.log(`✓ Sinh 0016_seed_rbac.sql — ${ROLES.length} roles, ${Object.keys(PERMS).length} permissions, ${Object.values(GRANTS).reduce((n, a) => n + a.length, 0)} grants`);
