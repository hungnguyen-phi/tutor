/**
 * Sprite mascot PNG → WebP.
 *
 *   node assets-src/mascot/webp.mjs          # xuất .webp cạnh .png
 *   node assets-src/mascot/webp.mjs --do     # đo thử, KHÔNG ghi file
 *
 * VÌ SAO: đo trên production 30/07 — trang /login tải 571 KB, trong đó ảnh sư tử
 * `pose-wave.png` một mình chiếm 157 KB (nặng nhất cả trang, và là ảnh LCP).
 * Cả bộ 35 sprite là 4,5 MB PNG. WebP lossless-ish ở quality 90 giữ nguyên nét
 * vẽ + nền trong suốt mà nhỏ hơn 4–6 lần.
 *
 * GIỮ NGUYÊN FILE PNG: chúng là nguồn, và là đường lui nếu một máy nào đó không
 * đọc được WebP. Lion.tsx trỏ sang .webp; muốn quay lại chỉ đổi một hằng số.
 *
 * sharp lấy từ store pnpm của repo (dep bắc cầu qua Next) — cùng cách slice.mjs
 * đang làm, để script chạy độc lập không cần thêm dependency vào package.json.
 */
import sharp from "file:///D:/tutor/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "D:/tutor/apps/web/public/brand/lion";
const CHI_DO = process.argv.includes("--do");

const pngs = readdirSync(DIR).filter((f) => f.endsWith(".png"));
let truoc = 0;
let sau = 0;
const dong = [];

for (const f of pngs) {
  const src = join(DIR, f);
  const kb = statSync(src).size;
  // q95 + alphaQuality 100 — đã đo trên pose-wave (297×413):
  //   q80 14 KB (lệch TB 3,24) · q90 19 KB (2,64) · q95 25 KB (2,38) · lossless 72 KB (0)
  // Chọn q95: vẫn giảm 84% mà lệch trung bình 0,9% ở vùng NHÌN THẤY ĐƯỢC, và
  // ALPHA lệch 0 TUYỆT ĐỐI (nền trong suốt nguyên vẹn, không quầng viền — đúng
  // thứ slice.mjs đã khổ công un-blend). Đây là tài sản thương hiệu hiển thị to
  // (196px ở đăng nhập), nên không hà tiện xuống q80.
  const buf = await sharp(src).webp({ quality: 95, effort: 6, alphaQuality: 100 }).toBuffer();
  truoc += kb;
  sau += buf.length;
  dong.push({
    ten: f,
    png: Math.round(kb / 1024),
    webp: Math.round(buf.length / 1024),
    giam: Math.round((1 - buf.length / kb) * 100),
  });
  if (!CHI_DO) writeFileSync(join(DIR, f.replace(/\.png$/, ".webp")), buf);
}

dong.sort((a, b) => b.png - a.png);
for (const d of dong.slice(0, 8)) {
  console.log(`  ${d.ten.padEnd(20)} ${String(d.png).padStart(4)} KB → ${String(d.webp).padStart(3)} KB  (−${d.giam}%)`);
}
console.log(
  `\n${pngs.length} sprite · ${Math.round(truoc / 1024)} KB → ${Math.round(sau / 1024)} KB ` +
    `(giảm ${Math.round((1 - sau / truoc) * 100)}%)${CHI_DO ? " — chỉ đo, chưa ghi file" : " — đã ghi .webp"}`,
);
