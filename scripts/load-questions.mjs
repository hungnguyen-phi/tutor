// Nạp câu hỏi đã chuẩn hoá (load-questions.json) vào bản published Toán 10 trên
// Supabase qua Management API. Chèn bằng jsonb_array_elements (an toàn ký tự đặc
// biệt), chia lô, status='review' + review_queue. Chạy: node scripts/load-questions.mjs <path-json>
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const token = get("SUPABASE_ACCESS_TOKEN");
const ref = (get("SUPABASE_URL") ?? "").match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
if (!token || !ref) { console.error("Thiếu SUPABASE_ACCESS_TOKEN / SUPABASE_URL"); process.exit(1); }

const VERSION = "6cc28358-2d65-4f18-ac34-c670f6b82a58"; // Toán 10 — Kết nối tri thức (published)

const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(`Nạp ${rows.length} câu vào version ${VERSION} (status review)…`);

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 800)}`);
  return body;
}

const esc = (s) => s.replace(/'/g, "''"); // escape single-quote cho SQL literal
const CHUNK = 150;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK);
  const json = esc(JSON.stringify(batch));
  const sql = `
insert into questions (
  tenant_id, kg_version_id, question_key, node_key, tier, loai_danh_gia,
  dang_cau_hoi, nhom_cham, ui_can_thiet, tinh_mastery, dok, do_kho,
  do_kho_uoc_luong, hoi_do_tu_tin, noi_dung, dap_an, loi_giai, distractors,
  tham_so_hoa, trang_thai
)
select
  (select id from tenants where slug='viet-anh'),
  '${VERSION}'::uuid,
  e->>'question_key', e->>'node_key',
  nullif(e->>'tier','')::int, e->>'loai_danh_gia',
  e->>'dang_cau_hoi', e->>'nhom_cham', e->>'ui_can_thiet', (e->>'tinh_mastery')::bool,
  (e->>'dok')::int, e->>'do_kho', (e->>'do_kho_uoc_luong')::bool, (e->>'hoi_do_tu_tin')::bool,
  e->>'noi_dung', e->>'dap_an', nullif(e->>'loi_giai',''), e->'distractors',
  (e->>'tham_so_hoa')::bool, e->>'trang_thai'
from jsonb_array_elements('${json}'::jsonb) e
where e->>'node_key' in (select node_key from kg_nodes where kg_version_id='${VERSION}'::uuid)
on conflict (kg_version_id, question_key) do update set
  noi_dung=excluded.noi_dung, dap_an=excluded.dap_an, distractors=excluded.distractors,
  loi_giai=excluded.loi_giai, do_kho=excluded.do_kho, dok=excluded.dok, trang_thai='review';`;
  await runSql(sql);
  done += batch.length;
  console.log(`  … ${done}/${rows.length}`);
}

// review_queue: 1 hàng pending / câu vừa nạp (bỏ qua nếu đã pending)
await runSql(`
insert into review_queue (tenant_id, content_type, content_id, ai_generated, status, note)
select q.tenant_id, 'question', q.id::text, false, 'pending', 'Ngân hàng Toán 10 (Drive 2026-07-21)'
from questions q
where q.kg_version_id='${VERSION}'::uuid and q.trang_thai='review'
  and not exists (select 1 from review_queue r where r.content_type='question' and r.content_id=q.id::text and r.status='pending');`);

const cov = await runSql(`select
  (select count(*) from questions where kg_version_id='${VERSION}'::uuid) as tong_cau,
  (select count(distinct node_key) from questions where kg_version_id='${VERSION}'::uuid) as node_co_cau,
  (select count(*) from kg_nodes where kg_version_id='${VERSION}'::uuid) as tong_node;`);
console.log("XONG. Coverage:", cov);
