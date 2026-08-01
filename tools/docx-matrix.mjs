/**
 * BỘ KIỂM BỘ ĐỌC .docx — chạy: node tools/docx-matrix.mjs
 *
 * Kiểm hai thứ mà nếu hỏng thì học sinh bị chấm oan:
 *   1. Đọc được chữ + công thức ra khỏi tệp Word (kể cả chữ nằm trong bảng).
 *   2. LaTeX sinh ra RENDER ĐƯỢC bằng chính KaTeX mà app đang dùng — dịch ra
 *      một chuỗi trông giống LaTeX nhưng KaTeX không nuốt nổi thì trên màn hình
 *      em thấy vệt đỏ, tệ hơn là không dịch.
 *
 * Bản mẫu `tools/fixtures/bai-lam-mau.docx` do System.IO.Compression của .NET
 * nén (không phải bộ nén của mình) — nên đây là phép thử THẬT cho bộ đọc ZIP,
 * và nó chính là tệp đã lòi ra chuyện vài bộ nén Windows ghi tên bằng dấu "\".
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "apps/web/package.json"));
const katex = require("katex");

const { docxToText } = await import(
  pathToFileURL(join(ROOT, "supabase/functions/_shared/docx.ts")).href
);

const r = await docxToText(new Uint8Array(readFileSync(join(ROOT, "tools/fixtures/bai-lam-mau.docx"))));

let fail = 0;
const check = (ten, dieuKien, thayGi) => {
  if (dieuKien) { console.log(`  ✓ ${ten}`); return; }
  console.log(`  ✗ ${ten}${thayGi === undefined ? "" : ` — thấy: ${JSON.stringify(thayGi)}`}`);
  fail++;
};

console.log("── Đọc nội dung ──");
check("lấy được chữ thường", r.text.includes("Giải phương trình bậc hai"));
check("đọc cả chữ trong BẢNG", r.text.includes("Ô trong bảng phải đọc được"));
check("phân số → \\frac", r.text.includes("\\frac{-b+\\sqrt{Δ}}{2a}"));
check("số mũ → ^", r.text.includes("x^2-5x+6=0"));
check("chỉ số dưới → _", r.text.includes("x_1=2"));
check("tổng → \\sum có cận", r.text.includes("\\sum_{i=1}^{n}"));
check("hàm sin bọc ngoặc nhọn (không dính thành \\sinx)", r.text.includes("\\sin{x}"));
check("ngoặc → \\left(…\\right)", r.text.includes("\\left(a+b\\right)"));
check("đếm đúng số công thức đọc được", r.soCongThuc === 6, r.soCongThuc);

// Cặp $…$ thật sự. Bắt theo CẶP chứ đừng dò "$ rồi tới ⟦": dấu $ ĐÓNG của công
// thức trước cũng khớp kiểu dò đó, và phép kiểm báo hỏng oan.
const formulas = [...r.text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);

console.log("\n── Công thức chưa dịch nổi ──");
check("bật cờ coMathChuaDoc", r.coMathChuaDoc === true, r.coMathChuaDoc);
check("có đánh dấu chỗ chưa đọc được", r.text.includes("⟦công thức chưa đọc được⟧"));
check("đánh dấu nằm NGOÀI $…$ (không đẩy chuỗi hỏng vào KaTeX)",
  !formulas.some((f) => f.includes("⟦")),
  formulas.filter((f) => f.includes("⟦")));

console.log("\n── KaTeX render được không ──");
check("có công thức để kiểm", formulas.length > 0, formulas.length);
for (const f of formulas) {
  let ok = true, loi = "";
  try { katex.renderToString(f, { throwOnError: true }); } catch (e) { ok = false; loi = String(e).split("\n")[0]; }
  check(`render: ${f}`, ok, loi || undefined);
}

console.log(fail === 0 ? "\n✓ TẤT CẢ ĐẠT" : `\n✗ ${fail} mục HỎNG`);
process.exit(fail ? 1 : 0);
