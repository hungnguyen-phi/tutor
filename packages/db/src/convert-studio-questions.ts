/**
 * Chuyển bộ CÂU HỎI từ Studio (Trạm 3) → schema Question của Tutor
 * (va.kg-bundle/2.2). Đây là mắt xích "Lớp 2" còn thiếu: khung (nodes+edges) đã
 * nối qua convert-studio-kg.ts; script này nối phần NỘI DUNG BÀI HỌC.
 *
 *   pnpm --filter @tutor/db convert:questions -- --in=<studio-questions.json> \
 *        [--bundle=bundles/kg-bundle-<slug>-<grade>.json] [--out=<path>]
 *
 * · KHÔNG có --bundle: chỉ MAP + VALIDATE (đối chiếu Zod Question của Tutor) rồi
 *   ghi mảng câu hỏi + báo cáo. Dùng để kiểm mẫu Trạm 3 hợp lệ tới đâu.
 * · CÓ --bundle: trộn câu hỏi đã hợp lệ vào bundle KHUNG cùng môn (upsert theo
 *   id), validate lại CẢ bundle bằng KgBundle Zod (kiểm mọi node_id có thật) rồi
 *   ghi ra — file này import:kg nạp thẳng.
 *
 * Ánh xạ trường (Studio Trạm 3 → Tutor Question). Đọc được CẢ hai kiểu tên
 * (camelCase bản cũ · snake_case/spec v2.2), nên khi skill mới đổi format vẫn ăn:
 *   atom|node_id → node_id · noiDung|noi_dung → noi_dung · dapAn|dap_an → dap_an
 *   loiGiai|loi_giai → loi_giai · nhieu|distractors → distractors
 *   nhieu[].{noiDung,lyDo} → {phuong_an, quan_niem_sai} · doKho "dễ" → do_kho "de"
 *   thamSoHoa "false" → tham_so_hoa false
 *   dang_cau_hoi: LẤY nếu Trạm 3 ghi (spec v2.2), NGƯỢC LẠI SUY LUẬN an toàn
 *   (có đáp án nhiễu → mcq; còn lại → dien_dap_an — đều nhóm chấm tự động).
 *
 * Dạng cần payload riêng (nhieu_buoc→buoc, tim_loi→loi_cai_san, dung_sai chùm ý,
 * các dạng rubric→rubric, nghe→audio) chỉ map khi Studio có sẵn field tương ứng;
 * thiếu thì BỎ QUA + báo lý do — chờ mẫu v2.2 thật để khoá chính xác.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Question, KgBundle, FORM_SPEC, checkNodeBank, type QuestionForm } from "@tutor/shared";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

const inFile = opt("in");
if (!inFile) {
  console.error("✗ Dùng: pnpm --filter @tutor/db convert:questions -- --in=<studio-questions.json> [--bundle=<khung.json>] [--out=<path>]");
  process.exit(1);
}
const bundleFile = opt("bundle");

// ── Tiện ích đọc field đa tên (bản cũ camelCase ↔ spec v2.2 snake_case). ─────
type Any = Record<string, unknown>;
const pick = (o: Any, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null && o[k] !== "") return o[k];
  return undefined;
};
const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : v == null ? undefined : String(v));
const asBool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";
const asInt = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

// do_kho: chuẩn hoá về enum Tutor "de" | "TB" | "kho".
function normDoKho(v: unknown): "de" | "TB" | "kho" | undefined {
  const s = asStr(v)?.trim().toLowerCase();
  if (!s) return undefined;
  if (/(^de$|dễ|de\b|easy)/.test(s)) return "de";
  if (/(kho|khó|hard)/.test(s)) return "kho";
  if (/(tb|trung ?bình|medium|mid)/.test(s)) return "TB";
  return undefined;
}

const FORMS = new Set<QuestionForm>(Object.keys(FORM_SPEC) as QuestionForm[]);
// Dạng câu hỏi: lấy field nếu có, hợp lệ theo 17 dạng; nếu không thì suy luận.
function resolveForm(q: Any): QuestionForm {
  const raw = asStr(pick(q, "dang_cau_hoi", "dangCauHoi", "dang", "form", "loai"))?.trim();
  if (raw && FORMS.has(raw as QuestionForm)) return raw as QuestionForm;
  const nhieu = pick(q, "nhieu", "distractors", "phuong_an_nhieu");
  if (Array.isArray(nhieu) && nhieu.length > 0) return "mcq";
  return "dien_dap_an"; // an toàn: có đáp án, không nhiễu → điền đáp án (tự chấm)
}

// Studio distractor {noiDung,lyDo} | {phuong_an,quan_niem_sai} → Tutor {phuong_an, quan_niem_sai}.
function mapDistractors(q: Any): { phuong_an: string; quan_niem_sai: string }[] {
  const arr = pick(q, "nhieu", "distractors", "phuong_an_nhieu");
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((d: Any) => {
    const phuong_an = asStr(pick(d, "phuong_an", "noiDung", "noi_dung", "text", "dapAn"));
    // quan niệm sai: ưu tiên câu CHỮ; misconception_id-only thì tạm dùng id (chờ registry).
    const quan_niem_sai =
      asStr(pick(d, "quan_niem_sai", "lyDo", "ly_do", "misconception", "misconception_text")) ??
      asStr(pick(d, "misconception_id", "misconceptionId")) ??
      "";
    if (!phuong_an) return [];
    return [{ phuong_an, quan_niem_sai }];
  });
}

// ── Đọc câu hỏi Studio. Chấp nhận mảng thuần hoặc {questions:[...]}. ─────────
const rawIn = JSON.parse(readFileSync(resolve(inFile), "utf8"));
const items: Any[] = Array.isArray(rawIn) ? rawIn : Array.isArray(rawIn?.questions) ? rawIn.questions : [];
if (items.length === 0) {
  console.error(`✗ ${inFile}: không thấy mảng câu hỏi (mảng thuần hoặc {questions:[...]})`);
  process.exit(1);
}

// Dạng chỉ map được khi CÓ payload riêng (chưa thấy trong mẫu → sẽ báo & bỏ qua).
const NEEDS_PAYLOAD = new Set<QuestionForm>(["nhieu_buoc", "tim_loi", "dung_sai", "nghe"]);

const mapped: Question[] = [];
const skipped: { id: string; form: string; reason: string }[] = [];

for (const q of items) {
  const id = asStr(pick(q, "id", "question_id", "questionId")) ?? `q-${mapped.length + skipped.length + 1}`;
  const node_id = asStr(pick(q, "node_id", "nodeId", "atom", "atomId", "atom_id"));
  if (!node_id) {
    skipped.push({ id, form: "?", reason: "thiếu node_id/atom" });
    continue;
  }
  const form = resolveForm(q);
  const spec = FORM_SPEC[form];

  // Dạng cần payload riêng mà Studio chưa kèm → bỏ qua trung thực, chờ mẫu v2.2.
  if (NEEDS_PAYLOAD.has(form)) {
    skipped.push({ id, form, reason: `dạng '${form}' cần payload riêng (buoc/loi_cai_san/audio) — chưa map, chờ mẫu v2.2` });
    continue;
  }
  // Dạng rubric (nhóm B) cần rubric — mẫu hiện là objective; bỏ qua nếu rơi vào.
  if (spec.nhom_cham !== "auto" && form !== "phan_tu") {
    skipped.push({ id, form, reason: `dạng rubric '${form}' cần tiêu chí chấm — chưa map` });
    continue;
  }

  const tier = asInt(pick(q, "tier", "bac", "bậc"));
  const dok = asInt(pick(q, "dok", "DOK")) ?? 1;
  const noi_dung = asStr(pick(q, "noi_dung", "noiDung", "content", "de_bai"));
  const dap_an = asStr(pick(q, "dap_an", "dapAn", "answer", "key")) ?? "";
  if (!noi_dung) {
    skipped.push({ id, form, reason: "thiếu nội dung câu hỏi" });
    continue;
  }

  const tierNorm = tier != null && tier >= 1 && tier <= 3 ? (tier as 1 | 2 | 3) : undefined;
  const candidate = {
    id,
    node_id,
    ...(tierNorm ? { tier: tierNorm } : {}),
    dang_cau_hoi: form,
    dok: (dok >= 1 && dok <= 4 ? dok : 1) as 1 | 2 | 3 | 4,
    do_kho: normDoKho(pick(q, "do_kho", "doKho", "difficulty")) ?? "TB",
    do_kho_uoc_luong: true, // ước lượng người soạn, chưa có dữ liệu thật
    noi_dung,
    tham_so_hoa: asBool(pick(q, "tham_so_hoa", "thamSoHoa")),
    // Spec: câu Bậc 2–3 mặc định hỏi độ tự tin (bắt "đúng nhờ đoán").
    hoi_do_tu_tin: pick(q, "hoi_do_tu_tin", "hoiDoTuTin", "do_tu_tin") != null
      ? asBool(pick(q, "hoi_do_tu_tin", "hoiDoTuTin", "do_tu_tin"))
      : tierNorm != null && tierNorm >= 2,
    loai_danh_gia: "objective" as const,
    dap_an,
    ...(asStr(pick(q, "loi_giai", "loiGiai", "explanation")) ? { loi_giai: asStr(pick(q, "loi_giai", "loiGiai", "explanation")) } : {}),
    distractors: mapDistractors(q),
    buoc: [] as never[],
  };

  const parsed = Question.safeParse(candidate);
  if (!parsed.success) {
    skipped.push({ id, form, reason: parsed.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") });
    continue;
  }
  mapped.push(parsed.data);
}

// ── Báo cáo. ────────────────────────────────────────────────────────────────
const formCount = new Map<string, number>();
for (const q of mapped) formCount.set(q.dang_cau_hoi, (formCount.get(q.dang_cau_hoi) ?? 0) + 1);
const auto = mapped.filter((q) => FORM_SPEC[q.dang_cau_hoi].nhom_cham === "auto").length;

console.log(`✓ ${inFile}`);
console.log(`  câu hỏi: ${items.length} đọc · ${mapped.length} HỢP LỆ (khớp Zod Question của Tutor) · ${skipped.length} bỏ qua`);
console.log(`  dạng: ${[...formCount.entries()].map(([k, v]) => `${k}=${v}`).join(" · ") || "(không có)"}`);
console.log(`  tự chấm (nhóm A): ${mapped.length ? Math.round((auto / mapped.length) * 100) : 0}% (trần chi phí LLM cần ≥70%/node)`);

// Cảnh báo node nào chưa đạt ≥70% tự chấm (dùng chính validator của importer).
const byNode = new Map<string, Question[]>();
for (const q of mapped) byNode.set(q.node_id, [...(byNode.get(q.node_id) ?? []), q]);
const thinNodes = [...byNode.entries()].map(([n, qs]) => ({ n, ...checkNodeBank(qs) })).filter((r) => !r.ok);
if (thinNodes.length) {
  console.log(`  ⚠ ${thinNodes.length} node chưa đạt chuẩn ngân hàng (vd: ${thinNodes[0]!.n} — ${thinNodes[0]!.reason})`);
}
if (skipped.length) {
  console.log(`  ── bỏ qua (${skipped.length}) — mẫu để hoàn thiện converter: ──`);
  for (const s of skipped.slice(0, 8)) console.log(`     · ${s.id} [${s.form}]: ${s.reason}`);
  if (skipped.length > 8) console.log(`     … và ${skipped.length - 8} câu nữa`);
}

// ── Xuất. ────────────────────────────────────────────────────────────────────
if (bundleFile) {
  // Trộn vào bundle KHUNG cùng môn → file import:kg nạp thẳng (kiểm mọi node_id).
  const bundleRaw = JSON.parse(readFileSync(resolve(bundleFile), "utf8"));
  const base = KgBundle.parse(bundleRaw);
  const nodeKeys = new Set(base.nodes.map((n) => n.id));
  const orphan = mapped.filter((q) => !nodeKeys.has(q.node_id));
  if (orphan.length) {
    console.error(`✗ ${orphan.length} câu hỏi trỏ tới node KHÔNG có trong ${bundleFile} (vd ${orphan[0]!.node_id}). Sai môn/khối hoặc ID lệch — dừng.`);
    process.exit(1);
  }
  const merged = new Map(base.questions.map((q) => [q.id, q as Question]));
  for (const q of mapped) merged.set(q.id, q);
  const outBundle = { ...base, questions: [...merged.values()] };
  const parsed = KgBundle.safeParse(outBundle);
  if (!parsed.success) {
    console.error("✗ Bundle sau khi trộn không khớp KgBundle — lỗi của script:");
    for (const i of parsed.error.issues.slice(0, 15)) console.error(`  · ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
  }
  const out = resolve(opt("out") ?? bundleFile);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(parsed.data, null, 2) + "\n", "utf8");
  console.log(`✓ trộn ${mapped.length} câu hỏi vào bundle → ${out}  (nạp: pnpm --filter @tutor/db import:kg -- ${out})`);
} else {
  const base = inFile.split(/[\\/]/).pop()!.replace(/\.json$/i, "");
  const out = resolve(opt("out") ?? `bundles/questions-${base}.tutor.json`);
  mkdirSync(dirname(out), { recursive: true });

  // --set=<Subject>:<version_label> → xuất ENVELOPE va.kg-questions/2.2 mà cửa
  // "Cắm bộ câu hỏi" (/teacher) kéo-thả thẳng. Nhãn phải KHỚP một phiên bản KG
  // đã nạp khung (vd published "Toán 10 — Kết nối tri thức (GDPT 2018)").
  const setArg = opt("set");
  if (setArg) {
    const idx = setArg.indexOf(":");
    const subject = idx > 0 ? setArg.slice(0, idx) : "";
    const versionLabel = idx > 0 ? setArg.slice(idx + 1) : "";
    if (!subject || !versionLabel) {
      console.error('✗ --set cần dạng "<Subject>:<version_label>", vd --set="Toan:Toán 10 — Kết nối tri thức (GDPT 2018)"');
      process.exit(1);
    }
    const envelope = {
      schema: "va.kg-questions/2.2" as const,
      subject,
      version_label: versionLabel,
      nguon: `convert:questions · ${base}`,
      questions: mapped,
    };
    writeFileSync(out, JSON.stringify(envelope, null, 2) + "\n", "utf8");
    console.log(`✓ ghi GÓI ${mapped.length} câu (va.kg-questions/2.2) → ${out}`);
    console.log(`  Kéo-thả file này vào /teacher › "Cắm bộ câu hỏi" (nhãn: ${versionLabel}).`);
  } else {
    // Không --set: xuất mảng thuần (để trộn tiếp / kiểm mẫu).
    writeFileSync(out, JSON.stringify(mapped, null, 2) + "\n", "utf8");
    console.log(`✓ ghi ${mapped.length} câu hỏi (đã hợp lệ schema Tutor) → ${out}`);
    console.log(`  · --bundle=bundles/kg-bundle-<slug>-<grade>.json → trộn vào khung (import:kg)`);
    console.log(`  · --set="Toan:<nhãn phiên bản>" → xuất gói kéo-thả cho /teacher`);
  }
}
