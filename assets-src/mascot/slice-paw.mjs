/**
 * Xử lý artwork dấu chân (df74c0d3…): nền ô caro NƯỚNG TRONG ẢNH (không alpha).
 *
 *   node assets-src/mascot/slice-paw.mjs
 *
 * 1. Flood-fill nền từ mép: pixel TRUNG TÍNH SÁNG (caro trắng/xám nhạt — gold
 *    bão hoà cao và navy tối không lọt lưới) nối liền mép → alpha 0 + un-blend viền.
 * 2. Tách tích V: các khối navy là viền bàn (to, chạm mép ngoài paw), 4 vòng
 *    ngón, và TÍCH V — khối navy cô lập nằm ở nửa dưới, không chạm nền ngoài.
 *    Tô tích bằng màu gold lấy mẫu tại tâm đệm → bản "plain" cho các trạng thái
 *    chưa-thành-thạo (không được phép mang dấu tích).
 * 3. Xuất 2 sprite 256px: paw-check.png (nguyên bản) · paw-plain.png (xoá tích).
 */
import sharp from "file:///D:/tutor/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";
import { writeFileSync } from "node:fs";

const SRC = "D:/tutor/assets-src/mascot/df74c0d3-8b26-4482-89a4-d1f30595c6c7.png";
const OUT = "D:/tutor/apps/web/public/brand/lion";

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = new Uint8Array(data);
const W = info.width, H = info.height;
const idx = (x, y) => y * W + x;

// ── 1. Nền caro: trung tính sáng (kể cả ô xám ~#e9e9e9), nối liền mép ────────
const isBgColor = (i) => {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mn >= 205 && mx - mn <= 14; // sáng + gần như vô sắc
};
const bg = new Uint8Array(W * H);
const queue = new Int32Array(W * H);
let qh = 0, qt = 0;
const push = (i) => {
  if (!bg[i] && isBgColor(i)) {
    bg[i] = 1;
    queue[qt++] = i;
  }
};
for (let x = 0; x < W; x++) {
  push(idx(x, 0));
  push(idx(x, H - 1));
}
for (let y = 0; y < H; y++) {
  push(idx(0, y));
  push(idx(W - 1, y));
}
while (qh < qt) {
  const i = queue[qh++];
  const x = i % W, y = (i / W) | 0;
  if (x > 0) push(i - 1);
  if (x < W - 1) push(i + 1);
  if (y > 0) push(i - W);
  if (y < H - 1) push(i + W);
}
let bgCount = 0;
for (let i = 0; i < W * H; i++) {
  if (bg[i]) {
    px[i * 4 + 3] = 0;
    bgCount++;
  }
}
console.log(`nền caro: ${Math.round((bgCount / (W * H)) * 100)}% ảnh → trong suốt`);

// Un-blend pixel viền sát nền (chống quầng xám caro quanh viền navy)
for (let i = 0; i < W * H; i++) {
  if (px[i * 4 + 3] === 0) continue;
  const x = i % W, y = (i / W) | 0;
  const nearBg =
    (x > 0 && !px[(i - 1) * 4 + 3]) || (x < W - 1 && !px[(i + 1) * 4 + 3]) ||
    (y > 0 && !px[(i - W) * 4 + 3]) || (y < H - 1 && !px[(i + W) * 4 + 3]);
  if (!nearBg) continue;
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
  const wht = Math.min(r, g, b) / 255;
  if (wht <= 0.7) continue;
  const a = Math.max(0.2, 1 - (wht - 0.7) / 0.3);
  const un = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - a) * 235) / a)));
  px[i * 4] = un(r);
  px[i * 4 + 1] = un(g);
  px[i * 4 + 2] = un(b);
  px[i * 4 + 3] = Math.round(a * 255);
}

// ── Bbox + xuất bản CHECK (nguyên bản) ───────────────────────────────────────
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (px[idx(x, y) * 4 + 3] > 8) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
const crop = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
const checkBuf = await sharp(Buffer.from(px.buffer), { raw: { width: W, height: H, channels: 4 } })
  .extract(crop)
  .resize({ width: 256 })
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(`${OUT}/paw-check.png`, checkBuf);
console.log(`✓ paw-check.png (bbox ${crop.width}×${crop.height} → 256w)`);

