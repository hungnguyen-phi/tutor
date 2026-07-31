/**
 * intent.ts — CỔNG Ý ĐỊNH đứng TRƯỚC tầng chấm (vá cụm lỗi 8·9·11·14, đợt 29/07).
 *
 * Bài học trả giá: mọi thứ học sinh gõ vào ô chữ đều bị đem đi CHẤM, và tầng
 * chấm (nhất là LLM) hay gật bừa khi đầu vào không phải đáp án — gõ "ok" được
 * "đủ ý chính", gõ "gợi ý giúp em" được CHÚC MỪNG trả lời đúng. Cổng này phân
 * loại TẤT ĐỊNH trước khi bất cứ bộ chấm nào được gọi:
 *
 *   help — lời XIN TRỢ GIÚP ("gợi ý", "không biết làm"…) → đi vào thang
 *          Socratic, KHÔNG chấm, KHÔNG ghi attempt/bằng chứng.
 *   junk — bài rác so với câu tự luận (quá ngắn / toàn từ đệm "ok, vâng, đã
 *          hiểu" / một con số trơ) → mời viết thêm, KHÔNG gọi LLM.
 *   answer — còn lại: đem chấm như thường.
 *
 * Mọi luật ở đây thuần chuỗi — không LLM, không mạng — nên rẻ, tức thì, và
 * không thể bị prompt-hack.
 */

