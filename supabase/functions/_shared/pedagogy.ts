/** Deno port of @tutor/pedagogy effort gate (PRD §17, Q6=C). Keep in sync. */

export interface EffortGateInput {
  attempts: number;
  thinkingQuality?: number; // 0..1, optional LLM soft signal
  currentRung: number;
  totalRungs: number;
  minAttempts: number;
  thinkingThreshold?: number;
}

export type EffortGateAction =
  | "require_attempt"
  | "require_thinking"
  | "advance_rung"
  | "bottom_out";

export interface EffortGateDecision {
  action: EffortGateAction;
  reason: string;
}

// Từ khóa LẬP LUẬN (vi + vài từ en). Từ đơn khớp theo TOKEN (tránh khớp nhầm
// "do" trong "domain"); cụm nhiều từ khớp theo chuỗi con.
const REASON_SINGLE = new Set([
  "vì", "bởi", "nên", "do", "vậy", "nếu", "thì", "bằng", "tính", "suy", "ra",
  "thay", "gọi", "đặt", "xét", "because", "since", "so", "therefore",
  "thus", "hence", "solve", "apply", "let",
]);
const REASON_PHRASE = ["suy ra", "áp dụng", "công thức", "rút gọn", "vì vậy", "do đó"];

/**
 * Ước lượng "chất lượng suy nghĩ" (0..1) của một câu trả lời/giải thích của HS
 * bằng HEURISTIC NHẸ Ở SERVER (không cần LLM) — cho cổng nỗ lực (require_thinking)
 * một tín hiệu CỨNG, không phụ thuộc hoàn toàn vào phán đoán LLM. Dùng làm
 * `thinkingQuality` truyền vào evaluateEffortGate. Tiêu chí cộng điểm:
 *  - Độ dài: ≥6 từ (+0.4) hoặc 3–5 từ (+0.2) — có diễn giải, không cụt lủn.
 *  - Có bước tính: xuất hiện số hoặc phép toán (= + - * / ^ √) (+0.2).
 *  - Có từ khóa lập luận (vì/nên/suy ra/áp dụng…) (+0.4).
 * Rỗng, hoặc LẶP Y HỆT câu trước (chép lại để qua cổng) → 0.
 */
export function thinkingQuality(text: string, previous?: string): number {
  const t = (text ?? "").trim();
  if (!t) return 0;
  const norm = t.toLowerCase();
  if (previous && norm === previous.trim().toLowerCase()) return 0;

  // Tách token theo ranh giới KHÔNG-phải-chữ/số (giữ nguyên chữ có dấu tiếng Việt).
  const words = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let score = 0;

  if (words.length >= 6) score += 0.4;
  else if (words.length >= 3) score += 0.2;

  if (/[=+\-*/^√]|\d/.test(t)) score += 0.2;

  const hasReason =
    words.some((w) => REASON_SINGLE.has(w)) ||
    REASON_PHRASE.some((p) => norm.includes(p));
  if (hasReason) score += 0.4;

  return Math.min(1, score);
}

export function evaluateEffortGate(i: EffortGateInput): EffortGateDecision {
  const minA = i.minAttempts ?? 2;
  const threshold = i.thinkingThreshold ?? 0.5;

  // Hard gate — cannot be bypassed by any LLM judgement (the `cam` rule).
  if (i.attempts < minA) {
    return {
      action: "require_attempt",
      reason: `Cần thử ≥${minA} lần (đã thử ${i.attempts}).`,
    };
  }
  const thinking = i.thinkingQuality ?? 0;
  if (thinking < threshold) {
    return {
      action: "require_thinking",
      reason: "Chưa thể hiện suy nghĩ thật — yêu cầu giải thích cách làm.",
    };
  }
  // `currentRung` = SỐ BẬC ĐÃ TRAO. Mở đáy chỉ khi đã đi HẾT thang.
  // Sửa 29/07: điều kiện cũ `currentRung + 1 >= totalRungs` khiến bậc CUỐI
  // (giàn giáo mạnh — chỗ chia nhỏ quy trình, ngay trước khi hé hướng giải)
  // không bao giờ được trao: thang 4 bậc thực chất chỉ dùng 3.
  if (i.currentRung >= i.totalRungs) {
    return { action: "bottom_out", reason: "Đã đi hết thang → mở đáy kèm lý do." };
  }
  return { action: "advance_rung", reason: "Đủ nỗ lực + suy nghĩ thật → lên bậc gợi ý." };
}

/** Mastery threshold (Q1=C): ≥3/4 correct at target incl. ≥1 higher-order (DOK≥3). */
export const MASTERY = { minCorrect: 3, window: 4, minConsistent: 2 };

export interface Evidence {
  correct: boolean;
  dok: number;
  isTargetDifficulty: boolean;
  at: number; // ordering (ms)
}

