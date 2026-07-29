// Ma trận chấm (A0) — chạy các module chấm THẬT (cas/interactive/intent) trong
// Node: transpile TS→JS, mock "npm:mathjs@13" bằng null-import (test tránh nhánh
// symbolic). Mọi ca dưới đây là hành vi BẮT BUỘC sau đợt vá 29/07.
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module"; const require2 = createRequire(import.meta.url); const ts = require2("../node_modules/typescript/lib/typescript.js");

const ROOT = "../supabase/functions/_shared";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "build");
fs.mkdirSync(OUT, { recursive: true });

function transpile(name) {
  let src = fs.readFileSync(path.join(ROOT, name + ".ts"), "utf8");
  // Deno npm: specifier → mock (dynamic import chỉ chạy ở nhánh symbolic, test né nhánh đó
  // nhưng vẫn phải resolve được module nếu lỡ gọi).
  src = src.replace(/import\("npm:mathjs@13"\)/g, 'import("./mathjs-mock.mjs")');
  src = src.replace(/from "\.\/(\w+)\.ts"/g, 'from "./$1.mjs"');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(OUT, name + ".mjs"), js);
}
fs.writeFileSync(
  path.join(OUT, "mathjs-mock.mjs"),
  // parse ném lỗi → exprEqualSymbolic trả {correct:false, method:"error"} — fail-closed.
  `export function create(){ return { parse(){ throw new Error("mock"); }, evaluate(){ throw new Error("mock"); } }; } export const all = {};`,
);
for (const m of ["cas", "interactive", "intent"]) transpile(m);

const cas = await import(pathToFileURL(path.join(OUT, "cas.mjs")).href);
const inter = await import(pathToFileURL(path.join(OUT, "interactive.mjs")).href);
const intent = await import(pathToFileURL(path.join(OUT, "intent.mjs")).href);

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  → được ${JSON.stringify(got)}, muốn ${JSON.stringify(want)}`}`);
};

// ── LỖI 16: số kiểu Việt ────────────────────────────────────────────────────
t("0,2 vs 0.2", (await cas.checkAnswer("0,2", "0.2")).correct, true);
t("-0,2 vs -0.2", (await cas.checkAnswer("-0,2", "-0.2")).correct, true);
t("1.234,5 vs 1234.5", (await cas.checkAnswer("1.234,5", "1234.5")).correct, true);
t("0,2 vs 0.3 → SAI", (await cas.checkAnswer("0,2", "0.3")).correct, false);
t("2356 vs 2356", (await cas.checkAnswer("2356", "2356")).correct, true);
t("đáp án VN-phẩy trong bank: 0.2 vs 0,2", (await cas.checkAnswer("0.2", "0,2")).correct, true);

// ── Hồi quy CAS cũ không được vỡ ────────────────────────────────────────────
t("tuple (1,2) vs (1;2)", (await cas.checkAnswer("(1,2)", "(1;2)")).correct, true);
t("set x=1;x=3 vs {1;3}", (await cas.checkAnswer("x=1; x=3", "{1;3}")).correct, true);
t("set 1,3 vs {1;3}", (await cas.checkAnswer("1,3", "{1;3}")).correct, true);
t("MCQ chữ B vs B", (await cas.checkAnswer("B", "B")).correct, true);
t("MCQ b vs B (hoa/thường)", (await cas.checkAnswer("b", "B")).correct, true);
t("chuỗi rỗng → SAI", (await cas.checkAnswer("", "42")).correct, false);
t("1/2 vs 0.5", (await cas.checkAnswer("1/2", "0.5")).correct, true);
t("1/2 vs 0,5 (bank phẩy)", (await cas.checkAnswer("1/2", "0,5")).correct, true);
t("số bất kỳ 7 vs 42 → SAI", (await cas.checkAnswer("7", "42")).correct, false);

// ── LỖI 9/11/14: cổng ý định ────────────────────────────────────────────────
t("help: 'gợi ý giúp em với'", intent.isHelpRequest("gợi ý giúp em với"), true);
t("help: 'em không biết làm'", intent.isHelpRequest("em không biết làm"), true);
t("help: 'làm sao để giải câu này'", intent.isHelpRequest("làm sao để giải câu này"), true);
t("help: 'cho em đáp án'", intent.isHelpRequest("cho em đáp án"), true);
t("KHÔNG help: 'Sai'", intent.isHelpRequest("Sai"), false);
t("KHÔNG help: 'không'", intent.isHelpRequest("không"), false);
t("KHÔNG help: đáp án thật có 'vì… suy ra…'",
  intent.isHelpRequest("Đúng vì tổng ba góc bằng 180 độ nên suy ra x = 50"), false);

