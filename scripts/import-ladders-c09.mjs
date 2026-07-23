// Nạp thang Socratic Chương 9 (Xác suất) — schema 3.0 (node_key đã đúng dạng
// TO10-C09-*, trường quan_niem_sai/bac_1..4/day/cong_no_luc). Hoàn tất Toán 10
// đủ 9/9 chương. Chạy:  node scripts/import-ladders-c09.mjs [file.json] [--dry]
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const token = get("SUPABASE_ACCESS_TOKEN");
const ref = (get("SUPABASE_URL") ?? "").match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
const VERSION = "6cc28358-2d65-4f18-ac34-c670f6b82a58"; // Toán 10 published

const FILE = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "D:/ThangSocratic_Toan10_C09.json";
const DRY = process.argv.includes("--dry");

const RUNGS = [
  ["bac_1", 1, "sieu_nhan_thuc"],
  ["bac_2", 2, "huong_chu_y"],
  ["bac_3", 3, "dan_ve_tien_de"],
  ["bac_4", 4, "gian_giao_manh"],
];

const src = JSON.parse(readFileSync(FILE, "utf8"));
const arr = src.socratic_ladders ?? [];
const seq = new Map();
const rows = [];
for (const f of arr) {
  const node_key = String(f.node_key ?? "").trim();
  if (!/^TO10-C09-/.test(node_key)) continue;
  const rungs = RUNGS
    .map(([k, bac, loai]) => ({ bac, loai, cau_hoi: String(f[k] ?? "").trim() }))
    .filter((r) => r.cau_hoi);
  if (rungs.length === 0) continue;
  const n = (seq.get(node_key) ?? 0) + 1;
  seq.set(node_key, n);
  // Đáy = "day" + bài luyện lại (app không có cột riêng nên gộp vào bottom_out).
  const day = String(f.day ?? "").trim();
  const luyen = String(f.bai_luyen_lai ?? "").trim();
  rows.push({
    ladder_key: `${node_key}-L${n}`,
    node_key,
    misconception: String(f.quan_niem_sai ?? "[không có distractor cụ thể]").trim(),
    rungs,
    bottom_out: {
      noi_dung: luyen ? `${day}\n\nBài luyện lại: ${luyen}` : day,
      dieu_kien_mo: "qua_cong_no_luc",
    },
    cong_no_luc: {
      ghi_chu: String(f.cong_no_luc ?? "Sau 1–2 lần thử thực chất").trim(),
      yeu_cau: "thu_toi_thieu_va_giai_thich",
      so_lan_thu_toi_thieu: 2,
    },
    status: "active",
  });
}

console.log(`Chuyển được ${rows.length} thang / ${seq.size} node (Chương IX).`);
const keys = rows.map((r) => r.ladder_key);
const dup = keys.length - new Set(keys).size;
const emptyBO = rows.filter((r) => !r.bottom_out.noi_dung).length;
console.log(`INTEGRITY: dup_key=${dup}  empty_bottom_out=${emptyBO}  rungs<4=${rows.filter((r) => r.rungs.length < 4).length}`);
if (dup > 0 || emptyBO > 0) { console.error("✗ Có vấn đề toàn vẹn — DỪNG."); process.exit(1); }
if (DRY) { console.log("\n[--dry] Không ghi DB.\nMẫu:", JSON.stringify(rows[0], null, 1).slice(0, 500)); process.exit(0); }

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 800)}`);
  return body;
}
const esc = (s) => s.replace(/'/g, "''");
const json = esc(JSON.stringify(rows));
await runSql(`
insert into socratic_ladders (tenant_id, kg_version_id, ladder_key, node_key, misconception, rungs, bottom_out, cong_no_luc, status)
select (select id from tenants where slug='viet-anh'), '${VERSION}'::uuid,
  e->>'ladder_key', e->>'node_key', e->>'misconception', e->'rungs', e->'bottom_out', e->'cong_no_luc', e->>'status'
from jsonb_array_elements('${json}'::jsonb) e
where e->>'node_key' in (select node_key from kg_nodes where kg_version_id='${VERSION}'::uuid)
on conflict (kg_version_id, ladder_key) do update set
  rungs=excluded.rungs, bottom_out=excluded.bottom_out, misconception=excluded.misconception,
  cong_no_luc=excluded.cong_no_luc, status='active';`);
console.log(`ĐÃ NẠP ${rows.length} thang Chương IX.`);
const cov = await runSql(`select count(*) tong, count(distinct node_key) node from socratic_ladders where kg_version_id='${VERSION}'::uuid and node_key like 'TO10-C09-%' and status='active';`);
console.log("Coverage C09 sau nạp:", cov);
