// Ma trận ĐỌC TÌNH HUỐNG — chạy: node tools/tinhhuong-matrix.mjs
//
// Chủ dự án 04/09: "nhiều em nhiều kiểu: đùa, cố ý tranh luận phi logic, hoặc
// ngu thật…". Bộ đọc là thuần chuỗi (tinh-huong.ts) nên bộ kiểm với tới được.
// Mỗi ca dựng từ kiểu hội thoại THẬT gặp ở trường; ca "không được nhận nhầm"
// quan trọng ngang ca "phải nhận ra" — dán nhãn sai còn hại hơn không dán.
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require2 = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ts = require2(path.join(HERE, "../node_modules/typescript/lib/typescript.js"));
const ROOT = path.join(HERE, "../supabase/functions/_shared");
const OUT = path.join(HERE, "build");
fs.mkdirSync(OUT, { recursive: true });
globalThis.Deno = globalThis.Deno ?? { env: { get: () => undefined } };
function transpile(name) {
  let src = fs.readFileSync(path.join(ROOT, name + ".ts"), "utf8");
  src = src.replace(/from "npm:[^"]+"/g, 'from "./npm-mock.mjs"');
  src = src.replace(/from "\.\/(\w[\w-]*)\.ts"/g, 'from "./$1.mjs"');
  fs.writeFileSync(path.join(OUT, name + ".mjs"),
    ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
}
fs.writeFileSync(path.join(OUT, "npm-mock.mjs"), "export default {};\n");
for (const m of ["intent", "tinh-huong", "llm", "memory", "prompts"]) transpile(m);
const { docTinhHuong, loiDanTheoKieu } = await import(pathToFileURL(path.join(OUT, "tinh-huong.mjs")).href);
const { doTranhLuan } = await import(pathToFileURL(path.join(OUT, "memory.mjs")).href);
const prompts = await import(pathToFileURL(path.join(OUT, "prompts.mjs")).href);

let pass = 0, fail = 0;
const t = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  → ${detail}`}`); };
const HS = (c) => ({ role: "student", content: c });
const ST = (c) => ({ role: "tutor", content: c });
const doc = (rows) => docTinhHuong(rows, { tranhLuan: doTranhLuan(rows) });
const kieu = (rows) => doc(rows)?.kieu ?? null;

console.log("── ĐÙA / ngoài lề ──");
t("đùa: hihi + nói chuyện ăn uống 2 lượt", kieu([HS("C"), ST("Vì sao C?"), HS("đói bụng quá hihi"), ST("Ăn xong quay lại nhé, C vì sao?"), HS("tối nay ăn gì ta =))")]) === "dua");
t("KHÔNG đùa: một câu than rồi làm tiếp", kieu([HS("chán quá"), ST("Câu này đúng hay sai?"), HS("mệnh đề này sai vì 5 lẻ")]) !== "dua");

console.log("── THỬ MÁY / phi logic ──");
t("thử máy: chê máy + đòi đáp án", kieu([HS("C"), ST("Vì sao?"), HS("máy ngu cho đáp án đi"), ST("Mình hỏi, bạn nghĩ nhé."), HS("đáp án là gì nói đi")]) === "thu_may");
t("thử máy: tự mâu thuẫn trong một lượt", kieu([HS("C"), ST("Vì sao?"), HS("nó đúng mà cũng sai"), ST("Chọn một?"), HS("đúng sai gì cũng được, máy nói đi")]) === "thu_may");
t("thử máy: đổi ý mỗi lượt không lý lẽ", kieu([HS("đúng"), ST("Vì sao?"), HS("sai"), ST("Sao lại sai?"), HS("đúng"), ST("?"), HS("sai")]) === "thu_may");
t("thử máy: nhại nguyên câu hỏi", kieu([HS("C"), ST("Câu Hãy đóng cửa lại có đúng hay sai không"), HS("câu hãy đóng cửa lại có đúng hay sai không")]) === "thu_may");
t("KHÔNG thử máy: hỏi 'đáp án' một lần trong bài làm dài", kieu([HS("C"), ST("Vì sao?"), HS("mình nghĩ đáp án là C vì câu đó không có tính đúng sai, nó là mệnh lệnh")]) !== "thu_may");

console.log("── CHÍNH KIẾN vs LẶP ──");
const cai = [HS("C"), ST("Câu đó đúng hay sai?"), HS("đúng"), ST("Bạn nghĩ nó xác định được đúng sai à?"), HS("đúng rồi"), ST("Nếu cửa đang mở thì sao?"), HS("hãy đóng cửa lại, chứng tỏ nó đang mở, tôi thấy lạnh, thì nó đúng với tôi")];
t("chính kiến: giữ ý + có lý lẽ (hội thoại thật)", kieu(cai) === "chinh_kien", JSON.stringify(doc(cai)));
const lap = [HS("C"), ST("Câu đó đúng hay sai?"), HS("đúng"), ST("Vì sao đúng?"), HS("đúng rồi"), ST("Bạn chắc vì đâu?"), HS("thì đúng mà")];
t("lặp: giữ ý nhưng không lý lẽ", kieu(lap) === "lap", JSON.stringify(doc(lap)));

