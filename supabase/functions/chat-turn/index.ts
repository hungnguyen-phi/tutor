// chat-turn — ENGINE ÁP CỨNG (kiến trúc chính thức, xem DESIGN.md §Engine).
// Câu hỏi khách quan (nhom_cham='auto') được chấm và dẫn dắt 100% bằng logic
// xác định — KHÔNG gọi LLM ở bất kỳ bước nào: CAS chấm đúng/sai → khớp
// distractor ra quan niệm sai → thang Socratic SOẠN SẴN (rungs → bottom_out,
// qua cổng nỗ lực) → hết thang mà vẫn sai thì LAN TRUYỀN NGƯỢC qua cạnh
// prerequisite_hard: tìm nguyên tử nền còn hổng sâu nhất, vá nó trước, vá xong
// leo ngược lên bài cũ. Mastery/Leitner cập nhật NGAY mỗi câu trả lời.
// LLM chỉ còn ở 2 nhánh chấm rubric (writing/speaking) và chat tự do — và cả
// hai đều có đường lui tử tế khi trường chưa cấp khoá AI.
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can } from "../_shared/auth.ts";
import { checkAnswer, type CasResult } from "../_shared/cas.ts";
import { gradeInteractive, parseInteractive, type InteractiveStruct } from "../_shared/interactive.ts";
import { evaluateEffortGate } from "../_shared/pedagogy.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { anonymize, rehydrate, callLLM } from "../_shared/llm.ts";
import { buildGuideSystem, buildScoredRubricSystem } from "../_shared/prompts.ts";
import { rubricFor, buildRubricResult, parseRubricJson, type RubricResult } from "../_shared/rubrics.ts";
import { awardXp, type XpEventInput } from "../_shared/xp.ts";
import { recomputeNodeState } from "../_shared/mastery-state.ts";
import { loadQuestionOverrides, isHidden, applyQuestionEdit, type QOverride } from "../_shared/overrides.ts";
import { detectSafety, recordSafetyFlag, supportiveReply } from "../_shared/safety.ts";
import { genParams, seedFrom, fillTemplate, readSpec } from "../_shared/paramgen.ts";
import { orderedOptions } from "../_shared/options.ts";

// Studio ghi độ khó bằng CHỮ ("dễ/trung bình/khó"); cột enum do_kho ở DB là de/TB/kho.
// questions.do_kho (text) giữ chữ cho hiển thị; CHỈ đổi sang mã enum khi ghi mastery.
const DO_KHO_ENUM: Record<string, string> = {
  "dễ": "de", de: "de", "trung bình": "TB", tb: "TB", TB: "TB", "khó": "kho", kho: "kho",
};
const toDoKho = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return DO_KHO_ENUM[s] ?? DO_KHO_ENUM[s.toLowerCase()] ?? "TB";
};

interface Session {
  id: string;
  tenant_id: string;
  student_id: string;
  subject: string;
  kg_version_id: string;
  current_node_id: string | null;
}

interface QuestionItem {
  id: string;
  nodeKey: string;
  tier: number | null;
  dok: number;
  doKho: string;
  kind: string;
  prompt: string;
  options?: string[];
  /** 1 trong 17 dạng (mcq, dung_sai, sap_xep, noi_cot…) — client dựng UI tương ứng. */
  dangCauHoi?: string | null;
  /** Cấu trúc bóc sẵn cho dạng tương tác (sap_xep/noi_cot) — KHÔNG kèm đáp án. */
  interactive?: InteractiveStruct;
}

const REMEDIATION_MAX_DEPTH = 4;

/**
 * Chất lượng suy nghĩ tính từ NỘI DUNG lời học sinh viết (0..1) — TÍNH Ở SERVER,
 * KHÔNG nhận từ client (client có thể khai khống để nhảy cổng nỗ lực). Câu càng
 * dài + có từ lập luận (vì/nên/suy ra/công thức…) thì điểm càng cao; mặc định an
 * toàn là THẤP khi HS chỉ điền đáp án trơ. Tín hiệu NỖ LỰC theo số lần thử được
 * cộng RIÊNG ở nơi gọi (không lẫn vào telemetry này).
 */
function thinkingContentSignal(text: string): number {
  const t = (text ?? "").trim();
  const words = t ? t.split(/\s+/).filter(Boolean).length : 0;
  let q = Math.min(0.5, words / 30); // độ dài đóng góp tối đa 0.5
  if (/(vì|bởi|do |nên|suy ra|=>|→|ta có|thay|công thức|because|since|therefore|so that|step|bước)/i.test(t)) {
    q = Math.max(q, 0.6); // có dấu hiệu lập luận → đủ để coi là "đã thể hiện suy nghĩ"
  }
  return Math.max(0, Math.min(1, q));
}

/** Tóm tắt RubricResult thành text cho bong bóng chat (+ fallback khi client cũ). */
function rubricSummaryText(r: RubricResult): string {
  const lines = r.scores.map((s) => `• ${s.tieu_chi}: ${s.diem}/3 — ${s.nhan_xet}`);
  return [
    `Điểm ${r.ten}: ${r.tong}/${r.toi_da} (${r.muc})`,
    ...lines,
    r.nhan_xet_chung,
    r.cau_hoi_sua ? `👉 ${r.cau_hoi_sua}` : "",
  ].filter(Boolean).join("\n");
}

/** Câu hỏi auto kế tiếp trên một node mà học sinh CHƯA trả lời đúng.
 *  `excludeId`: bỏ qua đúng câu vừa làm (để không phục vụ lại chính nó). */
/** Câu MỞ bị gắn nhãn objective/auto: KHÔNG có phương án nhiễu, đề KHÔNG có chỗ
 *  trống, và đáp án là cả một ĐOẠN VĂN ("Giải thích vì sao…", "Tìm lỗi sai trong
 *  bài làm…"). CAS so chữ chính xác nên học sinh viết đúng ý bằng lời mình vẫn bị
 *  chấm SAI — 136 câu trong ngân hàng sống rơi vào diện này (đáp án dài trung vị
 *  268 ký tự).
 *
 *  Ngưỡng 40 ký tự: đo trên toàn bộ dữ liệu sống, nhóm "không phương án + không
 *  chỗ trống" chỉ có đúng 136 câu, ngắn nhất 60 ("LỖI 1: … LỖI 2: …" — cũng là
 *  câu mở) rồi nhảy thẳng lên 113. Ngưỡng 40 ôm trọn nhóm mà vẫn chừa chỗ an
 *  toàn cho câu đáp-án-ngắn về sau (số, công thức: thường dưới 25 ký tự) — những
 *  câu đó phải ở lại CAS, chấm tất định. */
