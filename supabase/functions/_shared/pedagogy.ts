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
