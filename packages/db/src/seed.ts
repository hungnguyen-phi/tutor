/**
 * M2 seed loader — loads pre-approved KG content for the M3 vertical slice.
 * Toán "Hàm số bậc hai" (objective + CAS-parametrized + Socratic ladder) and
 * Tiếng Anh "Present simple -s" (objective MCQ + Writing rubric + Speaking task).
 *
 * Idempotent: upserts by natural keys; re-running is safe.
 * Run: pnpm --filter @tutor/db seed
 */
import postgres from "postgres";

const rawPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "uksbvlkhcyhnpfamducc";
if (!rawPassword && !process.env.DATABASE_URL) {
  console.error("✗ Set SUPABASE_DB_PASSWORD or DATABASE_URL.");
  process.exit(1);
}

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
  : postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

/** jsonb helper — seed values are plain JSON-safe objects/arrays. */
const j = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);

interface SubjectSeed {
  subject: string;
  label: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<{ from_key: string; to_key: string; relation: string; weight: number }>;
  tiers: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
  ladders: Array<Record<string, unknown>>;
}

const TOAN: SubjectSeed = {
  subject: "Toan",
  label: "Toán 10 — GDPT 2018 (seed v1)",
  nodes: [
    { node_key: "T_HS", grade: "10", chapter: "C3. Hàm số bậc hai & đồ thị", label: "Hàm số & đồ thị", type: "KN", bloom_cu_tru: "Understand", mo_ta: "Khái niệm hàm số, TXĐ, đồng biến – nghịch biến." },
    { node_key: "T_HSB2", grade: "10", chapter: "C3. Hàm số bậc hai & đồ thị", label: "Hàm số bậc hai (parabol)", type: "KY", bloom_cu_tru: "Apply", mo_ta: "Đồ thị parabol, đỉnh, trục đối xứng." },
  ],
  edges: [{ from_key: "T_HS", to_key: "T_HSB2", relation: "prerequisite_hard", weight: 1.0 }],
  tiers: [
    { node_key: "T_HSB2", tier: 1, ten: "Bậc 1 Hiểu", bloom: "Understand", dok: 1, muc_tieu: "Nhận biết dạng đồ thị, đỉnh, trục đối xứng." },
    { node_key: "T_HSB2", tier: 2, ten: "Bậc 2 Vận dụng chuẩn", bloom: "Apply", dok: 2, muc_tieu: "Tính tọa độ đỉnh, trục đối xứng từ a, b, c." },
    { node_key: "T_HSB2", tier: 3, ten: "Bậc 3 Vận dụng cao", bloom: "Analyze", dok: 3, muc_tieu: "Vận dụng đỉnh/parabol vào GTLN–GTNN." },
  ],
  questions: [
    { question_key: "T_HSB2_Q1", node_key: "T_HSB2", tier: 1, loai_danh_gia: "objective", dok: 1, do_kho: "de",
      noi_dung: "Đồ thị của hàm số bậc hai y = ax² + bx + c (a ≠ 0) là đường gì?",
      dap_an: "parabol", loi_giai: "Đồ thị hàm số bậc hai là một parabol.",
      distractors: [
        { phuong_an: "đường thẳng", quan_niem_sai: "nhầm với hàm bậc nhất" },
        { phuong_an: "đường tròn", quan_niem_sai: "nhầm dạng đồ thị" },
        { phuong_an: "hypebol", quan_niem_sai: "nhầm với hàm phân thức" },
      ], tham_so_hoa: false },
    { question_key: "T_HSB2_Q2", node_key: "T_HSB2", tier: 2, loai_danh_gia: "objective", dok: 2, do_kho: "TB",
      noi_dung: "Tìm tọa độ đỉnh của parabol y = x² − 4x + 3.",
      dap_an: "(2; -1)", loi_giai: "x_đỉnh = -b/(2a) = 4/2 = 2; y(2) = 4 − 8 + 3 = -1. Đỉnh (2; -1).",
      distractors: [
        { phuong_an: "(-2; 15)", quan_niem_sai: "dùng b/2a thay vì -b/2a (sai dấu hoành độ đỉnh)" },
        { phuong_an: "(2; 3)", quan_niem_sai: "lấy tung độ đỉnh bằng c, không thay x vào hàm" },
        { phuong_an: "(4; 3)", quan_niem_sai: "nhầm hoành độ đỉnh là -b thay vì -b/2a" },
      ], tham_so_hoa: false },
    { question_key: "T_HSB2_Q3", node_key: "T_HSB2", tier: 2, loai_danh_gia: "objective", dok: 2, do_kho: "TB",
      noi_dung: "Tìm hoành độ đỉnh của parabol y = x² + {b}x + {c}. (khuôn tham số: b, c nguyên)",
      dap_an: "-{b}/2", loi_giai: "Hoành độ đỉnh x = -b/(2a) với a = 1 ⇒ x = -{b}/2. CAS kiểm tương đương biểu thức.",
      distractors: [
        { phuong_an: "{b}/2", quan_niem_sai: "sai dấu: dùng b/2a" },
        { phuong_an: "-{b}", quan_niem_sai: "quên chia 2a" },
      ], tham_so_hoa: true },
    { question_key: "T_HSB2_Q4", node_key: "T_HSB2", tier: 3, loai_danh_gia: "objective", dok: 3, do_kho: "kho",
      noi_dung: "Giá trị nhỏ nhất của hàm số y = x² − 4x + 3 là bao nhiêu?",
      dap_an: "-1", loi_giai: "Vì a = 1 > 0, GTNN đạt tại đỉnh: y_min = y(2) = -1.",
      distractors: [
        { phuong_an: "3", quan_niem_sai: "nhầm GTNN là hệ số c" },
        { phuong_an: "2", quan_niem_sai: "nhầm GTNN là hoành độ đỉnh" },
        { phuong_an: "không có GTNN", quan_niem_sai: "không nhận ra a > 0 nên có GTNN" },
      ], tham_so_hoa: false },
  ],
  ladders: [
    { ladder_key: "T_HSB2_L1", node_key: "T_HSB2", misconception: "dùng b/2a thay vì -b/2a (sai dấu hoành độ đỉnh)",
      rungs: [
        { bac: 1, loai: "sieu nhan thuc", cau_hoi: "Em tính hoành độ đỉnh bằng cách nào? Viết lại công thức em đã dùng." },
        { bac: 2, loai: "huong chu y", cau_hoi: "Công thức hoành độ đỉnh có dấu gì trước b? Em thử so lại với công thức trong vở." },
        { bac: 3, loai: "dan ve tien de", cau_hoi: "Trục đối xứng x = -b/(2a). Với a = 1, b = -4 thì -b/(2a) bằng bao nhiêu?" },
        { bac: 4, loai: "gian giao manh", cau_hoi: "Thử ví dụ đơn giản y = x² − 2x: -b/(2a) = 2/2 = 1. Em áp dụng tương tự cho bài của mình nhé?" },
      ],
      bottom_out: { dieu_kien_mo: "đã thử ≥2 lần và diễn đạt được suy nghĩ", noi_dung: "Hoành độ đỉnh = -b/(2a) = -(-4)/2 = 2 (chú ý dấu trừ). Giờ em thay x = 2 vào hàm để tính tung độ." },
      cong_no_luc: { so_lan_thu_toi_thieu: 2, yeu_cau: "đã diễn đạt được công thức đang dùng hoặc có dấu hiệu bí", contingent: "HS giỏi: gợi ý ít, lên bậc nhanh. HS yếu: giàn giáo nhiều hơn.", cam: "Không cho nhảy thẳng xuống bottom_out." } },
  ],
};

