// Nạp thang Socratic còn THIẾU (Chương 1/4/5/6) vào bản Toán 10 published.
// Chuyển định dạng PHẲNG (bac_1..4, day_he_dap_an, luat_cong_ngu_luc, vi_tri_trong_ct)
// → schema socratic_ladders của app (rungs/bottom_out/cong_no_luc), status='active'.
// Idempotent: on-conflict cập nhật nội dung, GIỮ status='active' (khác load-ladders cũ
// vốn ép 'review'). Chạy:  node scripts/import-ladders-missing.mjs [flatDir]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const token = get("SUPABASE_ACCESS_TOKEN");
const ref = (get("SUPABASE_URL") ?? "").match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
const VERSION = "6cc28358-2d65-4f18-ac34-c670f6b82a58"; // Toán 10 published (subject 'Toan')

// Thư mục chứa file phẳng ThangSocratic_Toan10_*.json (mặc định = scratchpad).
const dirArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const FLAT_DIR = dirArg ??
  "C:/Users/ASUS/AppData/Local/Temp/claude/D--tutor/b470173f-6e8e-4171-bc84-59675cb27ec9/scratchpad/toan10/TOÁN 10";

// CHỈ nạp các chương còn thiếu (C02/C03/C07/C08 đã có, key khác → không đụng).
const WANT_CHAPTERS = ["TO10-C01", "TO10-C04", "TO10-C05", "TO10-C06"];

// Hai schema file phẳng: Chương 1 dùng tên DÀI (bac_1_sieu_nhan_thuc, day_he_dap_an,
// luat_cong_ngu_luc); Chương 4/5/6 dùng tên NGẮN (bac_1, day, cong_ngu_luc). Thử cả hai.
const RUNGS = [
  [["bac_1_sieu_nhan_thuc", "bac_1"], 1, "sieu_nhan_thuc"],
  [["bac_2_huong_chu_y", "bac_2"], 2, "huong_chu_y"],
  [["bac_3_dan_tien_de", "bac_3"], 3, "dan_ve_tien_de"],
  [["bac_4_gian_giao", "bac_4"], 4, "gian_giao_manh"],
];
const pick = (flat, keys) => {
  for (const k of keys) { const v = String(flat[k] ?? "").trim(); if (v) return v; }
  return "";
};

// ── Chuyển 1 bản ghi phẳng → 1 hàng socratic_ladders ─────────────────────────
function convert(flat, seqPerNode) {
  const node_key = String(flat.vi_tri_trong_ct ?? "").trim();
  if (!node_key) return null;
  if (!WANT_CHAPTERS.some((c) => node_key.startsWith(c))) return null;

  const rungs = RUNGS
    .map(([keys, bac, loai]) => ({ bac, loai, cau_hoi: pick(flat, keys) }))
    .filter((r) => r.cau_hoi);
  if (rungs.length === 0) return null;

  const n = (seqPerNode.get(node_key) ?? 0) + 1;
  seqPerNode.set(node_key, n);

  return {
    ladder_key: `${node_key}-L${n}`,
    node_key,
    misconception: String(flat.misconception ?? "[không có distractor cụ thể]").trim(),
    rungs,
    bottom_out: {
      noi_dung: pick(flat, ["day_he_dap_an", "day"]),
      dieu_kien_mo: "qua_cong_no_luc",
    },
    cong_no_luc: {
      ghi_chu: pick(flat, ["luat_cong_ngu_luc", "cong_ngu_luc"]) || "Sau 1–2 lần thử thực chất",
      yeu_cau: "thu_toi_thieu_va_giai_thich",
      so_lan_thu_toi_thieu: 2,
    },
    status: "active",
  };
}

// ── Gom mọi file phẳng, chuyển, gộp ──────────────────────────────────────────
const files = readdirSync(FLAT_DIR).filter((f) => /^ThangSocratic_Toan10_.*\.json$/i.test(f)).sort();
const seqPerNode = new Map();
const rows = [];
for (const f of files) {
  let arr;
  try { arr = JSON.parse(readFileSync(join(FLAT_DIR, f), "utf8")); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  let kept = 0;
  for (const flat of arr) {
    const r = convert(flat, seqPerNode);
    if (r) { rows.push(r); kept++; }
  }
  if (kept) console.log(`  ${f}: +${kept} thang (chương đích)`);
}
console.log(`\nTổng chuyển được: ${rows.length} thang cho ${seqPerNode.size} node — chương ${WANT_CHAPTERS.join(",")}`);
if (rows.length === 0) { console.log("Không có gì để nạp — dừng."); process.exit(0); }

// Kiểm tra toàn vẹn + (nếu --dry) DỪNG trước khi ghi.
{
  const byCh = {};
  for (const r of rows) { const c = r.node_key.match(/TO10-C[0-9]+/)[0]; (byCh[c] ??= new Set()).add(r.node_key); }
  for (const c of Object.keys(byCh).sort()) console.log(`  ${c}: ${byCh[c].size} node`);
  const keys = rows.map((r) => r.ladder_key);
  const dup = keys.length - new Set(keys).size;
  const emptyBO = rows.filter((r) => !r.bottom_out.noi_dung).length;
  const shortRungs = rows.filter((r) => r.rungs.length < 4).length;
  console.log(`INTEGRITY: dup_key=${dup}  empty_bottom_out=${emptyBO}  rungs<4=${shortRungs}`);
  if (dup > 0) { console.error("✗ Có ladder_key trùng — DỪNG."); process.exit(1); }
}
if (process.argv.includes("--dry")) { console.log("\n[--dry] Không ghi DB. Xong."); process.exit(0); }

// ── Nạp qua Management API, chunk 120, on-conflict giữ active ─────────────────
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
const CHUNK = 120;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const json = esc(JSON.stringify(rows.slice(i, i + CHUNK)));
  const sql = `
insert into socratic_ladders (tenant_id, kg_version_id, ladder_key, node_key, misconception, rungs, bottom_out, cong_no_luc, status)
select (select id from tenants where slug='viet-anh'), '${VERSION}'::uuid,
  e->>'ladder_key', e->>'node_key', e->>'misconception', e->'rungs', e->'bottom_out', e->'cong_no_luc', e->>'status'
from jsonb_array_elements('${json}'::jsonb) e
where e->>'node_key' in (select node_key from kg_nodes where kg_version_id='${VERSION}'::uuid)
on conflict (kg_version_id, ladder_key) do update set
  rungs=excluded.rungs, bottom_out=excluded.bottom_out, misconception=excluded.misconception,
  cong_no_luc=excluded.cong_no_luc, status='active';`;
  await runSql(sql);
  done += Math.min(CHUNK, rows.length - i);
  process.stdout.write(`  … nạp ${done}/${rows.length}\r`);
}
console.log(`\n\nĐÃ NẠP ${done} thang.`);

const cov = await runSql(`select substring(node_key from 'TO10-C[0-9]+') chuong, count(*) thang, count(distinct node_key) node
  from socratic_ladders where kg_version_id='${VERSION}'::uuid and status='active' group by 1 order by 1;`);
console.log("Coverage sau nạp (status=active):");
console.log(cov);
