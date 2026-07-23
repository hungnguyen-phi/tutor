// Nạp bundle GDKTPL 10 (Studio) vào Tutor qua edge function import-kg +
// import-questions. CHẠY SAU KHI đã `supabase functions deploy import-kg`
// (bản đã thêm "GDKTPL" vào SUBJECTS). Đây là PROD WRITE → NGƯỜI DÙNG chạy:
//
//     node scripts/import-gdktpl.mjs
//
// Đọc .env (SUPABASE_URL, SUPABASE_ANON_KEY). Đăng nhập vai giáo viên (gv1@)
// lấy JWT rồi POST 2 bundle. Idempotent: 200 node đã pre-load sẽ được upsert
// (không nhân bản), 388 cạnh + 215 câu nạp mới vào review queue.
//
// Đổi account / thư mục bundle qua biến môi trường nếu cần:
//   IMPORT_EMAIL, IMPORT_PW, BUNDLE_DIR
import fs from "node:fs";
import path from "node:path";

function readEnv() {
  const out = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const ENV = readEnv();
const URL = ENV.SUPABASE_URL;
const ANON = ENV.SUPABASE_ANON_KEY;
const EMAIL = process.env.IMPORT_EMAIL || "gv1@vietanh.edu.vn";
const PW = process.env.IMPORT_PW || "VietAnh@2026";
const DIR = process.env.BUNDLE_DIR || "D:/school ai/studio/data/tutor-bundles";

async function post(url, headers, body) {
  const res = await fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  if (!URL || !ANON) { console.error("Thiếu SUPABASE_URL/ANON_KEY trong .env"); process.exit(1); }

  // 1) Đăng nhập → JWT vai giáo viên
  const auth = await post(
    `${URL}/auth/v1/token?grant_type=password`,
    { apikey: ANON, "Content-Type": "application/json" },
    JSON.stringify({ email: EMAIL, password: PW }),
  );
  if (!auth.json.access_token) {
    console.error(`Đăng nhập thất bại (${EMAIL}):`, auth.json);
    console.error("→ Thử đặt IMPORT_EMAIL/IMPORT_PW đúng tài khoản teacher/admin.");
    process.exit(1);
  }
  const H = { Authorization: `Bearer ${auth.json.access_token}`, apikey: ANON, "Content-Type": "application/json" };
  console.log(`✓ Đăng nhập ${EMAIL}`);

  // 2) import-kg (200 node upsert + 388 cạnh)
  console.log("→ import-kg (gdktpl10-kg.json) …");
  const kg = fs.readFileSync(path.join(DIR, "gdktpl10-kg.json"), "utf8");
  const r1 = await post(`${URL}/functions/v1/import-kg`, H, kg);
  console.log(`  [${r1.status}]`, JSON.stringify(r1.json));
  if (!r1.ok) { console.error("✗ import-kg lỗi — dừng (chưa nạp câu)."); process.exit(1); }

  // 3) import-questions (215 câu → review queue)
  console.log("→ import-questions (gdktpl10-questions.json) …");
  const qs = fs.readFileSync(path.join(DIR, "gdktpl10-questions.json"), "utf8");
  const r2 = await post(`${URL}/functions/v1/import-questions`, H, qs);
  console.log(`  [${r2.status}]`, JSON.stringify(r2.json));
  if (!r2.ok) { console.error("✗ import-questions lỗi."); process.exit(1); }

  console.log("\n✓ XONG import. Vào /teacher → tab 'Duyệt & nội dung' để rà, rồi chạy:");
  console.log("    node scripts/publish-gdktpl.mjs");
}

main().catch((e) => { console.error(e); process.exit(1); });
