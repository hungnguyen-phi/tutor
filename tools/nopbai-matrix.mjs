/**
 * BỘ KIỂM PHÁN QUYẾT BÀI NỘP — chạy: node tools/nopbai-matrix.mjs
 *
 * Từ 01/08 bài tự luận do AI chấm và KHÔNG còn giáo viên đứng sau. `chotPhanQuyet`
 * là cái chốt cuối trước khi ghi mastery, nên nó phải chịu được ba tình huống
 * mà mỗi cái sai một kiểu:
 *
 *   1. LLM hỏng / hết ngân sách token → PHẢI ra "chưa chấm được", TUYỆT ĐỐI
 *      không được thành điểm trượt. Đây là rủi ro MỚI sinh ra hôm nay: trước
 *      kia hạ tầng hỏng thì bài nằm chờ giáo viên, nay không còn ai chờ nữa.
 *   2. Mô hình gật cho một bài vài chữ trong khi đáp án mẫu là cả đoạn → phải
 *      HẠ thành trượt (bài học 29/07: chữ "ok" đậu 3/5 lần, đẻ 12 bằng chứng
 *      nhiễm phải dọn bằng SQL).
 *   3. Nhưng đáp án mẫu NGẮN thì bài ngắn là ĐÚNG — chặn ở đây là đánh trượt
 *      oan hàng loạt câu điền một cụm từ. Đây là mặt kia của cái đai, và là ca
 *      dễ làm hỏng nhất khi siết chặt số 2.
 *
 * Dùng chung lối transpile của tools/grading-matrix.mjs (TS→JS bằng chính
 * typescript.js trong repo) để chạy ĐÚNG mã đang deploy, không phải bản chép.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require2 = createRequire(import.meta.url);
const ts = require2(path.join(HERE, "../node_modules/typescript/lib/typescript.js"));

const ROOT = path.join(HERE, "../supabase/functions/_shared");
const OUT = path.join(HERE, "build");
fs.mkdirSync(OUT, { recursive: true });

// llm.ts đọc Deno.env ngay lúc nạp mô-đun (trần token/ngày). Không có Deno thì
// nạp là nổ — dựng một cái vỏ rỗng trước khi import.
globalThis.Deno ??= { env: { get: () => undefined } };

function transpile(name) {
  let src = fs.readFileSync(path.join(ROOT, name + ".ts"), "utf8");
  src = src.replace(/import\("npm:mathjs@13"\)/g, 'import("./mathjs-mock.mjs")');
  src = src.replace(/from "\.\/(\w[\w-]*)\.ts"/g, 'from "./$1.mjs"');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(OUT, name + ".mjs"), js);
}
fs.writeFileSync(
  path.join(OUT, "mathjs-mock.mjs"),
  `export function create(){ return { parse(){ throw new Error("mock"); }, evaluate(){ throw new Error("mock"); } }; } export const all = {};`,
);
for (const m of ["cas", "intent", "llm", "grade-open"]) transpile(m);

const { chotPhanQuyet } = await import(pathToFileURL(path.join(OUT, "grade-open.mjs")).href);

const DOAN_VAN =
  "Xét dấu tam thức bậc hai. Tính Δ = b² - 4ac. Nếu Δ < 0 thì tam thức cùng dấu " +
  "với hệ số a với mọi x. Nếu Δ = 0 thì tam thức cùng dấu với a trừ điểm x = -b/2a. " +
  "Nếu Δ > 0 thì tam thức trái dấu với a giữa hai nghiệm.";
const CUM_TU = "x = 2";

const llm = (correct, detail = "") => ({ correct, method: "llm", detail });

let dat = 0, truot = 0;
function tc(ten, ai, bai, ref, mongLyDo) {
  const r = chotPhanQuyet(ai, bai, ref);
  if (r.lyDo === mongLyDo) { console.log(`  ✓ ${ten}`); dat++; return; }
  console.log(`  ✗ ${ten}\n      mong: ${mongLyDo}  ·  thấy: ${r.lyDo} (chamDuoc=${r.chamDuoc}, dat=${r.dat})`);
  truot++;
}

console.log("── Hạ tầng hỏng KHÔNG được thành điểm trượt ──");
tc("LLM trả null (hết token / model hỏng)", null, "Bài làm đầy đủ của em…", DOAN_VAN, "khong_cham_duoc");
tc("null kể cả khi bài rất dài và tốt", null, DOAN_VAN, DOAN_VAN, "khong_cham_duoc");

console.log("\n── Mô hình nói trượt thì trượt ──");
tc("mô hình trượt, bài dài", llm(false, "chưa xét Δ = 0"), DOAN_VAN, DOAN_VAN, "mo_hinh_truot");
tc("mô hình trượt, bài ngắn", llm(false), "x = 2", CUM_TU, "mo_hinh_truot");

console.log("\n── Đai fail-closed: đáp án là ĐOẠN VĂN mà bài vài chữ ──");
tc('mô hình gật cho "ok"', llm(true), "ok", DOAN_VAN, "bai_qua_ngan");
tc('mô hình gật cho "em hiểu rồi ạ"', llm(true), "em hiểu rồi ạ", DOAN_VAN, "bai_qua_ngan");
tc("mô hình gật cho một con số trơ", llm(true), "5", DOAN_VAN, "bai_qua_ngan");
tc("mô hình gật cho ba chữ", llm(true), "delta lớn hơn", DOAN_VAN, "bai_qua_ngan");

console.log("\n── Mặt kia: đáp án NGẮN thì bài ngắn phải ĐẠT ──");
tc("đáp án một cụm từ, bài trùng ý", llm(true), "x = 2", CUM_TU, "dat");
tc("đáp án một cụm từ, bài có thêm lời", llm(true), "Vậy x = 2", CUM_TU, "dat");
tc("đáp án đoạn văn, bài đủ ý", llm(true),
  "Em tính Δ = b² - 4ac trước. Δ < 0 thì tam thức luôn cùng dấu với a. " +
  "Δ = 0 thì cùng dấu a trừ điểm x = -b/2a. Δ > 0 thì trái dấu a giữa hai nghiệm.",
  DOAN_VAN, "dat");

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