function isOpenAnswer(q: { dap_an: unknown; noi_dung: string | null; distractors: unknown }): boolean {
  if (Array.isArray(q.distractors) && q.distractors.length > 0) return false;
  const dap = String(q.dap_an ?? "");
  // Điền khuyết: chỗ trống là SỐ / biểu thức thì CAS chấm CHUẨN HƠN mô hình
  // (nó biết 1/2 = 0,5 = 50%). Nhưng chỗ trống là CỤM TỪ ("trái dấu a") thì CAS
  // chỉ so chữ — học sinh viết "ngược dấu a", đúng nghĩa toán học, vẫn bị chấm
  // sai. Chữ nghĩa thì giao cho mô hình so Ý. Đo trên ngân hàng sống: 31 câu
  // điền-bằng-chữ (đang oan) vs 22 câu điền-bằng-số (giữ CAS).
  if (/_{2,}/.test(q.noi_dung ?? "")) return isWordyAnswer(dap);
  return dap.length > 40;
}

/** Đáp án "chữ nghĩa" — không phải số, biểu thức hay LaTeX. */
function isWordyAnswer(dap: string): boolean {
  if (/\\|[=+^{}]|\d\s*\/\s*\d/.test(dap)) return false; // \vec, x=1, 1/2 → toán
  return /\p{L}{3,}/u.test(dap);
}

const OPEN_SYS_VI =
  `Bạn là giám khảo chấm câu trả lời tự luận ngắn của học sinh lớp 10.\n` +
  `So Ý CHÍNH của bài làm với đáp án mẫu — TUYỆT ĐỐI không đòi trùng câu chữ.\n` +
  `Diễn đạt khác mà nêu đủ ý cốt lõi thì vẫn ĐÚNG. Thiếu ý cốt lõi hoặc sai bản chất thì SAI.\n` +
  `Chỉ trả về JSON, không thêm lời nào khác:\n` +
  `{"dung": true hoặc false, "thieu": "ý còn thiếu, một câu ngắn; để rỗng nếu đúng"}`;
const OPEN_SYS_EN =
  `You grade a Grade-10 student's short written answer.\n` +
  `Compare the KEY IDEAS against the reference answer — never require identical wording.\n` +
  `Different phrasing with all core ideas present is CORRECT. Missing a core idea or a\n` +
  `conceptual error is INCORRECT. Reply with JSON only:\n` +
  `{"dung": true or false, "thieu": "the missing idea in one short sentence; empty if correct"}`;

/** Chấm câu MỞ bằng mô hình: so Ý, không so chữ. Trả null nếu gọi hỏng / hết
 *  ngân sách token / mô hình trả rác — nơi gọi rơi về CAS như cũ (thà giữ hành vi
 *  cũ còn hơn trao mastery bừa khi không chấm được). */
async function gradeOpenAnswer(args: {
  prompt: string;
  reference: string;
  studentAnswer: string;
  names: string[];
  en: boolean;
  studentId: string;
  tenantId: string;
  supa: ReturnType<typeof admin>;
}): Promise<CasResult | null> {
  try {
    const { text: safe, map } = anonymize(args.studentAnswer, args.names);
    const res = await callLLM({
      system: args.en ? OPEN_SYS_EN : OPEN_SYS_VI,
      user:
        `Đề:\n${args.prompt}\n\nĐáp án mẫu:\n${args.reference}\n\nBài làm của học sinh:\n${safe}`,
      agent: "grade-open",
      tier: "default",
      maxTokens: 220,
      temperature: 0,
      studentId: args.studentId,
      tenantId: args.tenantId,
      supa: args.supa,
    });
    const raw = rehydrate(res.text, map);
    const hit = raw.match(/\{[\s\S]*\}/); // mô hình hay bọc JSON trong lời dẫn
    if (!hit) return null;
    const j = JSON.parse(hit[0]) as { dung?: unknown; thieu?: unknown };
    if (typeof j.dung !== "boolean") return null;
    return { correct: j.dung, method: "llm", detail: String(j.thieu ?? "") };
  } catch {
    return null; // hỏng / hết ngân sách → CAS
  }
}

async function pickQuestion(
  supa: ReturnType<typeof admin>,
  s: Session,
  nodeKey: string,
  excludeId?: string,
): Promise<QuestionItem | null> {
  const { data: qs } = await supa
    .from("questions")
    // Bỏ `tham_so` (schema chưa có cột) + chỉ câu tĩnh — xem ghi chú ở diagnose.
    .select("id, node_key, tier, dok, do_kho, loai_danh_gia, dang_cau_hoi, noi_dung, dap_an, distractors, nhom_cham, tham_so_hoa")
    .eq("kg_version_id", s.kg_version_id)
    .eq("node_key", nodeKey)
    .eq("trang_thai", "active")
    .eq("tham_so_hoa", false)
    .order("tier", { ascending: true })
    .order("dok", { ascending: true });
  // H5 — lớp phủ GV (nạp 1 lần/request, cache trên session): bỏ câu ẨN, ghép SỬA.
  const cache = s as unknown as { _ovr?: Map<string, QOverride> };
  if (!cache._ovr) cache._ovr = await loadQuestionOverrides(supa, s.tenant_id);
  const ovr = cache._ovr;
  const visible = (qs ?? [])
    .filter((q) => !isHidden(ovr.get(q.id)))
    .map((q) => applyQuestionEdit(q, ovr.get(q.id)));
  // Câu VÁ NỀN phải trả lời được ngay tại chỗ. Câu [NOPBAI] (làm ngoài rồi tải
  // bài lên, giáo viên chấm hôm sau) không dùng để vá nền được — bỏ khỏi kho chọn.
  const auto = visible.filter(
    (q) => (q.nhom_cham === "auto" || q.loai_danh_gia === "objective") && !/\[NOPBAI\]/i.test(q.noi_dung ?? ""),
  );
  if (auto.length === 0) return null;

  const { data: done } = await supa
    .from("mastery_evidence")
    .select("question_id")
    .eq("student_id", s.student_id)
    .eq("kg_version_id", s.kg_version_id)
    .eq("node_id", nodeKey)
    .eq("correct", true);
  const doneIds = new Set((done ?? []).map((d) => d.question_id));

  const pool = excludeId ? auto.filter((x) => x.id !== excludeId) : auto;
  if (pool.length === 0) return null;
  const q = pool.find((x) => !doneIds.has(x.id)) ?? pool[0]!;

  // Câu KHUÔN: sinh giá trị tham số TẤT ĐỊNH theo (session, câu) rồi thay vào đề
  // + phương án. Chấm ở answer dùng CÙNG seed → cùng số (paramgen.ts).
  const spec = q.tham_so_hoa ? readSpec(q.tham_so) : null;
  const params = spec ? genParams(spec, seedFrom(s.id, q.id)) : {};
  const fill = (t: string) => (spec ? fillTemplate(t, params) : t);

  const item: QuestionItem = {
    id: q.id,
    nodeKey: q.node_key,
    tier: q.tier,
    dok: q.dok,
    doKho: q.do_kho,
    kind: "objective",
    prompt: fill(q.noi_dung),
    dangCauHoi: q.dang_cau_hoi ?? null,
  };
  const inter = parseInteractive(q.dang_cau_hoi, fill(q.noi_dung), String(q.dap_an ?? ""));
  // Câu điền-nhiều-ô mà CÓ phương án nhiễu vẫn là trắc nghiệm chọn cặp — giữ
  // nguyên lưới đáp án, chỉ câu KHÔNG có phương án mới dựng ô nhập từng chỗ.
  const hasOpts = Array.isArray(q.distractors) && q.distractors.length > 0;
  if (inter && !(inter.blanks && hasOpts)) item.interactive = inter;
  // CHECKLIST (đúng/sai chùm ý): distractors chỉ là biến thể lật một ý ("a) chọn
  // Sai") — vô nghĩa khi hiện thành 4 nút, và chính là nguồn màn hình "loạn" cũ.
  // KHÔNG gửi options → client dựng UI tick từng ý.
  if (!inter?.checklist && q.dap_an && Array.isArray(q.distractors) && q.distractors.length > 0) {
    // Thứ tự TẤT ĐỊNH theo mã câu — khớp y hệt diagnose, để câu vá nền hiện ra
    // giống hệt lúc gặp ở luồng chính (options.ts).
    item.options = orderedOptions(
      q.id,
      fill(String(q.dap_an)),
      (q.distractors as Array<{ phuong_an: string }>).map((d) => fill(d.phuong_an)),
    );
  }
  return item;
}

