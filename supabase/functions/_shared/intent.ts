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
const HELP_PATTERNS: RegExp[] = [
  /goi y/, // "gợi ý"
  /giup (em|minh|toi|tui|voi)/,
  /(khong|chua|chua the|k|ko|hong) (biet|hieu|lam duoc|ro)/,
  /huong dan/,
  /lam (sao|the nao|nhu the nao)/,
  /cach lam/,
  /chi (em|minh|tui|toi) (cach|voi)/,
  /bo tay|chiu thua|em chiu|minh chiu/,
  /\bhint\b|\bhelp me\b|how to (do|solve)/,
  /dap an la gi|cho (em|minh) dap an/,
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

/** Học sinh đang XIN TRỢ GIÚP chứ không nộp đáp án? */
export function isHelpRequest(text: string): boolean {
  const n = normVi(text);
  if (!n) return false;
  // Câu có phép tính / con số dài thường là bài làm thật — không coi là xin giúp.
  return HELP_PATTERNS.some((re) => re.test(n));
}

/** Số TỪ có nội dung (bỏ từ đệm) — thước đo "đã viết gì thật chưa". */
export function contentWordCount(text: string): number {
  const words = normVi(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.filter((w) => !FILLER.has(w)).length;
}

/**
 * Bài RÁC so với một câu TỰ LUẬN/MỞ (đáp án mẫu là đoạn văn): quá ngắn, toàn
 * từ đệm, hoặc chỉ một con số trơ. KHÔNG dùng cho câu đáp-án-ngắn (MCQ, điền
 * số) — ở đó "7" hay "B" là đáp án hợp lệ.
 */
export function isJunkOpenAnswer(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  const n = normVi(t);
  // Chỉ một con số / một biểu thức cụt so với câu đòi lập luận → rác.
  if (/^[-+0-9.,\s/^*()=]+$/.test(n)) return true;
  const words = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length < 5) return true; // đáp án mẫu ngắn nhất trong ngân hàng cũng ~1 câu
  if (words.every((w) => FILLER.has(w) || /^\d+$/.test(w))) return true;
  return false;
}

/** Bài làm mở ĐỦ ĐỘ TIN để nhận phán quyết ĐÚNG từ LLM chưa? (đai an toàn sau
 *  chấm: LLM gật mà bài dưới ngưỡng này thì KHÔNG công nhận.) */
export function plausibleOpenAnswer(text: string): boolean {
  return !isJunkOpenAnswer(text) && contentWordCount(text) >= 4;
}