// ── LỖI 8: bài rác cho câu MỞ ───────────────────────────────────────────────
t("junk: 'ok'", intent.isJunkOpenAnswer("ok"), true);
t("junk: 'ok đã hiểu'", intent.isJunkOpenAnswer("ok đã hiểu"), true);
t("junk: 'em hiểu rồi ạ'", intent.isJunkOpenAnswer("em hiểu rồi ạ"), true);
t("junk: số trơ '7'", intent.isJunkOpenAnswer("7"), true);
t("junk: '123,45'", intent.isJunkOpenAnswer("123,45"), true);
t("KHÔNG junk: câu trả lời thật",
  intent.isJunkOpenAnswer("Mệnh đề là câu khẳng định mà ta xác định được tính đúng sai của nó"), false);
t("plausible: câu thật", intent.plausibleOpenAnswer("Câu b sai vì độ lệch chuẩn lớn chỉ nói dữ liệu phân tán nhiều hơn"), true);
t("KHÔNG plausible: 'ok'", intent.plausibleOpenAnswer("ok"), false);

// ── Tương tác: blanks + dung_sai + sap_xep giữ nguyên hành vi ───────────────
t("blanks 0,2;;5 vs '0.2; 5'", inter.gradeInteractive("dien_dap_an", "0,2;;5", "0.2; 5")?.correct, true);
t("blanks sai 1 ô → SAI", inter.gradeInteractive("dien_dap_an", "0,2;;9", "0.2; 5")?.correct, false);
t("blanks chữ: 'độ lệch chuẩn;;số trung bình'",
  inter.gradeInteractive("x", "độ lệch chuẩn;;số trung bình", "độ lệch chuẩn; số trung bình")?.correct, true);
t("dung_sai Đúng vs Đúng", inter.gradeInteractive("dung_sai", "Đúng", "Đúng")?.correct, true);
t("dung_sai xàm 'abc' → SAI", inter.gradeInteractive("dung_sai", "abc", "Đúng")?.correct, false);
t("sap_xep c-a-b vs c a b", inter.gradeInteractive("sap_xep", "c a b", "c - a - b")?.correct, true);
t("sap_xep sai thứ tự → SAI", inter.gradeInteractive("sap_xep", "a c b", "c - a - b")?.correct, false);
t("checklist a:dung,b:sai đủ", inter.gradeInteractive("mcq", "a:dung,b:sai", "a) Đ; b) S")?.correct, true);
t("checklist thiếu ý → SAI", inter.gradeInteractive("mcq", "a:dung", "a) Đ; b) S")?.correct ?? false, false);


// ── Chốt chặn quan niệm sai (bảo mật: không lộ đáp án) ─────────────────────
t("giữ nguyên quan niệm sai bình thường",
  intent.safeMisconception("SAI CHIỀU — đây là định nghĩa của B ⊂ A"),
  "SAI CHIỀU — đây là định nghĩa của B ⊂ A");
t("gọt nhãn (b) SAI vì",
  intent.safeMisconception("(b) SAI vì giá trị phụ thuộc ngữ cảnh"),
  "vì giá trị phụ thuộc ngữ cảnh");
t("gọt d) Đúng —",
  intent.safeMisconception("d) Đúng — nhầm hai tập rời nhau"),
  "nhầm hai tập rời nhau");
t("rỗng → rỗng", intent.safeMisconception(null), "");

console.log(`\n${pass} đạt · ${fail} trượt`);
process.exit(fail ? 1 : 0);

// ── Chốt chặn quan niệm sai (bảo mật: không lộ đáp án) ─────────────────────
t("giữ nguyên quan niệm sai bình thường",
  intent.safeMisconception("SAI CHIỀU — đây là định nghĩa của B ⊂ A"),
  "SAI CHIỀU — đây là định nghĩa của B ⊂ A");
t("gọt nhãn '(b) SAI vì'",
  intent.safeMisconception("(b) SAI vì giá trị phụ thuộc ngữ cảnh"),
  "vì giá trị phụ thuộc ngữ cảnh");
t("gọt 'd) Đúng —'",
  intent.safeMisconception("d) Đúng — nhầm hai tập rời nhau"),
  "nhầm hai tập rời nhau");
t("rỗng → rỗng", intent.safeMisconception(null), "");

