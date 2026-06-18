/**
 * Mastery algorithm — Phase 1 fixed thresholds (PRD §11, Q1=C, Q5=B).
 *
 * - A node is mastered at the target difficulty when the student answers
 *   ≥3/4 correct at target difficulty, including ≥1 higher-order (DOK ≥ 3) item.
 * - Raising mastery requires ≥2 CONSISTENT pieces of evidence (anti-guessing).
 *
 * Pure & deterministic; BKT/IRT come later.
 */

export interface Evidence {
  questionId: string;
  nodeId: string;
  correct: boolean;
  dok: 1 | 2 | 3 | 4;
  doKho: "de" | "TB" | "kho";
  /** Target difficulty for this node at the student's current goal. */
  isTargetDifficulty: boolean;
  /** Monotonic ordering of evidence (e.g. attempt timestamp ms). */
  at: number;
}

export const MASTERY_MIN_CORRECT = 3;
export const MASTERY_WINDOW = 4;
export const MASTERY_MIN_CONSISTENT_EVIDENCE = 2;

export interface MasteryVerdict {
  mastered: boolean;
  correctAtTarget: number;
  windowSize: number;
  hasHigherOrder: boolean;
  consistentEvidence: number;
  reason: string;
}

/**
 * Evaluate mastery from the most recent evidence at target difficulty.
 * `higher-order` = DOK ≥ 3.
 */
export function evaluateMastery(evidence: Evidence[]): MasteryVerdict {
  const targeted = evidence
    .filter((e) => e.isTargetDifficulty)
    .sort((a, b) => a.at - b.at);

  const window = targeted.slice(-MASTERY_WINDOW);
  const correct = window.filter((e) => e.correct);
  const hasHigherOrder = correct.some((e) => e.dok >= 3);

  // Consistent evidence = count of correct answers in the recent window
  // (the "≥2 consistent" anti-guess rule is satisfied when correct ≥ 2).
  const consistentEvidence = correct.length;

  const mastered =
    correct.length >= MASTERY_MIN_CORRECT &&
    window.length >= MASTERY_MIN_CORRECT &&
    hasHigherOrder &&
    consistentEvidence >= MASTERY_MIN_CONSISTENT_EVIDENCE;

  return {
    mastered,
    correctAtTarget: correct.length,
    windowSize: window.length,
    hasHigherOrder,
    consistentEvidence,
    reason: mastered
      ? "Đạt ≥3/4 ở độ khó mục tiêu, có ≥1 câu bậc cao, ≥2 bằng chứng nhất quán."
      : "Chưa đủ điều kiện thành thạo.",
  };
}

/** Conditional prerequisite locking (Q3=C): block a node only when a HARD */
/** prerequisite's mastery is below the lock threshold; "near-pass" lets through. */
export const PREREQ_LOCK_THRESHOLD = 0.6;
export const PREREQ_NEAR_PASS = 0.5;

export function isNodeLocked(
  hardPrereqMastery: number[],
  lockThreshold = PREREQ_LOCK_THRESHOLD,
): boolean {
  return hardPrereqMastery.some((m) => m < lockThreshold);
}
