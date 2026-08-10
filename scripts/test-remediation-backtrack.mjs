// Test tính năng "truy ngược tiền đề" (findRemediation trong chat-turn):
// đăng nhập demo hs1, trả lời SAI liên tục ở một node có tiền đề thật
// (KC-1188837 — "Phép toán vectơ qua tọa độ", 3 cạnh prerequisite_hard trỏ
// vào), xem AI có leo ngược đúng node tiền đề không (gate: "remediate").
// Chạy: node scripts/test-remediation-backtrack.mjs
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
const QUESTION_ID = "0d7c6246-5a2d-4ca5-ad7a-32e551175885"; // node KC-1188837, dap_an="(1;2)"
const WRONG_ANSWER = "(1;-2)"; // distractor cố ý sai

console.log("1) Đăng nhập demo hs1@vietanh.edu.vn ...");
const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hs1@vietanh.edu.vn", password: "VietAnh@2026" }),
});
const auth = await authRes.json();
if (!auth.access_token) { console.error("✗ Đăng nhập lỗi:", auth); process.exit(1); }
console.log("✓ Đăng nhập OK, user_id:", auth.user.id);

console.log("\n2) Tìm session Toán 10 đang có của học sinh ...");
const sessRes = await fetch(
  `${SUPABASE_URL}/rest/v1/learning_sessions?student_id=eq.${auth.user.id}&subject=eq.Toan&select=id&limit=1`,
  { headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}` } },
);
const sessions = await sessRes.json();
if (!sessions?.[0]?.id) { console.error("✗ Không tìm thấy session:", sessions); process.exit(1); }
const sessionId = sessions[0].id;
console.log("✓ sessionId:", sessionId);

console.log(`\n3) Trả lời SAI liên tục câu hỏi ${QUESTION_ID} (node KC-1188837) ...`);
for (let i = 1; i <= 10; i++) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-turn`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "answer", questionId: QUESTION_ID, studentAnswer: WRONG_ANSWER }),
  });
  const data = await res.json();
  if (res.status === 429) {
    console.log(`  [${i}] 429 rate_limited, retryAfter=${data.retryAfter}s — dừng, đợi rồi chạy lại.`);
    break;
  }
  console.log(`  [${i}] gate=${data.gate ?? data.error ?? "?"}  correct=${data.correct}`);
  if (data.gate === "remediate") {
    console.log("\n✓✓✓ TRUY NGƯỢC TIỀN ĐỀ ĐÃ KÍCH HOẠT:");
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }
  if (data.gate === "exhausted") {
    console.log("\n⚠ Hết thang nhưng KHÔNG truy ngược được (remediate=null) — kiểm tra lại cạnh prerequisite_hard vào KC-1188837.");
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }
}
console.log("\n(Hết 10 lượt mà chưa tới gate remediate/exhausted — có thể minAttempts+totalRungs của node này lớn hơn dự kiến.)");