/**
 * Lan truyền ngược: DFS ngược cạnh prerequisite_hard từ node đang kẹt, tìm
 * nguyên tử nền CHƯA mastered ở tầng SÂU NHẤT còn có câu hỏi auto để luyện.
 * "Nguyên tử này sai thì lan truyền ngược lại các nguyên tử khác, và vá những
 * nguyên tử còn hổng, cứ tiếp tục như thế cho đến khi hiểu."
 */
async function findRemediation(
  supa: ReturnType<typeof admin>,
  s: Session,
  stuckNode: string,
): Promise<{ nodeKey: string; label: string; question: QuestionItem } | null> {
  const [{ data: edges }, { data: states }] = await Promise.all([
    supa
      .from("kg_edges")
      .select("from_key, to_key")
      .eq("kg_version_id", s.kg_version_id)
      .eq("relation", "prerequisite_hard"),
    supa
      .from("student_node_state")
      .select("node_id, mastered")
      .eq("student_id", s.student_id)
      .eq("kg_version_id", s.kg_version_id),
  ]);
  const mastered = new Set((states ?? []).filter((x) => x.mastered).map((x) => x.node_id));
  const prereqsOf = new Map<string, string[]>();
  for (const e of edges ?? []) {
    const arr = prereqsOf.get(e.to_key) ?? [];
    arr.push(e.from_key);
    prereqsOf.set(e.to_key, arr);
  }

  // Post-order DFS → ứng viên nền sâu nhất đứng trước (vá gốc trước, ngọn sau).
  const candidates: string[] = [];
  const visited = new Set<string>([stuckNode]);
  const walk = (node: string, depth: number) => {
    if (depth > REMEDIATION_MAX_DEPTH) return;
    for (const p of prereqsOf.get(node) ?? []) {
      if (visited.has(p)) continue;
      visited.add(p);
      walk(p, depth + 1);
      if (!mastered.has(p)) candidates.push(p);
    }
  };
  walk(stuckNode, 0);

  for (const nodeKey of candidates) {
    const question = await pickQuestion(supa, s, nodeKey);
    if (!question) continue; // nền chưa có câu hỏi → thử tầng nông hơn
    const { data: node } = await supa
      .from("kg_nodes")
      .select("label")
      .eq("kg_version_id", s.kg_version_id)
      .eq("node_key", nodeKey)
      .maybeSingle();
    return { nodeKey, label: node?.label ?? nodeKey, question };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const supa = admin();

    const { data: session } = await supa
      .from("learning_sessions")
      .select("id, tenant_id, student_id, subject, kg_version_id, current_node_id")
      .eq("id", body.sessionId)
      .single();
    if (!session) return json({ error: "session not found" }, 404);
    const s = session as Session;

    // CHỐT TENANT: phiên phải thuộc đúng tenant của người gọi (token) TRƯỚC mọi
    // thao tác — admin client bỏ qua RLS nên đây là hàng rào tenant DUY NHẤT ở đây.
    if (s.tenant_id !== ctx.tenantId) return json({ error: "forbidden" }, 403);

    // The caller must own the session (student) or be staff with scope access.
    const isOwner = s.student_id === ctx.userId;
    if (!isOwner && !can(ctx, "learn:session:read_scope")) {
      return json({ error: "forbidden" }, 403);
    }

    // PDPL — RÚT ĐỒNG Ý THÌ DỪNG: chấm/viết/nói/chat đều là XỬ LÝ dữ liệu học sinh.
    // Nếu đồng ý 'ai_tutoring' của HS đã bị RÚT → chặn mọi nhánh. (Chưa có bản ghi
    // = chưa thu thập → cho học tiếp; production siết opt-in khi có luồng thu consent.)
    {
      const { data: consent } = await supa
        .from("consent_records").select("status")
        .eq("student_id", s.student_id).eq("purpose", "ai_tutoring").maybeSingle();
      if (consent?.status === "withdrawn") {
        return json({ error: "consent_withdrawn", message: "Đồng ý xử lý dữ liệu học tập bằng AI đã được rút — liên hệ nhà trường để tiếp tục." }, 403);
      }
    }

    // Danh tính HS: người gọi chính là HS → dùng thẳng ctx (BỎ query profiles
    // thừa ở đường nóng). Nhân sự xem hộ HS khác mới cần đọc profiles để ẩn danh
    // tên khi chấm rubric.
    let names: string[];
    let grade: string;
    let language: string;
    if (isOwner) {
      names = ctx.fullName ? [ctx.fullName] : [];
      grade = ctx.grade ?? "10";
      language = s.subject === "Anh" ? "en" : (ctx.locale ?? "vi");
    } else {
      const { data: profile } = await supa
        .from("profiles")
        .select("full_name, grade, locale")
        .eq("id", s.student_id)
        .single();
      names = profile?.full_name ? [profile.full_name] : [];
      grade = profile?.grade ?? "10";
      language = s.subject === "Anh" ? "en" : (profile?.locale ?? "vi");
    }
    const en = language === "en";

    // Ghi lịch sử hội thoại chạy NỀN (EdgeRuntime.waitUntil giữ function sống
    // tới khi ghi xong) — KHÔNG chặn phản hồi cho học sinh. Lỗi ghi nuốt im lặng:
    // đây là nhật ký, không phải dữ liệu quyết định mastery (attempts +
    // mastery_evidence vẫn ghi ĐỒNG BỘ ở dưới).
    const persist = (role: string, content: string, agent?: string, meta?: unknown) => {
      const p = supa
        .from("session_turns")
        .insert({
          tenant_id: s.tenant_id,
          session_id: s.id,
          role,
          agent: agent ?? null,
          content,
          meta: meta ?? null,
        })
        .then(() => {}, () => {});
      (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(p);
      return p;
    };

    const action = body.action as string;

    // ── Câu khách quan: ENGINE ÁP CỨNG, không LLM ──────────────────────────
    if (action === "answer") {
      const questionId = String(body.questionId ?? "");
      // RATE-LIMIT nhánh chấm: chống spam nộp (đoán mò/bơm bằng chứng). Cửa sổ
      // trượt theo (HS, câu). Quá ngưỡng → 429 kèm số giây chờ cho UI dịu giọng.
      const rl = await rateLimit(supa, `answer:${ctx.userId}:${questionId}`, 8, 60);
      if (!rl.ok) return json({ error: "rate_limited", retryAfter: rl.retryAfter }, 429);

      // KIỂM QUYỀN SỞ HỮU CÂU HỎI: câu phải thuộc KG version đang phục vụ của
      // phiên — chặn chấm câu "mượn" từ version/tenant khác.
      const { data: q } = await supa
        .from("questions")
        .select("id, node_key, dap_an, distractors, dok, do_kho, tier, loai_danh_gia, dang_cau_hoi, nhom_cham, noi_dung, loi_giai, tham_so_hoa, tinh_mastery, hoi_do_tu_tin")
        .eq("id", questionId)
        .eq("kg_version_id", s.kg_version_id)
        .single();
      if (!q) return json({ error: "question not found" }, 404);

      // THAM SỐ do SERVER sinh TẤT ĐỊNH theo (session, câu) — KHÔNG nhận từ
      // client (client tin được thì HS bịa số cho khớp đáp án). Cùng seed với
      // lúc HIỂN THỊ (pickQuestion/diagnose) nên số y hệt cái học sinh đang thấy.
      const qSpec = q.tham_so_hoa ? readSpec(q.tham_so) : null;
      const qParams = qSpec ? genParams(qSpec, seedFrom(s.id, q.id)) : undefined;

      const studentAnswer = String(body.studentAnswer ?? "");
      persist("student", studentAnswer, undefined, { questionId: q.id, nodeKey: q.node_key });

      // Đếm lần thử + đọc node (revision/label) độc lập → SONG SONG. nodeRow
      // đọc MỘT LẦN ở đây rồi truyền xuống recomputeNodeState (không đọc lần hai).
      const [{ count: prev }, { data: nodeRow }] = await Promise.all([
        supa.from("attempts").select("id", { count: "exact", head: true }).eq("session_id", s.id).eq("question_id", q.id),
        supa.from("kg_nodes").select("revision, label").eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key).maybeSingle(),
      ]);
      const attemptNo = (prev ?? 0) + 1;

      // Dạng tương tác (dung_sai/sap_xep/noi_cot) chấm CẤU TRÚC tất định (so dãy /
      // tập cặp / đúng-sai) — CAS không phủ được. Còn lại (mcq/điền/toán) dùng CAS:
      // checkAnswer thay {name} vào dap_an rồi so tương đương (KHÔNG nhận body.params).
      // Thứ tự: (1) dạng tương tác chấm CẤU TRÚC tất định → (2) câu MỞ chấm bằng
      // mô hình (so Ý) → (3) CAS. Mỗi bậc trả null thì rơi xuống bậc dưới, nên
      // hỏng LLM cũng không kẹt học sinh.
      const interV = gradeInteractive(q.dang_cau_hoi, studentAnswer, String(q.dap_an ?? ""));
      const openV = interV || !isOpenAnswer(q)
        ? null
        : await gradeOpenAnswer({
            prompt: q.noi_dung ?? "",
            reference: String(q.dap_an ?? ""),
            studentAnswer,
            names,
            en,
            studentId: s.student_id,
            tenantId: s.tenant_id,
            supa,
          });
      const verdict =
        interV ?? openV ?? (await checkAnswer(studentAnswer, String(q.dap_an ?? ""), qParams));
      // Chỉ khi SAI mới cần khớp distractor để bắt quan niệm sai; đúng thì bỏ hẳn
      // vòng lặp. Còn cần thì chạy SONG SONG (checkAnswer có thể nạp mathjs).
      let matched: string | null = null;
      if (!verdict.correct) {
        const distractors = (q.distractors ?? []) as Array<{ phuong_an: string; quan_niem_sai: string }>;
        const hits = await Promise.all(distractors.map((d) => checkAnswer(studentAnswer, d.phuong_an, qParams)));
        const idx = hits.findIndex((r) => r.correct);
        if (idx >= 0) matched = distractors[idx]!.quan_niem_sai;
      }

      // do_tu_tin (1..3) là TỰ ĐÁNH GIÁ của HS — hợp lệ thì nhận, sai khoảng → null.
      const rawConf = typeof body.confidence === "number" ? body.confidence
        : typeof body.doTuTin === "number" ? body.doTuTin : null;
      const confidence = rawConf !== null && rawConf >= 1 && rawConf <= 3 ? Math.round(rawConf) : null;

      // TOÀN VẸN MASTERY:
      //  • chỉ LẦN ĐẦU trả lời câu (attemptNo===1) mới là bằng chứng 'target' —
      //    đúng ở lần thử 2+ KHÔNG tính mastery (kèm UNIQUE(session_id,question_id)
      //    + on-conflict-do-nothing bên dưới nên chỉ hàng lần-đầu tồn tại);
      //  • câu tinh_mastery=false (vd phản tư) không đóng góp mastery;
      //  • câu Bậc≥2 có hỏi độ tự tin: chỉ tính mastery khi do_tu_tin CAO (=3),
      //    chặn "đúng nhờ đoán" ở câu bậc cao.
      const tier = q.tier ?? 1;
      const needsConfidence = tier >= 2 && q.hoi_do_tu_tin === true;
      const confidenceOk = !needsConfidence || confidence === 3;
      const isTarget = attemptNo === 1 && q.tinh_mastery !== false && confidenceOk;

      // 'thinking quality' để lưu = tín hiệu NỘI DUNG (không phụ thuộc số lần thử).
      const thinkSignal = thinkingContentSignal(studentAnswer);

      // Ghi attempt + bằng chứng ĐỒNG BỘ (SONG SONG). Bằng chứng là dữ liệu sống
      // của mastery → ghi hỏng phải NỔ NGAY (không nuốt). Bằng chứng ghi idempotent:
      // upsert on-conflict-do-nothing theo UNIQUE(session_id, question_id) của mảng A
      // ⇒ nộp trùng / thử lại KHÔNG nhân bản, chỉ hàng lần-đầu được giữ.
      const [, { error: evErr }] = await Promise.all([
        supa.from("attempts").insert({
          tenant_id: s.tenant_id,
          session_id: s.id,
          student_id: s.student_id,
          question_id: q.id,
          node_id: q.node_key,
          attempt_no: attemptNo,
          raw_answer: studentAnswer,
          is_correct: verdict.correct,
          matched_misconception: matched,
          thinking_quality: thinkSignal,
          do_tu_tin: confidence,
        }),
        supa.from("mastery_evidence").upsert(
          {
            tenant_id: s.tenant_id,
            session_id: s.id,
            student_id: s.student_id,
            node_id: q.node_key,
            question_id: q.id,
            correct: verdict.correct,
            dok: q.dok,
            do_kho: toDoKho(q.do_kho),
            is_target_difficulty: isTarget,
            kg_version_id: s.kg_version_id,
            node_revision: nodeRow?.revision ?? null,
          },
          { onConflict: "session_id,question_id", ignoreDuplicates: true },
        ),
      ]);
      if (evErr) return json({ error: "mastery_evidence: " + evErr.message }, 500);

      // Mastery sống — trạng thái node đổi ngay khi có bằng chứng mới.
      const state = await recomputeNodeState(supa, {
        tenantId: s.tenant_id, studentId: s.student_id, kgVersionId: s.kg_version_id,
        nodeKey: q.node_key, nodeRevision: nodeRow?.revision ?? null,
      });

      // XP server-authoritative (xp-stats.sql): đúng +10, thử lại sau khi sai +5,
      // làm chủ node +30 — dedup chống farm nằm ở unique index DB. Gọi CẢ KHI
      // không có sự kiện: ngày chỉ toàn câu sai vẫn được chấm công chuỗi ngày.
      const xpEvents: XpEventInput[] = [];
      if (verdict.correct) xpEvents.push({ kind: "correct", questionId: q.id, sessionId: s.id });
      if (attemptNo >= 2) xpEvents.push({ kind: "persistence", questionId: q.id, sessionId: s.id });
      if (state.newlyMastered) {
        xpEvents.push({ kind: "node_mastered", nodeId: q.node_key, kgVersionId: s.kg_version_id, sessionId: s.id });
      }
      const xp = await awardXp(supa, s.tenant_id, s.student_id, xpEvents);

      if (verdict.correct) {
        const nodeLabel = nodeRow?.label ?? q.node_key;
        let msg: string;
        if (state.newlyMastered) {
          msg = en
            ? `Correct! You've just MASTERED "${nodeLabel}" — that persistence paid off!`
            : `Chính xác! Bạn vừa làm chủ «${nodeLabel}» rồi đó — nỗ lực bền bỉ của bạn được đền đáp!`;
        } else {
          msg = en
            ? "Correct — nice work! I can see your effort paying off. Ready for the next one?"
            : "Chính xác — làm tốt lắm! Mình thấy rõ nỗ lực của bạn. Sẵn sàng câu tiếp theo chứ?";
        }

        // Đang VÁ NỀN (client báo remediation=true khi trả lời câu nền tiêm):
        // vá xong (mastered) → LEO NGƯỢC về node đang kẹt; chưa xong → phục vụ
        // câu nền KẾ TIẾP (patch-and-climb).
        const inDetour = body.remediation === true;
        let climb: { nodeKey: string; question: QuestionItem } | null = null;
        let cont: { nodeKey: string; question: QuestionItem } | null = null;
        if (state.newlyMastered && inDetour && s.current_node_id && q.node_key !== s.current_node_id) {
          const back = await pickQuestion(supa, s, s.current_node_id);
          if (back) {
            climb = { nodeKey: s.current_node_id, question: back };
            msg += en
              ? ` Now let's climb back to where we left off!`
              : ` Giờ mình leo ngược lại bài đang dở nhé!`;
          }
        } else if (inDetour && !state.newlyMastered) {
          const nextBase = await pickQuestion(supa, s, q.node_key, q.id);
          if (nextBase) cont = { nodeKey: q.node_key, question: nextBase };
        }

        persist("tutor", msg, "engine", {
          correct: true,
          mastered: state.mastered,
          climb: climb?.nodeKey ?? null,
          cont: cont?.nodeKey ?? null,
        });
        return json({
          correct: true,
          attemptNo,
          mastered: state.mastered,
          masteryScore: Number(state.score.toFixed(2)),
          message: msg,
          ...(xp ? { xp } : {}),
          ...(climb ? { climb } : {}),
          ...(cont ? { continue: cont } : {}),
        });
      }

      // Sai → thang Socratic soạn sẵn, qua cổng nỗ lực. Chọn thang khớp đúng
      // quan niệm sai vừa bắt được; không khớp thì lấy thang đầu của node.
      const { data: ladders } = await supa
        .from("socratic_ladders")
        .select("id, rungs, bottom_out, cong_no_luc, misconception")
        .eq("kg_version_id", s.kg_version_id)
        .eq("node_key", q.node_key)
        .eq("status", "active");
      const ladder =
        (matched && (ladders ?? []).find((l) => l.misconception === matched)) || (ladders ?? [])[0] || null;

      const rungs = (ladder?.rungs ?? []) as Array<{ cau_hoi?: string; goi_y?: string }>;
      const totalRungs = rungs.length > 0 ? rungs.length : 4;
      const minAttempts =
        (ladder?.cong_no_luc as { so_lan_thu_toi_thieu?: number } | null)?.so_lan_thu_toi_thieu ?? 2;
      const currentRung = Math.max(0, attemptNo - minAttempts);

      // thinkingQuality cho CỔNG = tín hiệu nội dung + NỖ LỰC theo số lần thử (đã
      // qua trần số lần). Nhờ vế nỗ lực, giao diện chỉ có ô đáp án (MCQ không nhập
      // được lời giải thích) KHÔNG kẹt vô hạn ở "require_thinking".
      const thinkingQuality = Math.min(1, thinkSignal + Math.max(0, attemptNo - minAttempts) * 0.55);

      const gate = evaluateEffortGate({
        attempts: attemptNo,
        thinkingQuality,
        currentRung,
        totalRungs,
        minAttempts,
      });

      if (gate.action === "require_attempt") {
        const msg = en
          ? "Not quite yet — give it one more try first. What was your reasoning?"
          : "Chưa đúng — bạn thử lại một lần nữa nhé. Bạn đã suy nghĩ thế nào để ra kết quả đó?";
        persist("tutor", msg, "engine", { gate: gate.action, matched });
        return json({ correct: false, attemptNo, gate: gate.action, message: msg, ...(xp ? { xp } : {}) });
      }

      // Chưa thể hiện suy nghĩ thật (server chấm thấp) → mời HS nói cách nghĩ TRƯỚC
      // khi mở gợi ý — KHÔNG cho nhảy thẳng vào thang/đáy nhờ khai khống từ client.
      if (gate.action === "require_thinking") {
        const msg = en
          ? "Before I give a hint — tell me how you got that. What was your reasoning?"
          : "Trước khi mình gợi ý, bạn kể xem mình đã nghĩ thế nào để ra kết quả đó nhé? (Cứ thử lại, mình sẽ dẫn từng bước.)";
        persist("tutor", msg, "engine", { gate: gate.action, matched });
        return json({ correct: false, attemptNo, gate: gate.action, message: msg, ...(xp ? { xp } : {}) });
      }

      // Hết thang + vẫn sai (đã qua bottom_out ít nhất một lần) → lan truyền ngược.
      const pastBottomOut = attemptNo >= minAttempts + totalRungs;
      if (gate.action === "bottom_out" && pastBottomOut) {
        const rem = await findRemediation(supa, s, q.node_key);
        if (rem) {
          // Ghi nhớ node đang kẹt làm đích leo ngược: vá xong nền sẽ quay về đây.
          await supa
            .from("learning_sessions")
            .update({ current_node_id: q.node_key })
            .eq("id", s.id);
          const msg = en
            ? `I think the real gap is one level deeper: "${rem.label}". Let's patch that foundation first — once it's solid, this problem will feel much easier!`
            : `Mình để ý chỗ vướng thật sự có thể nằm sâu hơn một tầng: «${rem.label}». Mình cùng quay lại vá nền đó trước nhé — nền chắc rồi, bài này sẽ dễ hơn nhiều!`;
          persist("tutor", msg, "engine", { gate: "remediate", from: q.node_key, to: rem.nodeKey, matched });
          return json({
            correct: false,
            attemptNo,
            gate: "remediate",
            message: msg,
            remediate: rem,
            ...(xp ? { xp } : {}),
          });
        }
        // Không còn nền nào để vá → mở lời giải đầy đủ. Sau CỔNG NỖ LỰC, phục vụ
        // luôn một câu KHÁC cùng node (nếu còn) để HS áp dụng ngay, thay vì lặp
        // lại đúng câu vừa bí.
        // Lời giải câu khuôn có {name} → thay bằng số HS đang thấy trước khi hé.
        const loiGiai = q.loi_giai ? (qParams ? fillTemplate(q.loi_giai, qParams) : q.loi_giai) : "";
        const solution = loiGiai
          ? (en ? `Here is the full solution:\n${loiGiai}` : `Đây là lời giải đầy đủ:\n${loiGiai}`)
          : (en
              ? "You've given this real effort. Let's walk through it together in class — flag it for your teacher!"
              : "Bạn đã nỗ lực thật sự rồi. Câu này mình đánh dấu lại để thầy cô giảng kỹ trên lớp nhé!");
        const nextSame = await pickQuestion(supa, s, q.node_key, q.id);
        persist("tutor", solution, "engine", { gate: "exhausted", matched, cont: nextSame?.nodeKey ?? null });
        return json({
          correct: false,
          attemptNo,
          gate: "exhausted",
          message: solution,
          ...(xp ? { xp } : {}),
          ...(nextSame ? { continue: { nodeKey: q.node_key, question: nextSame } } : {}),
        });
      }

      if (gate.action === "bottom_out") {
        const bo = (ladder?.bottom_out as { noi_dung?: string } | null)?.noi_dung;
        const coreRaw = bo ?? q.loi_giai ?? "";
        const core = coreRaw && qParams ? fillTemplate(coreRaw, qParams) : coreRaw;
        const msg = core
          ? (en
              ? `You've earned a bigger hint — here's the key idea: ${core}\nNow try the final step again!`
              : `Bạn đã đủ nỗ lực để mình mở hướng giải: ${core}\nGiờ thử làm lại bước cuối xem!`)
          : (en
              ? "Let's slow down and rebuild from the definition. What does the question actually ask?"
              : "Mình chậm lại, dựng từ định nghĩa nhé. Đề bài thật ra đang hỏi điều gì?");
        persist("tutor", msg, "engine", { gate: gate.action, matched });
        return json({ correct: false, attemptNo, gate: gate.action, message: msg, ...(xp ? { xp } : {}) });
      }

      // advance_rung — trao đúng câu gợi mở đã soạn (nguyên văn, không LLM).
      const rung = rungs[Math.min(currentRung, rungs.length - 1)];
      const rungText = rung?.cau_hoi ?? rung?.goi_y ?? "";
      const lead = matched
        ? (en ? `I see where that idea came from. ` : `Mình hiểu vì sao bạn nghĩ vậy. `)
        : "";
      const msg = rungText
        ? `${lead}${en ? "Try thinking from this question: " : "Thử nghĩ từ câu này nhé: "}${rungText}`
        : (en
            ? `${lead}Not quite. Which piece of the question have you not used yet?`
            : `${lead}Chưa đúng. Trong đề bài còn dữ kiện nào bạn chưa dùng đến?`);
      persist("tutor", msg, "engine", { gate: gate.action, currentRung, matched });
      return json({ correct: false, attemptNo, gate: gate.action, currentRung, message: msg, ...(xp ? { xp } : {}) });
    }

    // ── NỘP BÀI (câu tự luận dài) — hai đường trong MỘT action:
    //    · Em GÕ bài làm (kèm ảnh/tệp tuỳ thích) → AI chấm NGAY theo Ý (so với
    //      đáp án mẫu), đúng thì ghi bằng chứng mastery + XP liền — vì các câu
    //      này là câu DOK≥3 duy nhất của node, không chấm ngay thì node không
    //      bao giờ xanh nổi trước khi giáo viên rảnh (đo 27/07: học sinh xong
    //      8/8 câu mà lộ trình đứng im). Giáo viên vẫn chấm LẠI sau — chấm
    //      "làm lại" sẽ lật node thành bàn chân đỏ (teacher-grading).
    //    · Em chỉ TẢI TỆP (bài viết tay khó gõ: hình vẽ, bảng biến thiên…) →
    //      như cũ: nằm hàng đợi chờ giáo viên, không XP, không mastery.
    if (action === "submit-work") {
      // Cùng cửa sổ trượt như nhánh "answer": mỗi lượt nộp là một lệnh gọi LLM
      // trả phí + một dòng hàng đợi của giáo viên, không siết thì bơm được cả hai.
      const rlW = await rateLimit(supa, `submit:${ctx.userId}:${String(body.questionId ?? "")}`, 8, 60);
      if (!rlW.ok) return json({ error: "rate_limited", retryAfter: rlW.retryAfter }, 429);

      const { data: q } = await supa
        .from("questions")
        .select("id, node_key, dap_an, loi_giai, noi_dung, dok, do_kho")
        .eq("id", body.questionId)
        .eq("kg_version_id", s.kg_version_id)
        .single();
      if (!q) return json({ error: "question not found" }, 404);
      // CHỈ câu gắn nhãn nộp bài mới đi đường này. Thiếu chốt này thì gọi thẳng
      // API với một câu trắc nghiệm thường cũng được chấm bằng AI — vừa lách
      // luật "chỉ lần thử đầu mới tính bằng chứng đích", vừa biến phản hồi
      // "còn thiếu: …" thành máy đọc dần đáp án.
      if (!/^\[(NOPBAI|WRITING|SPEAKING)\]/i.test(String(q.noi_dung ?? ""))) {
        return json({ error: "not a submission question" }, 400);
      }

      // Cắt trần độ dài bài gõ (bài tự luận lớp 10 dài nhất cũng không tới 6k).
      const workText = String(body.text ?? "").trim().slice(0, 6000);
      const filePath = String(body.filePath ?? "").trim();
      // Policy storage đã chặn GHI ra ngoài thư mục của mình; đây chặn nốt việc
      // ghi VẾT trỏ sang tệp của người khác (đường dẫn tự gõ trong body).
      const prefix = `bai-lam/${s.tenant_id}/${s.student_id}/`;
      if (filePath && !filePath.startsWith(prefix)) return json({ error: "bad file path" }, 400);
      if (!workText && !filePath) return json({ error: "empty submission" }, 400);

      // Chấm bằng AI khi có BÀI GÕ — so Ý với đáp án mẫu, không so chữ.
      let ai: CasResult | null = null;
      if (workText) {
        ai = await gradeOpenAnswer({
          prompt: (q.noi_dung ?? "").replace(/^\[(NOPBAI|WRITING|SPEAKING)\]\s*/i, ""),
          reference: [q.dap_an, q.loi_giai].filter(Boolean).join("\n"),
          studentAnswer: workText,
          names,
          en,
          studentId: s.student_id,
          tenantId: s.tenant_id,
          supa,
        }); // LLM hỏng/thiếu khoá → null → rơi về "đã nộp, chờ thầy cô" (không kẹt em)
      }

      const { error: insErr } = await supa.from("submissions").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        node_key: q.node_key,
        kind: "upload",
        text_content: workText || null,
        file_path: filePath || null,
        mime: String(body.mime ?? "").slice(0, 80) || null,
        size_bytes: Number(body.size) || null,
        status: "pending", // luôn chờ giáo viên xem lại — AI chấm là SƠ khảo
        feedback: ai ? { ai: { dung: ai.correct, thieu: ai.detail ?? "" } } : null,
      });
      if (insErr) return json({ error: insErr.message }, 500);
      persist("student", workText || `[nộp tệp] ${filePath.split("/").pop()}`, undefined, {
        questionId: q.id, kind: "upload", aiGraded: !!ai,
      });

      // Không có kết quả AI (chỉ nộp tệp / LLM hỏng) → đường cũ: chờ giáo viên.
      if (!ai) return json({ kind: "nop_bai", submitted: true });

      // Có kết quả AI → ghi bằng chứng như một câu trả lời thật (đúng CẢ khi
      // sai — attempts trung thực), rồi tính lại mastery + XP.
      // Lần thử ĐẾM TỪ DB (như nhánh "answer"), không tin client: XP "nỗ lực"
      // phát theo số client tự khai thì bịa được, mà em vào lại bài hôm sau
      // (state client về 0) lại mất công kiên trì thật.
      const [{ count: prevW }, { data: nodeRow }] = await Promise.all([
        supa.from("attempts").select("id", { count: "exact", head: true })
          .eq("session_id", s.id).eq("question_id", q.id),
        supa.from("kg_nodes").select("revision, label")
          .eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key).maybeSingle(),
      ]);
      const attemptNo = (prevW ?? 0) + 1;
      // MỘT câu tự luận = MỘT bằng chứng, dù nộp lại ở phiên khác. Khoá chống
      // trùng của bảng chỉ tính trong CÙNG phiên, nên không dọn thì nộp lại 3
      // phiên là ba dòng "đúng, câu đích" của CÙNG một câu — tự thoả luật
      // mastery, và giáo viên bấm "làm lại" chỉ lật được dòng của phiên mới nhất.
      await supa.from("mastery_evidence").delete()
        .eq("student_id", s.student_id).eq("question_id", q.id).neq("session_id", s.id);
      const [attRes, evRes] = await Promise.all([
        supa.from("attempts").insert({
          tenant_id: s.tenant_id,
          session_id: s.id,
          student_id: s.student_id,
          question_id: q.id,
          node_id: q.node_key,
          attempt_no: attemptNo,
          raw_answer: workText,
          is_correct: ai.correct,
        }),
        // KHÔNG ignoreDuplicates: nộp lại trong cùng phiên thì kết quả MỚI đè
        // kết quả cũ (em sửa bài theo góp ý của AI là phải được tính lại).
        supa.from("mastery_evidence").upsert(
          {
            tenant_id: s.tenant_id,
            session_id: s.id,
            student_id: s.student_id,
            node_id: q.node_key,
            question_id: q.id,
            correct: ai.correct,
            dok: q.dok,
            do_kho: toDoKho(q.do_kho),
            is_target_difficulty: true, // câu tự luận là câu ĐÍCH của node
            kg_version_id: s.kg_version_id,
            node_revision: nodeRow?.revision ?? null,
          },
          { onConflict: "session_id,question_id" },
        ),
      ]);
      // Ghi hỏng mà vẫn báo "được tính điểm luôn" + cộng XP thì đúng lại chính
      // cái triệu chứng đợt vá này sinh ra để sửa (lộ trình đứng im), lần này
      // còn im lặng hơn — nên hỏng là trả 500 cho lộ ra.
      if (attRes.error || evRes.error) {
        return json({ error: (attRes.error ?? evRes.error)?.message ?? "write failed" }, 500);
      }
      const state = await recomputeNodeState(supa, {
        tenantId: s.tenant_id,
        studentId: s.student_id,
        kgVersionId: s.kg_version_id,
        nodeKey: q.node_key,
        nodeRevision: nodeRow?.revision ?? null,
      });
      const xpEvents: XpEventInput[] = [];
      if (ai.correct) xpEvents.push({ kind: "correct", questionId: q.id, sessionId: s.id });
      if (attemptNo >= 2) xpEvents.push({ kind: "persistence", questionId: q.id, sessionId: s.id });
      if (state.newlyMastered) {
        xpEvents.push({ kind: "node_mastered", nodeId: q.node_key, kgVersionId: s.kg_version_id, sessionId: s.id });
      }
      const xp = await awardXp(supa, s.tenant_id, s.student_id, xpEvents);

      const fb = ai.correct
        ? (state.newlyMastered
            ? `Bài viết ổn rồi! Em vừa làm chủ «${nodeRow?.label ?? q.node_key}» — thầy cô sẽ xem lại bài sau.`
            : "Bài viết ổn rồi — AI thấy đủ ý chính. Thầy cô sẽ xem lại sau nhé!")
        : (ai.detail
            ? `Gần được rồi — còn thiếu: ${ai.detail}`
            : "Chưa đủ ý chính — em đọc lại đề rồi bổ sung thêm nhé.");
      persist("tutor", fb, "grade-open", { formative: true, aiCorrect: ai.correct });
      return json({
        kind: "nop_bai",
        submitted: true,
        correct: ai.correct,
        feedback: fb,
        ...(state.newlyMastered ? { mastered: true } : {}),
        ...(xp ? { xp } : {}),
      });
    }

    // ── Writing (English rubric, formative) — LLM đúng vai: chấm rubric ────

    if (action === "writing") {
      if (!Deno.env.get("OPENROUTER_API_KEY")) {
        const msg = "Chấm bài viết cần AI — trường chưa bật khoá AI. Bạn luyện các câu khách quan trước nhé, phần viết sẽ mở sau!";
        persist("tutor", msg, "engine", { unavailable: "writing" });
        return json({ kind: "writing", feedback: msg, unavailable: true }, 503);
      }
      const { data: q } = await supa
        .from("questions")
        .select("id, rubric, bai_mau, noi_dung, dang_cau_hoi")
        .eq("id", body.questionId)
        .eq("kg_version_id", s.kg_version_id)
        .single();
      if (!q) return json({ error: "question not found" }, 404);
      const text = String(body.text ?? "");
      persist("student", text, undefined, { questionId: q.id, kind: "writing" });

      const { text: safe, map } = anonymize(text, names);
      // Đợt B: chấm theo KHUÔN KỸ NĂNG (Viết/Lập luận theo dạng câu) → JSON có điểm.
      const rubric = rubricFor(q.dang_cau_hoi, q.rubric);
      const res = await callLLM({
        system: buildScoredRubricSystem(rubric, (q.bai_mau?.[0] as string) ?? "", false, language),
        user: `Đề: ${q.noi_dung}\nBài làm của học sinh:\n${safe}`,
        agent: "evaluate-rubric",
        tier: "default",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const parsed = parseRubricJson(rehydrate(res.text, map));
      const result = parsed ? buildRubricResult(rubric, parsed) : null;
      const feedback = result ? rubricSummaryText(result) : rehydrate(res.text, map);
      await supa.from("submissions").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        kind: "writing",
        text_content: text,
        feedback: result ? { rubric: result } : { formative: feedback },
      });
      persist("tutor", feedback, "evaluate-rubric", { formative: true });
      return json({ kind: "writing", ...(result ? { rubric: result } : {}), feedback, note: "formative — not an official grade" });
    }

    // ── Speaking (English; transcript from in-browser STT) ─────────────────
    if (action === "speaking") {
      if (!Deno.env.get("OPENROUTER_API_KEY")) {
        const msg = "Chấm phần nói cần AI — trường chưa bật khoá AI. Bạn luyện các câu khách quan trước nhé, phần nói sẽ mở sau!";
        persist("tutor", msg, "engine", { unavailable: "speaking" });
        return json({ kind: "speaking", feedback: msg, unavailable: true }, 503);
      }
      const { data: q } = await supa
        .from("questions")
        .select("id, rubric, noi_dung, dang_cau_hoi")
        .eq("id", body.questionId)
        .eq("kg_version_id", s.kg_version_id)
        .single();
      if (!q) return json({ error: "question not found" }, 404);
      const transcript = String(body.transcript ?? "");
      persist("student", transcript, undefined, { questionId: q.id, kind: "speaking" });

      const { text: safe, map } = anonymize(transcript, names);
      // Đợt B: khuôn kỹ năng NÓI, chấm từ transcript (bỏ qua phát âm) → JSON có điểm.
      const rubric = rubricFor(q.dang_cau_hoi ?? "noi", q.rubric);
      const res = await callLLM({
        system: buildScoredRubricSystem(rubric, "", true, language),
        user: `Đề nói: ${q.noi_dung}\nBản ghi (transcript) của học sinh:\n${safe}`,
        agent: "evaluate-speaking",
        tier: "default",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const parsed = parseRubricJson(rehydrate(res.text, map));
      const result = parsed ? buildRubricResult(rubric, parsed) : null;
      const feedback = result ? rubricSummaryText(result) : rehydrate(res.text, map);
      await supa.from("submissions").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        kind: "speaking",
        text_content: transcript,
        audio_path: body.audioPath ?? null,
        feedback: result ? { rubric: result } : { formative: feedback },
      });
      persist("tutor", feedback, "evaluate-speaking", { formative: true });
      return json({ kind: "speaking", ...(result ? { rubric: result } : {}), feedback, note: "transcript-based; pronunciation scoring deferred" });
    }

    // ── Chat tự do — LLM nếu có khoá; không có thì lái về luyện tập ────────
    if (action === "message") {
      const studentMessage = String(body.message ?? "");
      persist("student", studentMessage);
      // J2 — LƯỚI AN TOÀN: bắt dấu hiệu tổn thương (tự-làm-hại/bắt nạt/khủng
      // hoảng) → ghi cờ vào hàng đợi counselor (con người xác minh, không tự báo
      // PH) + đáp ẤM ÁP hướng tới người lớn tin cậy, KHÔNG dạy tiếp như chưa có
      // gì. Không lưu văn bản thô. Bảo thủ (chỉ cụm rõ) để tránh cờ oan.
      const signal = detectSafety(studentMessage);
      if (signal) {
        await recordSafetyFlag(supa, {
          tenantId: s.tenant_id, studentId: s.student_id, sessionId: s.id, signal,
        });
        const care = supportiveReply(signal.type);
        persist("tutor", care, "engine", { safety: signal.type });
        return json({ message: care });
      }
      if (!Deno.env.get("OPENROUTER_API_KEY")) {
        const msg =
          "Mình ở đây rồi! Bạn bấm vào một bài trên lộ trình để mình cùng luyện nhé — khi bạn làm bài, mình sẽ dẫn dắt từng bước một.";
        persist("tutor", msg, "engine");
        return json({ message: msg });
      }
      const { text: safe, map } = anonymize(studentMessage, names);
      const system = buildGuideSystem({
        subject: s.subject,
        grade: String(grade),
        language,
        nodeLabel: s.current_node_id ?? "",
        question: body.question ?? "",
        attempts: 0,
      });
      const res = await callLLM({
        system,
        user: safe || "(mở đầu buổi học)",
        agent: "guide",
        // Đối thoại dẫn dắt = "cái dễ dễ" → tier cheap = deepseek-v4-flash: NHANH + RẺ
        // ($0.094/$0.188 per 1M, rẻ nhất & nhẹ nhất họ deepseek). Chấm rubric/nói giữ default.
        tier: "cheap",
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });
      const text = rehydrate(res.text, map);
      persist("tutor", text, "guide");
      return json({ message: text });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    // KHÔNG rò nội bộ (chuỗi lỗi DB/provider) ra client — log server, trả chung chung.
    console.error("chat-turn error:", e instanceof Error ? (e.stack ?? e.message) : String(e));
    return json({ error: "internal" }, 500);
  }
});
