// Ma trận TRÍ NHỚ — khoá TRẦN TOKEN bằng máy, không bằng lời hứa.
//
// Vì sao có (29/07): bản đầu của trí nhớ gửi nguyên văn 12 lượt gần nhất. Trung
// bình chỉ ~400 token vì học sinh gõ ngắn (21 ký tự) — nhưng TRẦN là 1.031
// token. Trung bình không phải thứ để lập ngân sách: khi 500 em cùng học, cái
// quyết định hoá đơn là trần, không phải trung bình ($24 → $47/tháng).
//
// Bộ kiểm này ném dữ liệu ÁC vào (lượt dài 3.000 ký tự, 40 lượt liền, tên thật
// lặp khắp nơi) và đòi khối trí nhớ KHÔNG BAO GIỜ vượt trần.
//
// Chạy: node tools/memory-matrix.mjs
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

// Deno chỉ được chạm tới lúc nạp llm.ts (đọc env) — dựng cái vỏ trước khi import.
globalThis.Deno = globalThis.Deno ?? { env: { get: () => undefined } };

function transpile(name) {
  let src = fs.readFileSync(path.join(ROOT, name + ".ts"), "utf8");
  src = src.replace(/import\("npm:mathjs@13"\)/g, 'import("./mathjs-mock.mjs")');
  src = src.replace(/from "npm:[^"]+"/g, 'from "./npm-mock.mjs"');
  src = src.replace(/from "\.\/(\w[\w-]*)\.ts"/g, 'from "./$1.mjs"');
  fs.writeFileSync(
    path.join(OUT, name + ".mjs"),
    ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  );
}
fs.writeFileSync(path.join(OUT, "npm-mock.mjs"), "export default {};\n");
for (const m of ["llm", "memory", "prompts"]) transpile(m);

const mem = await import(pathToFileURL(path.join(OUT, "memory.mjs")).href);
const prompts = await import(pathToFileURL(path.join(OUT, "prompts.mjs")).href);

let pass = 0, fail = 0;
const t = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  → ${detail}`}`);
};

/** TRẦN — phải khớp MEM_BUDGET trong memory.ts. */
const BUDGET = 960;
const TOK = (c) => Math.round(c / 3.2); // tiếng Việt ~3,2 ký tự/token

/** Supabase giả: trả đúng thứ mỗi truy vấn cần, theo thứ tự memory.ts gọi. */
function fakeSupa({ turns = [], attempts = [], profile = [] }) {
  const chain = (rows) => {
    const o = {
      select: () => o, eq: () => o, not: () => o, order: () => o,
      limit: () => Promise.resolve({ data: rows }),
      then: (r) => Promise.resolve({ data: rows }).then(r),
    };
    return o;
  };
  let attemptCall = 0;
  return {
    from(tbl) {
      if (tbl === "session_turns") return chain(turns);
      // memory.ts gọi `attempts` HAI lần: sổ tay (câu này) rồi hồ sơ (dài hạn).
      return chain(attemptCall++ === 0 ? attempts : profile);
    },
  };
}

const long = (n, seed = "x") => (seed + " ").repeat(Math.ceil(n / 2)).slice(0, n);

// ── Ca 1: bình thường ────────────────────────────────────────────────────────
{
  const turns = [
    { role: "tutor", content: "Bạn thử nghĩ xem mệnh đề cần tính chất gì?", meta: { questionId: "q" } },
    { role: "student", content: "câu mang tính khẳng định", meta: { questionId: "q" } },
    { role: "tutor", content: "Đúng hướng rồi! Vậy câu nào là khẳng định?", meta: { questionId: "q" } },
    { role: "student", content: "D", meta: { questionId: "q" } },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns, attempts: [
    { raw_answer: "A", is_correct: false, matched_misconception: "nhầm câu cầu khiến" },
    { raw_answer: "C", is_correct: false, matched_misconception: "nhầm câu cảm thán" },
  ] }), { sessionId: "s", studentId: "u", questionId: "q", names: [] });
  t("bình thường: dưới trần", m.size <= BUDGET, `${m.size} ký tự`);
  t("bình thường: nhớ được em ĐÃ kể", m.soTay.includes("ĐÃ kể"), m.soTay);
  t("bình thường: nhớ được em sai phương án nào", m.soTay.includes("A") && m.soTay.includes("C"), m.soTay);
  t("bình thường: giữ lượt gần nhất nguyên văn", m.lichSu.includes("khẳng định"), m.lichSu);
  console.log(`   → ${m.size} ký tự ≈ ${TOK(m.size)} token`);
}

