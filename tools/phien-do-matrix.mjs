/**
 * BỘ KIỂM GÓI "BUỔI HỌC ĐANG DỞ" — chạy: node tools/phien-do-matrix.mjs
 *
 * Vì sao có (14/08): gói này là thứ duy nhất đứng giữa "văng một cái" và "mất
 * cả buổi học". Nó đọc từ localStorage — nơi dữ liệu có thể cũ (bản app trước),
 * hỏng (ghi dở lúc tab bị giết), hoặc bị sửa tay. Một gói méo lọt lưới thì
 * không phải hiện sai một dòng chữ: em bấm "Học tiếp" và rơi vào buổi học dựng
 * sai — mất đúng cái ta định cứu.
 *
 * Luật gốc của bộ kiểm: THÀ KHÔNG MỜI CÒN HƠN DỰNG MỘT BUỔI MÉO. Mọi ca nghi
 * ngờ phải trả `null` (lộ trình như thường), trừ hai ca cố ý cứu:
 *   · `qi` tràn mảng — văng đúng lúc đang đóng buổi ⇒ kẹp về câu cuối;
 *   · đồng hồ máy chạy lùi — tuổi gói âm ⇒ vẫn nhận, đừng vứt buổi của em vì
 *     một cái đồng hồ lệch.
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

const src = fs.readFileSync(path.join(HERE, "../apps/web/lib/phien-do.ts"), "utf8");
fs.writeFileSync(
  path.join(OUT, "phien-do.mjs"),
  ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText,
);
const { docTuChuoi, dongGoi, cauDangLam, khoaPhien, BAN_GOI, HAN_MS, TRAN_LOI } = await import(
  pathToFileURL(path.join(OUT, "phien-do.mjs")).href
);

let dat = 0;
let truot = 0;
const tc = (ten, thay, mong) => {
  const a = JSON.stringify(thay);
  const b = JSON.stringify(mong);
  if (a === b) {
    console.log(`  ✓ ${ten}`);
    dat++;
    return;
  }
  console.log(`  ✗ ${ten}\n      mong: ${b}\n      thấy: ${a}`);
  truot++;
};

const NOW = 1_760_000_000_000; // mốc cố định — bộ kiểm không được phụ thuộc giờ chạy
const cau = (id, extra = {}) => ({ id, nodeKey: "KC-01", tier: 1, dok: 1, doKho: "TB", kind: "objective", prompt: `Đề ${id}`, ...extra });

/** Gói CHUẨN — mọi ca hỏng bên dưới đều là bản này bị bẻ một chỗ. */
const goiChuan = (sua = {}) => ({
  v: BAN_GOI,
  luuLuc: NOW - 60_000,
  daHocMs: 8 * 60_000,
  subject: "Toan",
  ses: {
    sessionId: "ses-1",
    kgVersionId: "kgv-1",
    node: "KC-01",
    questions: [cau("q1"), cau("q2"), cau("q3")],
  },
  qi: 1,
  earned: 25,
  sai: ["q1"],
  tiem: [],
  nhanTiem: null,
  loi: [{ role: "tutor", text: "Em thử nghĩ xem…" }],
  ...sua,
});
const chuoi = (o) => JSON.stringify(o);

console.log("\n── 1. Ca hỏng PHẢI trả null (không mời học tiếp) ──");
tc("không có gói", docTuChuoi(null, NOW), null);
tc("chuỗi rỗng", docTuChuoi("", NOW), null);
tc("JSON hỏng (ghi dở lúc tab bị giết)", docTuChuoi('{"v":1,"ses":', NOW), null);
tc("JSON hợp lệ nhưng không phải object", docTuChuoi('"xin chao"', NOW), null);
tc("null literal", docTuChuoi("null", NOW), null);
tc("bản gói cũ (v khác)", docTuChuoi(chuoi(goiChuan({ v: 0 })), NOW), null);
tc("thiếu luuLuc", docTuChuoi(chuoi(goiChuan({ luuLuc: undefined })), NOW), null);
tc("quá hạn 1ms", docTuChuoi(chuoi(goiChuan({ luuLuc: NOW - HAN_MS - 1 })), NOW), null);
tc("thiếu subject", docTuChuoi(chuoi(goiChuan({ subject: "" })), NOW), null);
tc("thiếu ses", docTuChuoi(chuoi(goiChuan({ ses: null })), NOW), null);
tc(
  "thiếu sessionId — nối lại kiểu gì cũng phải mở buổi mới, thà đừng mời",
  docTuChuoi(chuoi(goiChuan({ ses: { ...goiChuan().ses, sessionId: "" } })), NOW),
  null,
);
tc(
  "buổi rỗng câu",
  docTuChuoi(chuoi(goiChuan({ ses: { ...goiChuan().ses, questions: [] } })), NOW),
  null,
);
tc(
  "một câu hỏng (mất id) ⇒ bỏ CẢ gói, vì qi sẽ trỏ nhầm câu",
  docTuChuoi(
    chuoi(goiChuan({ ses: { ...goiChuan().ses, questions: [cau("q1"), { prompt: "mất id" }, cau("q3")] } })),
    NOW,
  ),
  null,
);
tc(
  "questions không phải mảng",
  docTuChuoi(chuoi(goiChuan({ ses: { ...goiChuan().ses, questions: "q1,q2" } })), NOW),
  null,
);

