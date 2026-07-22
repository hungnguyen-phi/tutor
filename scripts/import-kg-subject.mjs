// Đợt D — CỬA nạp một MÔN MỚI vào tutor theo mã atom Studio (GDKTPL 10, Công nghệ
// 8–9, GDCD 9…). Studio đẩy 1 bundle JSON; script tạo/tái dùng version rồi upsert
// nodes/edges/questions — idempotent theo (kg_version_id, node_key/question_key).
//
// Bundle JSON (Studio cấp):
// {
//   "subject": "GDKTPL", "grade": "10", "label": "GDKTPL 10 — Kết nối tri thức",
//   "nodes":     [{ "node_key":"KP10-C01-A01", "label":"...", "chapter":"C01",
//                   "cluster":"...", "type":"KN", "bloom_cu_tru":"Understand",
//                   "mo_ta":"...", "est_minutes":8 }, ...],
//   "edges":     [{ "from_key":"KP10-C01-A02", "to_key":"KP10-C01-A01",
//                   "relation":"prerequisite_hard", "weight":1.0 }, ...],
//   "questions": [{ "question_key":"KP10-C01-A01-Q1", "node_key":"KP10-C01-A01",
//                   "dang_cau_hoi":"mcq", "loai_danh_gia":"objective",
//                   "nhom_cham":"auto", "noi_dung":"...", "dap_an":"A",
//                   "distractors":[{"phuong_an":"B","quan_niem_sai":"..."}],
//                   "tier":1, "dok":2, "do_kho":"de" }, ...]
// }
//
// Chạy:  node scripts/import-kg-subject.mjs <bundle.json> [--dry]
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const token = get("SUPABASE_ACCESS_TOKEN");
const ref = (get("SUPABASE_URL") ?? "").match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
const TENANT_SLUG = "viet-anh";

