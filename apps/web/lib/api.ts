import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from "./config";
import { supabase } from "./supabase";

async function callFn<T>(fn: string, body: unknown): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? `${fn} failed (${res.status})`);
  return data as T;
}

export type QKind = "objective" | "rubric" | "writing" | "speaking";

export interface DiagnoseQuestion {
  id: string;
  nodeKey: string;
  tier: number;
  dok: number;
  doKho: string;
  kind: QKind;
  prompt: string;
  options?: string[];
  rubric?: unknown;
}

export interface DiagnoseResult {
  sessionId: string;
  kgVersionId: string;
  node: string | null;
  questions: DiagnoseQuestion[];
}

export interface TurnResult {
  correct?: boolean;
  attemptNo?: number;
  gate?: string;
  currentRung?: number;
  message?: string;
  feedback?: string;
  kind?: string;
  note?: string;
}

export const diagnose = (subject: "Toan" | "Anh") =>
  callFn<DiagnoseResult>("diagnose", { subject });

export const answer = (sessionId: string, questionId: string, studentAnswer: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "answer", questionId, studentAnswer });

export const writing = (sessionId: string, questionId: string, text: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "writing", questionId, text });

export const speaking = (sessionId: string, questionId: string, transcript: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "speaking", questionId, transcript });

export interface EndResult {
  sessionId: string;
  nodes: Array<{ node: string; mastered: boolean; score: number }>;
}

export const endSession = (sessionId: string) =>
  callFn<EndResult>("end-session", { sessionId });

// ── Teacher (M3.5) ──────────────────────────────────────────────────────────
export interface TeacherStats {
  metrics: {
    misconceptions: Array<{ label: string; count: number }>;
    effort: { avgAttemptsToCorrect: number; accuracy: number; totalAttempts: number };
    mastery: { mastered: number; tracked: number; rate: number };
  };
  review: {
    questions: Array<{ id: string; key: string; node: string; kind: string; status: string; prompt: string }>;
    ladders: Array<{ id: string; key: string; node: string; misconception: string; status: string }>;
  };
}

export const teacherStats = () => callFn<TeacherStats>("teacher-stats", {});

export const teacherReview = (kind: "question" | "ladder", id: string, status: string) =>
  callFn<{ ok: boolean }>("teacher-review", { kind, id, status });

// ── 4DX Weekly Scoreboard ─────────────────────────────────────────────────────
export interface Scoreboard {
  student: { id: string; name: string };
  weekStart: string;
  viewer: { self: boolean; staff: boolean; mentorKind: "homeroom_coach" | "buddy" | null };
  limited: boolean;
  wigs: Array<{ area: string; areaLabel: string; title: string; targetDesc: string | null; progressPct: number; source: "tutor" | "manual" }>;
  leadMeasures: Array<{ label: string; targetText: string | null; valueText: string | null; status: "green" | "amber" | "red" }>;
  effort: { rank: number | null; scope: "lop" | "khoi" | "cap" | "truong" };
  commitment: string;
  subjectProgress: Array<{ subject: string; pct: number }>;
  coach: { name: string | null; cadenceDays: number; lastMeetingAt: string | null } | null;
  buddy: { name: string | null; lastMeetingAt: string | null } | null;
  sync: { syncedAt: string | null };
}

export const getScoreboard = (studentId?: string) =>
  callFn<Scoreboard>("scoreboard", { action: "get", studentId });

export const commitScoreboard = (commitment: string, studentId?: string) =>
  callFn<{ ok: boolean; commitment: string }>("scoreboard", { action: "commit", commitment, studentId });

export const syncScoreboard = (studentId?: string) =>
  callFn<{ ok: boolean; syncedAt: string; export: unknown; note: string }>("scoreboard", { action: "sync", studentId });
