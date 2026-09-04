// CHỤP + ĐO BẢN MOBILE THẬT — viewport iPhone 390×844, touch, DPR 2 — qua Chrome
// cài sẵn trên máy (puppeteer-core, không tải trình duyệt).
//
// Vì sao có (04/09): extension Chrome không resize được cửa sổ, còn "giả lập"
// bằng CSS html{width:390px} thì media query KHÔNG đổi → mọi số tràn là tạo
// tác. Cách duy nhất tin được là viewport thật. Script này đăng nhập demo, chụp
// 12 màn, và ĐO tất định: tràn ngang (scrollWidth), phần tử vượt mép phải, chữ
// <12px, nút chạm <40px — in ra để đối chiếu trước/sau mỗi lần sửa CSS.
//
// Cài một lần (ngoài repo, không thêm dependency): npm i -g puppeteer-core@23
//   hoặc trong scratchpad rồi trỏ NODE_PATH. Chạy từ gốc repo:
//   node tools/mobile-shot.mjs            → chụp hết vào tools/mobile-shots/
//   node tools/mobile-shot.mjs hoc bai    → chỉ các màn được nêu
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const OUT = path.resolve("tools/mobile-shots");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "https://tutor.vietanh.org";
const EMAIL = "hs1@vietanh.edu.vn", PASS = "VietAnh@2026";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Đo: tràn ngang, phần tử vượt mép phải, chữ <12px, nút chạm <44px. */
async function audit(tag) {
  return await page.evaluate((tag) => {
    const W = innerWidth;
    const out = { tag, scrollW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, over: [], small: [], tiny: [] };
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" && r.width >= W) continue;
      const key = el.tagName + "." + [...el.classList].slice(0, 2).join(".");
      if (r.right > W + 1 && !seen.has("o" + key)) { seen.add("o" + key); out.over.push(`${key} right=${Math.round(r.right)}`); }
      const fs = parseFloat(cs.fontSize);
      if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && fs < 12 && !seen.has("s" + key)) { seen.add("s" + key); out.small.push(`${key} ${fs}px "${el.textContent.trim().slice(0, 24)}"`); }
      const clickable = el.matches("button, a[href], [role=button], input, summary");
      if (clickable && r.top < innerHeight && r.bottom > 0 && (r.height < 40 || r.width < 40) && !seen.has("t" + key)) { seen.add("t" + key); out.tiny.push(`${key} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20)}"`); }
    }
    return out;
  }, tag);
}
async function shot(name, full = false) {
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  const a = await audit(name);
  console.log(`\n== ${name} == scrollW=${a.scrollW} (viewport 390)${a.scrollW > 392 ? "  ⚠ TRÀN NGANG" : ""}`);
  if (a.over.length) console.log("  vượt mép phải:", a.over.slice(0, 8).join(" | "));
  if (a.small.length) console.log("  chữ <12px:", a.small.slice(0, 8).join(" | "));
  if (a.tiny.length) console.log("  nút <40px:", a.tiny.slice(0, 8).join(" | "));
}
const click = async (sel) => { await page.waitForSelector(sel, { timeout: 8000 }); await page.click(sel); };
const clickText = async (re, tag = "button") => {
  const ok = await page.evaluate((re, tag) => { const b = [...document.querySelectorAll(tag)].find((x) => new RegExp(re).test(x.textContent)); if (b) { b.click(); return true; } return false; }, re, tag);
  if (!ok) throw new Error("không thấy nút /" + re + "/");
};

const want = new Set(process.argv.slice(2));
const on = (n) => !want.size || want.has(n);

// ── Đăng nhập ──
await page.goto(`${BASE}/login/`, { waitUntil: "networkidle2" });
if (on("login")) await shot("01-login");
await clickText("Tài khoản trường");
await page.waitForSelector('input[type="password"]');
if (on("login")) await shot("02-login-form");
await page.type('input[type="email"], input[name="email"]', EMAIL);
await page.type('input[type="password"]', PASS);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForSelector(".node", { timeout: 20000 });
await sleep(2500);

// ── Học ──
if (on("hoc")) { await shot("03-hoc-top"); await shot("03-hoc-full", true); }
// Kho báu
if (on("khobau")) {
  const okKb = await page.evaluate(() => { const b = document.querySelector(".node-treasure:not([disabled])"); if (b) { b.click(); return true; } return false; });
  if (okKb) { await sleep(2500); await shot("04-khobau"); await clickText("Về lộ trình"); await sleep(800); }
}
// Tab phụ
if (on("tabs")) {
  for (const [lbl, name] of [["Ôn tập", "05-ontap"], ["Hạng", "06-hang"], ["Mục tiêu", "07-muctieu"], ["Tôi", "08-toi"]]) {
    await page.evaluate((lbl) => [...document.querySelectorAll(".nav-item")].find((b) => b.getAttribute("aria-label") === lbl || b.textContent.trim() === lbl)?.click(), lbl);
    await sleep(1200);
    await shot(name, true);
  }
  await page.evaluate(() => [...document.querySelectorAll(".nav-item")].find((b) => b.textContent.trim() === "Học")?.click());
  await sleep(800);
}
// ── Làm bài ──
if (on("bai")) {
  await page.evaluate(() => document.querySelector('.node[data-state="current"]')?.click());
  await page.waitForSelector(".lesson-x", { timeout: 20000 });
  await sleep(2500);
  await shot("09-bai-top");
  await shot("09-bai-full", true);
  // chọn một đáp án sai để thấy trạng thái retry
  const picked = await page.evaluate(() => { const b = document.querySelector(".ans-tile, .iq-cbtn"); if (b) { b.click(); return true; } return false; });
  if (picked) {
    await sleep(400);
    await page.evaluate(() => document.querySelector(".btn-check")?.click());
    await sleep(3500);
    await shot("10-bai-sau-kiemtra");
  }
  // popup Ôn Lại
  const okRail = await page.evaluate(() => { const b = document.querySelector(".rol-btn"); if (b) { b.click(); return true; } return false; });
  if (okRail) { await sleep(2500); await shot("11-onlai-popup"); await page.keyboard.press("Escape"); await sleep(400); }
  else console.log("\n(rail Ôn Lại không hiện ở mobile — kiểm CSS .rol-rail display:none <860px)");
  // thoát → sheet
  await page.evaluate(() => document.querySelector(".lesson-x")?.click());
  await sleep(700);
  await shot("12-thoat-sheet");
}
await browser.close();
console.log("\nảnh:", OUT);
