/**
 * RBAC catalog (M4) — roles, permissions, role→permission, and scoped grants.
 * profiles.role holds the user's PRIMARY role; user_roles allows additional
 * scoped roles. has_perm() in rls.sql checks role_permissions.
 */
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants, profiles } from "./tenancy";

export const roles = pgTable("roles", {
  key: text("key").primaryKey(), // 'student' | 'teacher' | 'subject_lead' | ...
  label: text("label").notNull(),
});

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(), // 'content:question:approve'
  domain: text("domain").notNull(),
  label: text("label"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
    permKey: text("perm_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("role_perm_uq").on(t.roleKey, t.permKey)],
);

/** Additional scoped roles beyond profiles.role (multi-role / scope). */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
    scopeType: text("scope_type"), // tenant|campus|subject|class|student|null
    scopeId: text("scope_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("user_roles_user_idx").on(t.userId)],
);

/** Source of teacher scope (which class/subject a teacher is responsible for). */
export const teacherAssignments = pgTable(
  "teacher_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subject: text("subject"),
    classId: text("class_id"),
    isHomeroom: text("is_homeroom"), // 'true' for GVCN
  },
  (t) => [index("teacher_assign_idx").on(t.teacherId)],
);

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