export interface MasteryVerdict {
  mastered: boolean;
  score: number; // 0..1 over the recent window
  correctAtTarget: number;
  windowSize: number;
  hasHigherOrder: boolean;
}

/** Recompute mastery for one node from its evidence (Q1=C, Q5=B). */
/**
 * @param dokToiDaCoSan DOK cao nhất mà NGÂN HÀNG của node này thực sự có. Truyền
 *   null nếu chưa biết (giữ hành vi cũ). Xem chú thích "node cụt DOK" bên dưới.
 */
export function recomputeMastery(
  evidence: Evidence[],
  dokToiDaCoSan?: number | null,
): MasteryVerdict {
  const targeted = evidence.filter((e) => e.isTargetDifficulty).sort((a, b) => a.at - b.at);
  const window = targeted.slice(-MASTERY.window);
  const correct = window.filter((e) => e.correct);
  // ── NODE CỤT DOK (lỗi #23, rà 30/07) ─────────────────────────────────────
  // Điều kiện "phải có ≥1 câu DOK≥3 đúng" là ĐÚNG về sư phạm: thành thạo thì
  // phải chứng minh được ở bậc vận dụng, không phải nhớ máy móc. Nhưng đo trên
  // prod: học sinh có 32 lần đúng ở đúng độ khó mà CẢ 14 node đều chưa xanh —
  // vì nhiều node (KC-5110642, KC-0570467, KC-1828856…) có DOK cao nhất trong
  // ngân hàng chỉ là 2. Luật đang đòi một bằng chứng mà node đó KHÔNG CÓ
  // PHƯƠNG TIỆN để tạo ra: em làm đúng mọi câu vẫn vĩnh viễn không thành thạo,
  // và lộ trình đứng im vô thời hạn.
  // Nới đúng chỗ đó, KHÔNG nới cho node có sẵn câu bậc cao: node nào ngân hàng
  // có DOK≥3 thì vẫn phải làm đúng một câu như cũ.
  const nodeCutDok = typeof dokToiDaCoSan === "number" && dokToiDaCoSan < 3;
  const hasHigherOrder = nodeCutDok || correct.some((e) => e.dok >= 3);
  const mastered =
    correct.length >= MASTERY.minCorrect &&
    window.length >= MASTERY.minCorrect &&
    hasHigherOrder &&
    correct.length >= MASTERY.minConsistent;
  return {
    mastered,
    score: window.length ? correct.length / window.length : 0,
    correctAtTarget: correct.length,
    windowSize: window.length,
    hasHigherOrder,
  };
}

/** Leitner fixed intervals (Q2=B): 1 → 3 → 7 → 21 days. */
export const LEITNER_DAYS = [1, 3, 7, 21];
const DAY_MS = 86400000;
export function nextReviewISO(box: number, fromMs: number): string {
  const i = Math.max(0, Math.min(box, LEITNER_DAYS.length - 1));
  return new Date(fromMs + LEITNER_DAYS[i]! * DAY_MS).toISOString();
}

/**
 * Bao nhiêu lượt NÓI (kể từ lần thử cuối) thì mở van — xem `tinhVanNoLuc`.
 *
 * = 2, không phải 1. Ở 1 thì MỘT câu bất kỳ sau lần thử cuối đã đủ mở vế "diễn
 * đạt lý lẽ" của cổng nỗ lực, tức gần như bỏ hẳn vế đó. Ở 2 thì van mở đúng lúc
 * học sinh sắp phải nghe lại câu y hệt lần thứ ba — chữa đúng triệu chứng mà
 * không nới bất biến.
 */
export const NGUONG_MO_VAN = 2;

/**
 * VAN NỖ LỰC — cứu em đang nói thật mà bị đứng im tại chỗ.
 *
 * Hai đường vào, lấy đường nào rộng hơn:
 *
 *  1. `ketThatLienTiep` — em xin giúp nhiều lượt LIÊN TIẾP (van cũ, 29/07).
 *     `memory.ts` dừng đếm ngay khi gặp một lượt CÓ nội dung thật, nên đường này
 *     chỉ bắt được em spam "cho tớ gợi ý", không bắt được em trả lời thật.
 *
 *  2. `luotNoiSauLanThuCuoi` — van thứ hai (03/08, từ phản hồi thật). Một câu
 *     trả lời THẬT nhưng NGẮN ("để làm mệnh đề" — 4 từ, dưới ngưỡng 5) bị
 *     `thinkingContentSignal` chấm thấp y như spam, mà nó lại không phải "xin
 *     giúp" nên đường 1 không tính. Kết quả: em có thử thật mà bậc thang đứng
 *     im, sư tử hỏi lại gần như y hệt hai-ba lượt liền.
 *
 * Trả về số cộng thêm vào `engaged`. Nơi gọi còn dùng ">0" để nâng chất lượng
 * suy nghĩ lên đúng ngưỡng cổng — nên đây là hàm quyết định CẢ HAI: bậc thang
 * lẫn cổng nỗ lực. Tách ra khỏi thân request handler ngày 10/08 chính vì thế:
 * chỗ nào động tới cổng nỗ lực thì phải có bộ kiểm đứng gác.
 */
