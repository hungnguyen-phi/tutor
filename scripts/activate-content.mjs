// Active nội dung đã đồng bộ để phục vụ HS (trang_thai review → active), NHƯNG
// GIỮ lại ở 'review' những câu KaTeX hỏng (từ docs/katex-fixlist.csv) để Studio
// sửa tại nguồn — dùng chính kết quả audit làm CỔNG CHẤT LƯỢNG cho lần launch.
//
// Chạy:  node scripts/activate-content.mjs [--dry]   (mặc định thật; --dry chỉ đếm)
// Cần SUPABASE_ACCESS_TOKEN trong .env; REF=project tutor mới.
import fs from "node:fs";

const ENV = {};
for (const l of fs.readFileSync("D:/tutor/.env", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) ENV[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const TOKEN = ENV.SUPABASE_ACCESS_TOKEN;
const REF = process.env.REF || "oonuzgnfoypibrssvmrt";
const DRY = process.argv.includes("--dry");
if (!TOKEN) { console.error("Thiếu SUPABASE_ACCESS_TOKEN"); process.exit(1); }

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }),
  });
  const b = await r.json(); if (!r.ok) throw new Error(JSON.stringify(b).slice(0, 300)); return b;
}

// question_key hỏng KaTeX (giữ review) — từ fixlist, cột 1.
const broken = [...new Set(
  fs.readFileSync("D:/tutor/docs/katex-fixlist.csv", "utf8").split(/\r?\n/).slice(1)
    .filter(Boolean).map((l) => l.split(",")[0].replace(/^"|"$/g, "")),
)];
const inList = broken.map((k) => `'${k.replace(/'/g, "''")}'`).join(",");

const before = await q("select trang_thai, count(*) c from questions group by 1 order by 2 desc");
console.log("Trước:", before);
console.log(`Giữ 'review' (KaTeX hỏng): ${broken.length} câu.`);

if (DRY) {
  const would = await q(`select count(*) c from questions where trang_thai='review' and question_key not in (${inList})`);
  console.log("Sẽ active:", would[0].c);
  process.exit(0);
}

const upd = await q(`update questions set trang_thai='active' where trang_thai='review' and question_key not in (${inList}) returning 1`);
console.log(`Đã active: ${upd.length} câu.`);
const after = await q("select trang_thai, count(*) c from questions group by 1 order by 2 desc");
console.log("Sau:", after);
