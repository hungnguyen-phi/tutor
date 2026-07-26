// Chạy packages/db/fix-blank-distractors.sql lên DB sống qua Management API.
// Claude bị classifier chặn tự chạy → file này để NGƯỜI DÙNG chạy:
//     node packages/db/run-fix-blank-distractors.mjs
// Thêm --dry để chỉ xem trước, không ghi gì.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PROJECT_REF = "oonuzgnfoypibrssvmrt";
const DRY = process.argv.includes("--dry");

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("✗ Thiếu SUPABASE_ACCESS_TOKEN trong .env"); process.exit(1); }

async function q(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}

// 13 câu file SQL đụng tới
const IDS = [
  "4fc06895-8d5d-4eaa-b2d8-1de4fc00aec4", "e63ce4ef-1ab6-409c-8b8a-e1e897156e38",
  "7e9f4b20-18db-4539-9005-9c5340a8269c", "87d9c33a-078f-4176-b2fd-fc945c527241",
  "19761632-d4ee-4c7e-9e95-445b4a9272a5", "dbc3050f-85e5-421f-ae67-710ff45490b9",
  "feb29d0f-91f1-4f0a-b6fd-d5b374cf04d7", "70a331e9-96f6-4ca4-b35f-b0449d4cd8d9",
  "1d0513dc-8147-416f-b82d-2494f70b1a4b", "2c4b5d19-2ca5-43e2-b11d-c1c9c04abc79",
  "fa2f6c6a-cac5-484d-8f82-911a5f04aa0a", "6a449b1f-40c2-4e0a-af99-02d980748128",
  "82e85903-2b60-46b5-93be-9d2cae8f9235",
];
const inList = IDS.map((i) => `'${i}'`).join(",");
const SNAP = `select id, left(noi_dung, 70) as de, dap_an,
  (select string_agg(x->>'phuong_an', ' | ') from jsonb_array_elements(distractors) x) as nhieu
  from questions where id in (${inList}) order by id`;

const show = (rows, tieu_de) => {
  console.log(`\n── ${tieu_de} ──`);
  for (const r of rows) console.log(`  ${r.id.slice(0, 8)}  ĐÚNG: ${r.dap_an}\n            NHIỄU: ${r.nhieu ?? "(không)"}`);
};

const truoc = await q(SNAP);
show(truoc, `TRƯỚC (${truoc.length}/13 câu tìm thấy)`);
if (truoc.length !== 13) console.warn(`\n⚠ Chỉ tìm thấy ${truoc.length}/13 câu — kiểm lại id trước khi chạy.`);

if (DRY) { console.log("\n--dry: chỉ xem trước, KHÔNG ghi gì."); process.exit(0); }

const sql = readFileSync(join(HERE, "fix-blank-distractors.sql"), "utf8");
console.log("\n→ Đang chạy fix-blank-distractors.sql …");
await q(sql);
console.log("✓ Chạy xong.");

const sau = await q(SNAP);
show(sau, "SAU");

// Kiểm: không còn ghi chú soạn bài lọt trong phương án
const con = sau.filter((r) => /\(lặp\)|và cho là|\(hợp\)|\(chứa\)/i.test(r.nhieu ?? ""));
console.log(`\n${con.length === 0 ? "✓" : "✗"} Ghi chú soạn bài còn sót trong phương án: ${con.length}`);
if (con.length) con.forEach((r) => console.log(`   ${r.id.slice(0, 8)}: ${r.nhieu}`));
