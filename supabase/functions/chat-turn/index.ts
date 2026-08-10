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
import { evaluateEffortGate, chonBacGoiY, tinhVanNoLuc } from "../_shared/pedagogy.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { anonymize, rehydrate, callLLM, callLLMStream } from "../_shared/llm.ts";
import { buildGuideSystem, buildGuideUser, buildScoredRubricSystem } from "../_shared/prompts.ts";
import { buildMemory } from "../_shared/memory.ts";
import { openSse } from "../_shared/sse.ts";
import { rubricFor, buildRubricResult, parseRubricJson, type RubricResult } from "../_shared/rubrics.ts";
import { awardXp, type XpEventInput } from "../_shared/xp.ts";
import { recomputeNodeState } from "../_shared/mastery-state.ts";
import { loadQuestionOverrides, isHidden, applyQuestionEdit, type QOverride } from "../_shared/overrides.ts";
import { detectSafety, recordSafetyFlag, supportiveReply } from "../_shared/safety.ts";
import { contentWordCount, isHelpRequest, isJunkOpenAnswer, plausibleOpenAnswer, safeMisconception } from "../_shared/intent.ts";
import { genParams, seedFrom, fillTemplate, readSpec } from "../_shared/paramgen.ts";
import { orderedOptions } from "../_shared/options.ts";
import { docBaiLamTuTep } from "../_shared/doc-bai-lam.ts";
import { gradeOpenAnswer, chotPhanQuyet } from "../_shared/grade-open.ts";

// Studio ghi độ khó bằng CHỮ ("dễ/trung bình/khó"); cột enum do_kho ở DB là de/TB/kho.
// questions.do_kho (text) giữ chữ cho hiển thị; CHỈ đổi sang mã enum khi ghi mastery.
const DO_KHO_ENUM: Record<string, string> = {
  "dễ": "de", de: "de", "trung bình": "TB", tb: "TB", TB: "TB", "khó": "kho", kho: "kho",
};
const toDoKho = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return DO_KHO_ENUM[s] ?? DO_KHO_ENUM[s.toLowerCase()] ?? "TB";
};

// Tỉ lệ AI DIỄN GIẢI LẠI câu gợi mở đã soạn (advance_rung) thay vì đọc nguyên
// văn — câu càng khó càng cần AI bám sát ĐÚNG NGỮ CẢNH học sinh vừa làm, câu
// càng dễ thì nguyên văn soạn sẵn đã đủ rõ. AI CHỈ được diễn đạt lại, KHÔNG
// được đổi Ý của rungQuestion (xem buildGuideSystem: rungQuestion truyền
// nguyên, model chỉ "diễn đạt lại tự nhiên, KHÔNG lộ đáp án").
const AI_REPHRASE_CHANCE: Record<string, number> = { de: 0.3, TB: 0.5, kho: 0.7 };

/**
 * GIỌNG ĐIỆU riêng cho em này (chốt 02/08) — đọc `profiles.tutor_style_note`,
 * một ghi chú NGẮN do `end-session` tự đúc kết mỗi khi kết thúc buổi học, KHÔNG
 * phải log/lịch sử. Không có thì bỏ qua lặng lẽ — chưa học buổi nào có hội
 * thoại thật thì chưa có gì để đúc kết, không phải lỗi.
 */
