/**
 * Server-authoritative XP + streak. localStorage (lib/gamify.ts) từ nay CHỈ là
 * cache hiển thị — số thật do server cộng qua award_xp() và trả về mỗi lượt.
 *
 * Applied to the DB via raw SQL (xp-stats.sql) — file đó còn chứa các unique
 * index CHỐNG FARM dạng partial (mỗi câu/node/phiên chỉ ăn XP một lần) và hàm
 * award_xp / recompute_question_stats mà Drizzle không mô tả được. Đây là bản
 * mirror có type.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants, profiles } from "./tenancy";
import { learningSessions } from "./learning";

/** Sổ cái từng lần cộng XP — auditable; "XP tuần" = sum theo created_at. */
export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** correct +10 · persistence +5 · lesson_done +20 · node_mastered +30 */
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    sessionId: uuid("session_id").references(() => learningSessions.id, {
      onDelete: "set null",
    }),
    questionId: uuid("question_id"),
    nodeId: text("node_id"),
    kgVersionId: uuid("kg_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("xp_events_student_time_idx").on(t.studentId, t.createdAt),
    index("xp_events_tenant_time_idx").on(t.tenantId, t.createdAt),
  ],
);

/** Tổng hợp cho HUD: tổng XP + chuỗi ngày (ngày tính theo giờ VN). */
export const studentXp = pgTable(
  "student_xp",
  {
    studentId: uuid("student_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    xpTotal: bigint("xp_total", { mode: "number" }).notNull().default(0),
    streak: integer("streak").notNull().default(0),
    lastDay: date("last_day"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("student_xp_tenant_idx").on(t.tenantId)],
);

export type XpEvent = typeof xpEvents.$inferSelect;
export type StudentXp = typeof studentXp.$inferSelect;
