// Áp TẤT CẢ migration trong supabase/migrations/ theo đúng thứ tự tên file, lên
// project HIỆN TẠI (ref suy từ SUPABASE_URL trong .env). Dùng khi dựng nhà mới:
//     node scripts/apply-all-migrations.mjs
// PROD WRITE → NGƯỜI DÙNG chạy. Idempotent (mọi migration create-if-not-exists).
// Dừng ngay nếu một migration lỗi (để không áp lệch nửa chừng).
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
const PROJ = ENV.PROJECT_REF || (ENV.SUPABASE_URL || "").replace(/^https:\/\/([^.]+)\.supabase\.co.*$/, "$1");

async function run(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJ}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const b = await res.json().catch(() => ({}));
  return { ok: res.ok, body: b };
}

async function main() {
  if (!TOKEN || !PROJ) { console.error("Thiếu SUPABASE_ACCESS_TOKEN / SUPABASE_URL trong .env"); process.exit(1); }
  console.log(`Đích: project ${PROJ}`);
  const dir = "supabase/migrations";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    process.stdout.write(`→ ${f} … `);
    const { ok, body } = await run(fs.readFileSync(`${dir}/${f}`, "utf8"));
    if (!ok) { console.log("LỖI"); console.error(JSON.stringify(body).slice(0, 400)); process.exit(1); }
    console.log("ok");
  }
  console.log(`\n✓ Áp xong ${files.length} migration.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
