/**
 * Learning/session tables (Drizzle-owned). References to KG entities
 * (node_id, question_id, kg_version_id) are plain columns — the KG-core tables
 * live in raw SQL (kg-core.sql) to track KG_Schema_v2.json. FKs to KG tables are
 * declared in kg-core.sql, not here, to keep the two schema authorities decoupled.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { tenants, profiles } from "./tenancy";

export const sessionStatusEnum = pgEnum("session_status", ["active", "ended"]);
export const turnRoleEnum = pgEnum("turn_role", [
  "student",
  "tutor", // guide agent
  "evaluator", // evaluate agent (kept separate from guide)
  "system",
]);
export const subjectEnum = pgEnum("subject", ["Toan", "Hoa", "Anh", "Van"]);
export const submissionKindEnum = pgEnum("submission_kind", ["writing", "speaking"]);
export const doKhoEnum = pgEnum("do_kho", ["de", "TB", "kho"]);

export const learningSessions = pgTable(
  "learning_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subject: subjectEnum("subject").notNull(),
    kgVersionId: uuid("kg_version_id").notNull(),
    currentNodeId: text("current_node_id"),
    status: sessionStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("sessions_student_idx").on(t.studentId)],
);

/** Every conversational turn is persisted and reloaded each turn (Q18=A, no streaming). */
export const sessionTurns = pgTable(
  "session_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    role: turnRoleEnum("role").notNull(),
    /** Which agent produced this (e.g. "guide", "evaluate", "effort-gate"). */
    agent: text("agent"),
    content: text("content").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("turns_session_idx").on(t.sessionId, t.createdAt)],
);

/** Per-question attempts — drive the ≥2-attempt effort gate. */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    nodeId: text("node_id").notNull(),
    attemptNo: integer("attempt_no").notNull(),
    rawAnswer: text("raw_answer"),
    isCorrect: boolean("is_correct"),
    /** Misconception matched via the chosen distractor (diagnostic). */
    matchedMisconception: text("matched_misconception"),
    /** LLM soft signal of real thinking (0..1); null until judged. */
    thinkingQuality: real("thinking_quality"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attempts_session_q_idx").on(t.sessionId, t.questionId)],
);

/** Writing/speaking submissions (English). Audio stored in Supabase Storage. */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    kind: submissionKindEnum("kind").notNull(),
    textContent: text("text_content"),
    audioPath: text("audio_path"), // storage object path (signed URL on read)
    /** Formative feedback (rubric or pronunciation/fluency) — NOT an official grade. */
    feedback: jsonb("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("submissions_session_idx").on(t.sessionId)],
);

/** Evidence rows; a mastery raise needs ≥2 consistent (pedagogy package). */
export const masteryEvidence = pgTable(
  "mastery_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    questionId: text("question_id"),
    correct: boolean("correct").notNull(),
    dok: integer("dok").notNull(),
    doKho: doKhoEnum("do_kho").notNull(),
    isTargetDifficulty: boolean("is_target_difficulty").notNull().default(true),
    kgVersionId: uuid("kg_version_id").notNull(),
    // Phiên ghi bằng chứng — dedup CHỐNG FARM theo (session_id, question_id):
    // trả lời lại cùng câu TRONG PHIÊN không sinh thêm; phiên khác (ôn giãn cách)
    // vẫn ghi được. Nullable cho hàng lịch sử trước khi thêm cột (security-hardening.sql §2).
    sessionId: uuid("session_id").references(() => learningSessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("evidence_student_node_idx").on(t.studentId, t.nodeId),
    uniqueIndex("mastery_evidence_session_question_uq").on(t.sessionId, t.questionId),
  ],
);

/** Mastery state per node, pinned to the KG version learned (Q27). */
export const studentNodeState = pgTable(
  "student_node_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    kgVersionId: uuid("kg_version_id").notNull(),
    masteryScore: real("mastery_score").notNull().default(0),
    mastered: boolean("mastered").notNull().default(false),
    leitnerBox: integer("leitner_box").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("node_state_uq").on(t.studentId, t.nodeId, t.kgVersionId),
    index("node_state_due_idx").on(t.nextReviewAt),
  ],
);

export type LearningSession = typeof learningSessions.$inferSelect;
export type SessionTurn = typeof sessionTurns.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type MasteryEvidence = typeof masteryEvidence.$inferSelect;
export type StudentNodeState = typeof studentNodeState.$inferSelect;