console.log("\n── 2. Hai ca CỐ Ý cứu ──");
tc(
  "qi tràn mảng (văng lúc đang đóng buổi) ⇒ kẹp về câu cuối",
  docTuChuoi(chuoi(goiChuan({ qi: 3 })), NOW)?.qi,
  2,
);
tc("qi âm ⇒ về 0", docTuChuoi(chuoi(goiChuan({ qi: -5 })), NOW)?.qi, 0);
tc("qi lẻ (1.7) ⇒ làm tròn xuống", docTuChuoi(chuoi(goiChuan({ qi: 1.7 })), NOW)?.qi, 1);
tc(
  "đồng hồ máy chạy lùi (gói ở tương lai) ⇒ VẪN nhận",
  docTuChuoi(chuoi(goiChuan({ luuLuc: NOW + 5 * 60_000 })), NOW)?.qi,
  1,
);

console.log("\n── 3. Gói lành: đọc ra ĐÚNG chỗ em đang đứng ──");
const ok = docTuChuoi(chuoi(goiChuan()), NOW);
tc("sessionId giữ nguyên (nối lại đúng hàng learning_sessions)", ok?.ses.sessionId, "ses-1");
tc("số câu", ok?.ses.questions.length, 3);
tc("qi", ok?.qi, 1);
tc("earned", ok?.earned, 25);
tc("đã học (ms)", ok?.daHocMs, 8 * 60_000);
tc("câu từng sai", ok?.sai, ["q1"]);
tc("còn hạn sát nút (đúng HAN_MS)", docTuChuoi(chuoi(goiChuan({ luuLuc: NOW - HAN_MS })), NOW)?.qi, 1);

console.log("\n── 4. Trường rác thì DỌN, không làm hỏng cả gói ──");
tc("earned âm ⇒ 0", docTuChuoi(chuoi(goiChuan({ earned: -50 })), NOW)?.earned, 0);
tc("earned không phải số ⇒ 0", docTuChuoi(chuoi(goiChuan({ earned: "nhiều" })), NOW)?.earned, 0);
tc("daHocMs âm ⇒ 0", docTuChuoi(chuoi(goiChuan({ daHocMs: -1 })), NOW)?.daHocMs, 0);
tc("daHocMs thiếu ⇒ 0", docTuChuoi(chuoi(goiChuan({ daHocMs: undefined })), NOW)?.daHocMs, 0);
tc("sai lẫn rác ⇒ lọc", docTuChuoi(chuoi(goiChuan({ sai: ["q1", 7, null, "q2"] })), NOW)?.sai, ["q1", "q2"]);
tc("sai không phải mảng ⇒ []", docTuChuoi(chuoi(goiChuan({ sai: "q1" })), NOW)?.sai, []);
tc(
  "lời thiếu text ⇒ lọc",
  docTuChuoi(chuoi(goiChuan({ loi: [{ role: "tutor" }, { role: "student", text: "dạ" }] })), NOW)?.loi,
  [{ role: "student", text: "dạ" }],
);
tc(
  "câu vá nền hỏng ⇒ lọc, buổi vẫn nối được",
  docTuChuoi(chuoi(goiChuan({ tiem: [cau("nen-1"), { prompt: "mất id" }] })), NOW)?.tiem.length,
  1,
);
tc("nhanTiem rác ⇒ null", docTuChuoi(chuoi(goiChuan({ nhanTiem: 42 })), NOW)?.nhanTiem, null);
tc(
  "kgVersionId thiếu ⇒ chuỗi rỗng (không dùng để chấm, không đáng bỏ buổi)",
  docTuChuoi(chuoi(goiChuan({ ses: { ...goiChuan().ses, kgVersionId: undefined } })), NOW)?.ses.kgVersionId,
  "",
);

console.log("\n── 5. Đóng gói ──");
const goi = dongGoi({
  subject: "Anh",
  ses: goiChuan().ses,
  qi: 2,
  earned: 10,
  sai: [],
  tiem: [],
  nhanTiem: null,
  loi: Array.from({ length: TRAN_LOI + 15 }, (_, i) => ({ role: "tutor", text: `lời ${i}` })),
  batDauLuc: NOW - 12 * 60_000,
  now: NOW,
});
tc("daHocMs = now − lúc bắt đầu", goi.daHocMs, 12 * 60_000);
tc("cắt đuôi lời theo trần", goi.loi.length, TRAN_LOI);
tc("giữ lời MỚI NHẤT (không phải lời đầu buổi)", goi.loi[goi.loi.length - 1].text, `lời ${TRAN_LOI + 14}`);
tc(
  "chưa có mốc bắt đầu ⇒ daHocMs 0 (không đoán bừa thời gian học)",
  dongGoi({ ...goi, loi: [], batDauLuc: null, now: NOW }).daHocMs,
  0,
);
tc("đóng rồi đọc lại ⇒ nguyên vẹn", docTuChuoi(chuoi(goi), NOW)?.qi, 2);

console.log("\n── 6. Câu đang làm + khoá theo người dùng ──");
tc(
  "đang vá nền ⇒ câu tiêm trên cùng (không phải câu chính)",
  cauDangLam(docTuChuoi(chuoi(goiChuan({ tiem: [cau("nen-1"), cau("nen-2")] })), NOW))?.id,
  "nen-2",
);
tc("không vá nền ⇒ câu chính theo qi", cauDangLam(docTuChuoi(chuoi(goiChuan()), NOW))?.id, "q2");
tc("khoá mang uid — máy dùng chung không lẫn buổi", khoaPhien("u-123"), "tutor:phien-do:u-123");
tc("hai người ⇒ hai khoá", khoaPhien("a") === khoaPhien("b"), false);

console.log(`\n${truot === 0 ? "✅" : "❌"} ĐẠT ${dat} · TRƯỢT ${truot}\n`);
process.exit(truot === 0 ? 0 : 1);
