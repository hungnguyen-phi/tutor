// Thứ tự PHƯƠNG ÁN của một câu trắc nghiệm — TẤT ĐỊNH, không random.
//
// Trước đây mỗi lượt phục vụ là một lần Math.random(): cùng một câu, hai lần vào
// ra hai thứ tự khác nhau. Hệ quả: không ai làm nổi bảng đáp án ("câu 3 chọn ô
// nào?"), giáo viên chấm tay không đối chiếu được, và test thì ba người nhìn ba
// thứ khác nhau.
//
// Nhưng bỏ xáo hẳn (giữ nguyên thứ tự trong DB) thì ĐÁP ÁN ĐÚNG LUÔN Ở Ô ĐẦU —
// học sinh học được mẹo "cứ chọn ô 1" mà chẳng cần hiểu bài. Nên: xáo bằng bộ
// sinh số TẤT ĐỊNH gieo từ MÃ CÂU HỎI. Cùng một câu → muôn đời một thứ tự, với
// mọi học sinh, mọi phiên; câu khác nhau → vị trí đáp án khác nhau.
//
// Gieo bằng id câu (KHÔNG kèm session/student) là có chủ đích: có vậy bảng đáp
// án in ra mới dùng được cho cả lớp.

function fnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Trộn phương án theo thứ tự tất định của câu hỏi.
 * @param questionId  khoá gieo — cùng câu thì cùng thứ tự, mọi lúc mọi nơi
 * @param correct     đáp án đúng
 * @param distractors các phương án nhiễu
 */
export function orderedOptions(questionId: string, correct: string, distractors: string[]): string[] {
  const arr = [correct, ...distractors];
  const rand = mulberry32(fnv1a(String(questionId)));
  // Fisher–Yates với nguồn ngẫu nhiên tất định.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
