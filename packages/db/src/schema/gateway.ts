/** LLM gateway persistence: token budget + response cache. */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants, profiles } from "./tenancy";

/** Per-student/day token spend — backs TokenBudget (budget cap < $500/mo MVP). */
export const tokenUsage = pgTable(
  "token_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => profiles.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    tokens: integer("tokens").notNull().default(0),
  },
  (t) => [uniqueIndex("token_usage_student_day_uq").on(t.studentId, t.day)],
);

/** Prompt→response cache for frequent turns. Key from cacheKey() (PII-free). */
export const llmCache = pgTable("llm_cache", {
  key: text("key").primaryKey(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TokenUsage = typeof tokenUsage.$inferSelect;
export type LlmCacheRow = typeof llmCache.$inferSelect;
