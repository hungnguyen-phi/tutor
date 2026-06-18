/** Tenancy, identity, and consent (PDPL). Every row carries tenant_id for RLS. */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "student",
  "teacher",
  "parent",
  "admin",
  "leadership",
]);

export const consentStatusEnum = pgEnum("consent_status", ["active", "withdrawn"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Mirrors a Supabase auth user (id === auth.users.id). */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // = auth.users.id
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("student"),
    fullName: text("full_name"),
    grade: text("grade"),
    locale: text("locale").notNull().default("vi"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("profiles_tenant_idx").on(t.tenantId)],
);

/** Links a guardian (parent profile) to a student profile — for dual consent. */
export const guardianLinks = pgTable(
  "guardian_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("guardian_student_uq").on(t.guardianId, t.studentId)],
);

/**
 * Consent records (PDPL Law 91/2025, NĐ 88/2026). Dual consent for children ≥7
 * (student assent + guardian consent). Withdraw → status=withdrawn → stop processing.
 */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // e.g. "ai_tutoring", "voice_processing"
    /** True once BOTH guardian and student assent are recorded (dual consent ≥7). */
    dualConsent: boolean("dual_consent").notNull().default(false),
    guardianConsentBy: uuid("guardian_consent_by").references(() => profiles.id),
    studentAssent: boolean("student_assent").notNull().default(false),
    status: consentStatusEnum("status").notNull().default("active"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    index("consent_student_idx").on(t.studentId),
    uniqueIndex("consent_student_purpose_uq").on(t.studentId, t.purpose),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type ConsentRecord = typeof consentRecords.$inferSelect;
