/**
 * BỘ KIỂM TÁCH CÔNG THỨC — chạy: node tools/mathtex-matrix.mjs
 *
 * Vì sao có (11/08): chủ dự án báo "câu này sai kí tự rồi" ở đáp án `P̄ (hoặc ¬P)`.
 * Không phải ký tự hỏng — đó là `P` + U+0304 (dấu ngang KẾT HỢP), Unicode hợp lệ.
 * Nhưng phông của app không có glyph ghép sẵn nên trình duyệt tự chồng vạch lên
 * chữ và đặt lệch. Đo ngân hàng sống: 24/1.930 câu dính ⇒ khuôn nội dung, không
 * phải ca lẻ. Vá ở tầng mã (như `stripLeadTag`) để phủ cả dữ liệu cũ lẫn nội
 * dung Studio giao sau này.
 *
 * Hai đường phải cùng đúng, và chúng đi qua hai hàm khác nhau:
 *   · dấu ghép NGOÀI `$…$` → `segmentMath` phải nhả ra một đoạn TOÁN riêng
 *     (`autoSpans` không nhận ra nó: "P̄" trông y hệt một chữ cái thường).
 *   · dấu ghép TRONG `$…$` → `normalizeTex` đổi tại chỗ, KHÔNG bọc thêm `$`.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require2 = createRequire(import.meta.url);
const ts = require2(path.join(HERE, "../node_modules/typescript/lib/typescript.js"));
const OUT = path.join(HERE, "build");
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(HERE, "../apps/web/lib/mathtex.ts"), "utf8");
fs.writeFileSync(
  path.join(OUT, "mathtex.mjs"),
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText,
);
const { segmentMath, normalizeTex } = await import(pathToFileURL(path.join(OUT, "mathtex.mjs")).href);

let dat = 0, truot = 0;
const tc = (ten, thay, mong) => {
  const a = JSON.stringify(thay), b = JSON.stringify(mong);
  if (a === b) { console.log(`  ✓ ${ten}`); dat++; return; }
  console.log(`  ✗ ${ten}\n      mong: ${b}\n      thấy: ${a}`);
  truot++;
};
const P_NGANG = "P̄";   // P + dấu ngang kết hợp
const X_TREN = "x̅";    // x + overline kết hợp

console.log("── Dấu ngang kết hợp NGOÀI $…$ → nâng thành đoạn toán ──");
tc("một mình", segmentMath(P_NGANG), [{ t: "math", v: "\\overline{P}" }]);
// `autoSpans` cắt phần CHỮ theo từng token (giữ khoảng trắng làm segment riêng)
// — hành vi có sẵn từ trước, không phải thứ bản vá này đụng tới. Nên đừng kiểm
// hình dạng mảng; kiểm đúng hai điều có nghĩa: chữ ghép lại KHÔNG mất mát, và
// có ĐÚNG một đoạn toán là `\overline{P}`.
const ghep = (segs) => segs.map((s) => s.v).join("");
const cacDoanToan = (segs) => segs.filter((s) => s.t === "math").map((s) => s.v);
{
  const segs = segmentMath(`${P_NGANG} (hoặc ¬P)`);
  tc("đáp án thật trong DB — đoạn toán", cacDoanToan(segs), ["\\overline{P}"]);
  tc("đáp án thật trong DB — không mất chữ", ghep(segs), "\\overline{P} (hoặc ¬P)");
}
tc("giữa câu chữ",
  segmentMath(`kí hiệu ${P_NGANG} dùng để chỉ`).filter((s) => s.t === "math"),
  [{ t: "math", v: "\\overline{P}" }]);
tc("chữ thường + U+0305", segmentMath(X_TREN), [{ t: "math", v: "\\overline{x}" }]);
tc("hai cái trong một câu",
  segmentMath(`${P_NGANG} và ${X_TREN}`).filter((s) => s.t === "math").map((s) => s.v),
  ["\\overline{P}", "\\overline{x}"]);

console.log("\n── Dấu ngang kết hợp TRONG $…$ → normalizeTex đổi tại chỗ ──");
tc("trong công thức", normalizeTex(`${P_NGANG} \\land Q`), "\\overline{P} \\land Q");
tc("segmentMath giữ nguyên một đoạn math",
  segmentMath(`$${P_NGANG} \\land Q$`), [{ t: "math", v: `${P_NGANG} \\land Q` }]);

console.log("\n── KHÔNG đụng vào chuỗi không có dấu ghép (chống hồi quy) ──");
tc("chữ thường — không đoạn toán nào", cacDoanToan(segmentMath("Hôm nay trời mưa")), []);
tc("chữ thường — nguyên văn", ghep(segmentMath("Hôm nay trời mưa")), "Hôm nay trời mưa");
tc("căn thức vẫn chạy", normalizeTex("√(x+1)"), "\\sqrt{x+1}");
tc("tiếng Việt có dấu KHÔNG bị nhận nhầm",
  segmentMath("Mệnh đề đúng").every((s) => s.t === "text"), true);

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
