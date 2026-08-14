// diagnose — MVP stub (PRD §11, Q4): creates a session and returns the active
// questions for the subject's pilot node (full adaptive diagnostic lands at M5).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supa.ts";
import { authenticate, can, hasActiveConsent } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { orderedOptions } from "../_shared/options.ts";
import { goiYDinhDang } from "../_shared/dang-tra-loi.ts";
import { genParams, seedFrom, fillTemplate, readSpec } from "../_shared/paramgen.ts";
import { parseInteractive } from "../_shared/interactive.ts";
import { loadQuestionOverrides, isHidden, applyQuestionEdit } from "../_shared/overrides.ts";

// Server-side, KHÔNG nhận từ client: số câu tối đa trả về lượt đầu (chống kéo
// nguyên ngân hàng câu hỏi) + hạn mức chống lạm dụng (tạo phiên hàng loạt).
const FIRST_LOAD_LIMIT = 20;
const RL_MAX = 20; // tối đa 20 lượt diagnose
const RL_WINDOW_SEC = 60; // mỗi 60 giây / user

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const ctx = await authenticate(req);
    if (!ctx) return json({ error: "unauthorized" }, 401);
    if (!can(ctx, "learn:tutor:chat")) return json({ error: "forbidden" }, 403);

    // Nhận `subject` + `nodeKey` (BÀI HỌC đang mở) từ client; mọi thứ còn lại
    // (tenant, version, giới hạn) CHỐT server-side. `nodeKey` không được tin
    // thẳng — phải tra lại trong đúng version đang publish rồi mới dùng.
    //
    // Trước đây tham số này bị VỨT: bấm bài nào cũng ra cùng 20 câu đầu của CẢ
    // MÔN, rải trên 19 bài khác nhau (đo trên dữ liệu sống 27/07). Lộ trình vẽ
    // từng bài, mastery tính theo từng bài, mà nội dung học lại không thuộc bài
    // nào — học sinh không thể làm chủ nổi bài mình đang mở.
    // `questionId` (tuỳ chọn — luồng LÀM LẠI, lỗi 2): đưa đúng CÂU bị giáo viên
    // trả về lên ĐẦU phiên, học sinh không phải cày lại cả bài để tới nó.
    const { subject, nodeKey, questionId } = await req.json();
    if (!subject || typeof subject !== "string") return json({ error: "subject required" }, 400);

    const studentId = ctx.userId;
    const supa = admin();

    // Rate-limit theo user TRƯỚC khi chạm DB nặng / tạo phiên (chống spam phiên).
    const rl = await rateLimit(supa, `diagnose:${ctx.userId}`, RL_MAX, RL_WINDOW_SEC);
    if (!rl.ok) {
      return json({ error: "rate_limited", retryAfter: rl.retryAfter, message: "Bạn thao tác hơi nhanh — thử lại sau giây lát nhé." }, 429);
    }

    // Consent (PDPL) + tra version chạy SONG SONG — bớt một vòng mạng tuần tự.
    const [consentOk, versionRes] = await Promise.all([
      hasActiveConsent(ctx.userId),
      supa
        .from("kg_versions")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("subject", subject)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    // PDPL consent gate — no active consent → no processing.
    if (!consentOk) {
      return json({ error: "consent_required", message: "Cần đồng ý xử lý dữ liệu (consent) trước khi bắt đầu học." }, 403);
    }
    const version = versionRes.data;
    if (!version) return json({ error: `no published KG for ${subject}` }, 404);

    // Bài học đang mở: chỉ lấy câu CỦA BÀI ĐÓ. Tra node trong đúng version đang
    // publish — chuỗi lạ / node của version khác thì bỏ qua, rơi về chế độ CHẨN
    // ĐOÁN (quét cả môn) như lúc vào học lần đầu chưa chọn bài.
    let onlyNode: string | null = null;
    if (typeof nodeKey === "string" && nodeKey.trim()) {
      const { data: nodeRow } = await supa
        .from("kg_nodes")
        .select("node_key")
        .eq("kg_version_id", version.id)
        .eq("node_key", nodeKey.trim())
        .eq("status", "active")
        .maybeSingle();
      onlyNode = nodeRow?.node_key ?? null;
    }

    let qy = supa
      .from("questions")
      // KHÔNG select `tham_so`: schema hiện KHÔNG có cột đó (chỉ `tham_so_hoa`) →
      // select nó làm query LỖI → rỗng → "bài chưa có câu hỏi". Câu tham-số-hóa
      // cũng CHƯA có spec (content-sync không kéo về) nên sẽ hiện {b},{c} thô →
      // LỌC BỎ (chỉ phục vụ câu tĩnh). Bật lại khi có cột tham_so + spec từ Studio.
      .select("id, question_key, node_key, tier, dok, do_kho, loai_danh_gia, dang_cau_hoi, noi_dung, dap_an, distractors, rubric, tham_so_hoa")
      .eq("kg_version_id", version.id)
      .eq("trang_thai", "active")
      .eq("tham_so_hoa", false);
    if (onlyNode) qy = qy.eq("node_key", onlyNode);
    const { data: questions } = await qy
      .order("tier", { ascending: true })
      .order("dok", { ascending: true })
      // Tiêu chí phụ CỐ ĐỊNH: có 531 câu cùng (tier 1, dok 1), thiếu nó thì
      // Postgres trả thứ tự tuỳ lúc → mỗi lần vào bài lại thấy câu khác, không
      // ai làm nổi bảng đáp án và học sinh không quay lại đúng chỗ đang dở.
      .order("question_key", { ascending: true })
      // Giới hạn lượt đầu — không kéo cả ngân hàng câu về client.
      .limit(FIRST_LOAD_LIMIT);

    // H5 — lớp phủ GV: bỏ câu bị ẨN, ghép SỬA nội dung/lời giải trước khi phục
    // vụ. Rỗng khi GV chưa chỉnh gì (1 query nhẹ).
    const overrides = await loadQuestionOverrides(supa, ctx.tenantId);
    let served = (questions ?? [])
      .filter((q) => !isHidden(overrides.get(q.id)))
      .map((q) => applyQuestionEdit(q, overrides.get(q.id)));

    // ── BẬC THANG ĐỘ KHÓ, KHÔNG PHẢI VÁCH ĐỨNG (viết lại 14/08) ────────────
    // Nền: query xếp `tier ASC, dok ASC` nên câu khó luôn nằm CUỐI. Node chỉ
    // xanh khi làm đúng một câu DOK≥3, buổi học 8 câu mà gần như không ai đi
    // hết -> đo trên prod: 82 lượt DOK-1, 24 lượt DOK-2, ĐÚNG 5 lượt DOK-3.
    // Node không bao giờ xanh, lộ trình đứng ở 0%.
    //
    // Bản vá 13/08 nhấc câu DOK≥3 đầu tiên lên vị trí 3. Chạm được mastery,
    // nhưng đẻ ra một vách: dễ, dễ, KHÓ NHẤT, rồi tụt về trung bình. Chủ dự án
    // hỏi đúng chỗ đó ("bài học có sắp xếp đúng thứ tự chưa").
    //
    // Nay XOAY VÒNG theo DOK: mỗi vòng lấy một câu ở từng bậc 1→2→3→4. Buổi học
    // thành nhiều nhịp lên dốc thật (nhớ lại → hiểu → vận dụng), câu vận dụng
    // đầu tiên rơi vào vị trí 3 SAU một câu DOK-2 chứ không sau hai câu DOK-1.
    // Vẫn TẤT ĐỊNH (thứ tự trong từng bậc giữ nguyên `question_key`) nên em
    // thoát ra vào lại vẫn đúng chỗ đang dở — lý do cả khối này xếp cố định.
    const theoDok = new Map<number, typeof served>();
    for (const q of served) {
      const d = Number(q.dok) || 1;
      (theoDok.get(d) ?? theoDok.set(d, []).get(d)!).push(q);
    }
    const bac = [...theoDok.keys()].sort((a, b) => a - b);
    if (bac.length > 1) {
      const xoay: typeof served = [];
      for (let v = 0; xoay.length < served.length; v++) {
        for (const d of bac) {
          const q = theoDok.get(d)![v];
          if (q) xoay.push(q);
        }
      }
      served = xoay;
    }

    // LÀM LẠI ĐÚNG CÂU BỊ TRẢ: câu được yêu cầu nhảy lên đầu danh sách phục vụ.
    // Chỉ nhận id có thật trong danh sách vừa lọc (đã qua kiểm version + overlay
    // GV) — id lạ/tenant khác thì lặng lẽ bỏ qua, phiên chạy như thường.
    if (typeof questionId === "string" && questionId) {
      const idx = served.findIndex((q) => q.id === questionId);
      if (idx > 0) served = [served[idx]!, ...served.slice(0, idx), ...served.slice(idx + 1)];
    }

    const firstNode = served[0]?.node_key ?? null;
    const { data: ses } = await supa
      .from("learning_sessions")
      .insert({
        tenant_id: ctx.tenantId,
        student_id: studentId,
        subject,
        kg_version_id: version.id,
        current_node_id: firstNode,
        status: "active",
      })
      .select("id")
      .single();

    const items = served.map((q) => {
      // Dạng câu do NHÃN trong đề quyết định (lối có sẵn của [WRITING]/[SPEAKING]).
      // [NOPBAI] = câu tự luận dài: học sinh làm ngoài rồi tải bài lên, giáo viên
      // chấm sau — app không chấm, không đòi gõ cả đoạn vào ô nhập.
      const kind = /\[SPEAKING\]/i.test(q.noi_dung)
        ? "speaking"
        : /\[WRITING\]/i.test(q.noi_dung)
          ? "writing"
          : /\[NOPBAI\]/i.test(q.noi_dung)
            ? "nop_bai"
            : q.loai_danh_gia;
      // Câu khuôn: sinh params TẤT ĐỊNH theo (session, câu) — chat-turn chấm
      // dùng CÙNG seed nên số khớp cái học sinh thấy. Câu tĩnh: fill là no-op.
      const spec = q.tham_so_hoa ? readSpec(q.tham_so) : null;
      const params = spec && ses ? genParams(spec, seedFrom(ses.id, q.id)) : {};
      const fill = (t: string) => (spec ? fillTemplate(t, params) : t);
      const promptFilled = fill(q.noi_dung.replace(/^\[(SPEAKING|WRITING|NOPBAI)\]\s*/i, ""));
      // Bóc cấu trúc tương tác (sap_xep/noi_cot/checklist) — null cho dạng khác.
      // KHÔNG kèm đáp án.
      const rawInter = parseInteractive(q.dang_cau_hoi, promptFilled, String(q.dap_an ?? ""));
      // Điền-nhiều-ô CÓ phương án nhiễu vẫn là trắc nghiệm chọn cặp — giữ lưới
      // đáp án; chỉ câu không phương án mới dựng ô nhập từng chỗ.
      const inter =
        rawInter?.blanks && (q.distractors ?? []).length > 0 ? null : rawInter;
      const base = {
        id: q.id,
        nodeKey: q.node_key,
        tier: q.tier,
        dok: q.dok,
        doKho: q.do_kho,
        kind,
        dangCauHoi: q.dang_cau_hoi,
        prompt: promptFilled,
        ...(inter ? { interactive: inter } : {}),
      };
      // LỖI #29 — nói rõ KHUÔN câu trả lời được chấp nhận. Client không nhận
      // `dap_an` (đúng, không được lộ) nên chỗ duy nhất suy ra được khuôn là
      // đây. Hàm chỉ trả hằng số viết sẵn, không ghép mẩu nào của đáp án vào —
      // đo trên 468 câu tự luận đang sống: 0 gợi ý chứa nguyên đáp án.
      const goiY = goiYDinhDang(String(q.dap_an ?? ""), q.dang_cau_hoi);
      if (q.loai_danh_gia === "objective") {
        // Có phương án nhiễu → MCQ (thay params vào từng phương án); không có
        // (điền đáp án) → ô nhập tự do, chấm bằng CAS.
        const distractors = (q.distractors ?? []) as Array<{ phuong_an: string }>;
        // Checklist: distractors là biến thể lật một ý → KHÔNG dựng thành 4 nút
        // (client đã có UI tick từng ý). Xem ghi chú ở chat-turn/pickQuestion.
        if (distractors.length > 0 && !inter?.checklist) {
          // Thứ tự TẤT ĐỊNH theo mã câu (options.ts): cùng câu → muôn đời cùng
          // thứ tự, nên in được bảng đáp án; nhưng đáp án đúng KHÔNG dồn về ô đầu.
          const opts = orderedOptions(q.id, fill(String(q.dap_an)), distractors.map((d) => fill(d.phuong_an)));
          // MCQ tự nói ra mình cần gì (bốn ô để bấm) — thêm dòng gợi ý khuôn
          // chỉ là nhiễu. Người thử khen đúng hai dạng này "ổn".
          return { ...base, options: opts };
        }
        return { ...base, ...(goiY ? { goiYDinhDang: goiY } : {}) };
      }
      if (q.loai_danh_gia === "rubric") return { ...base, rubric: q.rubric };
      return base;
    });

    return json({ sessionId: ses?.id, kgVersionId: version.id, node: firstNode, questions: items });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
