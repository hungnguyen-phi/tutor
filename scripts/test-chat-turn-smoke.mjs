// Smoke test sau khi deploy chat-turn (fix dấu câu + hybrid AI advance_rung).
// Đăng nhập demo hs1, trả lời sai liên tục một câu MỚI (chưa từng thử) để xem
// message qua từng gate có tự nhiên/đúng dấu câu không.
// Chạy: node scripts/test-chat-turn-smoke.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const SUPABASE_URL = env.SUPABASE_URL;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const QUESTION_ID = "4de4668c-068b-40e3-af25-3aaaa0da3877"; // KC-1188837 — câu CHƯA từng thử
const WRONG_ANSWER = "(a) Sai"; // cố ý sai

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hs1@vietanh.edu.vn", password: "VietAnh@2026" }),
});
const auth = await authRes.json();
if (!auth.access_token) { console.error("✗ Đăng nhập lỗi:", auth); process.exit(1); }

const sessRes = await fetch(
  `${SUPABASE_URL}/rest/v1/learning_sessions?student_id=eq.${auth.user.id}&subject=eq.Toan&select=id&limit=1`,
  { headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}` } },
);
const sessionId = (await sessRes.json())?.[0]?.id;
if (!sessionId) { console.error("✗ Không tìm thấy session"); process.exit(1); }
console.log("sessionId:", sessionId, "\n");

for (let i = 1; i <= 8; i++) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-turn`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "answer", questionId: QUESTION_ID, studentAnswer: WRONG_ANSWER }),
  });
  const data = await res.json();
  if (res.status === 429) { console.log(`[${i}] 429 rate_limited, retryAfter=${data.retryAfter}s — dừng.`); break; }
  console.log(`[${i}] gate=${data.gate}`);
  console.log(`     "${data.message}"`);
  console.log();
  if (data.gate === "remediate" || data.gate === "exhausted") break;
}
