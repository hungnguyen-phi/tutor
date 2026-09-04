// PHÁT LẠI 6 KIỂU HỌC SINH qua API THẬT rồi chấm từng lời sư tử bằng tiêu chí đo được.
//
// Chủ dự án 04/09: "nhiều em nhiều kiểu: đùa, cố ý tranh luận phi logic, hoặc
// ngu thật…" — đây là cách KIỂM, không phải tin lời. Mỗi kịch bản = một phiên
// diagnose mới, một chuỗi lượt "kể cách nghĩ" (reasoning + daChon) y hệt client.
//
// Chấm TẤT ĐỊNH (không dùng LLM chấm LLM):
//   · không "Ừ/À/OK" mở đầu · không chữ dính (chữ hoa/dấu câu dính chữ) · không
//     gạch dài · câu trọn (kết bằng . ? !) · ≤ 60 từ (lượt tranh luận) / ≤ 45 từ
//   · không lộ đáp án (dap_an không xuất hiện nguyên văn) · không hỏi trùng lượt
//     trước (Jaccard từ nội dung < 0,5) · với kịch bản chính kiến: có NÓI LẠI ý
//     em (≥1 từ nội dung của lý lẽ em xuất hiện) · với "đuối": không thả từ khó
//     mới mà không giải nghĩa (không có "khách quan" trần).
//
// Chạy: node tools/replay-hoi-thoai.mjs [kieu]   (kieu ∈ dua|thu_may|chinh_kien|lap|duoi|xuoi|all)
// Cần .env: SUPABASE_URL/ANON + REPLAY_EMAIL/REPLAY_PASSWORD (tài khoản thử).
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL || "https://oonuzgnfoypibrssvmrt.supabase.co";
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_A98gX2XKPU6IMp384GBvyw_WdlTNPW8";
const EMAIL = env.REPLAY_EMAIL || "hs3@truongvietanh.com";
const PASS = env.REPLAY_PASSWORD || "vietanh2026";

