// Nạp thang Socratic đã chuẩn hoá vào bản published Toán 10 (status review).
// Chạy: node scripts/load-ladders.mjs <path-json>
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const token = get("SUPABASE_ACCESS_TOKEN");
const ref = (get("SUPABASE_URL") ?? "").match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
const VERSION = "6cc28358-2d65-4f18-ac34-c670f6b82a58";
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(`Nạp ${rows.length} thang Socratic (status review)…`);

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
  rungs=excluded.rungs, bottom_out=excluded.bottom_out, misconception=excluded.misconception, status='review';`;
  await runSql(sql);
  done += Math.min(CHUNK, rows.length - i);
  console.log(`  … ${done}/${rows.length}`);
}
const cov = await runSql(`select count(*) tong_thang, count(distinct node_key) node_co_thang
  from socratic_ladders where kg_version_id='${VERSION}'::uuid;`);
console.log("XONG. Coverage:", cov);
