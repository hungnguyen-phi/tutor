import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // KG-core tables are managed by raw SQL (kg-core.sql) to track KG_Schema_v2.json;
  // Drizzle owns the app tables only.
  verbose: true,
  strict: true,
});
