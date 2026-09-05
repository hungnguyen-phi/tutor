// Xuất góp ý học sinh (bảng student_feedback) ra màn hình + file Excel.
//   node packages/db/gop-y-xuat.mjs            → in bảng + ghi docs/Gop-y-hoc-sinh.xlsx
//   node packages/db/gop-y-xuat.mjs 7          → chỉ 7 ngày gần nhất
// Chỉ ĐỌC (Management API, token trong .env).
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const ngay = Number(process.argv[2] || 0);
const sql = `
select to_char(f.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI') as luc,
       coalesce(p.full_name, u.email) as hoc_sinh,
       f.page, f.subject, coalesce(n.label, f.node_key) as bai, f.question_id as cau,
       f.tag, f.tutor_text as su_tu_noi, f.student_text as em_viet, f.device
from public.student_feedback f
join auth.users u on u.id = f.student_id
left join public.profiles p on p.id = f.student_id
left join public.kg_nodes n on n.key = f.node_key
${ngay ? `where f.created_at > now() - interval '${ngay} days'` : ""}
order by f.created_at desc`;
const r = await fetch("https://api.supabase.com/v1/projects/oonuzgnfoypibrssvmrt/database/query", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const rows = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(rows)); process.exit(1); }
console.log(`${rows.length} góp ý${ngay ? ` trong ${ngay} ngày` : ""}\n`);
for (const x of rows) {
  console.log(`— ${x.luc} · ${x.hoc_sinh} · ${x.page}${x.bai ? " · " + x.bai : ""}${x.tag ? " · [" + x.tag + "]" : ""}`);
  if (x.su_tu_noi) console.log(`   Sư tử: “${String(x.su_tu_noi).slice(0, 160)}”`);
  console.log(`   Em:    ${x.em_viet}\n`);
}

// Excel: cần exceljs (npm i -g exceljs hoặc chạy trong thư mục có node_modules/exceljs). Không có thì chỉ in.
try {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Góp ý");
  const cols = [["Lúc", 12], ["Học sinh", 20], ["Màn", 10], ["Môn", 8], ["Bài", 32], ["Câu", 14], ["Kiểu", 12], ["Sư tử nói", 50], ["Em viết", 60], ["Thiết bị", 24]];
  ws.columns = cols.map(([header, width], i) => ({ header, width, key: ["luc", "hoc_sinh", "page", "subject", "bai", "cau", "tag", "su_tu_noi", "em_viet", "device"][i] }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26275D" } };
  rows.forEach((x) => { const row = ws.addRow(x); row.alignment = { wrapText: true, vertical: "top" }; });
  const out = "docs/Gop-y-hoc-sinh.xlsx";
  await wb.xlsx.writeFile(out);
  console.log("✓ đã ghi", out);
} catch {
  console.log("(không có exceljs — bỏ qua file Excel)");
}
