/**
 * M4 RBAC catalog seed — roles, permissions, role→permission grants.
 * Idempotent. Run: pnpm --filter @tutor/db seed:rbac
 */
import postgres from "postgres";

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF ?? "uksbvlkhcyhnpfamducc";
if (!pw && !process.env.DATABASE_URL) {
  console.error("✗ Set SUPABASE_DB_PASSWORD or DATABASE_URL.");
  process.exit(1);
}
const sql = pw
  ? postgres({
      host: process.env.SUPABASE_DB_HOST ?? `db.${ref}.supabase.co`,
      port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
      user: process.env.SUPABASE_DB_USER ?? "postgres",
      password: pw,
      database: "postgres",
      ssl: "require",
      prepare: false,
      max: 1,
    })
  : postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const ROLES: Array<[string, string]> = [
  ["student", "Học sinh"],
  ["parent", "Phụ huynh"],
  ["teacher", "Giáo viên bộ môn"],
  ["homeroom_teacher", "Giáo viên chủ nhiệm"],
  ["subject_lead", "Tổ trưởng chuyên môn"],
  ["counselor", "Cố vấn tâm lý"],
  ["content_author", "Đội nội dung — soạn"],
  ["content_reviewer", "Đội nội dung — duyệt"],
  ["campus_admin", "Quản lý cơ sở"],
  ["leadership", "Ban giám hiệu"],
  ["dpo", "Cán bộ bảo vệ dữ liệu"],
  ["admin", "Admin hệ thống"],
];

// key → domain
const PERMS: Record<string, string> = {
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

const GRANTS: Record<string, string[]> = {
  student: ["learn:tutor:chat", "learn:session:read_own", "learn:mastery:read_own", "privacy:consent:read"],
  parent: ["report:parent:read", "privacy:consent:read", "privacy:consent:grant", "privacy:consent:withdraw"],
  teacher: [
    "content:kg:read", "content:question:read", "content:question:write", "content:node:write", "content:ladder:write",
    "content:review:approve", "learn:session:read_scope", "learn:mastery:read_scope", "learn:attempt:read_scope",
    "config:class:update", "config:student:update", "assess:summative:grade", "intervene:manage", "live:classroom:run",
    "report:student:read", "report:class:read", "safety:flag:read",
  ],
  homeroom_teacher: [
    "learn:session:read_scope", "learn:mastery:read_scope", "learn:attempt:read_scope",
    "intervene:manage", "report:student:read", "report:class:read", "safety:flag:read", "config:student:update",
  ],
  subject_lead: [
    "content:kg:read", "content:question:read", "content:question:write", "content:node:write", "content:ladder:write",
    "content:review:approve", "content:question:retire", "config:subject:update",
    "learn:mastery:read_scope", "report:class:read", "ai:prompt:manage", "ai:budget:read",
  ],
  counselor: ["safety:flag:read", "safety:flag:verify", "safety:flag:resolve", "wellbeing:context:read"],
  content_author: ["content:kg:read", "content:node:write", "content:question:write", "content:ladder:write"],
  content_reviewer: ["content:kg:read", "content:question:read", "content:review:approve", "content:question:retire"],
  campus_admin: ["org:campus:manage", "org:class:manage", "iam:user:manage", "config:tenant:update", "report:school:read", "audit:log:read"],
  leadership: ["report:school:read", "report:class:read", "ai:budget:read"],
  dpo: ["privacy:consent:read", "privacy:dsar:fulfill", "privacy:dpia:manage", "audit:log:read"],
  admin: ALL,
};

try {
  for (const [key, label] of ROLES) {
    await sql`insert into roles (key, label) values (${key}, ${label})
      on conflict (key) do update set label = excluded.label`;
  }
  for (const [key, domain] of Object.entries(PERMS)) {
    await sql`insert into permissions (key, domain) values (${key}, ${domain})
      on conflict (key) do update set domain = excluded.domain`;
  }
  for (const [roleKey, perms] of Object.entries(GRANTS)) {
    await sql`delete from role_permissions where role_key = ${roleKey}`;
    for (const p of perms) {
      await sql`insert into role_permissions (role_key, perm_key) values (${roleKey}, ${p})
        on conflict do nothing`;
    }
  }
  const counts = await sql<{ roles: number; perms: number; grants: number }[]>`
    select (select count(*)::int from roles) roles,
           (select count(*)::int from permissions) perms,
           (select count(*)::int from role_permissions) grants`;
  console.log(`✓ RBAC seeded — roles=${counts[0]!.roles} permissions=${counts[0]!.perms} grants=${counts[0]!.grants}`);
} catch (e) {
  console.error("✗ rbac seed failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
