/** Governance: audit, content review (human-in-the-loop), safety flags. */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants, profiles } from "./tenancy";

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);
export const contentTypeEnum = pgEnum("content_type", [
  "node",
  "question",
  "ladder",
  "resource",
]);
export const safetyStatusEnum = pgEnum("safety_status", [
  "new",
  "verifying",
  "resolved",
  "dismissed",
]);

/** audit_logs — every sensitive access + AI decision (PDPL traceability). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"), // null for system/AI
    action: text("action").notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    /** Structured AI decision detail (model, tier, tokens, agent, cached). */
    aiDecision: jsonb("ai_decision"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_tenant_idx").on(t.tenantId, t.createdAt)],
);

/**
 * review_queue — all AI-generated content must be approved before serving.
 * At the M3 demo only pre-approved seed is served; M3.5 adds the teacher approve UI.
 */
export const reviewQueue = pgTable(
  "review_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contentType: contentTypeEnum("content_type").notNull(),
    contentId: text("content_id").notNull(),
    aiGenerated: boolean("ai_generated").notNull().default(true),
    status: reviewStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("review_status_idx").on(t.tenantId, t.status)],
);

/**
 * safety_events — sensitive flags (bullying/self-harm). A human verifies FIRST;
 * NEVER auto-surfaced to parents (PRD §6, Q24).
 */
export const safetyEvents = pgTable(
  "safety_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => profiles.id, { onDelete: "set null" }),
    sessionId: uuid("session_id"),
    flagType: text("flag_type").notNull(),
    severity: text("severity").notNull().default("review"),
    status: safetyStatusEnum("status").notNull().default("new"),
    verifiedBy: uuid("verified_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("safety_status_idx").on(t.tenantId, t.status)],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type ReviewQueueItem = typeof reviewQueue.$inferSelect;
export type SafetyEvent = typeof safetyEvents.$inferSelect;
