/**
 * BỘ KIỂM LUẬT GỢI Ý — chạy: node tools/goiy-matrix.mjs
 *
 * Lỗi #27, và là thứ người thử 1 chọn khi được hỏi *nếu chỉ được sửa MỘT thứ*:
 * "Sư tử nên có các gợi ý tăng cấp độ hướng dẫn lên và đừng hiển thị một gợi ý
 * giống nhau hai ba lần."
 *
 * Bốn thứ phải đúng cùng lúc, và chúng kéo ngược nhau:
 *   1. KHÔNG LẶP — đã trao bậc nào thì lượt sau phải là bậc mới.
 *   2. KHÔNG LÙI — không bao giờ trả về bậc thấp hơn bậc đã trao. (Thang đi từ
 *      ít đỡ tới nhiều đỡ, nên lùi = rút giàn giáo khỏi đúng em đang kẹt nhất.)
 *   3. BẤM MÒ KHÔNG MUA ĐƯỢC ĐÁY — cứ bấm sai liên tục thì leo hết thang là
 *      hết, đáy phải do nỗ lực thật hoặc do đã nhận đủ mọi gợi ý mới mở.
 *   4. THANG MỚI BẮT ĐẦU LẠI TỪ BẬC 1 — em sai sang quan niệm sai khác thì đó
 *      là nội dung khác, không được nhảy vào giữa.
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

const src = fs.readFileSync(path.join(HERE, "../supabase/functions/_shared/pedagogy.ts"), "utf8")
  .replace(/from "\.\/(\w[\w-]*)\.ts"/g, 'from "./$1.mjs"');
fs.writeFileSync(
  path.join(OUT, "pedagogy.mjs"),
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText,
);
const { chonBacGoiY, evaluateEffortGate, tinhVanNoLuc } = await import(pathToFileURL(path.join(OUT, "pedagogy.mjs")).href);

const psrc = fs.readFileSync(path.join(HERE, "../supabase/functions/_shared/prompts.ts"), "utf8")
  .replace(/from "\.\/(\w[\w-]*)\.ts"/g, 'from "./$1.mjs"');
fs.writeFileSync(
  path.join(OUT, "prompts.mjs"),
  ts.transpileModule(psrc, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText,
);
const { buildGuideSystem, buildGuideUser } = await import(pathToFileURL(path.join(OUT, "prompts.mjs")).href);

let dat = 0, truot = 0;
const tc = (ten, thay, mong) => {
  if (thay === mong) { console.log(`  ✓ ${ten}`); dat++; return; }
  console.log(`  ✗ ${ten} — mong ${mong}, thấy ${thay}`);
  truot++;
};
const bac = (o) => chonBacGoiY({ exhausted: false, choPhepDay: true, totalRungs: 4, ...o });

console.log("── Em bấm sai liên tiếp, KHÔNG kể gì (engaged = 0) ──");
console.log("   Đây đúng kịch bản người thử gặp: ba gợi ý y hệt nhau.");
tc("lượt 1 — chưa trao gì → bậc 1", bac({ engaged: 0, bacDaTrao: [] }), 0);
tc("lượt 2 — đã trao bậc 1 → bậc 2", bac({ engaged: 0, bacDaTrao: [0] }), 1);
tc("lượt 3 — đã trao 1,2 → bậc 3", bac({ engaged: 0, bacDaTrao: [0, 1] }), 2);
tc("lượt 4 — đã trao 1,2,3 → bậc 4", bac({ engaged: 0, bacDaTrao: [0, 1, 2] }), 3);
tc("lượt 5 — hết thang → xuống đáy, KHÔNG lặp bậc 4",
  bac({ engaged: 0, bacDaTrao: [0, 1, 2, 3] }), 4);

console.log("\n── Không bao giờ LÙI ──");
tc("engaged tụt về 0 mà đã trao tới bậc 3 → vẫn bậc 4",
  bac({ engaged: 0, bacDaTrao: [0, 1, 2] }), 3);
tc("dấu vết lộn xộn (trao 3 trước 2) → vẫn lấy cao nhất + 1",
  bac({ engaged: 0, bacDaTrao: [2, 0] }), 3);

console.log("\n── Em CÓ kể cách nghĩ thì được đi nhanh hơn ──");
tc("engaged 2, chưa trao gì → bậc 3 (không bắt bò từ bậc 1)",
  bac({ engaged: 2, bacDaTrao: [] }), 2);
tc("engaged 4 → chạm đáy bằng nỗ lực thật", bac({ engaged: 4, bacDaTrao: [] }), 4);

console.log("\n── Bấm mò KHÔNG mua được đáy ──");
const dayMoRa = (o) => evaluateEffortGate({
  attempts: 9, thinkingQuality: 1, totalRungs: 4, minAttempts: 2,
  currentRung: bac(o),
}).action;
tc("chưa trao hết thang, engaged 0 → vẫn là advance_rung",
  dayMoRa({ engaged: 0, bacDaTrao: [0, 1] }), "advance_rung");
tc("nhánh ĐỐI THOẠI không bao giờ chạm đáy dù đã trao hết",
  chonBacGoiY({ engaged: 9, bacDaTrao: [0, 1, 2, 3], totalRungs: 4, exhausted: true, choPhepDay: false }), 3);

console.log("\n── Thang MỚI (quan niệm sai khác) bắt đầu lại từ bậc 1 ──");
console.log("   Nơi gọi lọc bacDaTrao theo thangId, nên thang mới vào đây là mảng rỗng.");
tc("thang mới, em đã leo hết thang cũ → vẫn bậc 1", bac({ engaged: 0, bacDaTrao: [] }), 0);

console.log("\n── Van xả: kẹt quá lâu ──");
tc("exhausted → mở đáy dù chưa trao gì",
  chonBacGoiY({ engaged: 0, bacDaTrao: [], totalRungs: 4, exhausted: true, choPhepDay: true }), 4);

console.log("\n── Thang chỉ có 1 bậc (dữ liệu xấu) không được vòng vô tận ──");
tc("thang 1 bậc, chưa trao → bậc 1",
  chonBacGoiY({ engaged: 0, bacDaTrao: [], totalRungs: 1, exhausted: false, choPhepDay: true }), 0);
tc("thang 1 bậc, đã trao → xuống đáy",
  chonBacGoiY({ engaged: 0, bacDaTrao: [0], totalRungs: 1, exhausted: false, choPhepDay: true }), 1);

// ── VAN NỖ LỰC ────────────────────────────────────────────────────────────────
// `tinhVanNoLuc` quyết định CẢ HAI: bậc thang (cộng vào `engaged`) và cổng nỗ
// lực (nơi gọi dùng ">0" để nâng thinkingQuality lên đúng ngưỡng 0.5). Bản viết
// tay đầu tiên nằm lẫn trong thân request handler và lệch ngưỡng — 1 thay vì 2 —
// nên MỘT câu bất kỳ sau lần thử cuối đã mở luôn vế "diễn đạt lý lẽ". Không bộ
// kiểm nào với tới vì nó không phải hàm thuần. Nay nó là, và đây là hàng rào.
const van = (ketThatLienTiep, luotNoiSauLanThuCuoi) =>
  tinhVanNoLuc({ ketThatLienTiep, luotNoiSauLanThuCuoi });

console.log("\n── Van nỗ lực: NGƯỠNG LÀ 2 LƯỢT NÓI, không phải 1 ──");
tc("chưa nói lượt nào → đóng", van(0, 0), 0);
tc("mới nói 1 lượt → VẪN ĐÓNG (đây là chỗ từng sai)", van(0, 1), 0);
tc("nói 2 lượt → mở", van(0, 2), 1);
tc("nói 5 lượt → vẫn chỉ mở 1 nấc, không cộng dồn", van(0, 5), 1);

console.log("\n── Van cũ (xin giúp liên tiếp) vẫn nguyên tác dụng ──");
tc("kẹt thật 1, chưa nói lượt nào → mở theo đường cũ", van(1, 0), 1);
tc("kẹt thật 3 → lấy đúng số của đường cũ", van(3, 0), 3);
tc("kẹt thật 3 + nói 2 lượt → lấy đường RỘNG hơn", van(3, 2), 3);
tc("kẹt thật 0 + nói 2 → đường mới thắng", van(0, 2), 1);

console.log("\n── Đầu vào rác không được đẻ ra nỗ lực âm ──");
tc("ketThat âm (dữ liệu xấu) → 0", van(-2, 0), 0);
tc("ketThat âm nhưng đã nói đủ → vẫn mở 1", van(-2, 2), 1);

// ── CỔNG "CHƯA THỬ LẦN NÀO" KHÔNG ĐƯỢC LỘ ĐỀ ─────────────────────────────────
// Chủ dự án bắt tại trận 11/08: em chưa chọn phương án nào, bấm xin gợi ý, và
// sư tử dẫn thẳng vào phương án A của đề. Cổng tất định đã chặn đúng — chỗ rò
// là SYSTEM PROMPT: mô hình vẫn cầm nguyên đề bài kèm bốn phương án. Luật nay
// là "không đưa thì không lộ được", và đây là hàng rào giữ nó.
const DE_BAI = "Câu nào sau đây là một mệnh đề? A. Số 7 là số nguyên tố. "
  + "B. Bạn có khoẻ không? C. Hãy đóng cửa lại! D. x+3=5.";
const nen = (stage) => buildGuideSystem({
  subject: "Toan", grade: "10", language: "vi",
  nodeLabel: "Khái niệm mệnh đề logic", question: stage === "must_try" ? "" : DE_BAI,
  attempts: stage === "must_try" ? 0 : 2, stage,
});

console.log("\n── must_try: mô hình KHÔNG được cầm đề bài ──");
const sMust = nen("must_try");
// Bắt thẻ ĐÓNG: tên `<de_bai>` còn xuất hiện trong luật chống tiêm lệnh của
// BASE (liệt kê các thẻ là DỮ LIỆU), nên tìm thẻ mở là dương tính giả.
tc("không có khối <de_bai>…</de_bai>", sMust.includes("</de_bai>"), false);
tc("không lộ phương án A", sMust.includes("Số 7 là số nguyên tố"), false);
tc("không lộ phương án D", sMust.includes("x+3=5"), false);
tc("có luật cứng 'CHƯA THỬ LẦN NÀO'", sMust.includes("CHƯA THỬ LẦN NÀO"), true);
tc("có dặn không bịa đề", sMust.includes("đừng bịa"), true);

console.log("\n── các bậc sau vẫn được cầm đề (không siết nhầm) ──");
for (const st of ["need_think", "guide"]) {
  const s2 = nen(st);
  tc(`${st}: có khối <de_bai>…</de_bai>`, s2.includes("</de_bai>"), true);
  tc(`${st}: có nội dung đề`, s2.includes("Số 7 là số nguyên tố"), true);
  tc(`${st}: KHÔNG dính luật must_try`, s2.includes("CHƯA THỬ LẦN NÀO"), false);
}

// ── ĐÁP ÁN EM ĐANG CHỌN PHẢI TỚI ĐƯỢC SƯ TỬ (13/08) ──────────────────────────
// Lỗi chủ dự án báo: chọn xong một phương án rồi bấm "Xin gợi ý", sư tử đáp một
// câu rập khuôn "chọn một đáp án trước nhé" — như thể màn hình còn trống. Hai
// gốc: (a) lượt đối thoại không mang theo lựa chọn, (b) `must_try` dùng chung
// một lời dặn cho cả ca ĐÃ THỬ RỒI. Cổng nỗ lực KHÔNG đổi, chỉ lời nói phải khớp.
const nen2 = (o) => buildGuideSystem({
  subject: "Toan", grade: "10", language: "vi",
  nodeLabel: "Khái niệm mệnh đề logic",
  question: o.stage === "must_try" ? "" : DE_BAI,
  ...o,
});

console.log("\n── must_try khi em ĐÃ THỬ: không được bảo 'chọn đáp án trước' ──");
const sDaThu = nen2({ stage: "must_try", attempts: 1, dangChon: true });
tc("KHÔNG dính luật 'CHƯA THỬ LẦN NÀO'", sDaThu.includes("CHƯA THỬ LẦN NÀO"), false);
tc("có luật ca đã thử", sDaThu.includes("ĐÃ THỬ 1 lần"), true);
tc("có dặn bám vào <dang_chon>", sDaThu.includes("<dang_chon>"), true);
tc("vẫn KHÔNG cầm đề bài", sDaThu.includes("</de_bai>"), false);
tc("vẫn cấm gợi ý", sDaThu.includes("KHÔNG gợi ý"), true);

console.log("\n── must_try khi em CHƯA thử: cờ dang_chon cũng bị bỏ ──");
const sChuaThu = nen2({ stage: "must_try", attempts: 0, dangChon: true });
tc("giữ luật cứng 'CHƯA THỬ LẦN NÀO'", sChuaThu.includes("CHƯA THỬ LẦN NÀO"), true);
tc("KHÔNG nhắc <dang_chon>", sChuaThu.includes("<dang_chon>"), false);

console.log("\n── các bậc sau: có lựa chọn thì phải bám vào nó ──");
for (const st of ["need_think", "guide"]) {
  const s3 = nen2({ stage: st, attempts: 2, dangChon: true });
  tc(`${st}: có dặn bám <dang_chon>`, s3.includes("<dang_chon>"), true);
  tc(`${st}: vẫn cấm nói đúng/sai`, s3.includes("không được nói lựa chọn đó đúng hay sai"), true);
  const s4 = nen2({ stage: st, attempts: 2 });
  tc(`${st}: không có lựa chọn → không in thẻ rỗng`, s4.includes("<dang_chon>"), false);
}

// ── GỢI Ý PHẢI TRÚNG CHỖ, KHÔNG ĐƯỢC MÔNG LUNG (13/08) ───────────────────────
// Chủ dự án: "AI gợi ý vẫn cứ là mông lung". Gốc: đường đối thoại không hề biết
// em dính bẫy nào (không đối chiếu distractor, lại luôn lấy thang ĐẦU của node),
// nên mô hình chỉ hỏi được câu chung chung. Nay có chẩn đoán thì phải kèm lời
// dặn LÀM GÌ với nó — nêu suông thì mô hình vẫn trả về câu vô thưởng vô phạt.
const BAY = "Nhầm mệnh đề với câu hỏi vì thấy có dấu chấm hỏi";
console.log("\n── có chẩn đoán bẫy: bắt hỏi CỤ THỂ, cấm hỏi chung chung ──");
for (const st of ["need_think", "guide"]) {
  const sb = nen2({ stage: st, attempts: 2, misconception: BAY, dangChon: true });
  tc(`${st}: có chẩn đoán trong prompt`, sb.includes(BAY), true);
  tc(`${st}: bắt bám dữ kiện cụ thể`, sb.includes("BÁM VÀO MỘT THỨ CỤ THỂ"), true);
  tc(`${st}: cấm câu hỏi chung chung`, sb.includes("CẤM câu hỏi chung chung"), true);
  tc(`${st}: vẫn cấm đọc tên bẫy ra`, sb.includes("không đọc tên cái bẫy ra"), true);
}
const sbMust = nen2({ stage: "must_try", attempts: 1, misconception: BAY });
tc("must_try: KHÔNG kèm lời dặn nhắm bẫy (chưa được gợi ý)",
  sbMust.includes("BÁM VÀO MỘT THỨ CỤ THỂ"), false);

console.log("\n── luật độ dài: 2 câu, dưới 40 từ ──");
tc("có luật độ dài cứng", nen2({ stage: "guide", attempts: 2 }).includes("DƯỚI 40 TỪ"), true);
tc("luật độ dài có cả ở lượt không phải đối thoại",
  nen2({ attempts: 0 }).includes("DƯỚI 40 TỪ"), true);

console.log("\n── lượt user: lựa chọn đi đường DỮ LIỆU, không vào system ──");
const u = buildGuideUser({ studentSaid: "mình chưa biết làm", dangChon: "B. Số 9 là số nguyên tố" });
tc("có thẻ <dang_chon>", u.includes("<dang_chon>B. Số 9 là số nguyên tố</dang_chon>"), true);
tc("thẻ <dang_chon> đứng TRƯỚC <hoc_sinh>", u.indexOf("<dang_chon>") < u.indexOf("<hoc_sinh>"), true);
tc("không truyền thì không có thẻ", buildGuideUser({ studentSaid: "x" }).includes("dang_chon"), false);

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