// ── Ca 2: DỮ LIỆU ÁC — 40 lượt, mỗi lượt 3.000 ký tự ────────────────────────
{
  const turns = [];
  for (let i = 0; i < 40; i++) {
    turns.push({ role: i % 2 ? "student" : "tutor", content: long(3000, "dài" + i), meta: { questionId: "q" } });
  }
  const attempts = Array.from({ length: 20 }, (_, i) => ({
    raw_answer: long(500, "đáp" + i), is_correct: false, matched_misconception: long(400, "sai" + i),
  }));
  const profile = Array.from({ length: 150 }, (_, i) => ({ matched_misconception: long(300, "qn" + (i % 6)) }));
  const m = await mem.buildMemory(fakeSupa({ turns: turns.reverse(), attempts, profile }),
    { sessionId: "s", studentId: "u", questionId: "q", names: [] });
  t("ÁC: vẫn dưới trần", m.size <= BUDGET, `${m.size} ký tự — VỠ TRẦN`);
  t("ÁC: từng lớp không vượt phần của nó",
    m.soTay.length <= 300 && m.hoSo.length <= 140 && m.lichSu.length <= 520,
    `soTay ${m.soTay.length} · hoSo ${m.hoSo.length} · lichSu ${m.lichSu.length}`);
  console.log(`   → ${m.size} ký tự ≈ ${TOK(m.size)} token (trần ${BUDGET} ≈ ${TOK(BUDGET)})`);
}

// ── Ca 3: cửa cuối (buildGuideUser) cũng phải siết ──────────────────────────
{
  const u = prompts.buildGuideUser({
    hoSo: long(5000), soTay: long(5000), lichSu: long(5000), studentSaid: long(5000),
  });
  // <hoc_sinh> là lời em vừa gõ, có trần riêng 1.200 — không tính vào trí nhớ.
  const memPart = u.slice(0, u.indexOf("<hoc_sinh>"));
  t("cửa cuối: khối trí nhớ bị siết dù đầu vào khổng lồ",
    memPart.length <= BUDGET + 120, `${memPart.length} ký tự`);
  console.log(`   → khối trí nhớ ${memPart.length} ký tự (kể cả thẻ) ≈ ${TOK(memPart.length)} token`);
}

// ── Ca 4: tên thật KHÔNG được lọt ra prompt ─────────────────────────────────
{
  const turns = [
    { role: "student", content: "Nguyễn Văn An nghĩ là đáp án D vì nó khẳng định được" },
    { role: "tutor", content: "Nguyễn Văn An thử đọc lại đề nhé" },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }),
    { sessionId: "s", studentId: "u", names: ["Nguyễn Văn An"] });
  const all = m.soTay + m.lichSu + m.hoSo;
  t("ẩn danh: tên thật không lọt vào lịch sử", !all.includes("Nguyễn Văn An"), all);
}

// ── Ca 5: lượt em VỪA gõ không bị đếm hai lần ───────────────────────────────
{
  const vua = "em nghĩ là do dấu trừ đứng trước";
  const turns = [
    { role: "student", content: "trước đó em nói gì đó dài dòng để tính là đã nói" },
    { role: "student", content: vua },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }),
    { sessionId: "s", studentId: "u", names: [], omitContent: vua });
  t("không đọc lời vừa gõ hai lần", !m.lichSu.includes(vua), m.lichSu);
}

