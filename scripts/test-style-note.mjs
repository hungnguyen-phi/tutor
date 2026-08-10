// Test đầu-cuối tính năng "giọng điệu riêng theo học sinh" (chốt 02/08):
// đăng nhập demo, tạo vài lượt "kể cách nghĩ" mang tính cách rõ (đùa cợt,
// informal), gọi end-session, rồi đọc profiles.tutor_style_note xem AI có
// đúc kết đúng không.
// Chạy: node scripts/test-style-note.mjs
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
const QUESTION_ID = "0d7c6246-5a2d-4ca5-ad7a-32e551175885"; // KC-1188837

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hs1@vietanh.edu.vn", password: "VietAnh@2026" }),
});
const auth = await authRes.json();
const H = { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };

const sessRes = await fetch(
  `${SUPABASE_URL}/rest/v1/learning_sessions?student_id=eq.${auth.user.id}&subject=eq.Toan&select=id&limit=1`,
  { headers: H },
);
const sessionId = (await sessRes.json())?.[0]?.id;
console.log("sessionId:", sessionId);

// Vài lượt "kể cách nghĩ" mang giọng đùa cợt, informal, hay nản — để AI có tín hiệu đúc kết.
const REASONINGS = [
  "ây da khó quá trời, em hông biết làm sao luôn á, chắc em bấm đại quá =))",
  "thầy ơi/à sư tử ơi, cái này rối não em ghê, em thử nghĩ theo kiểu vầy nè: chắc là cộng vô đại thôi hihi",
  "hic em nản quá, sai hoài à, thôi em đoán bừa vậy",
];
for (const r of REASONINGS) {
  await fetch(`${SUPABASE_URL}/functions/v1/chat-turn`, {
    method: "POST", headers: H,
    body: JSON.stringify({ sessionId, action: "answer", questionId: QUESTION_ID, reasoning: r }),
  });
  console.log("đã gửi:", r.slice(0, 40) + "...");
}

console.log("\nGọi end-session ...");
const endRes = await fetch(`${SUPABASE_URL}/functions/v1/end-session`, {
  method: "POST", headers: H, body: JSON.stringify({ sessionId }),
});
console.log("end-session status:", endRes.status, JSON.stringify(await endRes.json()));

console.log("\nĐợi 5s cho waitUntil chạy nền xong rồi đọc lại tutor_style_note ...");
await new Promise((r) => setTimeout(r, 5000));
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const dbRes = await fetch(`https://api.supabase.com/v1/projects/oonuzgnfoypibrssvmrt/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: `select tutor_style_note from profiles where id='${auth.user.id}';` }),
});
console.log("tutor_style_note:", JSON.stringify(await dbRes.json(), null, 2));
