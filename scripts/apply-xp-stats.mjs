// Ap dung packages/db/xp-stats.sql len project Supabase qua Management API.
// Chay:  node scripts/apply-xp-stats.mjs
// Can .env co SUPABASE_ACCESS_TOKEN (sbp_...) va SUPABASE_URL (de suy project ref).
// Script nay CHI chay file xp-stats.sql — khong dong den cac lop SQL khac.
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();

const token = get("SUPABASE_ACCESS_TOKEN");
const ref = (get("SUPABASE_URL") ?? "").match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
if (!token || !ref) {
  console.error("Thieu SUPABASE_ACCESS_TOKEN hoac SUPABASE_URL trong .env");
  process.exit(1);
}

const sql = readFileSync(new URL("../packages/db/xp-stats.sql", import.meta.url), "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`LOI ${res.status}:`, body.slice(0, 2000));
  process.exit(1);
}
console.log("OK — xp-stats.sql da ap len project", ref);
console.log(body.slice(0, 500));
