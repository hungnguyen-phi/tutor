/**
 * Apply the raw-SQL layers (KG-core + RLS) after `drizzle-kit push`.
 * Run: pnpm --filter @tutor/db apply
 * (needs DATABASE_URL; e.g. node --env-file=../../.env --import tsx src/apply-sql.ts)
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rawPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "uksbvlkhcyhnpfamducc";
const url = process.env.DATABASE_URL;

if (!rawPassword && !url) {
  console.error("✗ Set SUPABASE_DB_PASSWORD (raw) or DATABASE_URL.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
// Order matters: kg-core creates the tables, v22 alters them, rls installs the
// helpers + base policies, rbac-rls locks the RBAC catalog, coaching provisions
// the 4DX tables, security-hardening tightens the whole surface (needs EVERY
// sensitive table to already exist), storage provisions the private bucket.
const files = [
  "kg-core.sql",
  "kg-core-v22.sql",
  "rls.sql",
  "rbac-rls.sql",
  "coaching.sql",
  "xp-stats.sql",
  "security-hardening.sql",
  "storage.sql",
];

// Discrete credentials (raw password, no URL-encoding) when available.
const sql = rawPassword
  ? postgres({
      host: process.env.SUPABASE_DB_HOST ?? `db.${projectRef}.supabase.co`,
      port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
      user: process.env.SUPABASE_DB_USER ?? "postgres",
      password: rawPassword,
      database: "postgres",
      ssl: "require",
      prepare: false,
      max: 1,
    })
  : postgres(url!, { prepare: false, max: 1 });
try {
  for (const f of files) {
    const text = readFileSync(join(pkgRoot, f), "utf8");
    process.stdout.write(`applying ${f} ... `);
    await sql.unsafe(text);
    console.log("ok");
  }
  console.log("✓ KG-core + RLS applied");
} catch (err) {
  console.error("\n✗ failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
