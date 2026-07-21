/**
 * Nạp một gói KG (đầu ra của quy trình 6 Trạm) vào Supabase.
 *
 *   pnpm --filter @tutor/db import:kg -- <file.json> [--activate] [--tenant=viet-anh]
 *
 * Gói JSON phải khớp Zod `KgBundle` (schema "va.kg-bundle/2.2") trong @tutor/shared.
 * Đó là contract duy nhất giữa nguồn nội dung (Google Sheet → Claude → JSON) và Tutor.
 *
 * Mặc định mọi nội dung nạp vào ở trạng thái `review` và được đẩy vào `review_queue`
 * — nguyên tắc bất biến human-in-the-loop. `--activate` bỏ qua cổng duyệt và chỉ nên
 * dùng ở môi trường thử nghiệm, không phục vụ học sinh thật.
 *
 * Idempotent: chạy lại cùng một file không tạo bản ghi trùng — nội dung upsert
 * theo khoá tự nhiên (node_key/question_key/ladder_key/resource_key), edges thay
 * nguyên khối theo version, review_queue bỏ qua mục 'pending' đã có.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { KgBundle, FORM_SPEC, checkNodeBank, type Question } from "@tutor/shared";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const activate = args.includes("--activate");
const tenantSlug = args.find((a) => a.startsWith("--tenant="))?.slice(9) ?? "viet-anh";

if (!file) {
  console.error("✗ Dùng: pnpm --filter @tutor/db import:kg -- <file.json> [--activate]");
  process.exit(1);
}

const rawPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "uksbvlkhcyhnpfamducc";
const url = process.env.DATABASE_URL;
if (!rawPassword && !url) {
  console.error("✗ Set SUPABASE_DB_PASSWORD (raw) or DATABASE_URL.");
  process.exit(1);
}

// ── 1. Đọc & validate. Dữ liệu lệch bị chặn TẠI CỬA, không đi sâu vào hệ. ────
const parsed = KgBundle.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error(`✗ ${file} không khớp schema va.kg-bundle/2.2:\n`);
  for (const issue of parsed.error.issues.slice(0, 20)) {
    console.error(`  · ${issue.path.join(".")}: ${issue.message}`);
  }
  const extra = parsed.error.issues.length - 20;
  if (extra > 0) console.error(`  … và ${extra} lỗi nữa`);
  process.exit(1);
}
const bundle = parsed.data;

// ── 2. Kiểm ngân sách LLM: mỗi node ≥70% câu chấm tự động. ───────────────────
const byNode = new Map<string, Question[]>();
for (const q of bundle.questions) {
  const list = byNode.get(q.node_id) ?? [];
  list.push(q);
  byNode.set(q.node_id, list);
}
const offenders = [...byNode.entries()]
  .map(([node, qs]) => ({ node, ...checkNodeBank(qs) }))
  .filter((r) => !r.ok);

if (offenders.length > 0) {
  console.error("✗ Ngân hàng câu hỏi vi phạm trần chi phí LLM (≥70% phải chấm tự động):\n");
  for (const o of offenders.slice(0, 10)) console.error(`  · ${o.node}: ${o.reason}`);
  process.exit(1);
}

// ── 3. Kiểm tham chiếu: mọi question/ladder/tier phải trỏ tới node có thật. ──
const nodeIds = new Set(bundle.nodes.map((n) => n.id));
const dangling: string[] = [];
const checkRef = (kind: string, id: string, nodeId: string) => {
  if (!nodeIds.has(nodeId)) dangling.push(`${kind} '${id}' → node '${nodeId}' không tồn tại`);
};
for (const q of bundle.questions) checkRef("question", q.id, q.node_id);
for (const l of bundle.ladders) checkRef("ladder", l.id, l.node_id);
for (const t of bundle.tiers) checkRef("tier", `${t.node_id}#${t.tier}`, t.node_id);
for (const r of bundle.resources) checkRef("resource", r.id, r.node_id);
for (const e of bundle.edges) {
  if (!nodeIds.has(e.from)) dangling.push(`edge → node '${e.from}' không tồn tại`);
  if (!nodeIds.has(e.to)) dangling.push(`edge → node '${e.to}' không tồn tại`);
}
if (dangling.length > 0) {
  console.error("✗ Tham chiếu treo:\n");
  for (const d of dangling.slice(0, 15)) console.error(`  · ${d}`);
  if (dangling.length > 15) console.error(`  … và ${dangling.length - 15} lỗi nữa`);
  process.exit(1);
}

const status = activate ? "active" : "review";
console.log(`✓ ${file} hợp lệ — ${bundle.nodes.length} node, ${bundle.edges.length} cạnh, ` +
  `${bundle.questions.length} câu hỏi, ${bundle.ladders.length} thang, ${bundle.resources.length} tài nguyên`);
console.log(`  nạp với trang_thai='${status}'${activate ? " (BỎ QUA cổng duyệt — chỉ dùng khi thử nghiệm)" : ""}`);

const sql = rawPassword
  ? postgres({
      host: process.env.SUPABASE_DB_HOST ?? `db.${projectRef}.supabase.co`,
      port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
      user: process.env.SUPABASE_DB_USER ?? "postgres",
      password: rawPassword,
      database: "postgres",
      ssl: "require",
      prepare: false,
      max: 1,
    })
  : postgres(url!, { prepare: false, max: 1 });

const j = (v: unknown) => JSON.stringify(v);

/**
 * Đẩy một mẩu nội dung vào hàng chờ duyệt, trừ khi đã --activate.
 * Bỏ qua nếu đã có mục 'pending' cùng nội dung — chạy lại không xếp hàng đôi.
 */
