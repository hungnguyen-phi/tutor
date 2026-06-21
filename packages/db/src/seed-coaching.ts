/**
 * Applies coaching.sql (DDL + RLS) then seeds demo 4DX data for the pilot
 * student "Nguyễn Văn An": a homeroom coach + a buddy, 4 WIGs, this week's
 * lead measures, and a scoreboard row. Idempotent.
 * Run: pnpm --filter @tutor/db seed:coaching
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pw = process.env.SUPABASE_DB_PASSWORD;
if (!pw) {
  console.error("✗ Need SUPABASE_DB_PASSWORD.");
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

const YEAR = 2026;
const BUDDY_ID = "00000000-0000-4000-8000-0000000000b2"; // demo peer (no auth login)

/** Monday (ISO) of the week containing `d`, as YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = x.getUTCDay(); // 0=Sun..6=Sat
  x.setUTCDate(x.getUTCDate() - ((dow + 6) % 7));
  return x.toISOString().slice(0, 10);
}

try {
  // 1) Apply DDL + RLS.
  const here = dirname(fileURLToPath(import.meta.url));
  const ddl = readFileSync(join(here, "..", "coaching.sql"), "utf8");
  process.stdout.write("applying coaching.sql ... ");
  await sql.unsafe(ddl);
  console.log("ok");

  // 2) Resolve pilot ids.
  const [tenant] = await sql<{ id: string }[]>`select id from tenants where slug='viet-anh'`;
  if (!tenant) throw new Error("pilot tenant 'viet-anh' not found — run seed first.");
  // Resolve the actual login account (joins auth.users) — there can be a separate
  // M3 demo profile with the same name, so match on the real email.
  const [student] = await sql<{ id: string }[]>`
    select p.id from profiles p join auth.users u on u.id = p.id
    where p.tenant_id=${tenant.id} and p.role='student' and u.email='hs1@vietanh.edu.vn' limit 1`;
  if (!student) throw new Error("login student hs1@vietanh.edu.vn not found — run seed:auth first.");
  const [coach] = await sql<{ id: string }[]>`
    select id from profiles where tenant_id=${tenant.id} and role='teacher' limit 1`;
  if (!coach) throw new Error("no teacher profile found — run seed:auth first.");
  const week = mondayOf(new Date());

  // 3) Buddy peer profile (no auth user — display only).
  await sql`
    insert into profiles (id, tenant_id, role, full_name, grade, locale)
    values (${BUDDY_ID}, ${tenant.id}, 'student', 'Lê Minh', '10', 'vi')
    on conflict (id) do update set full_name=excluded.full_name`;

  // 4) Coaching links.
  await sql`
    insert into coaching_links (tenant_id, student_id, mentor_id, kind, cadence_days, last_meeting_at)
    values (${tenant.id}, ${student.id}, ${coach.id}, 'homeroom_coach', 28, now() - interval '13 days')
    on conflict (student_id, mentor_id, kind) do update set cadence_days=excluded.cadence_days, last_meeting_at=excluded.last_meeting_at`;
  await sql`
    insert into coaching_links (tenant_id, student_id, mentor_id, kind, cadence_days, last_meeting_at)
    values (${tenant.id}, ${student.id}, ${BUDDY_ID}, 'buddy', 7, now() - interval '4 days')
    on conflict (student_id, mentor_id, kind) do update set cadence_days=excluded.cadence_days, last_meeting_at=excluded.last_meeting_at`;

  // 5) The 4 WIGs (tutor owns Kiến thức + Tiếng Anh).
  const wigs: [string, string, string, number, "tutor" | "manual", number][] = [
    ["kien_thuc", "Thành thạo chương Hàm số bậc hai", "≥ 80% mastery toàn chương", 65, "tutor", 0],
    ["ky_nang", "Thuyết trình tự tin trước lớp", "3 bài trình bày trong học kỳ", 40, "manual", 1],
    ["tieng_anh", "Đọc hiểu & từ vựng trình độ B1", "≥ 80% mastery cụm B1", 55, "tutor", 2],
    ["the_chat", "Chạy bền 1.5km dưới 9 phút", "Đạt mốc trước cuối năm", 70, "manual", 3],
  ];
  for (const [area, title, target, pct, source, sort] of wigs) {
    await sql`
      insert into wigs (tenant_id, student_id, area, title, target_desc, progress_pct, source, year, sort)
      values (${tenant.id}, ${student.id}, ${area}::wig_area, ${title}, ${target}, ${pct}, ${source}::wig_source, ${YEAR}, ${sort})
      on conflict (student_id, area, year)
        do update set title=excluded.title, target_desc=excluded.target_desc, progress_pct=excluded.progress_pct, source=excluded.source, sort=excluded.sort, updated_at=now()`;
  }

  // 6) This week's lead measures (replace for idempotency).
  await sql`delete from lead_measures where student_id=${student.id} and week_start=${week}`;
  const leads: [string, string, string, "green" | "amber" | "red", number][] = [
    ["Số buổi học trong tuần", "3 buổi", "3/3", "green", 0],
    ["Ôn thẻ đến hạn (Leitner)", "100%", "60%", "amber", 1],
    ["Tự giải thích lại bài", "3 lần", "3 lần", "green", 2],
  ];
  for (const [label, target, value, status, sort] of leads) {
    await sql`
      insert into lead_measures (tenant_id, student_id, week_start, label, target_text, value_text, status, sort)
      values (${tenant.id}, ${student.id}, ${week}, ${label}, ${target}, ${value}, ${status}::lead_status, ${sort})`;
  }

  // 7) Scoreboard row for the week.
  await sql`
    insert into scoreboard_weeks (tenant_id, student_id, week_start, effort_rank, effort_scope)
    values (${tenant.id}, ${student.id}, ${week}, 3, 'lop')
    on conflict (student_id, week_start) do update set effort_rank=excluded.effort_rank, updated_at=now()`;

  console.log(`\n✓ 4DX coaching seeded for An (week ${week}): coach + buddy, 4 WIGs, ${leads.length} lead measures.`);
} catch (e) {
  console.error("✗ seed-coaching failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
