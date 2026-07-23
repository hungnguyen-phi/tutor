// Publish môn GDKTPL 10 SAU KHI đã import + rà nội dung. PROD WRITE → NGƯỜI DÙNG
// chạy (Claude bị chặn ghi prod):
//
//     node scripts/publish-gdktpl.mjs
//
// Dùng Management API token trong .env (SUPABASE_ACCESS_TOKEN). Làm 3 việc:
//   1) ALTER TYPE subject ADD VALUE 'GDKTPL'  (cột learning_sessions.subject là enum)
//   2) version draft → published
//   3) node review → active, câu review → active  (bulk-approve; bỏ qua duyệt tay
//      — chấp nhận vì Studio đã QA. Muốn giữ human-in-the-loop thì duyệt trong
//      /teacher thay vì chạy script này.)
import fs from "node:fs";

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
const TOKEN = ENV.SUPABASE_ACCESS_TOKEN;
const PROJ = "gxbxsdhvtwtjkfygetzb";
const VER = "41af967f-bfec-44da-971f-e7d5bcd1f39a"; // GDKTPL 10 — Kết nối tri thức

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJ}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok) { console.error("SQL lỗi:", JSON.stringify(json)); throw new Error("SQL failed"); }
  return json;
}

async function main() {
  if (!TOKEN) { console.error("Thiếu SUPABASE_ACCESS_TOKEN trong .env"); process.exit(1); }

  // 1) enum — chạy RIÊNG (ADD VALUE không dùng được ngay trong cùng transaction).
  //    Nếu Management API báo "cannot run inside a transaction block", chạy câu
  //    này thủ công trong Supabase Dashboard → SQL Editor rồi bỏ qua bước này.
  console.log("→ (1) ALTER TYPE subject ADD VALUE 'GDKTPL'");
  await sql("ALTER TYPE subject ADD VALUE IF NOT EXISTS 'GDKTPL'");

  // 2) publish version
  console.log("→ (2) version → published");
  await sql(`update kg_versions set status='published' where id='${VER}'`);

  // 3) activate node + câu đã duyệt (đếm số dòng đổi)
  console.log("→ (3) node/câu review → active");
  const n = await sql(`with u as (update kg_nodes set status='active' where kg_version_id='${VER}' and status='review' returning 1) select count(*) c from u`);
  const q = await sql(`with u as (update questions set trang_thai='active' where kg_version_id='${VER}' and trang_thai='review' returning 1) select count(*) c from u`);
  console.log(`  nodes active: ${n[0]?.c ?? "?"} · questions active: ${q[0]?.c ?? "?"}`);

  console.log("\n✓ GDKTPL 10 đã PUBLISH. Học sinh vẫn cần P2 (thêm vào bộ chọn môn) mới chọn được.");
}

main().catch((e) => { console.error(e); process.exit(1); });