// ── Ca 6: em KẸT THẬT — "chưa hiểu" liên tiếp phải đếm được ─────────────────
{
  const turns = [
    { role: "student", content: "em nghĩ là câu B vì nó hỏi được đúng sai" },
    { role: "tutor", content: "Thử so B với A xem khác nhau chỗ nào?" },
    { role: "student", content: "em chưa hiểu" },
    { role: "tutor", content: "Nhìn câu A nhé." },
    { role: "student", content: "gợi ý giúp mình với" },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }), { sessionId: "s", studentId: "u", names: [] });
  t("đếm được 2 lượt xin giúp liên tiếp", m.xinGiupLienTiep === 2, `${m.xinGiupLienTiep}`);
}
{
  // Xin giúp ở ĐẦU buổi rồi tự làm được → KHÔNG tính là đang kẹt.
  const turns = [
    { role: "student", content: "em chưa hiểu" },
    { role: "tutor", content: "Thử đọc lại đề nhé." },
    { role: "student", content: "à em hiểu rồi, tại vì câu A khẳng định được đúng sai" },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }), { sessionId: "s", studentId: "u", names: [] });
  t("xin giúp ở đầu buổi rồi gỡ được → không tính kẹt", m.xinGiupLienTiep === 0, `${m.xinGiupLienTiep}`);
}

// ── Ca 7: buổi mới tinh — không có gì để nhớ ────────────────────────────────
{
  const m = await mem.buildMemory(fakeSupa({}), { sessionId: "s", studentId: "u", names: [] });
  t("buổi trống: khối trí nhớ rỗng", m.size === 0, `${m.size}`);
  t("buổi trống: daNoi = false (đừng gọi mô hình)", m.daNoi === false, `${m.daNoi}`);
}


// ── Ca 9: TRÍ NHỚ KHÔNG ĐƯỢC TRÀN TỪ CÂU NÀY SANG CÂU KHÁC ─────────────────
// Lỗi thật 30/07: em chuyển sang câu mới, hỏi câu đầu tiên, sư tử đáp "bạn đã
// thử ba lần và vẫn ra cùng một đáp án" — chuyện của CÂU TRƯỚC. Lịch sử lúc đó
// chỉ lọc theo phiên học, không lọc theo câu. Trí nhớ mà bịa ra quá khứ không
// có thật thì tệ hơn hẳn không có trí nhớ.
{
  const turns = [
    { role: "student", content: "em chọn A vì nó khẳng định được", meta: { questionId: "q_CU" } },
    { role: "tutor", content: "Bạn đã thử ba lần và vẫn ra cùng một đáp án đó", meta: { questionId: "q_CU" } },
    { role: "student", content: "em vẫn chọn A", meta: { questionId: "q_CU" } },
    { role: "student", content: "câu nào sai ạ", meta: { questionId: "q_MOI" } },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }),
    { sessionId: "s", studentId: "u", questionId: "q_MOI", names: [] });
  t("câu mới: KHÔNG kéo theo hội thoại câu cũ",
    !m.lichSu.includes("ba lần") && !m.lichSu.includes("chọn A"), m.lichSu);
  t("câu mới: không bịa ra là em đã nói nhiều", m.daNoi === false, `daNoi=${m.daNoi}`);
}
{
  // Ngược lại: cùng một câu thì PHẢI nhớ đủ.
  const turns = [
    { role: "student", content: "em nghĩ mệnh đề là câu khẳng định được đúng sai", meta: { questionId: "q1" } },
    { role: "tutor", content: "Đúng hướng rồi, vậy câu nào là khẳng định?", meta: { questionId: "q1" } },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }),
    { sessionId: "s", studentId: "u", questionId: "q1", names: [] });
  t("cùng một câu: vẫn nhớ đủ", m.lichSu.includes("khẳng định") && m.daNoi === true, m.lichSu);
}
{
  // Trò chuyện tự do (không có câu nào) → không lọc, giữ tất cả.
  const turns = [
    { role: "student", content: "chào bạn mình muốn hỏi về bài hôm qua", meta: { questionId: "q9" } },
  ].reverse();
  const m = await mem.buildMemory(fakeSupa({ turns }), { sessionId: "s", studentId: "u", names: [] });
  t("trò chuyện tự do: không lọc theo câu", m.lichSu.includes("bài hôm qua"), m.lichSu);
}

