/**
 * Cắt các sheet mascot thành sprite lẻ nền trong suốt.
 *
 *   node assets-src/mascot/slice.mjs
 *
 * Vì sao không colorkey trắng toàn cục: mắt sư tử TRẮNG và mõm màu kem —
 * key trắng sẽ đục thủng mặt. Thay vào đó flood-fill từ 4 mép ảnh: chỉ vùng
 * trắng NỐI LIỀN với nền ngoài mới thành trong suốt. Pixel viền anti-alias
 * (cam pha trắng) được un-blend: c' = (c - (1-a)*255)/a để hết quầng trắng.
 */
// sharp lấy từ store pnpm của repo (dep bắc cầu qua Next) — script chạy độc lập
import sharp from "file:///D:/tutor/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "D:/tutor/assets-src/mascot";
const OUT = "D:/tutor/apps/web/public/brand/lion";
mkdirSync(OUT, { recursive: true });

// Ngưỡng "trắng-ish" cho flood fill (nền các sheet hơi ngà, không trắng tinh)
const WHITE = 226;

/** Sheet → lưới cắt + tên sprite (đọc theo hàng, trái→phải). */
const SHEETS = [
  {
    file: "e6b7d4dd-5878-4c6b-8d92-931339c71fe0.png", // 12 đầu biểu cảm 4×3
    cols: 4, rows: 3, cutBottom: 0,
    names: [
      "head-smile", "head-laugh", "head-wink", "head-surprised",
      "head-curious", "head-think", "head-sleep", "head-sad",
      "head-talk", "head-content", "head-confused", "head-speak",
    ],
  },
  {
    file: "fdbc7d8e-8a06-4c12-b895-156960a556d3.png", // 8 tư thế toàn thân 4×2
    cols: 4, rows: 2, cutBottom: 0,
    names: [
      "pose-wave", "pose-thumbsup", "pose-point", "pose-read",
      "pose-celebrate", "pose-run", "pose-ponder", "pose-laptop",
    ],
  },
  {
    file: "81a030d5-3c59-46bc-b55d-8aa21a569854.png", // 9 cảnh 3×3, có nhãn chữ ở đáy ô
    cols: 3, rows: 3, cutBottom: 0.13, // cắt bỏ dải nhãn WELCOME/STUDY/…
    dropLabels: true, // nhãn lệch lưới ở vài ô — quét bỏ component chữ navy còn sót
    names: [
      "scene-welcome", "scene-study", "scene-achievement",
      "scene-reminder", "scene-support", "scene-success",
      "scene-notification", "scene-idea", "scene-celebration",
    ],
  },
];

/** Flood-fill nền từ mép: trả về mask Uint8 (1 = nền). BFS bằng hàng đợi phẳng. */
function floodBackground(px, w, h) {
  const bg = new Uint8Array(w * h);
  const isWhite = (i) => px[i * 4] >= WHITE && px[i * 4 + 1] >= WHITE && px[i * 4 + 2] >= WHITE;
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const push = (i) => {
    if (!bg[i] && isWhite(i)) {
      bg[i] = 1;
      queue[qt++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return bg;
}

/** Nền → alpha 0; pixel cạnh nền được un-blend khỏi trắng để hết quầng. */
function applyAlpha(px, bg, w, h) {
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) {
      px[i * 4 + 3] = 0;
      continue;
    }
    const x = i % w, y = (i / w) | 0;
    const nearBg =
      (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) ||
      (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (!nearBg) continue;
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const whiteness = Math.min(r, g, b) / 255; // 1 = trắng tinh
    if (whiteness <= 0.82) continue; // pixel đủ đậm — giữ nguyên
    const a = Math.max(0.15, 1 - (whiteness - 0.82) / 0.18); // alpha giảm dần
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - a) * 255) / a)));
    px[i * 4] = un(r);
    px[i * 4 + 1] = un(g);
    px[i * 4 + 2] = un(b);
    px[i * 4 + 3] = Math.round(a * 255);
  }
}