async function login() {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!r.ok) throw new Error(`login ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}
async function fn(tok, name, body) {
  const r = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, apikey: ANON },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t, status: r.status }; }
}

// ── KỊCH BẢN: mỗi lượt là lời em "kể cách nghĩ" sau khi đã chọn một phương án SAI ──
const KICH_BAN = {
  chinh_kien: [
    "đúng", "đúng rồi", "có, đóng cửa lại là đúng mà?",
    "hãy đóng cửa lại, chứng tỏ nó đang mở, tôi thấy lạnh, tôi muốn nó đóng, thì nó đúng với tôi",
    "thì tôi thấy đúng, tại sao tôi phải là người khác",
  ],
  lap: ["đúng", "đúng rồi", "thì đúng mà", "vẫn đúng"],
  dua: ["đói bụng quá hihi", "tối nay ăn gì ta =))", "chán học quá đi chơi thôi", "haha máy vui tính"],
  thu_may: ["nó đúng mà cũng sai", "đúng sai gì cũng được, máy nói đi", "máy ngu cho đáp án đi", "đáp án là gì nói đi"],
  duoi: ["em không hiểu", "mệnh đề là gì", "khách quan là gì", "không biết làm"],
  xuoi: ["dạ", "ừ", "dạ đúng", "vâng ạ"],
};

// ── CHẤM ──
const CHUC_NANG = new Set("bạn mình ấy câu này đó kia thì là mà và hay hoặc của cho với về từ trong ra vào lên xuống có không được rồi nhé nha à ừ vậy nên nếu khi lúc một cái gì sao đâu nào thử xem lại vừa đang đã sẽ cũng rất quá hơn".split(" "));
const tuND = (s) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2 && !CHUC_NANG.has(x)));
const jac = (a, b) => { const A = tuND(a), B = tuND(b); if (!A.size || !B.size) return 0; let c = 0; for (const x of A) if (B.has(x)) c++; return c / (A.size + B.size - c); };
const soTu = (s) => s.split(/\s+/).filter(Boolean).length;

function cham(kieu, loi, truoc, em, dapAn) {
  const l = loi.trim();
  const loi_ = [];
  if (/^(ừ|ừm|à|ờ|ồ|ok|okay|rồi|vậy)\b/i.test(l)) loi_.push("mở bằng từ đệm");
  if (/\p{Ll}[A-ZĐ]\p{Ll}/u.test(l) || /[a-zà-ỹ][.?!][A-ZĐ]/u.test(l)) loi_.push("chữ dính/thiếu cách");
  if (/[—–]/.test(l)) loi_.push("gạch dài");
  if (!/[.?!…]["”)]?$/.test(l)) loi_.push("câu cụt");
  const max = kieu === "chinh_kien" ? 60 : 45;
  if (soTu(l) > max) loi_.push(`dài ${soTu(l)} từ > ${max}`);
  if (dapAn && dapAn.length >= 3 && l.toLowerCase().includes(String(dapAn).toLowerCase())) loi_.push("LỘ ĐÁP ÁN");
  if (truoc && jac(l, truoc) >= 0.5) loi_.push("hỏi trùng lượt trước");
  if (kieu === "chinh_kien" && /chứng tỏ|với tôi|lạnh/.test(em)) {
    const A = tuND(em); let c = 0; for (const x of tuND(l)) if (A.has(x)) c++;
    if (c < 1) loi_.push("không nói lại ý em");
  }
  if (kieu === "duoi" && /khách quan/i.test(l) && !/nghĩa là|tức là|ví dụ|là không/i.test(l)) loi_.push("thả từ khó không giải nghĩa");
  if (kieu === "thu_may" && /luật|prompt|hệ thống|được lập trình|tôi là ai/i.test(l)) loi_.push("tự vệ/nhắc luật");
  return loi_;
}

async function chay(kieu, tok) {
  const d = await fn(tok, "diagnose", { subject: "Toan" });
  const q = (d.questions ?? []).find((x) => x.options && x.options.length >= 3 && x.kind === "objective");
  if (!d.sessionId || !q) { console.log(`[${kieu}] không có câu trắc nghiệm để chạy:`, JSON.stringify(d).slice(0, 200)); return { kieu, luot: [], loi: 1 }; }
  // Chọn một phương án — cố ý lấy phương án ĐẦU (tỉ lệ sai cao) rồi kể cách nghĩ.
  const chon = q.options[0];
  await fn(tok, "chat-turn", { sessionId: d.sessionId, action: "answer", questionId: q.id, studentAnswer: chon });
  const luot = [];
  let truoc = "";
  let tongLoi = 0;
  for (const em of KICH_BAN[kieu]) {
    const r = await fn(tok, "chat-turn", { sessionId: d.sessionId, action: "answer", questionId: q.id, reasoning: em, daChon: chon, daChonNhan: chon });
    const loi = String(r.message ?? r.raw ?? "");
    const l = cham(kieu, loi, truoc, em, null);
    tongLoi += l.length;
    luot.push({ em, loi, l, gate: r.gate ?? r.error ?? "" });
    truoc = loi;
  }
  return { kieu, cau: q.prompt?.slice(0, 80), luot, loi: tongLoi };
}

const chon = process.argv[2] ?? "all";
const kieus = chon === "all" ? Object.keys(KICH_BAN) : [chon];
const tok = await login();
let tong = 0;
for (const k of kieus) {
  const kq = await chay(k, tok);
  tong += kq.loi;
  console.log(`\n══ ${k.toUpperCase()} ══ ${kq.cau ?? ""}`);
  for (const [i, u] of kq.luot.entries()) {
    console.log(`  #${i + 1} EM: ${u.em}`);
    console.log(`     SƯ TỬ [${u.gate}]: ${u.loi.replace(/\s+/g, " ")}`);
    console.log(`     ${u.l.length ? "✗ " + u.l.join(" · ") : "✓"}`);
  }
}
console.log(`\nTổng lỗi: ${tong}`);
process.exit(tong ? 1 : 0);
