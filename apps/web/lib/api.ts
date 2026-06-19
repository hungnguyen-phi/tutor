import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, DEMO_STUDENT_ID } from "./config";

async function callFn<T>(fn: string, body: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `${fn} failed (${res.status})`);
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
  callFn<DiagnoseResult>("diagnose", { studentId: DEMO_STUDENT_ID, subject });

export const answer = (sessionId: string, questionId: string, studentAnswer: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "answer", questionId, studentAnswer });

export const writing = (sessionId: string, questionId: string, text: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "writing", questionId, text });

export const speaking = (sessionId: string, questionId: string, transcript: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "speaking", questionId, transcript });