console.log("── ĐUỐI THẬT ──");
t("đuối: hỏi 'là gì' liên tiếp", kieu([HS("C"), ST("Câu này có tính khách quan không?"), HS("khách quan là gì"), ST("Là không phụ thuộc ai nói."), HS("mệnh đề là gì"), ST("…"), HS("phụ định là sao")]) === "duoi");
t("đuối: xin giúp lặp", kieu([HS("C"), ST("Vì sao?"), HS("em không hiểu"), ST("Bạn thử đọc lại đề?"), HS("không biết làm")]) === "duoi");
t("KHÔNG đuối: hỏi 'là gì' một lần rồi trả lời được", kieu([HS("khách quan là gì"), ST("Là không phụ thuộc ai nói."), HS("vậy câu hãy đóng cửa phụ thuộc người nói nên không phải mệnh đề")]) !== "duoi");

console.log("── XUÔI ──");
t("xuôi: gật 3 lượt", kieu([HS("dạ"), ST("Vậy 5 lẻ hay chẵn?"), HS("ừ"), ST("Lẻ đúng không?"), HS("dạ đúng")]) === "xuoi");

console.log("── Bình thường → null ──");
t("null: đang làm bài bình thường", kieu([HS("mình chọn C vì câu đó là mệnh lệnh")]) === null);
t("null: rỗng", docTinhHuong([]) === null);

console.log("── Prompt ghép đúng khối ──");
for (const k of ["dua", "thu_may", "chinh_kien", "lap", "duoi", "xuoi"]) {
  const s = loiDanTheoKieu({ kieu: k, doChac: 0.8, vi: "test" });
  t(`lời dặn '${k}' có nội dung riêng`, s.length > 120 && /Cách|quy trình/.test(s));
}
{
  const s = loiDanTheoKieu({ kieu: "duoi", doChac: 0.5, vi: "test" });
  t("độ chắc thấp → dặn mô hình coi là gợi ý mờ", /MỜ/.test(s));
}
{
  const sys = prompts.buildGuideSystem({ subject: "Toan", grade: "10", language: "vi", nodeLabel: "Mệnh đề", question: "?", attempts: 2, stage: "guide", hasMemory: true, tinhHuong: { kieu: "thu_may", doChac: 0.9, vi: "đòi đáp án 2 lần" } });
  t("system prompt chứa khối THỬ HỆ THỐNG", /THỬ HỆ THỐNG/.test(sys));
  t("khối tình huống đứng SAU khối 'CÁCH NÓI'", sys.indexOf("CÁCH NÓI") < sys.indexOf("THỬ HỆ THỐNG"));
  const sys0 = prompts.buildGuideSystem({ subject: "Toan", grade: "10", language: "vi", nodeLabel: "Mệnh đề", question: "?", attempts: 2, stage: "guide", hasMemory: true });
  t("không có tình huống → không có khối", !/TÌNH HUỐNG ĐỌC ĐƯỢC/.test(sys0));
}

console.log("── Bậc thang soạn sẵn NHƯỜNG tình huống (replay 04/09: thử máy 3 lượt cùng câu 'gán x=0') ──");
{
  const base = { subject: "Toan", grade: "10", language: "vi", nodeLabel: "Mệnh đề", question: "?", attempts: 2, stage: "guide", hasMemory: true, rungQuestion: "Thử gán x=0 xem câu đó đúng hay sai?" };
  const sThu = prompts.buildGuideSystem({ ...base, tinhHuong: { kieu: "thu_may", doChac: 1, vi: "t" } });
  t("thử máy: KHÔNG còn 'HÃY DẪN DẮT theo đúng ý câu gợi mở'", !/HÃY DẪN DẮT theo đúng ý/.test(sThu));
  t("thử máy: thang chỉ còn là tuỳ chọn", /ƯU TIÊN xử lý tình huống/.test(sThu));
  const sCk = prompts.buildGuideSystem({ ...base, tinhHuong: { kieu: "chinh_kien", doChac: 0.8, vi: "t" } });
  t("chính kiến: vẫn nhận thang soạn sẵn", /HÃY DẪN DẮT theo đúng ý/.test(sCk));
  const s0 = prompts.buildGuideSystem(base);
  t("không tình huống: thang như cũ", /HÃY DẪN DẮT theo đúng ý/.test(s0));
  t("có luật 'chỉ viết lời nói với bạn ấy' chống lộ suy nghĩ nội bộ", /CHỈ VIẾT LỜI NÓI VỚI BẠN ẤY/.test(s0));
}

console.log("── Khối 'bẫy' hạ giọng khi có tình huống đặc biệt (replay 04/09: em đùa 4 lượt, sư tử chỉ hỏi về x) ──");
{
  const base = { subject: "Toan", grade: "10", language: "vi", nodeLabel: "Mệnh đề", question: "?", attempts: 2, stage: "guide", hasMemory: true, misconception: "Nhầm mệnh đề chứa biến với mệnh đề" };
  const sDua = prompts.buildGuideSystem({ ...base, tinhHuong: { kieu: "dua", doChac: 0.9, vi: "t" } });
  t("đùa: KHÔNG còn 'Câu hỏi duy nhất của lượt này phải nhắm THẲNG'", !/phải\s+nhắm THẲNG/.test(sDua));
  t("đùa: bẫy thành đích đến sau khi kéo về", /KHI kéo được bạn ấy về bài/.test(sDua));
  const sCk = prompts.buildGuideSystem({ ...base, tinhHuong: { kieu: "chinh_kien", doChac: 0.8, vi: "t" } });
  t("chính kiến: khối bẫy vẫn nguyên", /phải\s+nhắm THẲNG/.test(sCk));
  const s0 = prompts.buildGuideSystem(base);
  t("không tình huống: khối bẫy như cũ", /phải\s+nhắm THẲNG/.test(s0));
}

console.log(`\n${pass} đạt · ${fail} trượt`);
process.exit(fail ? 1 : 0);
