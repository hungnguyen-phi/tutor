import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load the repo-root .env so `drizzle-kit push/generate` sees DATABASE_URL.
config({ path: "../../.env" });

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