const path = process.argv.slice(2).find((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry");
if (!path) { console.error("Thiếu đường dẫn bundle. VD: node scripts/import-kg-subject.mjs bundle.json --dry"); process.exit(1); }
const b = JSON.parse(readFileSync(path, "utf8"));

// ── Kiểm tra bundle TRƯỚC khi chạm DB ────────────────────────────────────────
const errs = [];
if (!b.subject) errs.push("thiếu subject");
if (!b.label) errs.push("thiếu label");
for (const [name, arr] of [["nodes", b.nodes], ["edges", b.edges], ["questions", b.questions]])
  if (!Array.isArray(arr)) errs.push(`${name} phải là mảng`);
const nodeKeys = new Set((b.nodes ?? []).map((n) => n.node_key));
(b.nodes ?? []).forEach((n, i) => { if (!n.node_key || !n.label) errs.push(`node[${i}] thiếu node_key/label`); });
(b.edges ?? []).forEach((e, i) => {
  if (!e.from_key || !e.to_key || !e.relation) errs.push(`edge[${i}] thiếu from_key/to_key/relation`);
  else if (!nodeKeys.has(e.from_key) || !nodeKeys.has(e.to_key)) errs.push(`edge[${i}] trỏ tới node không có trong bundle`);
});
const qKeys = new Set();
(b.questions ?? []).forEach((q, i) => {
  if (!q.question_key || !q.node_key || !q.noi_dung || !q.loai_danh_gia) errs.push(`question[${i}] thiếu question_key/node_key/noi_dung/loai_danh_gia`);
  else if (!nodeKeys.has(q.node_key)) errs.push(`question[${i}] node_key "${q.node_key}" không có trong nodes`);
  if (qKeys.has(q.question_key)) errs.push(`question_key trùng: ${q.question_key}`);
  qKeys.add(q.question_key);
});
if (errs.length) { console.error("✗ Bundle KHÔNG hợp lệ:\n - " + errs.slice(0, 20).join("\n - ")); process.exit(1); }

console.log(`Bundle OK: subject=${b.subject} label="${b.label}" | ${b.nodes.length} node, ${b.edges.length} edge, ${b.questions.length} câu`);
if (DRY) { console.log("[--dry] Không ghi DB. Kiểm tra xong."); process.exit(0); }

// ── Nạp qua Management API ────────────────────────────────────────────────────
async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 800)}`);
  return JSON.parse(body);
}
const esc = (s) => String(s ?? "").replace(/'/g, "''");
const G = String(b.grade ?? "");

// 1) Tạo/tái dùng version (published) theo (tenant, subject, label)
const ver = await runSql(`
  insert into kg_versions (tenant_id, subject, label, status)
  select (select id from tenants where slug='${TENANT_SLUG}'), '${esc(b.subject)}', '${esc(b.label)}', 'published'
  where not exists (select 1 from kg_versions where tenant_id=(select id from tenants where slug='${TENANT_SLUG}') and subject='${esc(b.subject)}' and label='${esc(b.label)}')
  returning id;`);
const V = ver[0]?.id ?? (await runSql(`select id from kg_versions where tenant_id=(select id from tenants where slug='${TENANT_SLUG}') and subject='${esc(b.subject)}' and label='${esc(b.label)}' limit 1;`))[0].id;
console.log("Version:", V);

const chunked = async (label, rows, sqlFor) => {
  const C = 100; let done = 0;
  for (let i = 0; i < rows.length; i += C) { await runSql(sqlFor(rows.slice(i, i + C))); done += Math.min(C, rows.length - i); process.stdout.write(`  ${label}: ${done}/${rows.length}\r`); }
  console.log(`  ${label}: ${rows.length} ✓        `);
};

// 2) Nodes (upsert theo kg_version_id,node_key)
await chunked("nodes", b.nodes, (arr) => {
  const json = esc(JSON.stringify(arr));
  return `insert into kg_nodes (tenant_id, kg_version_id, node_key, subject, grade, chapter, cluster, label, type, bloom_cu_tru, mo_ta, est_minutes, status)
    select (select id from tenants where slug='${TENANT_SLUG}'), '${V}'::uuid,
      e->>'node_key', '${esc(b.subject)}', ${G ? `'${esc(G)}'` : "e->>'grade'"}, e->>'chapter', e->>'cluster', e->>'label',
      coalesce(e->>'type','KN'), e->>'bloom_cu_tru', e->>'mo_ta', (e->>'est_minutes')::int, coalesce(e->>'status','approved')
    from jsonb_array_elements('${json}'::jsonb) e
    on conflict (kg_version_id, node_key) do update set label=excluded.label, chapter=excluded.chapter, cluster=excluded.cluster, mo_ta=excluded.mo_ta;`;
});

// 3) Edges (xoá sạch của version rồi nạp lại — idempotent)
await runSql(`delete from kg_edges where kg_version_id='${V}'::uuid;`);
await chunked("edges", b.edges, (arr) => {
  const json = esc(JSON.stringify(arr));
  return `insert into kg_edges (tenant_id, kg_version_id, from_key, to_key, relation, weight)
    select (select id from tenants where slug='${TENANT_SLUG}'), '${V}'::uuid,
      e->>'from_key', e->>'to_key', e->>'relation', coalesce((e->>'weight')::real, 1.0)
    from jsonb_array_elements('${json}'::jsonb) e;`;
});

// 4) Questions (upsert theo kg_version_id,question_key)
await chunked("questions", b.questions, (arr) => {
  const json = esc(JSON.stringify(arr));
  return `insert into questions (tenant_id, kg_version_id, question_key, node_key, loai_danh_gia, dang_cau_hoi, nhom_cham, tier, dok, do_kho, noi_dung, dap_an, distractors, rubric, trang_thai)
    select (select id from tenants where slug='${TENANT_SLUG}'), '${V}'::uuid,
      e->>'question_key', e->>'node_key', e->>'loai_danh_gia', e->>'dang_cau_hoi', coalesce(e->>'nhom_cham','auto'),
      coalesce((e->>'tier')::int,1), coalesce((e->>'dok')::int,2), coalesce(e->>'do_kho','trung_binh'),
      e->>'noi_dung', e->>'dap_an', e->'distractors', e->'rubric', coalesce(e->>'trang_thai','active')
    from jsonb_array_elements('${json}'::jsonb) e
    on conflict (kg_version_id, question_key) do update set
      noi_dung=excluded.noi_dung, dap_an=excluded.dap_an, distractors=excluded.distractors, rubric=excluded.rubric,
      dang_cau_hoi=excluded.dang_cau_hoi, trang_thai=excluded.trang_thai;`;
});

console.log(`\nXONG. Môn "${b.subject}" đã sẵn sàng trên tutor (version ${V}).`);
