// AUDIT KaTeX — chạy CHÍNH logic hiển thị của app (segmentMath + katex render,
// throwOnError) trên TOÀN BỘ nội dung Studio, tìm mọi công thức KHÔNG parse được
// (những chỗ học sinh sẽ thấy TEXT THÔ = hiển thị sai). Xuất danh sách để sửa ở
// nguồn. Chạy:  cd apps/web && node --import tsx scripts/audit-katex.ts
import fs from "node:fs";
import katex from "katex";
import { segmentMath } from "../lib/mathrender";

const ENV: Record<string, string> = {};
for (const l of fs.readFileSync("../../.env", "utf8").split(/\r?\n/)) {
  if (!l || l.startsWith("#") || !l.includes("=")) continue;
  const i = l.indexOf("="); ENV[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const TOKEN = ENV.SUPABASE_ACCESS_TOKEN;
const STUDIO = "jhqdzrejpcvasbsnamer";

async function sq<T = any>(sql: string): Promise<T[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${STUDIO}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }),
  });
  const b = await r.json(); if (!r.ok) throw new Error(JSON.stringify(b).slice(0, 200)); return b as T[];
}

// Chạy đúng đường render của app: segmentMath → mỗi đoạn 'math' phải katex parse
// được. Trả danh sách LaTeX FAIL (kèm lỗi) cho một chuỗi.
function failuresIn(text: string): { latex: string; err: string }[] {
  const out: { latex: string; err: string }[] = [];
  if (!text) return out;
  for (const seg of segmentMath(text)) {
    if (seg.t !== "math") continue;
    try { katex.renderToString(seg.v, { throwOnError: true, displayMode: false }); }
    catch (e) { out.push({ latex: seg.v, err: (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 90) }); }
  }
  return out;
}

type Row = { table: string; id: string; field: string; latex: string; err: string; subject?: string };

async function auditQuestions(): Promise<{ rows: Row[]; segs: number; strings: number }> {
  const rows: Row[] = []; let segs = 0, strings = 0;
  const total = (await sq<{ c: number }>("select count(*)::int c from questions"))[0]?.c ?? 0;
  for (let off = 0; off < total; off += 2000) {
    const qs = await sq<any>(`select q.id, q.noi_dung, q.dap_an, q.loi_giai, q.nhieu, a.subject from questions q left join atoms a on a.id=q.atom_id order by q.id limit 2000 offset ${off}`);
    for (const q of qs) {
      for (const [field, val] of [["noi_dung", q.noi_dung], ["dap_an", q.dap_an], ["loi_giai", q.loi_giai]] as const) {
        if (!val) continue; strings++;
        for (const f of failuresIn(String(val))) { segs++; rows.push({ table: "questions", id: q.id, field, latex: f.latex, err: f.err, subject: q.subject }); }
      }
      for (const d of Array.isArray(q.nhieu) ? q.nhieu : []) {
        if (!d?.noiDung) continue; strings++;
        for (const f of failuresIn(String(d.noiDung))) { segs++; rows.push({ table: "questions", id: q.id, field: "nhieu", latex: f.latex, err: f.err, subject: q.subject }); }
      }
    }
  }
  return { rows, segs, strings };
}

async function main() {
  if (!TOKEN) { console.error("Thiếu SUPABASE_ACCESS_TOKEN"); process.exit(1); }
  console.log("Đang audit KaTeX trên nội dung Studio…\n");
  const q = await auditQuestions();

  // Tổng hợp
  const byErr: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  for (const r of q.rows) {
    const key = r.err.replace(/'[^']*'|position \d+|character[^;]*/gi, "…").slice(0, 50);
    byErr[key] = (byErr[key] ?? 0) + 1;
    bySubject[r.subject ?? "?"] = (bySubject[r.subject ?? "?"] ?? 0) + 1;
  }
  fs.writeFileSync("../../scratchpad-katex-fails.json", JSON.stringify(q.rows.slice(0, 500), null, 2));
  console.log(`Câu hỏi: ${q.strings} chuỗi kiểm · ${q.rows.length} công thức FAIL (rơi về text thô).`);
  console.log("\n— Top loại lỗi —"); Object.entries(byErr).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([e, n]) => console.log(`  ${n}×  ${e}`));
  console.log("\n— Theo môn —"); Object.entries(bySubject).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([s, n]) => console.log(`  ${n}×  ${s}`));
  console.log("\n— 8 ví dụ fail —"); q.rows.slice(0, 8).forEach((r) => console.log(`  [${r.subject}] ${r.field}: «${r.latex.slice(0, 55)}» → ${r.err}`));
  console.log("\n(500 dòng đầu ghi ra scratchpad-katex-fails.json)");
}
main().catch((e) => { console.error(e); process.exit(1); });
