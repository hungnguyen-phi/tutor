/**
 * 4DX coaching layer. A student sets 4 yearly WIGs (Kiến thức · Kỹ năng ·
 * Tiếng Anh · Thể chất); the AI Tutor owns progress for Kiến thức + Tiếng Anh
 * (source='tutor'), the other two are coached manually. Two coaches per student:
 * a homeroom coach (GVCN, ~4-weekly) and a buddy (peer student, weekly).
 *
 * Applied to the DB via raw SQL (coaching.sql) to avoid the interactive
 * drizzle-kit push prompt — this file is the typed source of truth.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants, profiles } from "./tenancy";

export const coachingKindEnum = pgEnum("coaching_kind", ["homeroom_coach", "buddy"]);
export const wigAreaEnum = pgEnum("wig_area", ["kien_thuc", "ky_nang", "tieng_anh", "the_chat"]);
export const wigSourceEnum = pgEnum("wig_source", ["tutor", "manual"]);
export const leadStatusEnum = pgEnum("lead_status", ["green", "amber", "red"]);
export const effortScopeEnum = pgEnum("effort_scope", ["lop", "khoi", "cap", "truong"]);

/** A coach/buddy mentoring relationship. mentor_id is a teacher (coach) or a peer student (buddy). */
export const coachingLinks = pgTable(
  "coaching_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    mentorId: uuid("mentor_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kind: coachingKindEnum("kind").notNull(),
    cadenceDays: integer("cadence_days").notNull().default(28),
    lastMeetingAt: timestamp("last_meeting_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("coaching_student_mentor_uq").on(t.studentId, t.mentorId, t.kind),
    index("coaching_mentor_idx").on(t.mentorId),
  ],
);

/** The 4 yearly WIGs. Tutor-owned areas (Kiến thức, Tiếng Anh) sync from mastery. */
export const wigs = pgTable(
  "wigs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    area: wigAreaEnum("area").notNull(),
    title: text("title").notNull(),
    targetDesc: text("target_desc"),
    progressPct: real("progress_pct").notNull().default(0), // 0..100
    source: wigSourceEnum("source").notNull().default("manual"),
    year: integer("year").notNull(),
    sort: integer("sort").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("wig_student_area_year_uq").on(t.studentId, t.area, t.year)],
);

/** Weekly lead measures (the few high-leverage acts the student commits to). */
export const leadMeasures = pgTable(
  "lead_measures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    label: text("label").notNull(),
    targetText: text("target_text"),
    valueText: text("value_text"),
    status: leadStatusEnum("status").notNull().default("amber"),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lead_student_week_idx").on(t.studentId, t.weekStart)],
);

/** One scoreboard row per student per week: effort rank, commitment, 4DX sync stamp. */
export const scoreboardWeeks = pgTable(
  "scoreboard_weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    effortRank: integer("effort_rank"),
    effortScope: effortScopeEnum("effort_scope").notNull().default("lop"),
    commitment: text("commitment"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("scoreboard_student_week_uq").on(t.studentId, t.weekStart)],
);

export type CoachingLink = typeof coachingLinks.$inferSelect;
export type Wig = typeof wigs.$inferSelect;
export type LeadMeasure = typeof leadMeasures.$inferSelect;
export type ScoreboardWeek = typeof scoreboardWeeks.$inferSelect;
