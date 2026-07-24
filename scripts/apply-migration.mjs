// Áp MỘT file migration lên DB prod qua Management API. PROD WRITE → NGƯỜI DÙNG
// chạy (Claude bị chặn ghi prod):
//
//     node scripts/apply-migration.mjs 0012_teacher_overrides.sql
//
// Đọc token từ .env (SUPABASE_ACCESS_TOKEN). File truyền vào là tên trong
// supabase/migrations/ (hoặc đường dẫn đầy đủ). Migration idempotent (create if
// not exists / drop-create policy) nên chạy lại an toàn.
import fs from "node:fs";

function readEnv() {
  const out = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const ENV = readEnv();
const TOKEN = ENV.SUPABASE_ACCESS_TOKEN;
// Ref suy từ SUPABASE_URL trong .env (theo project HIỆN TẠI, không hardcode) —
// đổi nhà là script tự trỏ đúng chỗ. Cho override bằng PROJECT_REF nếu cần.
const PROJ = ENV.PROJECT_REF ||
  (ENV.SUPABASE_URL || "").replace(/^https:\/\/([^.]+)\.supabase\.co.*$/, "$1");
const arg = process.argv[2];

async function main() {
  if (!TOKEN) { console.error("Thiếu SUPABASE_ACCESS_TOKEN trong .env"); process.exit(1); }
  if (!arg) {
    console.error("Cần tên file migration, vd:\n  node scripts/apply-migration.mjs 0012_teacher_overrides.sql");
    process.exit(1);
  }
  const path = arg.includes("/") || arg.includes("\\") ? arg : `supabase/migrations/${arg}`;
  const sql = fs.readFileSync(path, "utf8");
  console.log(`→ áp ${path} …`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJ}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { console.error("✗ Lỗi:", JSON.stringify(json)); process.exit(1); }
  console.log("✓ Áp xong.");
}

main().catch((e) => { console.error(e); process.exit(1); });
