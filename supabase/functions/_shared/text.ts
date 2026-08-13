/**
 * VỆ SINH CHỮ TRƯỚC KHI TỚI MẮT HỌC SINH.
 *
 * Vì sao có file này (chủ dự án 13/08: "con AI lúc nào cũng trả lời có gạch
 * ngang, cấm hẳn luôn cho tôi"): system prompt ĐÃ cấm dấu gạch dài từ 30/07
 * ("DẤU CÂU: chỉ dấu chấm, dấu phẩy, dấu hỏi") và mô hình vẫn rải khắp nơi.
 * Đây đúng bài học đã ghi trong chính prompt đó: danh sách cấm bằng lời không
 * bao giờ đuổi kịp mô hình. Cách chắc chắn là ĐỔI KÝ TỰ ở tầng mã — cùng một
 * nước đi đã dùng cho ngoặc kép « » (xem `rehydrate` trong llm.ts).
 *
 * Và gạch ngang KHÔNG chỉ do AI đẻ ra: hơn 50 câu soạn tay trong `chat-turn`
 * cũng viết theo lối "… nhé — thử mới biết…". Sửa tay từng câu thì câu mới
 * viết ngày mai lại dính. Nên chặn ở đường ra, không chặn ở từng câu.
 *
 * HAI MỨC, vì hai chỗ dùng có ràng buộc khác nhau:
 *  · `boGachDai`  — chỉ — và –. An toàn tuyệt đối với MẨU chữ rời (SSE stream)
 *    vì hai ký tự này không bao giờ nằm trong công thức KaTeX (dấu trừ là "-").
 *  · `boGachNgang` — đầy đủ, chỉ dùng cho chuỗi HOÀN CHỈNH: thêm gạch đầu dòng
 *    và gạch nối dùng như dấu câu, có bảo vệ vùng $…$.
 */

/** Gạch dài/gạch trung → dấu phẩy. Dùng được cho cả mẩu chữ rời giữa luồng. */
export function boGachDai(s: string): string {
  return donDauCau(String(s ?? "").replace(/\s*[—–]\s*/g, ", "));
}

/**
 * Bản đầy đủ cho chuỗi HOÀN CHỈNH (câu chốt của server, chuỗi soạn tay).
 * Vùng `$…$` được giữ NGUYÊN VĂN: đó là công thức, dấu "-" trong đó là dấu trừ.
 */
export function boGachNgang(s: string): string {
  // CẤT công thức đi rồi dọn TOÀN BỘ chuỗi một lượt, thay vì dọn từng đoạn xen
  // giữa các công thức. Bản đầu làm kiểu chia-đoạn và dính lỗi thật, bộ kiểm
  // bắt được: câu "So $a - b$ với $b - a$ — khác nhau chỗ nào?" cho ra
  // "…$b - a$khác nhau…" — đoạn cuối bắt đầu bằng dấu phẩy vừa sinh ra, và luật
  // "bỏ phẩy đứng đầu dòng" tưởng đó là đầu dòng nên nuốt luôn cả dấu cách.
  const kho: string[] = [];
  const giu = String(s ?? "").replace(/\$[^$\n]*\$/g, (m) => {
    kho.push(m);
    return `[[CT${kho.length - 1}]]`;
  });
  return sachVanXuoi(giu).replace(/\[\[CT(\d+)\]\]/g, (_, i) => kho[Number(i)] ?? "");
}

function sachVanXuoi(s: string): string {
  let t = s;
  // Gạch đầu dòng ("- ", "— ") ở đầu dòng: prompt đã cấm liệt kê, đây là lưới
  // chắn. KHÔNG đụng "•" — dấu đó là danh sách CÓ CHỦ Ý của bảng điểm rubric.
  t = t.replace(/^[ \t]*[-–—][ \t]+/gm, "");
  t = t.replace(/\s*[—–]\s*/g, ", ");
  // Gạch nối ASCII dùng như DẤU CÂU. Cửa hẹp có chủ đích: đòi vế trái là một
  // TỪ ≥2 chữ cái và vế phải bắt đầu bằng chữ cái, nên "x - y", "5 - 3",
  // "a - b" (toán viết trần, không bọc $…$) không bị đụng tới.
  t = t.replace(/(\p{L}[\p{L}\p{M}]+)[ \t]+-[ \t]+(?=\p{L})/gu, "$1, ");
  return donDauCau(t);
}

/** Dọn phần thừa do việc thay dấu đẻ ra (",," · " ," · ", ." · phẩy mở đầu). */
function donDauCau(t: string): string {
  return t
    .replace(/,[ \t]*,/g, ",")
    .replace(/[ \t]+,/g, ",")
    .replace(/,[ \t]*([.!?;:])/g, "$1")
    .replace(/^[ \t]*,[ \t]*/gm, "")
    .replace(/,[ \t]*$/gm, "")
    .replace(/[ \t]{2,}/g, " ");
}