// ── Ca 10: HỎI XIN ĐÁP ÁN ≠ TRÌNH BÀY SUY NGHĨ ─────────────────────────────
// Bộ kiểm tự bắt được 30/07: "câu nào sai ạ" đủ dài, đủ số từ, nên bản đầu tính
// là "đã kể cách nghĩ" — rồi sổ tay báo lên "bạn ấy ĐÃ kể cách nghĩ rồi" trong
// khi em mới chỉ hỏi xin đáp án.
for (const [noi, mong, vi] of [
  ["câu nào sai ạ", false, "hỏi xin đáp án"],
  ["cho em biết đáp án đi mà", false, "đòi đáp án"],
  ["em nghĩ là B vì nó khẳng định được, đúng không ạ?", true, "có lập luận + câu hỏi ở cuối"],
  ["bạn có khỏe không, em có thể trả lời đúng, cũng có thể trả lời sai mà?", true, "đoạn dài, là suy nghĩ thật"],
  ["em nghĩ mệnh đề phải khẳng định được đúng sai", true, "trình bày thẳng"],
  ["A", false, "bấm đáp án"],
]) {
  const turns = [{ role: "student", content: noi, meta: { questionId: "q" } }];
  const m = await mem.buildMemory(fakeSupa({ turns }),
    { sessionId: "s", studentId: "u", questionId: "q", names: [] });
  t(`${mong ? "TÍNH" : "không tính"} là kể cách nghĩ: "${noi.slice(0, 34)}" (${vi})`,
    m.daNoi === mong, `daNoi=${m.daNoi}`);
}

// ── Ca 8: PHÁT HIỆN "NÓI MÃI MÀ KHÔNG LÀM BÀI" ─────────────────────────────
// Bản sao 1:1 phép đếm trong chat-turn. Con số này KHÔNG chặn em lại (chủ dự án
// bác trần cứng: "ai lại đi cài hạn mức cho học sinh") — nó được ĐƯA CHO SƯ TỬ
// để chính nó nhận ra và tự kéo em về việc làm bài bằng lời của nó.
// Điểm sống còn vẫn là: đếm TỪ LẦN THỬ CUỐI, nên em vừa nói vừa làm bài không
// bao giờ bị coi là đang đùa.
const CHAT_CAP = 4; // ngưỡng BÁO cho sư tử, không phải ngưỡng chặn
function demNoiSauLanThuCuoi(turns, lastAttAt, qid) {
  return turns.filter((r) =>
    r.meta?.kind === "reflect" && r.meta?.questionId === qid &&
    (!lastAttAt || r.created_at > lastAttAt)
  ).length;
}
const noi = (n, at) => Array.from({ length: n }, (_, i) => ({
  created_at: at + String(i).padStart(2, "0"),
  meta: { kind: "reflect", questionId: "q1" },
}));

{
  // Em cợt nhả: nói 12 lượt liền, chưa thử lại lần nào.
  const d = demNoiSauLanThuCuoi(noi(12, "2026-07-30T10:"), "2026-07-30T09:00", "q1");
  t("cợt nhả: 12 lượt nói không thử → sư tử được báo", d >= CHAT_CAP, `${d}`);
}
{
  // Em chăm chỉ: nói 12 lượt NHƯNG lần thử cuối mới đây → bộ đếm về gần 0.
  const d = demNoiSauLanThuCuoi(noi(12, "2026-07-30T10:"), "2026-07-30T10:11", "q1");
  t("chăm chỉ: vừa thử lại → KHÔNG bị coi là đùa", d < CHAT_CAP, `${d}`);
}
{
  // Nói ở CÂU KHÁC không được tính sang câu này.
  const khac = noi(12, "2026-07-30T10:").map((r) => ({ ...r, meta: { kind: "reflect", questionId: "q2" } }));
  const d = demNoiSauLanThuCuoi(khac, "2026-07-30T09:00", "q1");
  t("nói ở câu khác không tính sang câu này", d === 0, `${d}`);
}
{
  // Chưa thử lần nào (câu mới mở) mà đã nói 9 lượt → vẫn phải chặn.
  const d = demNoiSauLanThuCuoi(noi(9, "2026-07-30T10:"), "", "q1");
  t("chưa thử lần nào mà nói 9 lượt → được báo", d >= CHAT_CAP, `${d}`);
}
{
  // Ngay dưới trần thì phải cho qua — đừng chặn oan.
  const d = demNoiSauLanThuCuoi(noi(3, "2026-07-30T10:"), "2026-07-30T09:00", "q1");
  t("3 lượt (dưới ngưỡng) → sư tử không bị làm phiền", d < CHAT_CAP, `${d}`);
}

