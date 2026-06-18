/**
 * Drizzle schema (app tables). KG-core tables live in raw SQL (kg-core.sql).
 * M0: tenant anchor only, to prove the migration pipeline. Full slice schema → M1.
 */
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
