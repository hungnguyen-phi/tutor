// Gieo bản ghi ĐỒNG THUẬN (PDPL) 'active' cho HỌC SINH DEMO để test luồng học —
// vì diagnose/chat-turn chặn cứng: không có consent active → 403 "Cần đồng ý xử lý
// dữ liệu trước khi bắt đầu học". CHỈ dùng cho tài khoản demo/pilot test. Học sinh
// THẬT phải đi luồng đồng thuận kép: phụ huynh bấm "Đồng ý cho con dùng AI Tutor"
// (view Phụ huynh) + học sinh ưng thuận. dual_consent=false ở đây = chỉ cần status
// active (hasActiveConsent trả true) cho demo.
//
// Chạy:  node scripts/seed-demo-consent.mjs
import fs from "node:fs";
const ENV = {};
for (const l of fs.readFileSync("D:/tutor/.env", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) ENV[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const TOKEN = ENV.SUPABASE_ACCESS_TOKEN;
const REF = process.env.REF || "oonuzgnfoypibrssvmrt";
if (!TOKEN) { console.error("Thiếu SUPABASE_ACCESS_TOKEN"); process.exit(1); }

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }),
  });
  const b = await r.json(); if (!r.ok) throw new Error(JSON.stringify(b).slice(0, 300)); return b;
}

const PURPOSE = "ai_tutoring";
const students = await q("select id, full_name, tenant_id from profiles where role='student'");
console.log(`Học sinh (role=student): ${students.length}`);

// 1) hàng đã có → set active. 2) hàng thiếu → chèn.
const upd = await q(`update consent_records set status='active', dual_consent=false, student_assent=true, withdrawn_at=null
  where purpose='${PURPOSE}' and student_id in (select id from profiles where role='student') returning 1`);
const ins = await q(`insert into consent_records (tenant_id, student_id, purpose, dual_consent, student_assent, status, granted_at)
  select p.tenant_id, p.id, '${PURPOSE}', false, true, 'active', now()
  from profiles p
  where p.role='student'
    and not exists (select 1 from consent_records c where c.student_id=p.id and c.purpose='${PURPOSE}')
  returning 1`);
console.log(`Cập nhật active: ${upd.length} · Chèn mới: ${ins.length}`);

const chk = await q(`select count(*) c from consent_records where purpose='${PURPOSE}' and status='active'`);
console.log(`Tổng consent '${PURPOSE}' active: ${chk[0].c}`);