// ── TRANH LUẬN (04/09) — đo từ chính hội thoại thật chủ dự án dán ────────────
// Em giữ ý "đúng" nhiều lượt, có lý lẽ ("chứng tỏ", "với tôi"); sư tử hỏi trùng.
{
  const rows = [
    { role: "student", content: "C" },
    { role: "tutor", content: "Theo định nghĩa mệnh đề trong sách nó có tính đúng/sai. Thử đọc lớn câu đó lên rồi tự hỏi: câu này đúng hay sai?" },
    { role: "student", content: "đúng" },
    { role: "tutor", content: "Bạn vừa nói đúng vậy bạn đang nghĩ câu Hãy đóng cửa lại có thể xác định được đúng hay sai à?" },
    { role: "student", content: "đúng rồi" },
    { role: "tutor", content: "Bạn chọn C vì nghĩ nó có đúng/sai thử đọc to câu đó lên nếu nó đúng thì phải xác định được điều gì là đúng điều gì là sai bạn thấy được không?" },
    { role: "student", content: "có, đóng cửa lại là đúng mà?" },
    { role: "tutor", content: "Bạn nói đóng cửa lại là đúng vậy nếu lúc đó cửa đang mở câu đó đúng hay sai?" },
    { role: "student", content: "hãy đóng cửa lại, chứng tỏ nó đang mở, tôi thấy lạnh, tôi muốn nó đóng, thì nó đúng với tôi" },
  ];
  const d = mem.doTranhLuan(rows);
  t("tranh luận: nhận ra em giữ ý", !!d && d.lanGiuY >= 3, JSON.stringify(d));
  t("tranh luận: lời cuối CÓ lý lẽ", !!d && d.coLyLe === true, JSON.stringify(d));
  t("tranh luận: giữ lại lý lẽ để nói lại đúng ý", !!d && /chứng tỏ|với tôi/.test(d.lyLe), d?.lyLe ?? "");
  t("tranh luận: bắt được sư tử hỏi trùng", !!d && d.hoiLap >= 1, `hoiLap=${d?.hoiLap}`);
  // Prompt bật đúng khối, không đếm lượt cứng
  const sys = prompts.buildGuideSystem({ subject: "Toan", grade: "10", language: "vi", nodeLabel: "Mệnh đề",
    question: "Câu nào là mệnh đề?", attempts: 3, stage: "guide", hasMemory: true, tranhLuan: d });
  t("prompt: có khối CHÍNH KIẾN khi đo được dấu hiệu", /CHÍNH KIẾN/.test(sys) && /NÓI LẠI lập luận/.test(sys));
  t("prompt: không còn luật cứng 'lượt thứ ba'", !/lượt thứ ba/.test(sys));
  const sys0 = prompts.buildGuideSystem({ subject: "Toan", grade: "10", language: "vi", nodeLabel: "Mệnh đề",
    question: "Câu nào là mệnh đề?", attempts: 1, stage: "guide", hasMemory: true });
  t("prompt: KHÔNG bật khối tranh luận khi không có dấu hiệu", !/CHÍNH KIẾN/.test(sys0));
}
{
  // Em đổi ý mỗi lượt, không lý lẽ → không phải "có chính kiến"
  const rows = [
    { role: "student", content: "A" }, { role: "tutor", content: "Vì sao A?" },
    { role: "student", content: "không, B" }, { role: "tutor", content: "B thì sao?" },
    { role: "student", content: "ừ chắc là C" },
  ];
  t("không tranh luận: đổi ý liên tục → null", mem.doTranhLuan(rows) === null, JSON.stringify(mem.doTranhLuan(rows)));
  t("không tranh luận: mới một lượt → null", mem.doTranhLuan([{ role: "student", content: "đúng" }]) === null);
}

console.log(`\n${pass} đạt · ${fail} trượt`);
process.exit(fail ? 1 : 0);