export function tinhVanNoLuc(i: {
  /** Số lượt xin giúp LIÊN TIẾP (đã trừ lượt đầu) — đường van cũ. */
  ketThatLienTiep: number;
  /** Số lượt em NÓI (kể/xin giúp) kể từ lần THỬ đáp án cuối cùng. */
  luotNoiSauLanThuCuoi: number;
}): number {
  const vanCu = Math.max(0, i.ketThatLienTiep);
  const vanMoi = i.luotNoiSauLanThuCuoi >= NGUONG_MO_VAN ? 1 : 0;
  return Math.max(vanCu, vanMoi);
}

/**
 * CHỌN BẬC GỢI Ý cho lượt này — luật "chỉ tiến, không lùi" (lỗi #27).
 *
 * Người thử 1 đợt 2, khi được hỏi *nếu chỉ được sửa MỘT thứ*: "Sư tử nên có các
 * gợi ý tăng cấp độ hướng dẫn lên và đừng hiển thị một gợi ý giống nhau hai ba
 * lần." Trước đó con trỏ chỉ chạy theo `engaged` (số lượt em thật sự trình bày
 * suy nghĩ), nên em bấm sai ba lần liền là nhận `rungs[0]` ba lần.
 *
 * Vì sao "không lùi" KHÔNG phải là chặn em xuống mức dễ hơn: thang Socratic đi
 * từ ÍT đỡ tới NHIỀU đỡ (bậc 1 siêu nhận thức → 2 hướng chú ý → 3 dẫn về tiền
 * đề → 4 giàn giáo mạnh — đúng thứ tự ở cả 2.628 thang trong ngân hàng). Đi tới
 * CHÍNH LÀ dễ hơn; lùi lại là rút giàn giáo đi.
 *
 * `bacDaTrao` phải là các bậc đã trao CỦA CHÍNH THANG NÀY. Em sai sang một quan
 * niệm sai khác thì đó là thang khác, nội dung khác, phải được bắt đầu lại từ
 * bậc 1 của nó — dùng chung con trỏ là nuốt mất hai bậc đầu của thang mới.
 */
export function chonBacGoiY(i: {
  /** Số lượt em đã thật sự trình bày suy nghĩ (thinking_quality ≥ ngưỡng). */
  engaged: number;
  /** Các bậc ĐÃ TRAO của thang này (chỉ số 0-based). */
  bacDaTrao: number[];
  totalRungs: number;
  /** Van xả: kẹt quá lâu thì cho chạm đáy dù chưa trình bày đủ. */
  exhausted: boolean;
  /**
   * Nhánh này có được phép chạm `totalRungs` (mở đáy thang) không.
   * Nhánh CHẤM: có. Nhánh ĐỐI THOẠI: KHÔNG — chat nhiều không moi được đáy (B4).
   */
  choPhepDay: boolean;
}): number {
  const tran = Math.max(0, i.totalRungs - 1);
  const cao = i.bacDaTrao.length ? Math.max(...i.bacDaTrao) : -1;
  // Đã trao HẾT thang mà vẫn sai → đừng lặp bậc cuối. Trả `totalRungs` để cổng
  // hạ xuống đáy (rồi vá nền ở nhánh dưới). Tới được đây nghĩa là em đã nhận đủ
  // mọi gợi ý và vẫn sai — đó là nỗ lực thật, không phải cửa hậu.
  const hetThang = cao >= tran;
  if (i.choPhepDay && (i.exhausted || hetThang)) return i.totalRungs;

  // HAI TRỤC, kẹp KHÁC NHAU — chỗ này bộ kiểm đã bắt tôi một lần:
  //  · leo vì ĐÃ TRAO (chống lặp)  → kẹp dưới đáy. Bấm sai liên tục chỉ leo hết
  //    thang là hết, KHÔNG tự mua được đáy.
  //  · leo vì NỖ LỰC THẬT         → KHÔNG kẹp. Em trình bày suy nghĩ đủ số lần
  //    thì xứng đáng chạm đáy, đó là luật có từ 29/07. Kẹp cả trục này (bản vá
  //    đầu của tôi) là giam đúng em chịu khó nhất ở bậc cuối cho tới khi van
  //    `exhausted` mở — tức phạt em vì đã cố gắng.
  const tuDaTrao = Math.min(cao + 1, tran);
  const tuNoLuc = i.choPhepDay ? i.engaged : Math.min(i.engaged, tran);
  return Math.min(Math.max(tuNoLuc, tuDaTrao), i.choPhepDay ? i.totalRungs : tran);
}
