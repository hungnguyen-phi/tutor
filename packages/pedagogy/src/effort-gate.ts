/**
 * Effort gate (PRD §17, Q6=C). Hybrid: a HARD minimum (≥ N attempts) that no
 * amount of LLM judgement can bypass, PLUS a soft "real thinking" signal that an
 * LLM evaluates. Both must pass before help is escalated or the answer is revealed.
 *
 * This module is the hard part only — pure, deterministic, testable. The soft
 * LLM judgement is supplied by the caller as `thinkingQuality`.
 */
import type { EffortGateRule } from "@tutor/shared";

export interface EffortGateInput {
  /** How many genuine attempts the student has made on this question. */
  attempts: number;
  /**
   * Optional LLM assessment (0..1) of whether the student showed real thinking.
   * Undefined means "not yet judged" → soft condition treated as not met.
   */
  thinkingQuality?: number;
  /** Rung the student is currently on (0-based). */
  currentRung: number;
  /** Total rungs available before bottom-out. */
  totalRungs: number;
  rule: EffortGateRule;
  /** Minimum thinking-quality to satisfy the soft gate. */
  thinkingThreshold?: number;
}

export type EffortGateDecision =
  | { action: "require_attempt"; reason: string }
  | { action: "require_thinking"; reason: string }
  | { action: "advance_rung"; reason: string }
  | { action: "bottom_out"; reason: string };

const DEFAULT_THINKING_THRESHOLD = 0.5;

/**
 * Decide what the tutor may do next. NEVER returns `bottom_out` before the hard
 * attempt minimum is met — that is the inviolable "no jumping straight to the
 * answer" rule (`cam` in the schema).
 */
export function evaluateEffortGate(input: EffortGateInput): EffortGateDecision {
  const minAttempts = input.rule.so_lan_thu_toi_thieu ?? 2;
  const threshold = input.thinkingThreshold ?? DEFAULT_THINKING_THRESHOLD;

  // Hard gate first — cannot be bypassed by LLM judgement.
  if (input.attempts < minAttempts) {
    return {
      action: "require_attempt",
      reason: `Cần thử ≥${minAttempts} lần (đã thử ${input.attempts}).`,
    };
  }

  // Soft gate — real-thinking signal.
  const thinking = input.thinkingQuality ?? 0;
  if (thinking < threshold) {
    return {
      action: "require_thinking",
      reason: "Chưa thể hiện được suy nghĩ thật — yêu cầu giải thích cách làm.",
    };
  }

  // Both gates passed → escalate help, but only bottom-out past the rung ceiling.
  // `currentRung` = SỐ BẬC ĐÃ TRAO. Sửa 29/07 (giữ đồng bộ với bản Deno ở
  // supabase/functions/_shared/pedagogy.ts): điều kiện cũ `currentRung + 1 >=`
  // khiến bậc CUỐI (giàn giáo mạnh) không bao giờ được trao — thang 4 bậc chỉ
  // dùng 3, đúng bậc quan trọng nhất trước khi hé hướng giải thì bỏ qua.
  if (input.currentRung >= input.totalRungs) {
    return {
      action: "bottom_out",
      reason: "Đã đi hết thang Socratic → mở đáy (hé đáp án kèm lý do).",
    };
  }

  return {
    action: "advance_rung",
    reason: "Đủ nỗ lực + suy nghĩ thật → lên bậc gợi ý kế tiếp.",
  };
}
