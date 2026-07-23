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
import { checkAnswer } from "../_shared/cas.ts";
import { gradeInteractive, parseInteractive, type InteractiveStruct } from "../_shared/interactive.ts";
import { evaluateEffortGate, recomputeMastery, nextReviewISO, type Evidence } from "../_shared/pedagogy.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { anonymize, rehydrate, callLLM } from "../_shared/llm.ts";
import { buildGuideSystem, buildScoredRubricSystem } from "../_shared/prompts.ts";
import { rubricFor, buildRubricResult, parseRubricJson, type RubricResult } from "../_shared/rubrics.ts";
import { awardXp, type XpEventInput } from "../_shared/xp.ts";
import { loadQuestionOverrides, isHidden, applyQuestionEdit, type QOverride } from "../_shared/overrides.ts";
import { genParams, seedFrom, fillTemplate, readSpec } from "../_shared/paramgen.ts";

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

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
async function pickQuestion(
  supa: ReturnType<typeof admin>,
  s: Session,
  nodeKey: string,
  excludeId?: string,
): Promise<QuestionItem | null> {
  const { data: qs } = await supa
    .from("questions")
    .select("id, node_key, tier, dok, do_kho, loai_danh_gia, dang_cau_hoi, noi_dung, dap_an, distractors, nhom_cham, tham_so_hoa, tham_so")
    .eq("kg_version_id", s.kg_version_id)
    .eq("node_key", nodeKey)
    .eq("trang_thai", "active")
    .order("tier", { ascending: true })
    .order("dok", { ascending: true });
  // H5 — lớp phủ GV (nạp 1 lần/request, cache trên session): bỏ câu ẨN, ghép SỬA.
  const cache = s as unknown as { _ovr?: Map<string, QOverride> };
  if (!cache._ovr) cache._ovr = await loadQuestionOverrides(supa, s.tenant_id);
  const ovr = cache._ovr;
  const visible = (qs ?? [])
    .filter((q) => !isHidden(ovr.get(q.id)))
    .map((q) => applyQuestionEdit(q, ovr.get(q.id)));
  const auto = visible.filter((q) => q.nhom_cham === "auto" || q.loai_danh_gia === "objective");
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
  if (inter) item.interactive = inter;
  if (q.dap_an && Array.isArray(q.distractors) && q.distractors.length > 0) {
    item.options = shuffle([
      fill(String(q.dap_an)),
      ...(q.distractors as Array<{ phuong_an: string }>).map((d) => fill(d.phuong_an)),
    ]);
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

/** Cập nhật mastery/Leitner NGAY sau mỗi bằng chứng — không đợi end-session.
 *  `nodeRevision` được TRUYỀN VÀO (đã đọc kg_nodes ở đường nóng) để KHÔNG đọc
 *  kg_nodes lần hai. */
async function recomputeNodeState(
  supa: ReturnType<typeof admin>,
  s: Session,
  nodeKey: string,
  nodeRevision: number | null,
): Promise<{ mastered: boolean; score: number; newlyMastered: boolean }> {
  const [{ data: evidence }, { data: prevState }] = await Promise.all([
    supa
      .from("mastery_evidence")
      .select("correct, dok, is_target_difficulty, created_at")
      .eq("student_id", s.student_id)
      .eq("kg_version_id", s.kg_version_id)
      .eq("node_id", nodeKey),
    supa
      .from("student_node_state")
      .select("mastered, leitner_box")
      .eq("student_id", s.student_id)
      .eq("kg_version_id", s.kg_version_id)
      .eq("node_id", nodeKey)
      .maybeSingle(),
  ]);
  const ev: Evidence[] = (evidence ?? []).map((e) => ({
    correct: e.correct,
    dok: e.dok,
    isTargetDifficulty: e.is_target_difficulty,
    at: new Date(e.created_at).getTime(),
  }));
  const v = recomputeMastery(ev);
  const now = Date.now();
  const box = prevState?.leitner_box ?? 0;
  await supa.from("student_node_state").upsert(
    {
      tenant_id: s.tenant_id,
      student_id: s.student_id,
      node_id: nodeKey,
      kg_version_id: s.kg_version_id,
      mastery_score: v.score,
      mastered: v.mastered,
      node_revision: nodeRevision ?? null,
      leitner_box: box,
      next_review_at: v.mastered ? nextReviewISO(box, now) : null,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "student_id,node_id,kg_version_id" },
  );
  return { mastered: v.mastered, score: v.score, newlyMastered: v.mastered && !prevState?.mastered };
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
        .select("id, node_key, dap_an, distractors, dok, do_kho, tier, loai_danh_gia, dang_cau_hoi, nhom_cham, noi_dung, loi_giai, tham_so_hoa, tham_so, tinh_mastery, hoi_do_tu_tin")
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
      const verdict =
        gradeInteractive(q.dang_cau_hoi, studentAnswer, String(q.dap_an ?? "")) ??
        (await checkAnswer(studentAnswer, String(q.dap_an ?? ""), qParams));
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
            do_kho: q.do_kho,
            is_target_difficulty: isTarget,
            kg_version_id: s.kg_version_id,
            node_revision: nodeRow?.revision ?? null,
          },
          { onConflict: "session_id,question_id", ignoreDuplicates: true },
        ),
      ]);
      if (evErr) return json({ error: "mastery_evidence: " + evErr.message }, 500);

      // Mastery sống — trạng thái node đổi ngay khi có bằng chứng mới.
      const state = await recomputeNodeState(supa, s, q.node_key, nodeRow?.revision ?? null);

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
        tier: "default",
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
