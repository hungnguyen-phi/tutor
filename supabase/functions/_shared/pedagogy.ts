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
  if (i.currentRung + 1 >= i.totalRungs) {
    return { action: "bottom_out", reason: "Vượt trần số bậc → mở đáy kèm lý do." };
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
export function recomputeMastery(evidence: Evidence[]): MasteryVerdict {
  const targeted = evidence.filter((e) => e.isTargetDifficulty).sort((a, b) => a.at - b.at);
  const window = targeted.slice(-MASTERY.window);
  const correct = window.filter((e) => e.correct);
  const hasHigherOrder = correct.some((e) => e.dok >= 3);
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