const ANH: SubjectSeed = {
  subject: "Anh",
  label: "English Grammar (seed v1)",
  nodes: [
    { node_key: "E_PRES3S", grade: "10", chapter: "Present Simple", label: "Present simple — third person -s", type: "QT", bloom_cu_tru: "Apply", mo_ta: "Add -s/-es to the verb with he/she/it in the present simple." },
  ],
  edges: [],
  tiers: [
    { node_key: "E_PRES3S", tier: 1, ten: "Tier 1 Understand", bloom: "Understand", dok: 1, muc_tieu: "Recognize when to add -s/-es." },
    { node_key: "E_PRES3S", tier: 2, ten: "Tier 2 Apply", bloom: "Apply", dok: 2, muc_tieu: "Produce correct third-person forms in context." },
  ],
  questions: [
    { question_key: "E_PRES3S_Q1", node_key: "E_PRES3S", tier: 2, loai_danh_gia: "objective", dok: 2, do_kho: "de",
      noi_dung: "Choose the correct option: She ___ to school every day.",
      dap_an: "goes", loi_giai: "Third person singular (she) takes -es: go → goes.",
      distractors: [
        { phuong_an: "go", quan_niem_sai: "thiếu -s/-es ở ngôi thứ ba số ít" },
        { phuong_an: "going", quan_niem_sai: "nhầm sang hiện tại tiếp diễn" },
        { phuong_an: "gone", quan_niem_sai: "nhầm sang quá khứ phân từ" },
      ], tham_so_hoa: false },
    { question_key: "E_PRES3S_Q2", node_key: "E_PRES3S", tier: 1, loai_danh_gia: "objective", dok: 1, do_kho: "de",
      noi_dung: "Which form is correct? He ___ football every weekend.",
      dap_an: "plays", loi_giai: "He + play → plays (add -s).",
      distractors: [
        { phuong_an: "play", quan_niem_sai: "thiếu -s ngôi thứ ba số ít" },
        { phuong_an: "playing", quan_niem_sai: "nhầm hiện tại tiếp diễn" },
      ], tham_so_hoa: false },
    { question_key: "E_PRES3S_W1", node_key: "E_PRES3S", tier: 2, loai_danh_gia: "rubric", dok: 3, do_kho: "TB",
      noi_dung: "[WRITING] Write 3–4 sentences about a friend's daily routine (use he/she).",
      rubric: [
        { tieu_chi: "Grammar (third-person -s)", thang_muc: ["0 – nhiều lỗi -s", "1 – vài lỗi", "2 – hầu hết đúng", "3 – chính xác"] },
        { tieu_chi: "Vocabulary", thang_muc: ["0 – rất hạn chế", "1 – cơ bản", "2 – phù hợp", "3 – đa dạng"] },
        { tieu_chi: "Coherence", thang_muc: ["0 – rời rạc", "1 – liên kết yếu", "2 – mạch lạc", "3 – rất mạch lạc"] },
      ],
      bai_mau: ["My friend Anna gets up at 6. She has breakfast and goes to school. She studies hard and plays the piano in the evening."],
      loi_thuong_gap: ["quên -s với he/she", "dùng sai have/has", "thiếu liên từ"], tham_so_hoa: false },
    { question_key: "E_PRES3S_S1", node_key: "E_PRES3S", tier: 2, loai_danh_gia: "rubric", dok: 2, do_kho: "de",
      noi_dung: "[SPEAKING] Talk for ~30 seconds about what a member of your family does every day.",
      rubric: [
        { tieu_chi: "Pronunciation", thang_muc: ["0", "1", "2", "3"] },
        { tieu_chi: "Fluency", thang_muc: ["0", "1", "2", "3"] },
        { tieu_chi: "Coherence", thang_muc: ["0", "1", "2", "3"] },
      ],
      bai_mau: ["My father works in an office. He wakes up early, drives to work, and comes home at six."],
      loi_thuong_gap: ["bỏ -s khi nói", "ngập ngừng nhiều", "phát âm đuôi -s chưa rõ"], tham_so_hoa: false },
  ],
  ladders: [
    { ladder_key: "E_PRES3S_L1", node_key: "E_PRES3S", misconception: "thiếu -s/-es ở ngôi thứ ba số ít",
      rungs: [
        { bac: 1, loai: "sieu nhan thuc", cau_hoi: "Read your sentence aloud. Who is the subject — he, she, it, or they?" },
        { bac: 2, loai: "huong chu y", cau_hoi: "When the subject is he/she/it in the present simple, what do we add to the verb?" },
        { bac: 3, loai: "dan ve tien de", cau_hoi: "'She go' or 'She goes' — which one follows the -s rule?" },
        { bac: 4, loai: "gian giao manh", cau_hoi: "Example: He play → He plays. Now fix your verb the same way." },
      ],
      bottom_out: { dieu_kien_mo: "đã thử ≥2 lần", noi_dung: "With he/she/it we add -s/-es: go → goes. So it is 'She goes to school.'" },
      cong_no_luc: { so_lan_thu_toi_thieu: 2, yeu_cau: "learner explained their choice or is clearly stuck", contingent: "stronger learners: fewer hints.", cam: "Do not reveal the answer before the effort gate." } },
  ],
};