async function enqueueReview(tenantId: string, contentType: string, contentId: string) {
  if (activate) return;
  await sql`
    insert into review_queue (tenant_id, content_type, content_id, ai_generated, status)
    select ${tenantId}, ${contentType}, ${contentId}, false, 'pending'
    where not exists (
      select 1 from review_queue
       where tenant_id = ${tenantId} and content_type = ${contentType}
         and content_id = ${contentId} and status = 'pending')`;
}

try {
  const tRow = await sql<{ id: string }[]>`
    select id from tenants where slug = ${tenantSlug} limit 1`;
  if (!tRow[0]) throw new Error(`tenant '${tenantSlug}' chưa tồn tại — chạy seed trước`);
  const tenantId = tRow[0].id;

  // kg_version: tìm theo (tenant, subject, label) hoặc tạo mới.
  const vRow = await sql<{ id: string }[]>`
    select id from kg_versions
     where tenant_id = ${tenantId} and subject = ${bundle.subject} and label = ${bundle.version_label}
     limit 1`;
  const versionId = vRow[0]?.id ?? (
    await sql<{ id: string }[]>`
      insert into kg_versions (tenant_id, subject, label, status)
      values (${tenantId}, ${bundle.subject}, ${bundle.version_label}, ${activate ? "published" : "draft"})
      returning id`
  )[0]!.id;
  console.log(`  tenant=${tenantSlug} kg_version=${versionId.slice(0, 8)} (${bundle.version_label})`);

  for (const n of bundle.nodes) {
    // revision chỉ tăng khi người soạn khai báo sửa NGHĨA; importer không tự băm nội dung.
    await sql`
      insert into kg_nodes (tenant_id, kg_version_id, node_key, subject, grade, chapter, cluster, label, type, bloom_cu_tru, mo_ta, status)
      values (${tenantId}, ${versionId}, ${n.id}, ${bundle.subject}, ${String(n.grade)}, ${n.chapter},
              ${n.cluster ?? null}, ${n.label}, ${n.type}, ${n.bloom_cu_tru}, ${n.mo_ta}, ${status})
      on conflict (kg_version_id, node_key) do update set
        label = excluded.label, chapter = excluded.chapter, cluster = excluded.cluster,
        mo_ta = excluded.mo_ta, status = excluded.status`;
    await enqueueReview(tenantId, "node", n.id);
  }

  await sql`delete from kg_edges where kg_version_id = ${versionId}`;
  for (const e of bundle.edges) {
    await sql`
      insert into kg_edges (tenant_id, kg_version_id, from_key, to_key, relation, weight)
      values (${tenantId}, ${versionId}, ${e.from}, ${e.to}, ${e.relation}, ${e.weight})`;
  }

  for (const t of bundle.tiers) {
    await sql`
      insert into kg_tiers (tenant_id, kg_version_id, node_key, tier, ten, bloom, dok, muc_tieu)
      values (${tenantId}, ${versionId}, ${t.node_id}, ${t.tier}, ${t.ten}, ${t.bloom}, ${t.dok}, ${t.muc_tieu})
      on conflict (kg_version_id, node_key, tier) do update set
        ten = excluded.ten, bloom = excluded.bloom, dok = excluded.dok, muc_tieu = excluded.muc_tieu`;
  }

  for (const q of bundle.questions) {
    const spec = FORM_SPEC[q.dang_cau_hoi];
    const objective = q.loai_danh_gia === "objective";
    await sql`
      insert into questions (
        tenant_id, kg_version_id, question_key, node_key, tier,
        dang_cau_hoi, nhom_cham, ui_can_thiet, tinh_mastery, hoi_do_tu_tin,
        loai_danh_gia, dok, do_kho, do_kho_uoc_luong, noi_dung, tham_so_hoa,
        dap_an, loi_giai, distractors, buoc, audio_uri,
        rubric, bai_mau, loi_thuong_gap, loi_cai_san, trang_thai)
      values (
        ${tenantId}, ${versionId}, ${q.id}, ${q.node_id}, ${q.tier ?? null},
        ${q.dang_cau_hoi}, ${spec.nhom_cham}, ${spec.ui_can_thiet}, ${spec.tinh_mastery}, ${q.hoi_do_tu_tin},
        ${q.loai_danh_gia}, ${q.dok}, ${q.do_kho}, ${q.do_kho_uoc_luong}, ${q.noi_dung}, ${q.tham_so_hoa},
        ${objective ? q.dap_an : null}, ${objective ? (q.loi_giai ?? null) : null},
        ${objective ? j(q.distractors) : null}, ${objective && q.buoc.length ? j(q.buoc) : null},
        ${objective ? (q.audio_uri ?? null) : null},
        ${!objective ? j(q.rubric) : null}, ${!objective ? j(q.bai_mau) : null},
        ${!objective ? j(q.loi_thuong_gap) : null}, ${!objective && q.loi_cai_san.length ? j(q.loi_cai_san) : null},
        ${status})
      on conflict (kg_version_id, question_key) do update set
        dang_cau_hoi = excluded.dang_cau_hoi, nhom_cham = excluded.nhom_cham,
        ui_can_thiet = excluded.ui_can_thiet, tinh_mastery = excluded.tinh_mastery,
        hoi_do_tu_tin = excluded.hoi_do_tu_tin, dok = excluded.dok, do_kho = excluded.do_kho,
        do_kho_uoc_luong = excluded.do_kho_uoc_luong, noi_dung = excluded.noi_dung,
        dap_an = excluded.dap_an, loi_giai = excluded.loi_giai, distractors = excluded.distractors,
        buoc = excluded.buoc, audio_uri = excluded.audio_uri, rubric = excluded.rubric,
        bai_mau = excluded.bai_mau, loi_thuong_gap = excluded.loi_thuong_gap,
        loi_cai_san = excluded.loi_cai_san, trang_thai = excluded.trang_thai`;
    await enqueueReview(tenantId, "question", q.id);
  }

  for (const l of bundle.ladders) {
    await sql`
      insert into socratic_ladders (tenant_id, kg_version_id, ladder_key, node_key, misconception, rungs, bottom_out, cong_no_luc, status)
      values (${tenantId}, ${versionId}, ${l.id}, ${l.node_id}, ${l.misconception},
              ${j(l.rungs)}, ${j(l.bottom_out)}, ${j(l.cong_no_luc)}, ${status})
      on conflict (kg_version_id, ladder_key) do update set
        misconception = excluded.misconception, rungs = excluded.rungs,
        bottom_out = excluded.bottom_out, cong_no_luc = excluded.cong_no_luc, status = excluded.status`;
    await enqueueReview(tenantId, "ladder", l.id);
  }

  for (const r of bundle.resources) {
    // resource_key = r.id trong gói ⇒ review_queue.content_id truy ngược được đúng hàng.
    // Index resources_key_uq giờ là unique TOÀN PHẦN (kg-core-v22.sql — PostgREST
    // của edge fn không khớp được index một phần), nên conflict target trần là đủ.
    await sql`
      insert into resources (tenant_id, kg_version_id, resource_key, node_key, tier, format, ly_do_chon_format, dual_coding, accessibility, uri, status)
      values (${tenantId}, ${versionId}, ${r.id}, ${r.node_id}, ${r.tier ?? null}, ${r.format},
              ${r.ly_do_chon_format ?? null}, ${r.dual_coding}, ${r.accessibility ?? null}, ${r.uri ?? null}, ${status})
      on conflict (kg_version_id, resource_key) do update set
        node_key = excluded.node_key, tier = excluded.tier, format = excluded.format,
        ly_do_chon_format = excluded.ly_do_chon_format, dual_coding = excluded.dual_coding,
        accessibility = excluded.accessibility, uri = excluded.uri, status = excluded.status`;
    await enqueueReview(tenantId, "resource", r.id);
  }

  const c = await sql<{ nodes: number; edges: number; questions: number; ladders: number; resources: number }[]>`
    select
      (select count(*)::int from kg_nodes        where kg_version_id = ${versionId}) as nodes,
      (select count(*)::int from kg_edges        where kg_version_id = ${versionId}) as edges,
      (select count(*)::int from questions       where kg_version_id = ${versionId}) as questions,
      (select count(*)::int from socratic_ladders where kg_version_id = ${versionId}) as ladders,
      (select count(*)::int from resources       where kg_version_id = ${versionId}) as resources`;
  const t = c[0]!;
  console.log(`✓ nạp xong → nodes=${t.nodes} edges=${t.edges} questions=${t.questions} ladders=${t.ladders} resources=${t.resources}`);
  if (!activate) console.log("  nội dung đang chờ duyệt trong review_queue — chưa phục vụ học sinh.");
} catch (err) {
  console.error("✗ import thất bại:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