// deno-lint-ignore no-explicit-any
async function fetchStyleNote(supa: any, studentId: string): Promise<string | undefined> {
  try {
    const { data } = await supa
      .from("profiles").select("tutor_style_note").eq("id", studentId).maybeSingle();
    return (data?.tutor_style_note as string | null) ?? undefined;
  } catch {
    return undefined;
  }
}

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
    // PHÁT CHỮ DẦN: cờ do CLIENT bật. Không bật thì server trả JSON y như cũ —
    // nhờ vậy web và edge function không buộc phải lên cùng lúc, và bản web cũ
    // đang chạy ngoài kia không vỡ khi function mới deploy trước.
    //
    // CẦU DAO: đặt secret `STREAM_DISABLED=1` là toàn bộ quay về đường JSON
    // NGAY, không cần sửa mã, không cần deploy lại. Dòng phát đi qua edge
    // runtime và cả proxy trước nó — nếu chỗ nào gom bộ đệm hay cắt sớm thì phải
    // tắt được trong một phút, chứ không phải chờ một vòng deploy.
    const wantStream = body.stream === true && Deno.env.get("STREAM_DISABLED") !== "1";

    /**
     * Một lượt sư tử NÓI: phát dần nếu client xin, không thì trả một cục.
     *
     * Gộp về một chỗ vì ba nhánh (kể-cách-nghĩ · mời-nói-rõ-thêm · trò chuyện)
     * đều cần đúng chuỗi việc: gọi mô hình → hỏng thì lùi về câu tất định → lưu
     * lời sư tử → trả phong bì. Ba bản sao là ba chỗ để quên một bước.
     */
    const speak = async (o: {
      envelope: Record<string, unknown>;
      fallback: string;
      llm: Parameters<typeof callLLM>[0] | null;
      /** Bảng tra tên thật để hoàn nguyên sau khi mô hình trả lời. */
      map: Record<string, string>;
      persistMeta?: unknown;
      /** Nhãn ghi vào `session_turns.agent`. Giữ đúng như trước khi gộp. */
      agent?: string;
      /** Câu đang làm — PHẢI có để trí nhớ lọc đúng câu (xem ghi chú dưới). */
      questionId?: string;
    }): Promise<Response> => {
      const who = o.agent ?? "engine";
      // Lời sư tử PHẢI mang mã câu. Thiếu nó thì trí nhớ không lọc được theo
      // câu, và hội thoại của câu TRƯỚC tràn sang câu SAU: đo được trên hội
      // thoại thật 30/07 — em vừa mở câu mới, chưa thử lần nào, mà sư tử nói
      // "bạn đã thử ba lần và vẫn ra cùng một đáp án" (chuyện của câu cũ).
      const meta = o.questionId
        ? { ...(o.persistMeta as Record<string, unknown> ?? {}), questionId: o.questionId }
        : o.persistMeta;
      /**
       * HẾT HẠN MỨC NGÀY thì phải NÓI THẬT.
       *
       * Trước đây `BudgetExceededError` rơi vào cùng một khối catch với "mô
       * hình hỏng", nên em chạm trần 200k token chỉ thấy một câu soạn sẵn bâng
       * quơ — không hiểu vì sao sư tử bỗng nói lạc đề, tưởng app hỏng. Còn em
       * cợt nhả thì cũng chẳng biết mình vừa bị chặn.
       */
      const HET_HAN_MUC = en
        ? "We've talked a lot today! Let's pick this up tomorrow — for now, try the questions on your own, I'll be here."
        : "Hôm nay mình nói chuyện nhiều rồi đó! Mai mình lại tiếp nhé — giờ bạn cứ làm bài tiếp, mình vẫn chấm bình thường.";
      const isBudget = (e: unknown) => e instanceof Error && e.name === "BudgetExceededError";

      // ĐƯỜNG CŨ — một cục JSON.
      if (!wantStream) {
        let msg = o.fallback;
        if (o.llm) {
          try {
            const res = await callLLM(o.llm);
            const t = rehydrate(res.text, o.map).trim();
            if (t) msg = t;
          } catch (e) {
            if (isBudget(e)) msg = HET_HAN_MUC; // hết lượt hôm nay → nói thẳng
            /* mô hình hỏng → giữ câu tất định */
          }
        }
        persist("tutor", msg, who, meta);
        return json({ ...o.envelope, message: msg }, 200, req);
      }

      // ĐƯỜNG PHÁT DẦN.
      const { response, writer } = openSse(req);
      const bg = (async () => {
        writer.meta(o.envelope);
        if (!o.llm) {
          writer.delta(o.fallback);
          persist("tutor", o.fallback, who, meta);
          writer.done(o.fallback);
          return;
        }
        // Tên thật được thay bằng [NAME_0] trước khi gửi đi; mẩu chữ về có thể
        // CẮT ĐÔI cái nhãn đó. Giữ lại phần đuôi còn dở tới khi thấy dấu đóng —
        // không thì học sinh đọc thấy "[NAME_" nhấp nháy giữa câu.
        let pend = "";
        let full = "";
        const push = (d: string) => {
          pend += d;
          const open = pend.lastIndexOf("[");
          let safe: string;
          if (open >= 0 && !pend.slice(open).includes("]")) {
            safe = pend.slice(0, open);
            pend = pend.slice(open);
          } else {
            safe = pend;
            pend = "";
          }
          if (safe) { const t = rehydrate(safe, o.map); full += t; writer.delta(t); }
        };
        let hetHanMuc = false;
        try {
          await callLLMStream(o.llm, push);
          if (pend) { const t = rehydrate(pend, o.map); full += t; writer.delta(t); }
        } catch (e) {
          hetHanMuc = isBudget(e); // hết lượt hôm nay → nói thẳng, đừng nói bâng quơ
        }
        const lui = hetHanMuc ? HET_HAN_MUC : o.fallback;
        const msg = full.trim() || lui;
        // Mô hình câm hẳn → phát câu lui để em không nhìn màn trống.
        if (!full.trim()) writer.delta(lui);
        persist("tutor", msg, who, meta);
        writer.done(msg);
      })().catch((e) => {
        console.error("speak stream error:", e instanceof Error ? e.message : e);
        writer.fail(o.fallback);
      });
      (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
        .EdgeRuntime?.waitUntil?.(bg);
      return response;
    };

    // ── Câu khách quan: ENGINE ÁP CỨNG, không LLM ──────────────────────────
    if (action === "answer") {
      const questionId = String(body.questionId ?? "");
      // RATE-LIMIT nhánh chấm: chống spam nộp (đoán mò/bơm bằng chứng). Cửa sổ
      // trượt theo (HS, câu). Quá ngưỡng → 429 kèm số giây chờ cho UI dịu giọng.
      // Lượt "kể cách nghĩ" đi NGÂN SÁCH RIÊNG, rộng hơn: nó không chấm, không
      // ghi bằng chứng, và nhịp đối thoại thật (thử → kể → thử → kể) mà dùng
      // chung 8 lượt/phút là em bị 429 giữa chừng đúng lúc đang mở lời.
      const isReflectTurn = !String(body.studentAnswer ?? "").trim() && !!String(body.reasoning ?? "").trim();
      const rl = isReflectTurn
        ? await rateLimit(supa, `reflect:${ctx.userId}`, 20, 60)
        : await rateLimit(supa, `answer:${ctx.userId}:${questionId}`, 8, 60);
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

      // ── CHỐT ĐỐI XỨNG: câu NỘP BÀI không được đi đường "answer" (lỗi #8) ────
      // Từ 01/08 cả hai nhánh đều ghi `mastery_evidence`, nên chốt này KHÔNG
      // còn là "chặn AI ghi bằng chứng" nữa mà là chặn ĐI SAI CỬA. Cửa
      // `submit-work` mới có: đọc tệp/ảnh ra chữ, cổng ý định, đai độ dài, và
      // luật XP chỉ-lần-đầu. Lọt qua `answer` là bỏ hết chỗ đó — gõ "ok" vài
      // lần, mô hình gật một lần là node xanh, đúng cửa hậu của lỗi #8.
      // Chặn ở server, không phụ thuộc client cư xử đúng.
      if (/^\[(NOPBAI|WRITING|SPEAKING)\]/i.test(String(q.noi_dung ?? ""))) {
        return json({ error: "wrong-channel", detail: "submit-work" }, 400);
      }

      // THAM SỐ do SERVER sinh TẤT ĐỊNH theo (session, câu) — KHÔNG nhận từ
      // client (client tin được thì HS bịa số cho khớp đáp án). Cùng seed với
      // lúc HIỂN THỊ (pickQuestion/diagnose) nên số y hệt cái học sinh đang thấy.
      const qSpec = q.tham_so_hoa ? readSpec(q.tham_so) : null;
      const qParams = qSpec ? genParams(qSpec, seedFrom(s.id, q.id)) : undefined;

      const studentAnswer = String(body.studentAnswer ?? "").slice(0, 6000);

      // ── B0 · LƯỢT "KỂ CÁCH EM NGHĨ" (29/07, chủ dự án chỉ ra lỗ hổng gốc):
      // client gửi `reasoning` KHÔNG kèm đáp án → đây là lượt ĐỐI THOẠI, không
      // phải lượt thử. Không chấm, không ghi attempt mới; chất lượng suy nghĩ
      // được LƯU vào lần thử gần nhất để cổng nỗ lực đọc ở các lượt sau — thay
      // cho vế "cộng theo số lần bấm" đã bỏ (cổng không còn là cái đếm click).
      const reasoning = String(body.reasoning ?? "").trim().slice(0, 2000);
      if (!studentAnswer.trim() && reasoning) {
        persist("student", reasoning, undefined, { questionId: q.id, kind: "reflect" });
        // Lời XIN GỢI Ý không phải là "đã thể hiện suy nghĩ" — nếu tính thì bấm
        // một nhát nút 💡 là mở được cổng (chuỗi mồi sẵn có chữ "bước" đủ để
        // thinkingContentSignal cho 0,6). Xin giúp vẫn được đáp, chỉ không mua bậc.
        // Lời ngắn cụt KHÔNG mua được bậc: `thinkingContentSignal` cho 0,6 chỉ
        // vì thấy chữ "vì"/"bước", nên gõ "1 vì" bốn lượt là moi được đáy. Đòi
        // tối thiểu 5 từ có nghĩa mới tính là "đã trình bày suy nghĩ".
        const signal =
          isHelpRequest(reasoning) || contentWordCount(reasoning) < 5
            ? Math.min(0.3, thinkingContentSignal(reasoning))
            : thinkingContentSignal(reasoning);
        // Ba truy vấn độc lập → SONG SONG (nhãn bài chỉ để AI có ngữ cảnh, không
        // đáng thêm một vòng mạng tuần tự).
        const [attRes, { data: ladders }, { data: nodeForGuide }, mem, chatRes, styleNote] = await Promise.all([
          supa.from("attempts").select("id, attempt_no, thinking_quality, created_at")
            .eq("session_id", s.id).eq("question_id", q.id)
            .order("attempt_no", { ascending: true }),
          supa.from("socratic_ladders").select("id, rungs, bottom_out, cong_no_luc")
            .eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key)
            .eq("status", "active").limit(1),
          supa.from("kg_nodes").select("label")
            .eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key)
            .maybeSingle(),
          // TRÍ NHỚ — đi CÙNG chuyến với ba truy vấn kia, không thêm vòng chờ nào.
          buildMemory(supa, {
            sessionId: s.id, studentId: s.student_id, questionId: q.id,
            names, omitContent: reasoning,
          }).catch(() => null),
          // Lượt gần đây của CẢ HAI VAI, một chuyến duy nhất:
          //  · vai student → đếm "đã nói bao nhiêu lần kể từ lần thử cuối";
          //  · vai tutor   → đọc BẬC THANG ĐÃ TRAO cho luật chỉ-tiến (lỗi #27).
          // Lọc vai ở phía mình thay vì thêm một truy vấn nữa.
          supa.from("session_turns").select("created_at, role, meta")
            .eq("session_id", s.id)
            .order("created_at", { ascending: false }).limit(120),
          fetchStyleNote(supa, s.student_id),
        ]);
        const nodeLabelForGuide = String(nodeForGuide?.label ?? q.node_key);
        const attRows = (attRes.data ?? []) as Array<{ id: string; thinking_quality: number | null }>;
        const attempts = attRows.length;
        const lastAtt = attRows[attRows.length - 1];
        const best = Math.max(signal, Number(lastAtt?.thinking_quality ?? 0));
        if (lastAtt && best > Number(lastAtt.thinking_quality ?? 0)) {
          await supa.from("attempts").update({ thinking_quality: best }).eq("id", lastAtt.id);
        }
        const ladder = (ladders ?? [])[0] ?? null;
        const rungs = (ladder?.rungs ?? []) as Array<{ cau_hoi?: string; goi_y?: string }>;
        const totalRungs = rungs.length > 0 ? rungs.length : 4;
        const minAtt =
          (ladder?.cong_no_luc as { so_lan_thu_toi_thieu?: number } | null)?.so_lan_thu_toi_thieu ?? 2;
        // CÙNG MỘT THƯỚC với nhánh chấm (đếm bậc ĐÃ TRAO), nếu không thì hai
        // đường dùng hai con trỏ khác nhau và thang nhảy loạn: em kể một câu ở
        // lượt 6 là được ngay bậc sâu nhất trong khi nhánh chấm mới ở bậc 2.
        const rungTurnsR = attRows.slice(Math.max(0, minAtt - 1));
        const engagedR = rungTurnsR.filter((r) => Number(r.thinking_quality ?? 0) >= 0.5).length;

        // ── VAN CHO EM KẸT THẬT (vá 29/07, chủ dự án đưa hội thoại thật) ─────
        // Lời xin giúp bị hạ tín hiệu suy nghĩ xuống 0,3 để không ai bấm nút gợi
        // ý mà mua được bậc thang. Đúng với em lười — nhưng em KẸT THẬT cũng gõ
        // đúng mấy chữ đó ("em chưa hiểu"), và vì tín hiệu bị hạ nên `engagedR`
        // đứng im ⇒ mãi ở bậc 1 ⇒ sư tử hỏi lại cùng một câu tới khi em bỏ cuộc.
        // Đo được: hai lượt "chưa hiểu" liền nhận về gần như y hệt một câu.
        //
        // Từ lượt xin giúp THỨ HAI LIÊN TIẾP: coi là kẹt thật, cho đi tiếp một
        // bậc mỗi lượt. AN TOÀN vì bậc thang là CÂU HỎI gợi mở do giáo viên
        // soạn, KHÔNG phải đáp án — và `bottomOut` vẫn KHÔNG bao giờ được
        // truyền qua đường đối thoại này. Xin giúp nhiều nhất chỉ đi hết thang,
        // không bao giờ chạm đáy.
        const ketThat = Math.max(0, (mem?.xinGiupLienTiep ?? 0) - 1);
        // LUẬT CHỈ-TIẾN, dùng CHUNG con trỏ với nhánh chấm (lỗi #27). Hai nhánh
        // đọc cùng một dấu vết `meta.bacTrao` nên em hỏi qua ô trò chuyện hay
        // sai qua ô đáp án đều leo tiếp cùng một thang, không ai nhận lại đúng
        // câu gợi ý vừa đọc.
        const daTraoR = new Set<number>();
        for (const r of (chatRes?.data ?? []) as Array<{ role: string; meta: Record<string, unknown> | null }>) {
          if (r.role !== "tutor") continue;
          const mt = r.meta ?? {};
          if (mt.questionId !== q.id) continue;
          if (ladder?.id && mt.thangId && mt.thangId !== ladder.id) continue;
          if (typeof mt.bacTrao === "number") daTraoR.add(mt.bacTrao);
        }
        // Đếm TỪ LẦN THỬ CUỐI (đặt SỚM hơn trước — cần cho `bestR` bên dưới, và
        // vẫn tái dùng để đưa `noiChuaThu` vào prompt ở cuối như cũ).
        const lastAttAt = attRows.length
          ? String((attRes.data ?? [])[attRows.length - 1]?.created_at ?? "")
          : "";
        const noiSauLanThuCuoi = ((chatRes?.data ?? []) as Array<
          { created_at: string; role: string; meta: { kind?: string; questionId?: string } | null }
        >).filter((r) =>
          r.role === "student" &&
          r.meta?.kind === "reflect" && r.meta?.questionId === q.id &&
          (!lastAttAt || r.created_at > lastAttAt)
        ).length;
        // ── VAN THỨ HAI: TRẢ LỜI THẬT NHƯNG NGẮN CŨNG BỊ ĐỨNG IM (phản hồi thật
        // 03/08) ─────────────────────────────────────────────────────────────
        // `ketThat` chỉ tính khi HAI lượt LIÊN TIẾP đều là "xin giúp" (memory.ts
        // dừng đếm ngay khi gặp một lượt CÓ nội dung thật). Nhưng một câu trả
        // lời THẬT mà ngắn (vd "để làm mệnh đề" — 4 từ, dưới ngưỡng 5) cũng bị
        // `thinkingContentSignal` chấm thấp y như spam (xem cap ở dòng ~547) —
        // và vì nó không phải "xin giúp", `xinGiupLienTiep`/`ketThat` không
        // tính, nên bậc vẫn đứng im. Kết quả: sư tử hỏi lại gần như y hệt câu cũ
        // hai-ba lượt liền, dù học sinh có thử thật. Van thứ hai: đã ≥2 lượt
        // phản hồi (bất kể xin giúp hay trả lời ngắn) kể từ lần thử cuối mà
        // VẪN ở nguyên bậc này → ép qua cổng — CẢ HAI chỗ (bậc thang lẫn cổng
        // nỗ lực), không chỉ đổi giọng mà bậc vẫn đứng im.
        //
        // Luật + ngưỡng nằm ở `tinhVanNoLuc` (pedagogy.ts), KHÔNG viết tay ở
        // đây: hàm này quyết định cả bậc thang lẫn cổng nỗ lực, mà bản viết tay
        // đầu tiên đã lệch ngưỡng (1 thay vì 2) đúng vì nó nằm lẫn trong thân
        // handler nên không bộ kiểm nào với tới. Nay `goiy-matrix` gác nó.
        const vanThat = tinhVanNoLuc({
          ketThatLienTiep: ketThat,
          luotNoiSauLanThuCuoi: noiSauLanThuCuoi,
        });
        const currentRungR = chonBacGoiY({
          engaged: engagedR + vanThat, bacDaTrao: [...daTraoR], totalRungs,
          exhausted: false,
          // Đối thoại KHÔNG bao giờ chạm đáy: chat nhiều không moi được đáp án (B4).
          choPhepDay: false,
        });
        // Kẹt thật (hoặc trả lời ngắn lặp) thì cũng phải QUA được cổng, không
        // thì stage kẹt ở "need_think" và bậc thang vừa mở ra lại không được dùng.
        const bestR = vanThat > 0 ? Math.max(best, 0.5) : best;

        const gate = evaluateEffortGate({
          attempts,
          thinkingQuality: bestR,
          currentRung: currentRungR,
          totalRungs,
          minAttempts: minAtt,
        });
        let msg: string;
        // Bậc thang đã soạn cho lượt này (KHÔNG bao giờ mở đáy qua đường đối
        // thoại — B4: chat nhiều không moi được đáp án).
        const rung = rungs[Math.min(currentRungR, Math.max(0, rungs.length - 1))];
        const rungText = rung?.cau_hoi ?? rung?.goi_y ?? "";
        const stage: "must_try" | "need_think" | "guide" =
          gate.action === "require_attempt" ? "must_try"
          : gate.action === "require_thinking" ? "need_think"
          : "guide";

        // ── EM ĐANG ĐÙA HAY ĐANG HỌC? (chủ dự án chốt 29/07) ─────────────────
        // KHÔNG cắm trần cứng rồi chặn em lại — đó là tư duy bán dịch vụ, và nó
        // phạt oan đúng em kẹt thật (em kẹt cũng nói nhiều lượt liền). Thay vào
        // đó ĐƯA TÌNH TRẠNG cho sư tử, để chính nó nhận ra và tự nói bằng lời
        // của nó — như một người bạn để ý thấy nãy giờ toàn nói chuyện.
        //
        // Đếm TỪ LẦN THỬ CUỐI: em vừa nói vừa làm bài thì nói bao nhiêu cũng
        // được, đó đúng là thứ mình muốn khuyến khích. (Đã tính ở trên.)

        // ĐƯỜNG LUI TẤT ĐỊNH — dùng khi trường chưa bật khoá AI hoặc LLM hỏng.
        if (stage === "must_try") {
          msg = en
            ? "Thanks for sharing your thinking! Now pick or type an answer first — trying is how we learn. I'm right here."
            : "Cảm ơn bạn đã kể! Giờ bạn chọn hoặc điền một đáp án trước nhé — thử mới biết mình vướng ở đâu, mình ở ngay đây.";
        } else if (stage === "need_think") {
          msg = en
            ? "Tell me a bit more — which step did you take first, and why?"
            : "Bạn kể cụ thể hơn chút nữa nhé — bạn làm bước nào trước, và vì sao chọn bước đó?";
        } else {
          msg = rungText
            ? `${en ? "Try thinking from this question: " : "Thử nghĩ từ câu này nhé: "}${rungText}`
            : en
              ? "Which piece of the question have you not used yet?"
              : "Trong đề bài còn dữ kiện nào bạn chưa dùng đến?";
        }

        // ── AI ĐÁP ĐÚNG CÁI EM VỪA NÓI (vá 29/07) ──────────────────────────
        // Trước đây nhánh này TẤT ĐỊNH 100%: em nói ba điều khác nhau — kể cả
        // một quan niệm sai thật ("trời đẹp quá là đúng mà") — mà sư tử lặp y
        // một câu ba lần. Cổng nỗ lực vẫn do SERVER quyết (stage ở trên); AI
        // chỉ được DIỄN ĐẠT đúng quyết định đó bằng lời bám vào ý của em.
        // `bottomOut` cố tình KHÔNG truyền ⇒ mô hình không có gì để lộ.
        const { text: safe, map } = anonymize(reasoning, names);
        return await speak({
          envelope: { correct: false, gate: "reflect", graded: false },
          fallback: msg,
          map,
          // GHI lại bậc vừa trao khi thật sự có trao (stage "guide") — đây là
          // dấu vết mà cả hai nhánh đọc để không trao lại đúng bậc cũ (lỗi #27).
          persistMeta: {
            gate: "reflect", stage, questionId: q.id,
            ...(stage === "guide" && rungText
              ? { bacTrao: Math.min(currentRungR, Math.max(0, rungs.length - 1)), thangId: ladder?.id ?? null }
              : {}),
          },
          questionId: q.id,
          llm: Deno.env.get("OPENROUTER_API_KEY")
            ? {
              system: buildGuideSystem({
                subject: s.subject,
                grade: String(grade),
                language,
                nodeLabel: nodeLabelForGuide,
                question: String(q.noi_dung ?? "").slice(0, 600),
                ...(rungText && stage === "guide" ? { rungQuestion: rungText } : {}),
                attempts,
                stage,
                hasMemory: !!mem,
                // Nói nhiều mà chưa thử lại → sư tử tự thấy, tự kéo về việc làm bài.
                ...(noiSauLanThuCuoi >= 4 ? { noiChuaThu: noiSauLanThuCuoi } : {}),
                ...(styleNote ? { coGiongRieng: true } : {}),
              }),
              user: buildGuideUser({
                giongRieng: styleNote,
                hoSo: mem?.hoSo,
                soTay: mem?.soTay,
                lichSu: mem?.lichSu,
                studentSaid: safe,
              }),
              agent: "guide",
              tier: "cheap", // đối thoại = việc nhẹ, deepseek-flash: nhanh + rẻ
              // Chỗ em ngồi chờ chữ hiện ra → chọn nhà cung cấp nhanh nhất.
              fastRoute: true,
              maxTokens: 200,
              // 0,65 chứ không 0,4: lượt đối thoại cần ĐỔI NHỊP giữa các lần.
              // Ở 0,4 mô hình bám một dáng câu duy nhất — đọc ra ngay là máy nói.
              // Đây là lời DẪN DẮT, không phải phán quyết, nên nới được: chấm
              // đúng/sai vẫn tất định, và bậc thang vẫn do giáo viên soạn.
              temperature: 0.65,
              studentId: s.student_id,
              tenantId: s.tenant_id,
              supa,
            }
            : null,
        });
      }

      persist("student", studentAnswer, undefined, { questionId: q.id, nodeKey: q.node_key });

      // ── A1 · CỔNG Ý ĐỊNH (29/07, lỗi 14): lời XIN TRỢ GIÚP gõ vào ô đáp án
      // KHÔNG được đem đi chấm — trước đây "gợi ý giúp em" bị chấm ĐÚNG rồi
      // CHÚC MỪNG. Chỉ coi là xin giúp khi câu KHÔNG khớp nguyên văn đáp án /
      // một phương án nào (đáp án thật không bao giờ là "không biết làm").
      // KHÔNG ghi attempt, KHÔNG ghi bằng chứng, KHÔNG XP — đây không phải lượt thử.
      {
        const nq = (x: string) =>
          x.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
        const na = nq(studentAnswer);
        const matchesOption =
          na.length > 0 &&
          (nq(String(q.dap_an ?? "")) === na ||
            // Array.isArray BẮT BUỘC: `distractors` là jsonb không ràng buộc kiểu.
            // Chỗ này chạy TRƯỚC khi chấm nên một dòng dữ liệu méo sẽ ném
            // "some is not a function" cho MỌI câu trả lời, kể cả câu đúng —
            // rộng hơn hẳn lối cũ (chỉ chạy khi trả lời sai).
            (Array.isArray(q.distractors) &&
              (q.distractors as Array<{ phuong_an: string }>).some((d) => nq(d?.phuong_an ?? "") === na)));
        if (!matchesOption && isHelpRequest(studentAnswer)) {
          // Mở đúng BẬC 1 của thang Socratic (siêu nhận thức) nếu node có thang —
          // xin giúp là tín hiệu tốt, phải được đáp bằng câu dẫn, không phải im lặng.
          const { data: hl } = await supa
            .from("socratic_ladders")
            .select("rungs")
            .eq("kg_version_id", s.kg_version_id)
            .eq("node_key", q.node_key)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
          const rung1 = (hl?.rungs as Array<{ cau_hoi?: string }> | null)?.[0]?.cau_hoi;
          const msg = en
            ? `Happy to help you think — no grading on this one. ${rung1 ?? "Tell me first: what is the question asking, in your own words?"}`
            : `Được chứ — mình cùng nghĩ nhé (lượt này không chấm điểm). ${rung1 ?? "Bạn kể mình nghe trước: đề bài đang hỏi điều gì, nói bằng lời của bạn?"}`;
          persist("tutor", msg, "engine", { gate: "help", questionId: q.id });
          return json({ correct: false, gate: "help", graded: false, message: msg });
        }
      }

      // Đếm lần thử + đọc node (revision/label) độc lập → SONG SONG. nodeRow
      // đọc MỘT LẦN ở đây rồi truyền xuống recomputeNodeState (không đọc lần hai).
      // Lấy kèm thinking_quality của lần thử GẦN NHẤT: lượt "kể cách nghĩ" (B0)
      // đã cộng dồn suy nghĩ thật vào đó — cổng nỗ lực phải nhớ, không bắt kể lại.
      const [prevRes, { data: nodeRow }] = await Promise.all([
        // PHẢI .order: `rungTurns` cắt theo VỊ TRÍ nên thứ tự là ngữ nghĩa, không
        // phải trang trí. Postgres không hứa thứ tự khi thiếu ORDER BY — hôm nay
        // đúng chỉ vì heap tình cờ xếp vậy; một lần CLUSTER/dump-restore là cắt
        // nhầm hàng, và em đã kể cách nghĩ lại bị tụt về bậc 1 mãi.
        supa.from("attempts").select("thinking_quality")
          .eq("session_id", s.id).eq("question_id", q.id)
          .order("attempt_no", { ascending: true }),
        supa.from("kg_nodes").select("revision, label").eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key).maybeSingle(),
      ]);
      const prevRows = (prevRes.data ?? []) as Array<{ thinking_quality: number | null }>;
      const attemptNo = prevRows.length + 1;
      // Suy nghĩ CAO NHẤT em từng thể hiện ở câu này (gồm cả lượt "kể cách nghĩ"
      // — B0 ghi đè lên lần thử gần nhất). Cổng nhớ, không bắt kể lại từ đầu.
      const prevThinking = prevRows.reduce((m, r) => Math.max(m, Number(r.thinking_quality ?? 0)), 0);

      // Dạng tương tác (dung_sai/sap_xep/noi_cot) chấm CẤU TRÚC tất định (so dãy /
      // tập cặp / đúng-sai) — CAS không phủ được. Còn lại (mcq/điền/toán) dùng CAS:
      // checkAnswer thay {name} vào dap_an rồi so tương đương (KHÔNG nhận body.params).
      // Thứ tự: (1) dạng tương tác chấm CẤU TRÚC tất định → (2) câu MỞ chấm bằng
      // mô hình (so Ý) → (3) CAS. Mỗi bậc trả null thì rơi xuống bậc dưới, nên
      // hỏng LLM cũng không kẹt học sinh.
      const interV = gradeInteractive(q.dang_cau_hoi, studentAnswer, String(q.dap_an ?? ""));
      const openQ = !interV && isOpenAnswer(q);
      // ── A1 · CHẶN RÁC trước LLM (lỗi 9/11): câu MỞ mà bài làm chỉ là "ok" /
      // một con số trơ thì KHÔNG gọi mô hình (đỡ token) và KHÔNG tính lượt thử —
      // trả lời thẳng là bài chưa đủ để chấm. Chính nhánh này chặn ca "nhập 1 số
      // bất kỳ thì sư tử báo chính xác" của người thử 2.
      if (openQ && isJunkOpenAnswer(studentAnswer, String(q.dap_an ?? ""))) {
        const msg = en
          ? "This one needs your reasoning in full sentences — write out your idea first, then submit again. (Not graded yet, so nothing lost!)"
          : "Câu này cần bạn viết lập luận thành câu — bạn viết rõ ý của mình rồi gửi lại nhé. (Lượt này mình chưa chấm, không mất gì đâu!)";
        persist("tutor", msg, "engine", { gate: "insufficient", questionId: q.id });
        return json({ correct: false, gate: "insufficient", graded: false, message: msg });
      }
      let openV = !openQ
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
      // ĐAI AN TOÀN sau LLM. Chỉ RÀNG khi đáp án mẫu là ĐOẠN VĂN (≥12 từ): ở đó
      // một bài vài chữ không thể đủ ý, nên LLM gật là chắc chắn sai (lỗi 8:
      // "ok" từng đậu 3/5 lần). Câu điền khuyết đáp án một cụm từ thì KHÔNG ràng
      // — ràng là đánh trượt chính em gõ đúng; ở đó LLM/CAS là trọng tài.
      if (openV?.correct && !plausibleOpenAnswer(studentAnswer, String(q.dap_an ?? ""))) {
        openV = { correct: false, method: "llm", detail: en ? "answer too short to cover the key ideas" : "bài làm quá ngắn so với yêu cầu" };
      }
      const verdict =
        interV ?? openV ?? (await checkAnswer(studentAnswer, String(q.dap_an ?? ""), qParams));
      // Chỉ khi SAI mới cần khớp distractor để bắt quan niệm sai; đúng thì bỏ hẳn
      // vòng lặp. Còn cần thì chạy SONG SONG (checkAnswer có thể nạp mathjs).
      let matched: string | null = null;
      if (!verdict.correct) {
        // `?? []` KHÔNG đủ: distractors là jsonb không ràng buộc kiểu, `?? []`
        // chỉ bắt null/undefined còn một object/chuỗi vẫn lọt xuống `.map` rồi ném.
        const distractors = (
          Array.isArray(q.distractors) ? q.distractors : []
        ) as Array<{ phuong_an: string; quan_niem_sai: string }>;
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
      // BỊT RÒ 29/07 (chủ dự án chỉ ra): XP "đúng" CHỈ ở lần thử ĐẦU — bấm mò
      // 4 phương án tới khi trúng không còn ăn +10; kiên trì thật vẫn có +5.
      const xpEvents: XpEventInput[] = [];
      if (verdict.correct && attemptNo === 1) xpEvents.push({ kind: "correct", questionId: q.id, sessionId: s.id });
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
            : `Chính xác! Bạn vừa làm chủ "${nodeLabel}" rồi đó — nỗ lực bền bỉ của bạn được đền đáp!`;
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
      const [{ data: ladders }, luotTutor] = await Promise.all([
        supa
          .from("socratic_ladders")
          .select("id, rungs, bottom_out, cong_no_luc, misconception")
          .eq("kg_version_id", s.kg_version_id)
          .eq("node_key", q.node_key)
          .eq("status", "active"),
        // Bậc thang ĐÃ TRAO trong phiên này — nền của luật "gợi ý chỉ tiến,
        // không lùi" (lỗi #27). Đi CÙNG chuyến với truy vấn thang, không thêm
        // vòng chờ nào cho học sinh.
        supa
          .from("session_turns")
          .select("meta")
          .eq("session_id", s.id)
          .eq("role", "tutor")
          .order("created_at", { ascending: true })
          .limit(150),
      ]);
      const ladder =
        (matched && (ladders ?? []).find((l) => l.misconception === matched)) || (ladders ?? [])[0] || null;

      const rungs = (ladder?.rungs ?? []) as Array<{ cau_hoi?: string; goi_y?: string }>;
      const totalRungs = rungs.length > 0 ? rungs.length : 4;
      const minAttempts =
        (ladder?.cong_no_luc as { so_lan_thu_toi_thieu?: number } | null)?.so_lan_thu_toi_thieu ?? 2;

      // ── CỔNG NỖ LỰC, viết lại 29/07 ────────────────────────────────────────
      // Cũ: thinkSignal + (attemptNo − minAttempts) × 0,55 ⇒ bấm đại thêm MỘT
      //     nhát là qua cổng "đã suy nghĩ thật" (cổng = cái đếm click).
      // Lần vá đầu trừ thêm 2 thì hỏng kiểu khác: `currentRung` vẫn chạy theo
      // attemptNo nên khi thinking đủ thì rung đã tới cuối ⇒ NHẢY THẲNG bottom_out,
      // 2.628 thang Socratic không bao giờ được dùng.
      // Nay tách hẳn hai trục:
      //   • QUA CỔNG   ← chất lượng suy nghĩ (nội dung lượt này, hoặc cao nhất
      //                  từng thể hiện ở câu này). Bấm mò KHÔNG mua được.
      //   • LÊN BẬC    ← số lần đã thực sự trình bày (`engaged`), nên mỗi lần em
      //                  nói ra suy nghĩ là được thêm MỘT bậc gợi mở.
      // Van xả: im lặng quá lâu thì vẫn được dẫn (không giam em), nhưng vì
      // `engaged` = 0 nên chỉ tới bậc 1 — đáy KHÔNG mở bằng cách click.
      const stuckLong = attemptNo >= minAttempts + 4;
      const thinkingQuality = Math.min(1, Math.max(thinkSignal, prevThinking, stuckLong ? 0.5 : 0));
      // Chốt chặn cuối: quá nhiều lần mà vẫn kẹt thì mở đáy/vá nền, đừng để em
      // quay vòng vô tận trên cùng một câu.
      // `currentRung` = SỐ BẬC ĐÃ TRAO trước lượt này (0 ⇒ sắp trao bậc 1).
      // Bậc CHỈ được trao ở những lượt SAU trần tối thiểu, nên đếm từ đó —
      // đếm cả các lượt đầu là bậc 1 (siêu nhận thức) bị nhảy cóc, thành ra em
      // nào chịu khó kể lại càng bị bỏ qua đúng bậc quan trọng nhất.
      // KHÔNG kẹp xuống totalRungs-1: phải chạm được totalRungs thì đáy mới mở.
      const rungTurns = prevRows.slice(Math.max(0, minAttempts - 1));
      const engaged = rungTurns.filter((r) => Number(r.thinking_quality ?? 0) >= 0.5).length;
      const exhausted = attemptNo >= minAttempts + totalRungs + 2;

      // ── LỖI #27: GỢI Ý CHỈ ĐƯỢC TIẾN, KHÔNG ĐƯỢC LÙI ───────────────────────
      // Người thử 1 đợt 2, khi được hỏi "nếu chỉ được sửa MỘT thứ": *"Sư tử nên
      // có các gợi ý tăng cấp độ hướng dẫn lên và đừng hiển thị một gợi ý giống
      // nhau hai ba lần."*
      //
      // Gốc: `currentRung = engaged`, mà `engaged` chỉ đếm lượt CÓ trình bày
      // suy nghĩ. Em bấm sai ba lần liền thì engaged đứng ở 0 ⇒ nhận đúng
      // `rungs[0]` ba lần. Câu mở lời có xoay vòng nên nghe hơi khác, còn RUỘT
      // gợi ý thì y nguyên. Đã đếm trên DB: 204/204 node đều có thang ≥3 bậc và
      // 0/2.628 thang có hai bậc trùng chữ — nội dung thừa sức, chỉ con trỏ đứng.
      //
      // Vì sao "không lùi" KHÔNG phải là chặn em xuống mức dễ hơn: thang này đi
      // từ ÍT đỡ tới NHIỀU đỡ (bậc 1 siêu nhận thức → 2 hướng chú ý → 3 dẫn về
      // tiền đề → 4 giàn giáo mạnh, đúng thứ tự ở cả 2.628 thang). ĐI TỚI CHÍNH
      // LÀ DỄ HƠN; lùi lại là RÚT giàn giáo đi, ném lại câu mơ hồ nhất cho đúng
      // em đang kẹt nhất.
      //
      // Con trỏ tính THEO TỪNG THANG: em sai kiểu A rồi sang kiểu B thì thang B
      // là nội dung khác hẳn, phải được bắt đầu lại từ bậc 1 của chính nó — nếu
      // không nó bị vào thẳng bậc 3 và nuốt mất hai bậc đầu.
      const daTrao = new Set<number>();
      for (const r of (luotTutor.data ?? []) as Array<{ meta: Record<string, unknown> | null }>) {
        const m = r.meta ?? {};
        if (m.questionId !== q.id) continue;
        if (ladder?.id && m.thangId && m.thangId !== ladder.id) continue;
        if (typeof m.bacTrao === "number") daTrao.add(m.bacTrao);
      }
      const currentRung = chonBacGoiY({
        engaged, bacDaTrao: [...daTrao], totalRungs, exhausted, choPhepDay: true,
      });

      const gate = evaluateEffortGate({
        attempts: attemptNo,
        thinkingQuality,
        currentRung,
        totalRungs,
        minAttempts,
      });

      if (gate.action === "require_attempt") {
        // Xoay vòng lời nhắc (lỗi 19 — một câu lặp mãi nghe như máy hỏng), và
        // khi đã bắt được QUAN NIỆM SAI thì nói thẳng vào nó (không lộ đáp án —
        // chỉ gọi tên cách nghĩ chưa chuẩn mà distractor này được soạn để bắt).
        // Thư viện CỐ Ý lớn + đa giọng điệu (không phải cùng một khuôn "Chưa
        // đúng — ..." lặp lại): lượt sai ĐẦU TIÊN vẫn tất định 100% (tức thời,
        // không gọi LLM) nhưng phải đủ đa dạng để không lộ ra là câu soạn sẵn.
        const RETRY_VI = [
          "Chưa đúng rồi. Bạn dựa vào đâu để chọn như vậy?",
          "Chưa phải rồi, đọc lại đề chậm một lượt xem — còn dữ kiện nào bạn chưa dùng?",
          "Sai là não đang tập mà, thử một hướng khác xem sao?",
          "Chưa trúng. Bạn thử kể lại từng bước mình vừa làm xem nào?",
          "Gần đúng hướng thôi, chưa phải đáp án. Bạn soát lại bước đầu tiên thử xem.",
          "Không phải rồi bạn ơi. Có chỗ nào trong đề mình đọc lướt qua không nhỉ?",
          "Chưa được. Thử hình dung lại vấn đề theo cách khác xem sao?",
          "Trật rồi. Bạn tự tin với cách làm vừa rồi không, hay đang đoán?",
          "Chưa ổn. Mình gợi ý một chút: đọc lại câu hỏi xem nó thực sự cần gì.",
          "Sai chỗ nào đó rồi. Bạn có muốn thử lại theo hướng khác không?",
          "Chưa khớp đáp án đâu. Bước tính/lập luận vừa rồi bạn chắc chắn chưa?",
          "Không đúng. Cứ bình tĩnh, thử lại một lần nữa nhé.",
          "Chưa ăn khớp với đề rồi. Bạn thử đọc lại câu hỏi một lượt xem sao.",
          "Hụt rồi bạn ơi. Có bước nào bạn làm tắt không nhỉ?",
          "Không phải đáp án đó. Bạn thử tính/suy luận lại từ đầu xem.",
          "Chệch hướng một chút rồi. Bạn định nghĩa lại vấn đề xem có khác không.",
          "Chưa tới rồi. Mình đoán bạn đang vội — thử chậm lại một nhịp xem.",
          "Không đúng đâu. Bạn có chắc mình hiểu đúng đề chưa?",
          "Trớt quớt rồi bạn ơi, thử lại phát nữa xem nào.",
          "Chưa phải. Có khi nào bạn nhớ nhầm công thức/quy tắc nào đó không?",
          "Sai bét rồi, nhưng không sao — thử soi lại từng chữ trong đề xem.",
          "Chưa đúng. Bạn làm theo trực giác hay có tính toán hẳn hoi vậy?",
          "Lệch rồi. Câu này có cần bước trung gian nào bạn bỏ qua không?",
          "Không khớp. Bạn thử đổi cách tiếp cận xem, đừng đi lại đúng đường cũ.",
          "Trật lất rồi. Bạn có muốn đọc lại đề một lần nữa trước khi thử tiếp không?",
          "Chưa chuẩn. Cứ thoải mái, sai ở đây không mất gì cả, thử lại xem.",
          "Không ra rồi. Bạn thử hình dung bằng hình vẽ/ví dụ cụ thể xem sao.",
          "Chưa tới đích. Có phép tính nào bạn làm hơi nhanh không?",
          "Sai chỗ nào chưa rõ, nhưng chắc chắn chưa đúng — thử cách khác xem.",
        ];
        // Lead-in khi bắt được quan niệm sai — cũng xoay vòng, tránh dính cứng
        // một cụm ("dính một bẫy quen thuộc") lặp ở mọi lượt.
        const TRAP_LEAD_VI = [
          "Mình nhận ra cách nghĩ sau lựa chọn đó, nó dính một bẫy quen thuộc:",
          "Chỗ bạn vừa chọn có một hiểu lầm khá phổ biến:",
          "Mình đoán được vì sao bạn chọn vậy rồi, có một bẫy nhỏ ở đây:",
          "Nhiều bạn cũng chọn y như vậy vì vướng đúng chỗ này:",
          "À, mình biết chỗ này rồi — nhiều bạn hay lẫn đúng điểm này:",
          "Đây là một nhầm lẫn kinh điển, không riêng gì bạn đâu:",
          "Mình thấy lỗi rồi, khá tinh vi đấy:",
          "Có một chỗ dễ lẫn ở ngay đây, mình chỉ cho bạn nhé:",
          "Đúng kiểu nhầm mà rất nhiều bạn học mắc phải:",
          "Ồ, đây là một cái bẫy quen mặt trong đề dạng này:",
          "Mình hiểu vì sao bạn chọn phương án đó — có một điểm dễ gây lầm:",
          "Chỗ này tinh vi thật, bạn không phải người đầu tiên vướng đâu:",
        ];
        const TRAP_LEAD_EN = [
          "I can see the idea behind that choice, it hides a common trap:",
          "There's a fairly common mix-up behind that pick:",
          "I get why you chose that, there's a small trap here:",
          "That's a classic one, lots of people trip on it:",
          "There's a subtle trap right there:",
        ];
        // ── KHÔNG hỏi lại "vì sao bạn chọn vậy" sau khi đã NÓI THẲNG bẫy —
        // hỏi lại là mâu thuẫn (vừa giải thích lý do sai, lại quay ra hỏi lý
        // do). Phát hiện qua phản hồi thật 02/08: lượt sai ĐẦU TIÊN đã bắt
        // được quan niệm sai, máy vẫn hỏi "bạn dựa vào đâu để chọn như vậy?"
        // — nghe như hai module ghép lại không ăn khớp. Trường hợp matched
        // dùng bộ câu chốt RIÊNG: mời thử lại, không đòi giải trình.
        const RETRY_AFTER_TRAP_VI = [
          "Giờ bạn thử chọn lại xem.",
          "Nhìn lại các lựa chọn với bẫy vừa nói, thử lại nhé.",
          "Bạn xem lại và chọn lại thử xem.",
          "Giờ tránh đúng bẫy đó, chọn lại xem nào.",
          "Biết bẫy rồi thì thử lại chắc ăn hơn đó, làm lại xem.",
          "Vậy giờ bạn thử tránh đúng chỗ đó rồi chọn lại nhé.",
          "Thử lại đi, lần này chắc chắn né được rồi.",
          "Vậy giờ chọn lại thử, mình tin bạn né được bẫy đó.",
          "Giờ nhớ chỗ vừa nói rồi, chọn lại xem sao.",
          "Bạn thử lại lần nữa, để ý đúng chỗ mình vừa chỉ nhé.",
        ];
        const RETRY_AFTER_TRAP_EN = [
          "Now give it another try.",
          "Watch out for that trap and pick again.",
          "Have another look and try once more.",
          "Now that you know the trap, give it another shot.",
        ];
        const base = en
          ? (matched
              ? RETRY_AFTER_TRAP_EN[(attemptNo - 1) % RETRY_AFTER_TRAP_EN.length]!
              : "Not quite yet — give it one more try first. What was your reasoning?")
          : (matched
              ? RETRY_AFTER_TRAP_VI[(attemptNo - 1) % RETRY_AFTER_TRAP_VI.length]!
              : RETRY_VI[(attemptNo - 1) % RETRY_VI.length]!);
        const leadTrap = en
          ? TRAP_LEAD_EN[(attemptNo - 1) % TRAP_LEAD_EN.length]!
          : TRAP_LEAD_VI[(attemptNo - 1) % TRAP_LEAD_VI.length]!;
        const msg = matched
          ? `${leadTrap} ${safeMisconception(matched, q.dap_an)}. ${base}`
          : base;
        persist("tutor", msg, "engine", { gate: gate.action, matched, questionId: q.id });
        return json({ correct: false, attemptNo, gate: gate.action, message: msg, ...(xp ? { xp } : {}) });
      }

      // Chưa thể hiện suy nghĩ thật (server chấm thấp) → mời HS nói cách nghĩ TRƯỚC
      // khi mở gợi ý — KHÔNG cho nhảy thẳng vào thang/đáy nhờ khai khống từ client.
      if (gate.action === "require_thinking") {
        // Xoay vòng lời mời (lỗi 19): nhánh này có thể lặp vài lượt liền, nói y
        // hệt một câu là nghe như máy hỏng — mà đây đúng là chỗ cần em mở lời.
        const ASK_VI = [
          'Trước khi mình gợi ý, bạn kể xem đã nghĩ thế nào để ra kết quả đó nhé? Gõ vào ô "Kể cách em nghĩ" bên dưới.',
          "Bạn nói mình nghe bước đầu tiên bạn làm là gì? Nói sai cũng không sao — mình cần biết bạn đang nghĩ theo hướng nào.",
          "Trong đề, dữ kiện nào bạn thấy quan trọng nhất? Kể ra là mình dẫn tiếp ngay.",
          "Bạn thử diễn đạt lại đề bài bằng lời của mình xem? Đôi khi nói ra là tự thấy chỗ vướng.",
          "Cho mình biết bạn đang hình dung bài toán/câu này như thế nào đã nhé.",
          "Bạn định làm theo cách nào? Cứ nói ra, sai cũng không sao, mình chỉ cần hiểu hướng đi của bạn.",
          "Có bước nào bạn còn phân vân không chắc không? Nói ra để mình biết chỗ cần đỡ.",
          "Mình muốn nghe cách bạn suy luận trước đã — bắt đầu từ đâu vậy?",
          "Bạn thử kể từng bước một cho mình nghe xem, dù chưa chắc cũng được.",
          "Điều gì khiến bạn chọn theo hướng đó? Kể mình nghe cái đã.",
          "Bạn có đang phân vân giữa mấy cách làm không? Nói ra xem nào.",
          "Trước khi đi tiếp, bạn tóm tắt lại đề bằng lời của mình được không?",
          "Mình tò mò bạn suy luận kiểu gì để ra kết quả đó — kể thử xem.",
          "Bạn thử nói xem mình hiểu đề đang hỏi cái gì đã nhé.",
          "Có phần nào trong đề bạn thấy khó hình dung không? Nói ra để mình gỡ cùng.",
          "Bạn cứ kể thoải mái cách bạn tiếp cận bài này, đúng sai tính sau.",
          "Mình cần hiểu bạn đang nghĩ gì đã, rồi mình mới gợi ý đúng chỗ được.",
          "Bạn thử giải thích lại cho mình như đang nói với một người bạn xem.",
        ];
        // KHÔNG hỏi lại "bạn nghĩ thế nào" sau khi đã NÓI THẲNG bẫy — cùng lỗi
        // mâu thuẫn như require_attempt (phát hiện qua phản hồi thật 02/08).
        // Đã bắt được `matched` thì câu chốt phải mời SOÁT LẠI đúng chỗ vừa
        // nêu, không hỏi ngược lý do của một câu trả lời đã biết là sai kiểu gì.
        const ASK_AFTER_TRAP_VI = [
          "Bạn thử soát lại chính chỗ đó rồi chọn lại xem.",
          "Nhìn lại đúng chỗ mình vừa nói rồi thử lại nhé.",
          "Giờ tránh đúng bẫy đó, bạn làm lại thử xem.",
          "Bạn xem lại bước đó rồi chọn/điền lại giúp mình nhé.",
          "Biết chỗ hụt rồi thì soát lại thử, chắc ra được đó.",
          "Giờ bạn quay lại đúng bước đó, sửa rồi làm tiếp nhé.",
          "Thử soi lại đúng điểm mình vừa nói xem sao.",
          "Bạn làm lại từ chỗ đó xem, lần này chắc ổn hơn.",
        ];
        const ASK_AFTER_TRAP_EN = [
          "Take another look at that exact spot and try again.",
          "Watch out for that trap and give it another go.",
        ];
        const moiKe = en
          ? "Before I give a hint — tell me how you got that. What was your reasoning?"
          : ASK_VI[Math.min(attemptNo - minAttempts, ASK_VI.length - 1)] ?? ASK_VI[0]!;
        // (c) NÓI VÌ SAO SAI — lỗi #9(c), vá 30/07. Nhánh này là từ lần sai THỨ
        // HAI trở đi, tức đúng lúc em cần biết mình hỏng ở đâu nhất; vậy mà nó
        // không hề dùng `matched` đã tính sẵn ngay phía trên. Người thử 1:
        // "Không giải thích vì sao câu trả lời của mình lại bị đánh giá sai".
        // Đây KHÔNG phải cho đáp án: `quan_niem_sai` gọi tên CÁCH NGHĨ chưa
        // chuẩn mà chính phương án nhiễu đó được soạn ra để bắt, và
        // safeMisconception đã cắt phần lỡ chứa đáp án.
        // Đặt vào `fallback` là ĐÚNG CHỖ chứ không phải đường chết: khi mô hình
        // sống nó đã nhận `misconception` qua system prompt (dưới), còn fallback
        // chỉ chạy khi KHÔNG gọi mô hình — mà đó chính là ca em chưa nói câu nào
        // trong buổi, ca dễ lạc nhất.
        const chanDoan = safeMisconception(matched, q.dap_an);
        const closerSauBay = en
          ? ASK_AFTER_TRAP_EN[(attemptNo - 1) % ASK_AFTER_TRAP_EN.length]!
          : ASK_AFTER_TRAP_VI[(attemptNo - 1) % ASK_AFTER_TRAP_VI.length]!;
        const msg = chanDoan
          ? (en
              ? `There's a common trap behind that choice: ${chanDoan}. ${closerSauBay}`
              : `Chỗ bạn chọn dính một bẫy quen thuộc: ${chanDoan}. ${closerSauBay}`)
          : moiKe;

        // ── LỚP 3 (chốt 29/07): NHÁNH NÀY TỪNG KHÔNG HỀ GỌI AI ────────────────
        // Đo trên hội thoại thật: em kể cách nghĩ hai lượt liền — kể ĐÚNG — rồi
        // chọn sai một phương án, và nhánh này đáp "bạn kể xem đã nghĩ thế nào".
        // Máy hỏi lại thứ em vừa trả lời, vì nhánh này không đọc gì cả.
        //
        // Chỉ gọi mô hình khi em ĐÃ NÓI ít nhất một lần trong buổi (mem.daNoi):
        // em mới vào bài, chưa nói câu nào thì chẳng có gì để nhớ — câu soạn sẵn
        // vừa đúng vừa hiện ra tức thì, gọi mô hình chỉ tốn thêm một vòng chờ.
        const askEnvelope = {
          correct: false,
          attemptNo,
          gate: gate.action,
          ...(xp ? { xp } : {}),
        };
        if (!Deno.env.get("OPENROUTER_API_KEY")) {
          return await speak({
            envelope: askEnvelope, fallback: msg, llm: null, map: {},
            persistMeta: { gate: gate.action, matched }, questionId: q.id,
          });
        }
        const [memAsk, { data: nodeRowAsk }, styleNoteAsk] = await Promise.all([
          buildMemory(supa, {
            sessionId: s.id, studentId: s.student_id, questionId: q.id,
            names, omitContent: studentAnswer,
          }).catch(() => null),
          supa.from("kg_nodes").select("label")
            .eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key)
            .maybeSingle(),
          fetchStyleNote(supa, s.student_id),
        ]);
        const { text: safeAns, map: mapAsk } = anonymize(studentAnswer, names);
        return await speak({
          envelope: askEnvelope,
          fallback: msg,
          map: mapAsk,
          persistMeta: { gate: gate.action, matched },
          questionId: q.id,
          llm: memAsk?.daNoi
            ? {
              system: buildGuideSystem({
                subject: s.subject,
                grade: String(grade),
                language,
                nodeLabel: String(nodeRowAsk?.label ?? q.node_key),
                question: String(q.noi_dung ?? "").slice(0, 600),
                ...(matched ? { misconception: safeMisconception(matched, q.dap_an) } : {}),
                attempts: attemptNo,
                // `need_think` = mời em nói rõ thêm MỘT nhịp. KHÔNG truyền
                // rungQuestion và KHÔNG truyền bottomOut: cổng chưa mở, mô hình
                // không được cầm sẵn thứ để lỡ miệng.
                stage: "need_think",
                hasMemory: true,
                ...(styleNoteAsk ? { coGiongRieng: true } : {}),
              }),
              user: buildGuideUser({
                giongRieng: styleNoteAsk,
                hoSo: memAsk.hoSo, soTay: memAsk.soTay, lichSu: memAsk.lichSu,
                studentSaid: `(vừa chọn/điền: ${safeAns})`,
              }),
              agent: "guide",
              tier: "cheap",
              // Đối thoại = chỗ em ngồi chờ chữ → chọn nhà cung cấp nhanh nhất.
              fastRoute: true,
              maxTokens: 200,
              // 0,65 chứ không 0,4: lượt đối thoại cần ĐỔI NHỊP giữa các lần.
              // Ở 0,4 mô hình bám một dáng câu duy nhất — đọc ra ngay là máy nói.
              // Đây là lời DẪN DẮT, không phải phán quyết, nên nới được: chấm
              // đúng/sai vẫn tất định, và bậc thang vẫn do giáo viên soạn.
              temperature: 0.65,
              studentId: s.student_id,
              tenantId: s.tenant_id,
              supa,
            }
            : null,
        });
      }

      // Hết thang + vẫn sai (ĐÃ NHẬN gợi mở ở đáy ít nhất một lượt) → lan truyền ngược.
      // ⚠️ Phải đứng SAU lượt bottom_out đầu tiên. Trước đây điều kiện là
      // `>= minAttempts + totalRungs`, trùng ĐÚNG lượt mà cổng bắt đầu trả
      // bottom_out ⇒ nhánh gợi mở của thang (socratic_ladders.bottom_out.noi_dung)
      // trở thành MÃ CHẾT, và học sinh nhảy thẳng sang lời giải ĐẦY ĐỦ — hé
      // nhiều hơn hẳn thiết kế. +3 để mọi kiểu học sinh (kể cả em im lặng, vốn
      // chỉ chạm đáy nhờ van `exhausted`) đều nhận gợi mở trước khi thấy lời giải.
      const pastBottomOut = attemptNo >= minAttempts + totalRungs + 3;
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
            : `Mình để ý chỗ vướng thật sự có thể nằm sâu hơn một tầng: "${rem.label}". Mình cùng quay lại vá nền đó trước nhé — nền chắc rồi, bài này sẽ dễ hơn nhiều!`;
          persist("tutor", msg, "engine", { gate: "remediate", from: q.node_key, to: rem.nodeKey, matched, questionId: q.id });
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
        persist("tutor", solution, "engine", { gate: "exhausted", matched, cont: nextSame?.nodeKey ?? null, questionId: q.id });
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
        // socratic_ladders.bottom_out.noi_dung sống hiện dính THẺ NỘI BỘ soạn
        // sẵn ở đầu chuỗi ("[CHỈ MỞ SAU CỔNG NỖ LỰC]", "[CHỈ MỞ SAU KHI ĐÃ QUA
        // CỔNG NỖ LỰC]" …) — đo được 1.717/2.628 dòng dính, mọi môn. Đây là nhãn
        // NỘI BỘ của quy trình soạn (đánh dấu điều kiện mở), không phải lời nói
        // với học sinh — lộ ra đọc như lỗi hệ thống. Cắt Ở ĐÂY (không sửa DB)
        // để áp dụng luôn cho dữ liệu cũ lẫn mọi lượt nạp ladder mới sau này.
        const stripLeadTag = (s: string) => s.replace(/^\s*\[[^\]]{0,80}\]\s*/, "");
        const bo = stripLeadTag((ladder?.bottom_out as { noi_dung?: string } | null)?.noi_dung ?? "") || undefined;
        const coreRaw = bo ?? q.loi_giai ?? "";
        const core = coreRaw && qParams ? fillTemplate(coreRaw, qParams) : coreRaw;
        // Xoay vòng luôn ở đây (lỗi #19): mở đáy là khoảnh khắc hiếm, nhưng em
        // học nhiều node thì vẫn nghe lại nhiều lần trong một buổi.
        const MO_DAY_VI = [
          ["Bạn đã đủ nỗ lực để mình mở hướng giải:", "Giờ thử làm lại bước cuối xem!"],
          ["Bạn thử đủ rồi, mình mở hướng nhé:", "Làm lại bước cuối là xong đấy."],
          ["Đến lúc mình chỉ đường rồi:", "Bạn ráp lại bước cuối thử xem."],
          ["Nỗ lực của bạn xứng đáng một gợi ý lớn hơn:", "Ráp lại bước cuối, chắc là ra thôi."],
          ["Mình hé cho bạn hướng đi nhé, bạn thử đủ nhiều rồi:", "Xem lại bước cuối cùng nào."],
          ["Được rồi, mình dẫn nốt đoạn này:", "Bạn hoàn thiện bước cuối giúp mình nhé."],
          ["Bạn kiên trì vậy là đủ rồi, mình bật đèn lớn hơn nhé:", "Ráp nốt bước cuối xem có ra không."],
          ["Cố gắng của bạn đáng một gợi ý rõ hơn:", "Thử hoàn thiện bước cuối cùng nào."],
          ["Mình không để bạn bí mãi đâu, đây là hướng đi:", "Làm nốt bước cuối là xong."],
          ["Được rồi, tới lúc mình hé lộ hướng làm:", "Bạn chỉ còn thiếu bước cuối thôi."],
          ["Bạn thử nhiều cách rồi, giờ mình dẫn thẳng luôn:", "Ráp lại và hoàn thiện xem sao."],
        ];
        const MO_DAY_EN = [
          ["You've earned a bigger hint — here's the key idea:", "Now try the final step again!"],
          ["You've put in the work, so here's the idea:", "Give that last step another go."],
          ["Time for me to point the way:", "Put the last step together and see."],
          ["That was solid effort, here's the bigger hint:", "Finish that last step now."],
        ];
        const md = (en ? MO_DAY_EN : MO_DAY_VI)[Math.max(0, attemptNo - 1) % (en ? MO_DAY_EN.length : MO_DAY_VI.length)]!;
        const msg = core
          ? `${md[0]} ${core}\n${md[1]}`
          : (en
              ? "Let's slow down and rebuild from the definition. What does the question actually ask?"
              : "Mình chậm lại, dựng từ định nghĩa nhé. Đề bài thật ra đang hỏi điều gì?");
        persist("tutor", msg, "engine", { gate: gate.action, matched, questionId: q.id });
        return json({ correct: false, attemptNo, gate: gate.action, message: msg, ...(xp ? { xp } : {}) });
      }

      // advance_rung — trao câu gợi mở đã soạn. Mặc định NGUYÊN VĂN (tất định);
      // một phần lượt (theo độ khó câu) được AI DIỄN ĐẠT LẠI cho tự nhiên hơn —
      // AI chỉ đổi CÁCH NÓI, KHÔNG đổi Ý (rungText truyền nguyên vào prompt,
      // xem buildGuideSystem: "diễn đạt lại tự nhiên, KHÔNG lộ đáp án"). Nếu
      // AI lỗi/hết ngân sách/không được chọn ở lượt này → luôn có câu tất định
      // làm `fallback`, học sinh không bao giờ thấy màn trống.
      const bacTrao = Math.min(currentRung, Math.max(0, rungs.length - 1));
      const rung = rungs[bacTrao];
      const rungText = rung?.cau_hoi ?? rung?.goi_y ?? "";
      // Bắt được quan niệm sai → GỌI TÊN nó (lỗi 9c: "không giải thích vì sao
      // bị đánh sai") — dữ liệu quan_niem_sai được soạn đúng cho việc này, không
      // chứa đáp án cuối.
      // XOAY VÒNG cách mở lời (lỗi #19). Chuỗi cố định thì em nghe y hệt mọi
      // lượt — người thử 1: "câu 'Gần được rồi — còn thiếu' xuất hiện quá nhiều
      // lần". Chọn theo attemptNo chứ KHÔNG random: cùng một lượt vẽ lại nhiều
      // lần thì chữ không được nhảy trước mắt em.
      const MO_LOI_VI = [
        "Mình hiểu vì sao bạn nghĩ vậy, nhưng trong đó có một bẫy:",
        "Chỗ này nhiều bạn cũng vướng y như vậy:",
        "Cách nghĩ đó hợp lý, chỉ lệch đúng một chỗ:",
        "Hướng đi không sai, nhưng có một chỗ hụt:",
        "Mình thấy logic của bạn rồi, có một điểm cần soát lại:",
        "Gần đúng hướng, nhưng lệch ở một chi tiết:",
        "Bạn đi gần tới nơi rồi, chỉ hụt đúng một bước:",
        "Suy nghĩ của bạn có cơ sở, chỉ thiếu một mảnh ghép:",
        "Không tệ đâu, chỉ là còn sót một điều kiện:",
        "Bạn nhìn ra phần lớn vấn đề rồi, chỉ lệch nhỏ thôi:",
      ];
      const MO_LOI_EN = [
        "I see where that came from, there's a trap in it:",
        "A lot of people trip on exactly this:",
        "That reasoning makes sense, it just slips at one point:",
        "The direction isn't wrong, but there's a gap:",
      ];
      const chanDoanRung = safeMisconception(matched, q.dap_an);
      const leadMo = (en ? MO_LOI_EN : MO_LOI_VI)[Math.max(0, attemptNo - 1) % (en ? MO_LOI_EN.length : MO_LOI_VI.length)]!;
      const lead = chanDoanRung ? `${leadMo} ${chanDoanRung}. ` : "";
      const msg = rungText
        ? `${lead}${en ? "Try thinking from this question: " : "Thử nghĩ từ câu này nhé: "}${rungText}`
        : (en
            ? `${lead}Not quite. Which piece of the question have you not used yet?`
            : `${lead}Chưa đúng. Trong đề bài còn dữ kiện nào bạn chưa dùng đến?`);
      const persistMetaRung = {
        gate: gate.action, currentRung, matched, questionId: q.id,
        bacTrao, thangId: ladder?.id ?? null,
      };
      const envelopeRung = { correct: false, attemptNo, gate: gate.action, currentRung, ...(xp ? { xp } : {}) };

      const aiChance = AI_REPHRASE_CHANCE[toDoKho(q.do_kho)] ?? 0.5;
      const tryAiRung = !!rungText && !!Deno.env.get("OPENROUTER_API_KEY") && Math.random() < aiChance;
      if (!tryAiRung) {
        persist("tutor", msg, "engine", persistMetaRung);
        return json({ ...envelopeRung, message: msg });
      }
      const [memRung, { data: nodeRowRung }, styleNoteRung] = await Promise.all([
        buildMemory(supa, {
          sessionId: s.id, studentId: s.student_id, questionId: q.id,
          names, omitContent: studentAnswer,
        }).catch(() => null),
        supa.from("kg_nodes").select("label")
          .eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key)
          .maybeSingle(),
        fetchStyleNote(supa, s.student_id),
      ]);
      const { text: safeAnsRung, map: mapRung } = anonymize(studentAnswer, names);
      return await speak({
        envelope: envelopeRung,
        fallback: msg,
        map: mapRung,
        persistMeta: persistMetaRung,
        questionId: q.id,
        llm: {
          system: buildGuideSystem({
            subject: s.subject,
            grade: String(grade),
            language,
            nodeLabel: String(nodeRowRung?.label ?? q.node_key),
            question: String(q.noi_dung ?? "").slice(0, 600),
            ...(chanDoanRung ? { misconception: chanDoanRung } : {}),
            rungQuestion: rungText,
            attempts: attemptNo,
            stage: "guide",
            hasMemory: !!memRung,
            ...(styleNoteRung ? { coGiongRieng: true } : {}),
          }),
          user: buildGuideUser({
            giongRieng: styleNoteRung,
            hoSo: memRung?.hoSo, soTay: memRung?.soTay, lichSu: memRung?.lichSu,
            studentSaid: `(vừa chọn/điền: ${safeAnsRung})`,
          }),
          agent: "guide",
          tier: "cheap",
          fastRoute: true,
          maxTokens: 200,
          temperature: 0.65,
          studentId: s.student_id,
          tenantId: s.tenant_id,
          supa,
        },
      });
    }

    // ── NỘP BÀI (câu tự luận dài) — AI CHẤM HẾT, ba cửa vào một bộ chấm ────────
    //
    // ĐỔI LỚN 01/08 (chủ dự án chốt). Trước đây phán quyết là của GIÁO VIÊN, AI
    // chỉ đọc sơ. Đo trên prod ngày đổi: 69 bản nộp, **0 bản từng được chấm
    // Đạt**, 60 bản nằm chờ. Vòng lặp đó chưa khép nổi lần nào — mà [NOPBAI] là
    // 323/1.930 câu và thường là câu DOK≥3 DUY NHẤT của node, nên 60 em kia có
    // lộ trình đứng im vĩnh viễn. Nay AI quyết, giáo viên không chấm nữa.
    //
    // Ba cửa vào — gõ tay, tệp Word, ảnh chụp — quy về MỘT chuỗi (doc-bai-lam.ts)
    // rồi mới chấm. Một bộ chấm duy nhất, nộp đường nào cũng cùng thước đo.
    //
    // ĐAI AN TOÀN giữ nguyên tinh thần cũ (nghi ngờ thì TRƯỢT), vì bài học 29/07
    // là AI cho chữ "ok" đậu 3/5 lần rồi đẻ 12 bằng chứng nhiễm:
    //   · isJunkOpenAnswer  — bài rác không bao giờ tới được bộ chấm.
    //   · đếm ý fail-closed — mô hình tự khai đạt < cần mà vẫn gật thì hạ thành sai.
    //   · plausibleOpenAnswer — đáp án mẫu là đoạn văn thì bài vài chữ không thể đạt.
    //   · temperature 0 + cache — cùng một bài không lúc đậu lúc trượt.
    // Và khi KHÔNG chấm được (LLM hỏng, ảnh mờ, hết ngân sách token) thì bản nộp
    // nằm lại 'pending' + nói thẳng với em, TUYỆT ĐỐI không lặng lẽ đánh trượt.
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

      // ── ĐỌC TỆP RA CHỮ ────────────────────────────────────────────────────
      // Word / ảnh / .txt đều thành chữ ở đây rồi mới chấm. Trước 01/08 tệp
      // KHÔNG hề được đọc — nó chỉ nằm chờ mắt giáo viên, nên em nộp ảnh là
      // chắc chắn không có phản hồi nào.
      const doc = filePath
        ? await docBaiLamTuTep({
          supa, filePath, mime: String(body.mime ?? ""), en,
          studentId: s.student_id, tenantId: s.tenant_id,
        })
        : null;

      // Bài đầy đủ = phần em gõ + phần đọc ra từ tệp. Nộp cả hai (gõ lời giải,
      // chụp thêm hình vẽ) là chuyện thường, và chấm thiếu một nửa là chấm oan.
      const baiDayDu = [workText, doc?.text ?? ""].filter((t) => t.trim()).join("\n\n").slice(0, 10_000);

      // Có tệp mà KHÔNG đọc nổi, lại chẳng gõ gì → chưa có bài để chấm.
      //
      // CỐ Ý KHÔNG chèn dòng `submissions` ở đây. `learning-path` dựng bàn chân
      // đỏ theo bản nộp MỚI NHẤT của mỗi câu — một dòng 'pending' chèn vào lúc
      // này sẽ đè lên bản 'redo' trước đó và XOÁ MẤT dấu đỏ, dù em chưa sửa được
      // gì. Mà ở nhánh này cũng chẳng có bài nào để giữ: tệp vẫn nằm nguyên
      // trong bucket, còn dấu vết thì đã ghi ở session_turns ngay bên dưới.
      if (!baiDayDu.trim()) {
        const msg = doc?.canhBao
          ?? "Mình chưa đọc được bài của bạn. Bạn gõ vào ô soạn thảo, hoặc chụp lại ảnh rõ hơn nhé.";
        persist("tutor", msg, "engine", {
          gate: "unreadable", kind: "upload", questionId: q.id,
          nguon: doc?.nguon ?? null, filePath: filePath || null,
        });
        return json({ kind: "nop_bai", submitted: false, feedback: msg });
      }

      // ── A1 · CỔNG Ý ĐỊNH — "ok" / lời xin trợ giúp KHÔNG phải bài nộp ─────
      // (Lỗi 8: sáu bản nộp "ok" thật đã lọt vào hàng đợi 28/07.) Nay soi trên
      // BÀI ĐẦY ĐỦ, không chỉ phần gõ: em gõ "ok" nhưng đính ảnh bài làm thật
      // thì đó là bài thật, chặn ở đây là chặn oan.
      const refW = [q.dap_an, q.loi_giai].filter(Boolean).join(" ");
      if (isJunkOpenAnswer(baiDayDu, refW)) {
        const msg = isHelpRequest(baiDayDu)
          ? "Bạn đang cần gợi ý đúng không? Ô này là chỗ NỘP bài làm hoàn chỉnh — muốn được dẫn từng bước, bạn quay về câu hỏi và bấm xin gợi ý nhé."
          : "Bài nộp cần lời giải đầy đủ của bạn (viết thành câu, có lập luận). Bạn viết rõ rồi nộp lại nhé — lượt này mình chưa ghi nhận.";
        persist("tutor", msg, "engine", { gate: "insufficient", kind: "upload" });
        return json({ kind: "nop_bai", submitted: false, feedback: msg });
      }

      // ── CHẤM ───────────────────────────────────────────────────────────────
      const ai: CasResult | null = await gradeOpenAnswer({
        prompt: (q.noi_dung ?? "").replace(/^\[(NOPBAI|WRITING|SPEAKING)\]\s*/i, ""),
        reference: [q.dap_an, q.loi_giai].filter(Boolean).join("\n"),
        studentAnswer: baiDayDu,
        names,
        en,
        studentId: s.student_id,
        tenantId: s.tenant_id,
        supa,
      });

      // Phán quyết cuối do MỘT hàm thuần chốt (grade-open.ts) — cùng hàm mà
      // đợt chạy lại hàng đợi cũ dùng, nên hai đường không thể lệch thước.
      const { chamDuoc, dat, lyDo } = chotPhanQuyet(ai, baiDayDu, refW);

      const { error: insErr } = await supa.from("submissions").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        node_key: q.node_key,
        kind: "upload",
        // Lưu BÀI ĐẦY ĐỦ, không chỉ phần gõ: bản chép từ ảnh là thứ AI đã dựa
        // vào để chấm, không lưu lại thì sau này không ai dò được vì sao trượt.
        text_content: baiDayDu || null,
        file_path: filePath || null,
        mime: String(body.mime ?? "").slice(0, 80) || null,
        size_bytes: Number(body.size) || null,
        status: chamDuoc ? (dat ? "passed" : "redo") : "pending",
        feedback: {
          // `dung` là PHÁN QUYẾT CUỐI (đã qua đai), `moHinhNoi` là ý thô của mô
          // hình. Lưu cả hai: lệch nhau chính là dấu vết cần đọc khi rà lại.
          ai: chamDuoc ? { dung: dat, moHinhNoi: ai!.correct, thieu: ai!.detail ?? "" } : null,
          ...(doc ? { doc: { nguon: doc.nguon, canhBao: doc.canhBao ?? null } } : {}),
        },
        ...(chamDuoc ? { graded_at: new Date().toISOString() } : {}),
      });
      if (insErr) return json({ error: insErr.message }, 500);

      // GHI LƯỢT THỬ. Bỏ dòng này là lộ trình đếm thiếu: `learning-path` dựng
      // "đã làm mấy câu" TỪ BẢNG attempts, còn mẫu số đếm cả câu [NOPBAI] ⇒ bài
      // 8 câu có 1 câu nộp bài sẽ đứng mãi ở 7/8.
      const { count: prevW } = await supa.from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("session_id", s.id).eq("question_id", q.id);
      const soLanNop = (prevW ?? 0) + 1;
      await supa.from("attempts").insert({
        tenant_id: s.tenant_id,
        session_id: s.id,
        student_id: s.student_id,
        question_id: q.id,
        node_id: q.node_key,
        attempt_no: soLanNop,
        raw_answer: baiDayDu.slice(0, 4000),
        is_correct: dat,
      });

      persist("student", baiDayDu.slice(0, 2000), undefined, {
        questionId: q.id, kind: "upload", nguon: doc?.nguon ?? "go",
      });

      // ── BẰNG CHỨNG MASTERY + XP ────────────────────────────────────────────
      // Chỉ ghi khi CHẤM ĐƯỢC. Ghi cả khi trượt: bằng chứng "chưa đạt" là thứ
      // dựng bàn chân đỏ trên lộ trình, thiếu nó thì node im lặng như chưa làm.
      let mastered = false;
      let xp: Awaited<ReturnType<typeof awardXp>> | null = null;
      if (chamDuoc) {
        const { data: nodeRowW } = await supa
          .from("kg_nodes").select("revision")
          .eq("kg_version_id", s.kg_version_id).eq("node_key", q.node_key)
          .maybeSingle();

        // MỘT câu = MỘT bằng chứng. Khoá chống trùng của bảng chỉ tính trong
        // cùng phiên, nên bằng chứng của phiên TRƯỚC phải dọn — không thì em
        // sửa bài nộp lại mà dòng cũ vẫn giữ node xanh (hoặc vẫn giữ nó đỏ).
        await supa.from("mastery_evidence").delete()
          .eq("student_id", s.student_id).eq("question_id", q.id).neq("session_id", s.id);
        const { error: evErr } = await supa.from("mastery_evidence").upsert(
          {
            tenant_id: s.tenant_id,
            session_id: s.id,
            student_id: s.student_id,
            node_id: q.node_key,
            question_id: q.id,
            correct: dat,
            dok: q.dok,
            // Cố ý ĐÚNG NHƯ teacher-grading vẫn ghi: bài tự luận dài luôn là câu
            // KHÓ của node. Hai đường phải đẻ ra dòng giống hệt nhau, kẻo bật
            // lại màn chấm của giáo viên là mastery nhảy số.
            do_kho: "kho",
            is_target_difficulty: true,
            kg_version_id: s.kg_version_id,
            node_revision: nodeRowW?.revision ?? null,
          },
          // KHÔNG ignoreDuplicates: em nộp lại bài đã sửa thì phán quyết mới
          // phải ĐÈ lên phán quyết cũ, không thì sửa xong vẫn đỏ.
          { onConflict: "session_id,question_id" },
        );
        if (evErr) return json({ error: "mastery_evidence: " + evErr.message }, 500);

        const state = await recomputeNodeState(supa, {
          tenantId: s.tenant_id, studentId: s.student_id, kgVersionId: s.kg_version_id,
          nodeKey: q.node_key, nodeRevision: nodeRowW?.revision ?? null,
        });
        mastered = state.mastered;

        // XP "đúng" CHỈ ở lần nộp ĐẦU — nộp đi nộp lại tới khi qua không được
        // ăn +10 (cùng luật với nhánh trắc nghiệm). Kiên trì thật vẫn có +5.
        const xpEventsW: XpEventInput[] = [];
        if (dat && soLanNop === 1) xpEventsW.push({ kind: "correct", questionId: q.id, sessionId: s.id });
        if (soLanNop >= 2) xpEventsW.push({ kind: "persistence", questionId: q.id, sessionId: s.id });
        if (dat && state.newlyMastered) {
          xpEventsW.push({ kind: "node_mastered", nodeId: q.node_key, kgVersionId: s.kg_version_id, sessionId: s.id });
        }
        xp = await awardXp(supa, s.tenant_id, s.student_id, xpEventsW);
      }

      // ── LỜI CHO EM ─────────────────────────────────────────────────────────
      const themCanhBao = doc?.canhBao ? ` ${doc.canhBao}` : "";
      // Đai độ dài chặn (mô hình gật nhưng bài quá ngắn so với đáp án mẫu) thì
      // `detail` rỗng — nói đúng cái em cần sửa thay vì câu chung chung.
      const quaNgan = lyDo === "bai_qua_ngan";
      const fb = !chamDuoc
        ? "Mình đã giữ bài của bạn, nhưng lúc này chưa chấm được. Bạn quay lại sau ít phút và nộp lại nhé — bài không mất đâu."
        : dat
          ? (en
            ? "Nice work — that covers the main points. Logged to your path."
            : "Bài đạt rồi! Bạn nêu đủ các ý chính — mình ghi vào lộ trình luôn.") + themCanhBao
          : quaNgan
            ? `Bài còn ngắn so với đề này — đề đòi bạn trình bày cả lập luận, không chỉ đáp số. Bạn viết rõ các bước rồi nộp lại nhé.${themCanhBao}`
            : (ai!.detail
              ? `Chưa đạt — còn thiếu: ${ai!.detail} Bạn bổ sung rồi nộp lại nhé, nộp lại bao nhiêu lần cũng được.${themCanhBao}`
              : `Chưa đạt. Bạn đọc lại đề một lượt xem còn ý nào chưa viết, bổ sung rồi nộp lại nhé.${themCanhBao}`);
      persist("tutor", fb, "grade-open", { aiCorrect: chamDuoc ? dat : null });

      return json({
        kind: "nop_bai",
        submitted: true,
        // null = chưa chấm được (hạ tầng), client hiện "giữ bài, thử lại sau".
        dat: chamDuoc ? dat : null,
        feedback: fb,
        ...(chamDuoc && !dat && ai!.detail ? { thieu: ai!.detail } : {}),
        ...(doc?.canhBao ? { canhBao: doc.canhBao } : {}),
        ...(mastered ? { mastered: true } : {}),
        ...(xp ? { xp } : {}),
      });
    }

    // ── Writing (English rubric, formative) — LLM đúng vai: chấm rubric ────

    if (action === "writing") {
      // Chấm rubric = lượt LLM "nặng" (tier default) → phải siết như nhánh nộp bài.
      const rlWr = await rateLimit(supa, `writing:${ctx.userId}`, 8, 60);
      if (!rlWr.ok) return json({ error: "rate_limited", retryAfter: rlWr.retryAfter }, 429);
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
      const rlSp = await rateLimit(supa, `speaking:${ctx.userId}`, 8, 60);
      if (!rlSp.ok) return json({ error: "rate_limited", retryAfter: rlSp.retryAfter }, 429);
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
      // RATE-LIMIT (bịt lỗ 29/07): nhánh này gọi LLM MỖI LƯỢT mà trước đây
      // KHÔNG siết gì — giữ Enter là đốt sạch ngân sách token của trường trong
      // vài phút. 20 lượt/phút vẫn rộng rãi cho đối thoại thật.
      const rlM = await rateLimit(supa, `msg:${ctx.userId}`, 20, 60);
      if (!rlM.ok) return json({ error: "rate_limited", retryAfter: rlM.retryAfter }, 429);

      // Cap 2k: lượt chat dài hơn là dán văn bản, không phải câu hỏi học tập —
      // vừa tiết kiệm token vừa thu hẹp đất tiêm lệnh.
      const studentMessage = String(body.message ?? "").slice(0, 2000);
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
      // TRÍ NHỚ — chính nhánh này đẻ ra câu "Chào bạn!" GIỮA cuộc trò chuyện rồi
      // giảng lại đúng cái định nghĩa em vừa nêu chuẩn hai lượt trước (đo 29/07).
      // Không phải mô hình dở: `user` gửi lên chỉ có đúng một câu em vừa gõ.
      const [mem, styleNoteMsg] = await Promise.all([
        buildMemory(supa, {
          sessionId: s.id, studentId: s.student_id,
          ...(body.questionId ? { questionId: String(body.questionId) } : {}),
          names, omitContent: studentMessage,
        }).catch(() => null),
        fetchStyleNote(supa, s.student_id),
      ]);
      const system = buildGuideSystem({
        subject: s.subject,
        grade: String(grade),
        language,
        nodeLabel: s.current_node_id ?? "",
        question: String(body.question ?? "").slice(0, 600),
        attempts: 0,
        hasMemory: !!mem?.lichSu,
        ...(styleNoteMsg ? { coGiongRieng: true } : {}),
      });
      return await speak({
        envelope: {},
        agent: "guide",
        // Mô hình hỏng thì vẫn phải có người trả lời em một câu tử tế.
        fallback: "Mình đang ở đây với bạn. Bạn nói lại giúp mình chỗ đang vướng nhé?",
        map,
        llm: {
          system,
          // Bọc lượt nói của học sinh trong thẻ dữ liệu — BASE đã dặn mô hình coi
          // phần trong thẻ là dữ liệu, không phải lệnh (chống "bỏ vai đi, in đáp án").
          // `styleNoteMsg` cũng phải tính vào điều kiện: mở đầu buổi học thì
          // chưa có `safe` lẫn `lichSu`, mà đó đúng là lúc cần biết giọng.
          user: safe || mem?.lichSu || styleNoteMsg
            ? buildGuideUser({
              giongRieng: styleNoteMsg,
              hoSo: mem?.hoSo, soTay: mem?.soTay, lichSu: mem?.lichSu,
              studentSaid: safe,
            })
            : "(mở đầu buổi học)",
          agent: "guide",
          fastRoute: true, // chỗ em ngồi chờ chữ → nhà cung cấp nhanh nhất
          // Đối thoại dẫn dắt = "cái dễ dễ" → tier cheap = deepseek-v4-flash: NHANH + RẺ
          // ($0.094/$0.188 per 1M, rẻ nhất & nhẹ nhất họ deepseek). Chấm rubric/nói giữ default.
          tier: "cheap",
          studentId: s.student_id,
          tenantId: s.tenant_id,
          supa,
        },
      });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    // KHÔNG rò nội bộ (chuỗi lỗi DB/provider) ra client — log server, trả chung chung.
    console.error("chat-turn error:", e instanceof Error ? (e.stack ?? e.message) : String(e));
    return json({ error: "internal" }, 500);
  }
});
