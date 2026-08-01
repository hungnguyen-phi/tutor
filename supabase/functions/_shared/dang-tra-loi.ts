/**
 * GỢI Ý DẠNG TRẢ LỜI — nói KHUÔN, tuyệt đối không nói GIÁ TRỊ.
 *
 * Lỗi #29, người thử 1 đợt 2: *"Trong câu hỏi tự luận nên cho hint về dạng câu
 * trả lời sẽ được chấp nhận để tránh trường hợp học sinh trả lời đúng 80% câu
 * hỏi nhưng vẫn bị sư tử giữ lại để điều chỉnh đáp án."* Cùng phiếu, em khen
 * trắc nghiệm và Đúng/Sai "ổn" — vì hai dạng đó tự nói ra mình cần gì.
 *
 * Vì sao phải sinh ở SERVER: client không hề nhận `dap_an` (đúng, không được
 * lộ), nên không có cách nào đoán khuôn ở phía máy học sinh.
 *
 * LUẬT CỨNG của tệp này: mọi chuỗi trả về là hằng số viết sẵn, KHÔNG bao giờ
 * ghép một mẩu nào của `dapAn` vào. Ví dụ minh hoạ đều là số bịa. Đây là chỗ
 * dễ vô tình biến "gợi ý định dạng" thành "đọc dần đáp án" nhất.
 */

/** Bỏ khoảng trắng thừa + đưa dấu phân cách VN về dạng so được. */
const gon = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();

/** Đếm từ có nghĩa (dùng để phân biệt đáp án một cụm với đáp án cả đoạn). */
const demTu = (s: string) => gon(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;

export function goiYDinhDang(
  dapAn: string | null | undefined,
  dangCauHoi?: string | null,
): string | null {
  const d = gon(String(dapAn ?? ""));
  if (!d) return null;

  // Dạng thao tác (kéo thả, nối cột, tick) đã có UI nói rõ phải làm gì — thêm
  // một dòng chữ nữa chỉ là nhiễu.
  if (dangCauHoi && /sap_xep|noi_cot|keo_tha|dung_sai|trac_nghiem/i.test(dangCauHoi)) return null;

  // ĐOẠN VĂN — kiểm TRƯỚC mọi khuôn ký hiệu: đáp án tự luận dài thường có lẫn
  // vài con số, kiểm sau thì nó bị nhận nhầm thành "một số".
  if (demTu(d) >= 12) {
    return "Trả lời thành câu, trình bày đủ các bước lập luận — không chỉ ghi đáp số.";
  }

  // ── ĐIỀN NHIỀU Ô — khuôn PHỔ BIẾN NHẤT của ngân hàng này, và đúng cái người
  // thử nói: "trả lời đúng 80% câu hỏi nhưng vẫn bị giữ lại". Em điền một ô
  // trong khi đề có hai, nên bị chấm sai dù hiểu bài.
  //
  // Đo trên 468 câu tự luận đang sống: rất nhiều đáp án là các mẩu ngắn ngăn
  // bằng `;` ("hướng; độ dài", "tam thức; >"). Bộ chấm (cas.ts) so chúng như
  // một TẬP — phải nêu đủ mọi mẩu mới đúng. Nói ra số ô KHÔNG phải lộ đáp án:
  // các chỗ trống vốn đã hiện trên đề.
  const manh = d.split(";").map((x) => x.trim()).filter(Boolean);
  if (manh.length >= 2 && manh.every((x) => demTu(x) <= 6)) {
    return `Câu này cần ${manh.length} ý — điền ĐỦ cả ${manh.length}, cách nhau bằng dấu chấm phẩy. Thiếu một ý là chưa đạt.`;
  }

  // TẬP HỢP: {…}
  if (/^\{.*\}$/.test(d)) {
    return "Viết dưới dạng tập hợp, các phần tử cách nhau bằng dấu chấm phẩy — ví dụ {1; 2; 3}.";
  }

  // KHOẢNG / ĐOẠN / NỬA KHOẢNG: [a; b), (-∞; a], hợp của nhiều khoảng
  if (/^[[(][^;]*;[^;]*[\])]$/.test(d) && /[-−]?\s*(∞|infty)|;/.test(d) && !/^\(\s*-?\d+([.,]\d+)?\s*;\s*-?\d+([.,]\d+)?\s*\)$/.test(d)) {
    return "Viết dưới dạng khoảng hoặc đoạn, dùng dấu chấm phẩy — ví dụ [1; 5) hoặc (-∞; 2].";
  }
  if (/[[(][^\])]*[\])]\s*(∪|hoặc|U)\s*[[(]/i.test(d)) {
    return "Viết dưới dạng hợp của các khoảng — ví dụ (-∞; 1) ∪ [3; +∞).";
  }

  // TOẠ ĐỘ / CẶP SỐ: (a; b) hoặc (a, b) toàn số
  if (/^\(\s*-?\d+([.,]\d+)?\s*[;,]\s*-?\d+([.,]\d+)?\s*\)$/.test(d)) {
    return "Viết dưới dạng toạ độ trong ngoặc, hai thành phần cách nhau bằng dấu chấm phẩy — ví dụ (2; -3).";
  }

  // NHIỀU GIÁ TRỊ CÓ TÊN: "x = 1; y = 2"
  if (/^[A-Za-z]\w*\s*=\s*[^;=]+(;\s*[A-Za-z]\w*\s*=\s*[^;=]+)+$/.test(d)) {
    return "Ghi rõ TỪNG giá trị kèm tên của nó, cách nhau bằng dấu chấm phẩy — ví dụ x = …; y = ….";
  }

  // MỘT SỐ (kể cả thập phân kiểu Việt "1,5" và phân số "3/4")
  if (/^-?\d+([.,]\d+)?$/.test(d)) {
    return "Trả lời bằng MỘT SỐ. Số thập phân viết dấu phẩy hay dấu chấm đều được.";
  }
  if (/^-?\d+\s*\/\s*-?\d+$/.test(d)) {
    return "Trả lời bằng một phân số dạng a/b, hoặc số thập phân tương đương.";
  }

  // MỘT PHƯƠNG TRÌNH / BIỂU THỨC có biến
  if (/[=<>]/.test(d) && /[A-Za-z]/.test(d)) {
    return "Viết cả biểu thức (có dấu bằng), không chỉ ghi giá trị cuối.";
  }
  if (/[A-Za-z]/.test(d) && /[+\-*/^√]/.test(d)) {
    return "Trả lời bằng một biểu thức theo ẩn của đề.";
  }

  // CỤM TỪ NGẮN
  if (demTu(d) <= 4) {
    return "Trả lời ngắn gọn bằng một từ hoặc một cụm từ.";
  }
  return "Trả lời thành câu, nêu đủ ý chính.";
}