async function loadSubject(tenantId: string, s: SubjectSeed) {
  // kg_version: find by (tenant, subject, label) or create.
  const existing = await sql<{ id: string }[]>`
    select id from kg_versions
    where tenant_id = ${tenantId} and subject = ${s.subject} and label = ${s.label} limit 1`;
  let versionId: string;
  if (existing[0]) {
    versionId = existing[0].id;
  } else {
    const row = await sql<{ id: string }[]>`
      insert into kg_versions (tenant_id, subject, label, status)
      values (${tenantId}, ${s.subject}, ${s.label}, 'published') returning id`;
    versionId = row[0]!.id;
  }

  for (const n of s.nodes) {
    await sql`
      insert into kg_nodes (tenant_id, kg_version_id, node_key, subject, grade, chapter, label, type, bloom_cu_tru, mo_ta, status, approved_by)
      values (${tenantId}, ${versionId}, ${n.node_key as string}, ${s.subject}, ${n.grade as string}, ${n.chapter as string}, ${n.label as string}, ${n.type as string}, ${n.bloom_cu_tru as string}, ${n.mo_ta as string}, 'active', null)
      on conflict (kg_version_id, node_key) do update set
        label = excluded.label, chapter = excluded.chapter, mo_ta = excluded.mo_ta, status = 'active'`;
  }

  await sql`delete from kg_edges where kg_version_id = ${versionId}`;
  for (const e of s.edges) {
    await sql`
      insert into kg_edges (tenant_id, kg_version_id, from_key, to_key, relation, weight)
      values (${tenantId}, ${versionId}, ${e.from_key}, ${e.to_key}, ${e.relation}, ${e.weight})`;
  }

  for (const t of s.tiers) {
    await sql`
      insert into kg_tiers (tenant_id, kg_version_id, node_key, tier, ten, bloom, dok, muc_tieu)
      values (${tenantId}, ${versionId}, ${t.node_key as string}, ${t.tier as number}, ${t.ten as string}, ${t.bloom as string}, ${t.dok as number}, ${t.muc_tieu as string})
      on conflict (kg_version_id, node_key, tier) do update set
        ten = excluded.ten, bloom = excluded.bloom, dok = excluded.dok, muc_tieu = excluded.muc_tieu`;
  }

  for (const q of s.questions) {
    await sql`
      insert into questions (tenant_id, kg_version_id, question_key, node_key, tier, loai_danh_gia, dok, do_kho, noi_dung, dap_an, loi_giai, distractors, tham_so_hoa, rubric, bai_mau, loi_thuong_gap, trang_thai)
      values (${tenantId}, ${versionId}, ${q.question_key as string}, ${q.node_key as string}, ${q.tier as number}, ${q.loai_danh_gia as string}, ${q.dok as number}, ${q.do_kho as string}, ${q.noi_dung as string},
        ${(q.dap_an as string) ?? null}, ${(q.loi_giai as string) ?? null}, ${q.distractors ? j(q.distractors) : null}, ${(q.tham_so_hoa as boolean) ?? false},
        ${q.rubric ? j(q.rubric) : null}, ${q.bai_mau ? j(q.bai_mau) : null}, ${q.loi_thuong_gap ? j(q.loi_thuong_gap) : null}, 'active')
      on conflict (kg_version_id, question_key) do update set
        noi_dung = excluded.noi_dung, dap_an = excluded.dap_an, loi_giai = excluded.loi_giai,
        distractors = excluded.distractors, rubric = excluded.rubric, bai_mau = excluded.bai_mau,
        loi_thuong_gap = excluded.loi_thuong_gap, trang_thai = 'active'`;
  }

  for (const l of s.ladders) {
    await sql`
      insert into socratic_ladders (tenant_id, kg_version_id, ladder_key, node_key, misconception, rungs, bottom_out, cong_no_luc, status)
      values (${tenantId}, ${versionId}, ${l.ladder_key as string}, ${l.node_key as string}, ${l.misconception as string}, ${j(l.rungs)}, ${j(l.bottom_out)}, ${j(l.cong_no_luc)}, 'active')
      on conflict (kg_version_id, ladder_key) do update set
        rungs = excluded.rungs, bottom_out = excluded.bottom_out, cong_no_luc = excluded.cong_no_luc, status = 'active'`;
  }

  const counts = await sql<{ nodes: number; questions: number; ladders: number }[]>`
    select
      (select count(*)::int from kg_nodes where kg_version_id = ${versionId}) as nodes,
      (select count(*)::int from questions where kg_version_id = ${versionId}) as questions,
      (select count(*)::int from socratic_ladders where kg_version_id = ${versionId}) as ladders`;
  console.log(`  ${s.subject}: version ${versionId.slice(0, 8)} → nodes=${counts[0]!.nodes} questions=${counts[0]!.questions} ladders=${counts[0]!.ladders}`);
}

try {
  const tRow = await sql<{ id: string }[]>`
    insert into tenants (name, slug) values ('Trường Việt Anh', 'viet-anh')
    on conflict (slug) do update set name = excluded.name returning id`;
  const tenantId = tRow[0]!.id;
  console.log(`tenant viet-anh → ${tenantId}`);
  await loadSubject(tenantId, TOAN);
  await loadSubject(tenantId, ANH);
  console.log("✓ seed complete");
} catch (err) {
  console.error("✗ seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
