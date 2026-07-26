// Chạy một file .sql lên DB sống qua Management API (token đọc từ .env).
// Claude bị classifier chặn tự chạy → file này để NGƯỜI DÙNG chạy:
//     node packages/db/run-sql.mjs packages/db/<ten-file>.sql
// Thêm --dry để chỉ in file ra, không ghi gì.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROJECT_REF = "oonuzgnfoypibrssvmrt";
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Dùng: node packages/db/run-sql.mjs <đường-dẫn-file.sql> [--dry]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
if (!env.SUPABASE_ACCESS_TOKEN) { console.error("✗ Thiếu SUPABASE_ACCESS_TOKEN trong .env"); process.exit(1); }

const sql = readFileSync(resolve(file), "utf8");
const stmts = (sql.match(/^\s*UPDATE\s/gim) ?? []).length;
console.log(`File   : ${file}`);
console.log(`Project: ${PROJECT_REF}`);
console.log(`Lệnh UPDATE trong file: ${stmts}`);

if (DRY) { console.log("\n--dry: KHÔNG ghi gì. Nội dung:\n"); console.log(sql); process.exit(0); }

const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const txt = await r.text();
if (!r.ok) { console.error(`\n✗ HTTP ${r.status}\n${txt.slice(0, 600)}`); process.exit(1); }
console.log("\n✓ Chạy xong.");