/** Chuẩn hoá tiếng Việt không dấu, thường hoá, gọn khoảng trắng. */
function normVi(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** CỤM xin trợ giúp — bắt theo CỤM TỪ (không bắt từ đơn, kẻo "không" của câu
 *  Đúng/Sai bị hiểu nhầm). Chỉ áp khi câu KHÔNG khớp nguyên văn một phương án. */
// ⚠️ ĐÃ GỌT (audit vòng 2): bỏ "cach lam", "huong dan", "hint", "help me" —
// chúng là ĐÁP ÁN hợp lệ của nhiều câu (Tiếng Anh 10 hỏi nghĩa từ "hint";
// Toán hỏi "cách làm nào đúng?" → em gõ "cách làm 2"). Chỉ giữ những cụm mà
// KHÔNG câu nào có thể lấy làm đáp án.
const HELP_PATTERNS: RegExp[] = [
  // Những cụm này KHÔNG câu nào lấy làm đáp án được — đã tra kho sống: 0 dòng
  // `dap_an` chứa "gợi ý"/"giúp em"; 11 dòng chứa "không biết/hiểu" nhưng đều
  // dài 24–195 từ nên đã rơi khỏi lưới ở chốt "câu ngắn" bên dưới. Đây cũng là
  // cách học sinh kêu cứu THƯỜNG NHẤT, bỏ đi là em gõ "em không hiểu" rồi bị
  // chấm SAI + đóng dấu bằng chứng vĩnh viễn cho câu đó.
  /goi y/,
  /giup (em|minh|toi|tui|voi)/,
  /(khong|chua|k|ko|hong) (biet|hieu|ro|lam duoc)/,
  /chi (em|minh|tui|toi) (cach|voi|di)/,
  // "làm sao/làm thế nào" GIỮ LẠI được: ba chốt chặn ở isHelpRequest (câu dài,
  // có phép tính, có từ nối lập luận) đã loại hết ca "…và làm sao cho vế trái
  // bằng vế phải nên suy ra x = 2".
  /lam (sao|the nao|nhu the nao)/,
  /bo tay|chiu thua|em chiu|minh chiu|be tac/,
  /how do i (do|solve)|i (dont|don t|do not) know how/,
  /dap an la gi|cho (em|minh) dap an/,
  // ⚠️ CỐ Ý KHÔNG có: "cach lam", "huong dan", "hint", "help me" — chúng là
  // ĐÁP ÁN hợp lệ của nhiều câu (TA10 hỏi nghĩa "hint"; Toán hỏi "cách làm nào
  // đúng?" → em gõ "cách làm 2"; điền khuyết có ô là "hướng dẫn").
];

/** Từ đệm rỗng nghĩa — bài chỉ gồm những từ này là bài RÁC. */
const FILLER = new Set([
  "ok", "oke", "okay", "okie", "oki", "okla",
  "vang", "da", "a", "u", "uh", "um", "uhm", "ua",
  "roi", "xong", "duoc", "dc", "va",
  "hieu", "biet", "nho", "ro",
  "em", "minh", "tui", "toi", "ban", "thay", "co",
  "da hieu", "cam on", "thanks", "thank", "you", "yes", "yeah", "done",
]);

/**
 * Học sinh đang XIN TRỢ GIÚP chứ không nộp đáp án?
 *
 * ⚠️ PHẢI BẢO THỦ. Cụm như "cách làm", "làm sao", "hướng dẫn" xuất hiện đầy
 * trong BÀI LÀM THẬT ("Cách làm của bạn sai ở bước 2 vì quên đổi dấu…") — bắt
 * bừa là nuốt mất bài của em, mà ở nhánh nộp bài thì còn mất cả dòng hàng đợi
 * của giáo viên. Nên chỉ nhận khi câu NGẮN và KHÔNG có dấu hiệu lập luận:
 * lời cầu cứu thật thì cụt lủn, bài làm thật thì có lý lẽ hoặc phép tính.
 */
export function isHelpRequest(text: string): boolean {
  const n = normVi(text);
  if (!n) return false;
  const words = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  // Dài hơn một lời cầu cứu → đây là bài làm, dù có chứa cụm nào đi nữa.
  if (words.length > 12) return false;
  // Có phép tính / dấu suy ra / trích dẫn → đang trình bày, không phải xin giúp.
  if (/[=+\-*/^<>√≤≥]|=>|→|⇒/.test(text)) return false;
  // Có từ nối lập luận → đang giải thích.
  if (/\b(vi|boi|nen|suy ra|do do|ta co|thay vao|ket luan|buoc \d)\b/.test(n)) return false;
  return HELP_PATTERNS.some((re) => re.test(n));
}

/** Số TỪ có nội dung (bỏ từ đệm) — thước đo "đã viết gì thật chưa". */
export function contentWordCount(text: string): number {
  const words = normVi(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.filter((w) => !FILLER.has(w)).length;
}

/**
 * Bài RÁC so với một câu TỰ LUẬN thật sự.
 *
 * ⚠️ Ngưỡng phải SO VỚI ĐÁP ÁN MẪU, không phải một con số cứng. Ngân hàng có
 * câu ĐIỀN KHUYẾT đi vào cùng nhánh "câu mở" mà đáp án đúng chỉ là "giao" hay
 * "trái dấu a" — chặn theo ngưỡng 5 từ là học sinh gõ ĐÚNG y đáp án vẫn bị
 * đuổi về, và vì cổng chặn trước cả việc ghi lượt thử nên em kẹt vĩnh viễn.
 *
 * `reference` = đáp án mẫu. Đáp án mẫu ngắn ⇒ bài làm ngắn là hợp lệ.
 */
export function isJunkOpenAnswer(text: string, reference = ""): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  const n = normVi(t);
  const words = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  // Toàn từ đệm ("ok", "em hiểu rồi ạ") → rác với MỌI loại câu.
  if (words.every((w) => FILLER.has(w) || /^\d+$/.test(w))) return true;

  // Bao nhiêu từ thì đủ? Lấy theo ĐÁP ÁN MẪU: đáp án một cụm từ thì bài làm một
  // cụm từ là đủ; đáp án cả đoạn thì mới đòi lập luận thành câu.
  const refWords = normVi(reference).split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
  const need = refWords >= 12 ? 5 : refWords >= 5 ? 3 : 1;
  if (words.length < need) return true;

  // Một con số trơ CHỈ là rác khi đề đòi cả đoạn lập luận.
  if (need >= 5 && /^[-+0-9.,\s/^*()=]+$/.test(n)) return true;
  return false;
}

/** Bài làm mở ĐỦ ĐỘ TIN để nhận phán quyết ĐÚNG từ LLM chưa? (đai an toàn sau
 *  chấm: LLM gật mà bài dưới ngưỡng này thì KHÔNG công nhận.) */
export function plausibleOpenAnswer(text: string, reference = ""): boolean {
  if (isJunkOpenAnswer(text, reference)) return false;
  const refWords = normVi(reference).split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
  // Đáp án mẫu ngắn → không đòi "dày"; chỉ câu đoạn văn mới cần ≥4 từ có nghĩa.
  return refWords < 12 || contentWordCount(text) >= 4;
}

/**
 * Gọt QUAN NIỆM SAI trước khi đọc cho học sinh nghe.
 *
 * Kiểm dữ liệu sống 29/07: 0/3641 `quan_niem_sai` có dạng lộ đáp án — chúng
 * được soạn đúng vai ("SAI CHIỀU — đây là định nghĩa của B ⊂ A"). Hàm này là
 * chốt chặn cho NỘI DUNG TƯƠNG LAI: nếu ai đó soạn "(b) SAI vì…" thì với câu
 * Đúng/Sai chùm ý, riêng cái nhãn đầu câu đã là một phần đáp án.
 */
export function safeMisconception(
  s: string | null | undefined,
  dapAn?: string | null,
): string {
  let t = String(s ?? "").trim();
  if (!t) return "";
  // CHỈ bỏ nhãn phán quyết đứng ĐẦU: "(b) SAI vì…", "b) Đúng —", "① SAI:".
  // Đây là lỗ THẬT: với câu Đúng/Sai chùm ý thì riêng cái nhãn đã là một phần
  // đáp án. Phần còn lại của câu là chẩn đoán, phải giữ NGUYÊN VĂN.
  t = t.replace(/^[(\[]?\s*[a-dA-D①-⑨]\s*[)\].:]?\s*(ĐÚNG|SAI|Đúng|Sai|đúng|sai)(?![\p{L}])\s*[-–—:,]?\s*/u, "");
  // KHÔNG cắt theo cụm "kết quả là…/phải chọn…": đã tra 3.641 dòng dữ liệu sống,
  // 0 dòng lộ đáp án, trong khi cắt tới dấu chấm gần nhất thì băm nát chẩn đoán
  // thật ("Nhầm dấu: kết quả là số dương chứ không âm" → "Nhầm dấu"). Bộ cắt đó
  // chỉ có hại trên kho hiện tại; nếu sau này có nội dung lộ đáp án thì chặn ở
  // khâu DUYỆT nội dung, không phải cắt mù ở đây.
  t = t.replace(/^[\s.,;:—–-]+|[\s.,;:—–-]+$/gu, "");

  // ── CHẶN LỘ ĐÁP ÁN (lỗi #9(b), rà 30/07) ─────────────────────────────────
  // Chuỗi này được ĐỌC THẲNG cho học sinh ngay LẦN SAI ĐẦU TIÊN, và còn được
  // nhét vào system prompt của mô hình. Quét 3.563 distractor sống: có những
  // dòng chẩn đoán chứa nguyên văn đáp án — "Tính sai — kết quả đúng là
  // −8/40 = −0,2" cho câu đáp án "-0,2". Nói câu đó ra là phá thẳng bất biến
  // Socratic: em chưa thử lần nào đã biết đáp.
  //
  // ⚠️ CỬA HẸP CÓ CHỦ ĐÍCH. Bản vá đầu tiên (do agent đề xuất) chặn theo phép
  // so chuỗi con thô và xoá TRẮNG chuỗi — đo lại thì nó giết 143/3.563 lời
  // chẩn đoán, phần lớn LÀNH: câu có đáp án là chữ "sai" thì mọi lời giải
  // thích chứa từ "sai" đều bị xoá; đáp án "mọi" giết luôn "∅ là tập con của
  // MỌI tập hợp". Tức là vá lỗ (b) bằng cách làm lỗi (c) nặng thêm ở hơn 100
  // chỗ. Nên ở đây:
  //   · chỉ xét đáp án ĐỦ ĐẶC TRƯNG — dài ≥9 ký tự, hoặc có chữ số/ký hiệu
  //     toán (đáp án kiểu "-0,2", "x^2-4"). Đáp án là từ thường ngày ("mọi",
  //     "cả", "sai", "mệnh đề") KHÔNG bao giờ kích hoạt;
  //   · so theo RANH GIỚI (không phải substring), nên "2" không khớp trong "12";
  //   · và cắt ĐÚNG MỆNH ĐỀ chứa nó, giữ lại phần chẩn đoán còn lại — thà mất
  //     một vế còn hơn mất cả câu.
  const dap = String(dapAn ?? "").trim();
  if (dap) {
    // Ký hiệu TOÁN theo nghĩa rộng — gồm cả tập hợp/logic, vì đáp án kiểu
    // "B ⊂ A" ngắn nhưng vẫn là đáp án đầy đủ, nói ra là lộ.
    const coKyHieu = /[\d^√+\-*/=<>⊂⊃⊆⊇∈∉∅∪∩∀∃≠≤≥→↔⇒⇔\\]/.test(dap);
    // Ngưỡng 3 ký tự (không phải 2): đáp án số ĐƠN như "2" hay "5" xuất hiện
    // đầy trong các lời chẩn đoán hoàn toàn lành ("nhầm 12 với 2"), chặn theo
    // nó là lại rơi vào đúng cái bẫy giết-chẩn-đoán-lành đã tránh ở trên.
    const dacTrung = dap.length >= 9 || (coKyHieu && dap.length >= 3);
    if (dacTrung) {
      const chuan = (x: string) =>
        x.toLowerCase().replace(/\s+/g, "").replace(/[−–—]/g, "-").replace(/,/g, ".");
      const kim = chuan(dap);
      const menhDe = t.split(/(?<=[.;!?])\s+|\s+—\s+|\s+–\s+/u);
      const giu = menhDe.filter((m) => !chuan(m).includes(kim));
      // CHỈ ghép lại khi thật sự có mệnh đề bị loại. Ghép vô điều kiện là nuốt
      // luôn dấu "—" của những câu chẳng lộ gì — đo lần đầu thấy "12,7% bị cắt"
      // mà phần lớn chỉ là mất dấu câu, không phải cắt nội dung.
      if (giu.length !== menhDe.length) {
        t = giu.join(" ").replace(/^[\s.,;:—–-]+|[\s.,;:—–-]+$/gu, "");
      }
    }
  }
  return t.slice(0, 220);
}
