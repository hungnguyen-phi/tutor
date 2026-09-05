// Đọc DB prod qua Management API (token trong .env) — CHỈ ĐỌC, in JSON.
//   node packages/db/query.mjs "select 1"
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sql = process.argv.slice(2).join(" ");
if (!sql) { console.error("thiếu SQL"); process.exit(1); }
const r = await fetch("https://api.supabase.com/v1/projects/oonuzgnfoypibrssvmrt/database/query", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const j = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(j)); process.exit(1); }
console.log(JSON.stringify(j, null, 1));