/**
 * Bỏ các component chữ nhãn còn sót: khối liên thông NHỎ, màu navy đậm, nằm ở
 * nửa dưới ô. Nhân vật là một khối lớn liền mạch nên không bao giờ bị quét trúng;
 * confetti màu tươi (đỏ/xanh/vàng) không qua được bộ lọc màu navy.
 */
function dropNavyText(px, w, h) {
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || px[start * 4 + 3] <= 8) continue;
    let qh = 0, qt = 0;
    queue[qt++] = start;
    seen[start] = 1;
    const comp = [];
    let y0 = h, sr = 0, sg = 0, sb = 0;
    let x0 = w, x1 = 0;
    while (qh < qt) {
      const i = queue[qh++];
      comp.push(i);
      const x = i % w, y = (i / w) | 0;
      if (y < y0) y0 = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      sr += px[i * 4]; sg += px[i * 4 + 1]; sb += px[i * 4 + 2];
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        const jx = j % w;
        if (j < 0 || j >= w * h || seen[j] || px[j * 4 + 3] <= 8) continue;
        if (Math.abs(jx - x) > 1) continue; // không vòng qua mép
        seen[j] = 1;
        queue[qt++] = j;
      }
    }
    const n = comp.length;
    const navy = sr / n < 100 && sg / n < 100 && sb / n < 160;
    const drop =
      (n < w * h * 0.05 && y0 > h * 0.6 && navy) || // glyph nhãn navy
      (n < w * h * 0.015 && y0 > h * 0.85) || // mẩu lẻ nằm hẳn đáy ô
      (n < w * h * 0.03 && (x0 >= w * 0.92 || x1 <= w * 0.08)); // tràn từ ô kề bên
    if (drop) {
      for (const i of comp) px[i * 4 + 3] = 0;
    }
  }
}

/** Bounding box vùng không trong suốt (bỏ mép rác < 8 alpha). */
function bbox(px, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

for (const sheet of SHEETS) {
  const img = sharp(join(SRC, sheet.file)).ensureAlpha();
  const { width: W, height: H } = await img.metadata();
  const cellW = Math.floor(W / sheet.cols);
  const cellH = Math.floor(H / sheet.rows);
  const keepH = Math.floor(cellH * (1 - sheet.cutBottom));

  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const name = sheet.names[r * sheet.cols + c];
      const raw = await sharp(join(SRC, sheet.file))
        .ensureAlpha()
        .extract({ left: c * cellW, top: r * cellH, width: cellW, height: keepH })
        .raw()
        .toBuffer();
      const px = new Uint8Array(raw);
      const bg = floodBackground(px, cellW, keepH);
      applyAlpha(px, bg, cellW, keepH);
      if (sheet.dropLabels) dropNavyText(px, cellW, keepH);
      const box = bbox(px, cellW, keepH);
      if (!box) {
        console.error(`✗ ${name}: ô rỗng?`);
        continue;
      }
      const pad = 4;
      const left = Math.max(0, box.x0 - pad);
      const top = Math.max(0, box.y0 - pad);
      const out = await sharp(Buffer.from(px.buffer), { raw: { width: cellW, height: keepH, channels: 4 } })
        .extract({
          left,
          top,
          width: Math.min(cellW, box.x1 + pad + 1) - left,
          height: Math.min(keepH, box.y1 + pad + 1) - top,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
      writeFileSync(join(OUT, `${name}.png`), out);
      const fgPct = Math.round((bg.reduce((s, v) => s + (1 - v), 0) / (cellW * keepH)) * 100);
      console.log(`✓ ${name}  ${Math.min(cellW, box.x1 + pad + 1) - left}×${Math.min(keepH, box.y1 + pad + 1) - top}  (fg ${fgPct}%)`);
    }
  }
}
console.log(`\nXuất vào ${OUT}`);
