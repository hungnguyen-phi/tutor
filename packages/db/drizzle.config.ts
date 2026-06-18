import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load the repo-root .env so `drizzle-kit push/generate` sees DB credentials.
config({ path: "../../.env" });

// Prefer discrete credentials (raw password, no URL-encoding pitfalls) when
// SUPABASE_DB_PASSWORD is set; otherwise fall back to DATABASE_URL.
const rawPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "uksbvlkhcyhnpfamducc";

const dbCredentials = rawPassword
  ? {
      host: process.env.SUPABASE_DB_HOST ?? `db.${projectRef}.supabase.co`,
      port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
      user: process.env.SUPABASE_DB_USER ?? "postgres",
      password: rawPassword,
      database: "postgres",
      ssl: "require" as const,
    }
  : { url: process.env.DATABASE_URL ?? "" };

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials,
  verbose: true,
  strict: true,
});
