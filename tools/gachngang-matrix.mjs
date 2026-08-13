/**
 * BỘ KIỂM "CẤM GẠCH NGANG" — chạy: node tools/gachngang-matrix.mjs
 *
 * Chủ dự án 13/08: "con AI lúc nào cũng trả lời có gạch ngang, cấm hẳn luôn
 * cho tôi." System prompt đã cấm từ 30/07 mà mô hình vẫn viết, nên nay chặn ở
 * tầng mã (`supabase/functions/_shared/text.ts`).
 *
 * Hai thứ phải đúng CÙNG LÚC, và chúng kéo ngược nhau:
 *   1. SẠCH — không còn dấu gạch nào đọc ra như dấu câu.
 *   2. KHÔNG PHÁ TOÁN — dấu trừ trong công thức là dấu trừ, không phải gạch
 *      ngang. Đây là chỗ dễ hỏng nhất: cắt bừa là mọi bài toán vỡ hết, mà lỗi
 *      chỉ lộ ra trên màn học sinh chứ không ai thấy lúc sửa.
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

const src = fs.readFileSync(path.join(HERE, "../supabase/functions/_shared/text.ts"), "utf8");
fs.writeFileSync(
  path.join(OUT, "text.mjs"),
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText,
);
const { boGachNgang, boGachDai } = await import(pathToFileURL(path.join(OUT, "text.mjs")).href);

let dat = 0, truot = 0;
const tc = (ten, thay, mong) => {
  if (thay === mong) { console.log(`  ✓ ${ten}`); dat++; return; }
  console.log(`  ✗ ${ten}\n      mong : ${JSON.stringify(mong)}\n      thấy : ${JSON.stringify(thay)}`);
  truot++;
};

console.log("── Gạch dài trong câu → dấu phẩy ──");
tc("giữa câu",
  boGachNgang("Chính xác — làm tốt lắm!"), "Chính xác, làm tốt lắm!");
tc("câu soạn tay của cổng nỗ lực",
  boGachNgang("Cảm ơn bạn đã kể! Giờ bạn chọn một đáp án trước nhé — thử mới biết mình vướng ở đâu."),
  "Cảm ơn bạn đã kể! Giờ bạn chọn một đáp án trước nhé, thử mới biết mình vướng ở đâu.");
tc("gạch trung (–) cũng bị bắt",
  boGachNgang("Được chứ – mình cùng nghĩ nhé."), "Được chứ, mình cùng nghĩ nhé.");
tc("sau dấu câu thì KHÔNG đẻ ra phẩy kép",
  boGachNgang("Chưa tới rồi, mình đoán bạn đang vội — thử chậm lại nhé."),
  "Chưa tới rồi, mình đoán bạn đang vội, thử chậm lại nhé.");
tc("gạch đứng ngay trước dấu chấm hỏi",
  boGachNgang("Bạn chọn B — vì sao?"), "Bạn chọn B, vì sao?");
tc("gạch mở đầu câu bị bỏ hẳn",
  boGachNgang("— Bạn thử lại nhé."), "Bạn thử lại nhé.");
tc("gạch cuối câu bị bỏ hẳn (không tự chế thêm dấu chấm)",
  boGachNgang("Bạn thử lại nhé —"), "Bạn thử lại nhé");
tc("gạch đầu dòng bị bỏ",
  boGachNgang("- Bạn dựa vào đâu?\n- Bước nào trước?"), "Bạn dựa vào đâu?\nBước nào trước?");
tc("không còn ký tự — nào sót lại",
  /[—–]/.test(boGachNgang("A — B – C — D")), false);

console.log("\n── KHÔNG được phá công thức toán ──");
tc("dấu trừ trong $…$ giữ nguyên",
  boGachNgang("Ta có $x - 3 = 0$ nhé."), "Ta có $x - 3 = 0$ nhé.");
tc("phân số âm giữ nguyên",
  boGachNgang("Thử $\\frac{-b}{2a}$ xem — bạn thấy gì?"),
  "Thử $\\frac{-b}{2a}$ xem, bạn thấy gì?");
tc("hai công thức trong một câu",
  boGachNgang("So $a - b$ với $b - a$ — khác nhau chỗ nào?"),
  "So $a - b$ với $b - a$, khác nhau chỗ nào?");
tc("toán viết TRẦN (không bọc $) cũng không bị đụng",
  boGachNgang("Tính 5 - 3 rồi nói mình nghe."), "Tính 5 - 3 rồi nói mình nghe.");
tc("biến một chữ cái không bị đụng",
  boGachNgang("Xét x - y trước nhé."), "Xét x - y trước nhé.");
tc("từ ghép có gạch nối giữ nguyên",
  boGachNgang("Bài Covid-19 và e-mail vẫn nguyên."), "Bài Covid-19 và e-mail vẫn nguyên.");
tc("gạch nối dùng như dấu câu thì bị đổi",
  boGachNgang("Chính xác - làm tốt lắm!"), "Chính xác, làm tốt lắm!");

console.log("\n── Bản NHẸ cho mẩu chữ rời của luồng SSE ──");
console.log("   Chỉ — và –, vì mẩu rời cắt ngang được một công thức $…$.");
tc("gạch dài vẫn bị bắt", boGachDai("Chính xác — tốt lắm"), "Chính xác, tốt lắm");
tc("KHÔNG đụng gạch nối ASCII (có thể là dấu trừ đang dở)",
  boGachDai("$x - "), "$x - ");
tc("mẩu cắt giữa công thức không bị phá",
  boGachDai("Ta có $x - 3"), "Ta có $x - 3");
tc("không đụng gạch đầu dòng (để bản đầy đủ lo)",
  boGachDai("- Bạn thử lại"), "- Bạn thử lại");

console.log("\n── Đầu vào rác không được ném lỗi ──");
tc("chuỗi rỗng", boGachNgang(""), "");
tc("null", boGachNgang(null), "");
tc("undefined", boGachDai(undefined), "");
tc("chỉ một dấu $ lẻ", boGachNgang("Giá $5 — rẻ."), "Giá $5, rẻ.");

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