// ── 2. Tìm & xoá TÍCH V: khối navy cô lập ở nửa dưới ─────────────────────────
const isNavy = (i) => {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
  return px[i * 4 + 3] > 60 && r < 100 && g < 105 && b > 60 && b > r + 15;
};
const seen = new Uint8Array(W * H);
let checkComp = null;
for (let start = 0; start < W * H; start++) {
  if (seen[start] || !isNavy(start)) continue;
  let h2 = 0, t2 = 0;
  const q2 = [start];
  seen[start] = 1;
  const comp = [];
  let cy0 = H, cy1 = 0, cx0 = W, cx1 = 0, touchesBg = false;
  while (h2 < q2.length) {
    const i = q2[h2++];
    comp.push(i);
    const x = i % W, y = (i / W) | 0;
    if (y < cy0) cy0 = y;
    if (y > cy1) cy1 = y;
    if (x < cx0) cx0 = x;
    if (x > cx1) cx1 = x;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= W * H) continue;
      if (Math.abs((j % W) - x) > 1) continue;
      if (px[j * 4 + 3] === 0) touchesBg = true; // chạm nền ngoài = viền, không phải tích
      if (!seen[j] && isNavy(j)) {
        seen[j] = 1;
        q2.push(j);
      }
    }
  }
  // Tích V: KHÔNG chạm nền ngoài (nằm trọn trong đệm gold), ở nửa dưới ảnh,
  // đủ lớn để không phải nhiễu anti-alias.
  if (!touchesBg && cy0 > H * 0.5 && comp.length > W * H * 0.002) {
    checkComp = { comp, cx0, cx1, cy0, cy1 };
  }
}
if (!checkComp) {
  console.error("✗ Không tìm thấy component tích V — kiểm tra ngưỡng navy");
  process.exit(1);
}
console.log(`tích V: ${checkComp.comp.length}px, bbox x[${checkComp.cx0}-${checkComp.cx1}] y[${checkComp.cy0}-${checkComp.cy1}]`);

// Màu vá = gold lấy mẫu ngay trên tích (giữa đệm, tránh vùng highlight)
const sx = Math.round((checkComp.cx0 + checkComp.cx1) / 2);
const sy = checkComp.cy0 - 40;
const si = idx(sx, sy) * 4;
const gold = [px[si], px[si + 1], px[si + 2]];
console.log(`gold vá: rgb(${gold.join(",")}) tại (${sx},${sy})`);

// Tô tích + nở 3px nuốt viền anti-alias quanh nét
const mask = new Uint8Array(W * H);
for (const i of checkComp.comp) mask[i] = 1;
for (let pass = 0; pass < 3; pass++) {
  const grow = [];
  for (let y = checkComp.cy0 - 5; y <= checkComp.cy1 + 5; y++)
    for (let x = checkComp.cx0 - 5; x <= checkComp.cx1 + 5; x++) {
      const i = idx(x, y);
      if (mask[i]) continue;
      if (
        (x > 0 && mask[i - 1]) || (x < W - 1 && mask[i + 1]) ||
        (y > 0 && mask[i - W]) || (y < H - 1 && mask[i + W])
      )
        grow.push(i);
    }
  for (const i of grow) mask[i] = 1;
}
for (let i = 0; i < W * H; i++) {
  if (!mask[i]) continue;
  px[i * 4] = gold[0];
  px[i * 4 + 1] = gold[1];
  px[i * 4 + 2] = gold[2];
  px[i * 4 + 3] = 255;
}

const plainBuf = await sharp(Buffer.from(px.buffer), { raw: { width: W, height: H, channels: 4 } })
  .extract(crop)
  .resize({ width: 256 })
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(`${OUT}/paw-plain.png`, plainBuf);
console.log("✓ paw-plain.png (đã xoá tích V)");
