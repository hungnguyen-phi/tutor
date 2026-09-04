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

/**
 * Gạch dài/gạch trung → dấu phẩy. Dùng được cho cả mẩu chữ rời giữa luồng.
 *
 * VÁ 04/09 (chủ dự án dán hội thoại thật: "Bạn ơinếu", "lênnếu", "khách
 * quannghĩa"): bản cũ gọi `donDauCau` — hàm đó có luật "xoá dấu phẩy ĐẦU/CUỐI
 * DÒNG", đúng cho chuỗi trọn câu nhưng SAI với mẩu rời: mô hình viết
 * "lên — nếu", stream cắt thành "lên" + "—nếu" → mẩu 2 thành ", nếu" → luật
 * xoá phẩy đầu dòng nuốt luôn cả dấu cách → "nếu" → ghép ra "lênnếu". Mẩu rời
 * CHỈ được đổi ký tự tại chỗ, KHÔNG được đụng mép chuỗi; dọn dấu câu để dành
 * cho `boGachNgang` khi đã có trọn câu (chat-turn gọi nó ở câu chốt).
 */
export function boGachDai(s: string): string {
  return String(s ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/[ \t]{2,}/g, " ");
}

/**
 * Bỏ TỪ ĐỆM MỞ ĐẦU ("Ừ,", "À,", "Vậy,", "OK,"…) — chủ dự án 04/09: "lạm dụng từ
 * Ừ". Prompt đã cấm từ 30/07 (và ghi rõ: cấm bằng lời không đuổi kịp mô hình),
 * nên chặn ở đường ra như đã làm với gạch ngang. Chỉ cắt khi từ đệm đứng MỘT
 * MÌNH đầu câu, theo sau là dấu phẩy/chấm/cách; câu bắt đầu bằng "Vậy nên…"
 * (từ nối có nghĩa) vẫn giữ vì không khớp mẫu "từ đệm + dấu câu".
 */
export function boTuDem(s: string): string {
  const t = String(s ?? "").replace(/^\s*(?:ừ|ừm|à|ờ|ồ|uhm|um|ok|okay|rồi|vậy|nào)\s*[,.!…]+\s*/iu, "");
  if (t === s || !t) return s;
  const i = t.search(/\p{L}/u);
  return i < 0 ? t : t.slice(0, i) + t[i]!.toUpperCase() + t.slice(i + 1);
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
  return boTuDem(sachVanXuoi(giu).replace(/\[\[CT(\d+)\]\]/g, (_, i) => kho[Number(i)] ?? ""));
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
