/**
 * Leitner spaced repetition with fixed intervals (PRD §11, Q2=B): 1 → 3 → 7 → 21 days.
 * Pure: returns day offsets / next-review timestamps; the scheduler (n8n WF-SpacedRep)
 * does the IO.
 */

export const LEITNER_INTERVALS_DAYS = [1, 3, 7, 21] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Box index → interval in days. Capped at the last box. */
export function intervalDaysForBox(box: number): number {
  const i = Math.max(0, Math.min(box, LEITNER_INTERVALS_DAYS.length - 1));
  return LEITNER_INTERVALS_DAYS[i]!;
}

/** Next review timestamp given the current box and a base time (ms). */
export function nextReviewAt(box: number, fromMs: number): number {
  return fromMs + intervalDaysForBox(box) * DAY_MS;
}

/** Advance a card: correct → next box; incorrect → back to box 0. */
export function nextBox(currentBox: number, correct: boolean): number {
  if (!correct) return 0;
  return Math.min(currentBox + 1, LEITNER_INTERVALS_DAYS.length - 1);
}
