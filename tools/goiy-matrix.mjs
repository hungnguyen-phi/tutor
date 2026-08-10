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

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
