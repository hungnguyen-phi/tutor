/**
 * NĂNG LỰC HỌC SINH toàn môn — vào node MỚI thì phục vụ DOK nào (chốt 03/09).
 *
 * Chủ dự án: học sinh giỏi tự vào DOK cao khi mở một node mới; node chỉ có 1
 * mức DOK thì không có gì để chọn; node có nhiều mức thì học sinh đủ năng lực
 * bỏ hẳn các câu DOK thấp, đi thẳng DOK cao nhất của node đó.
 *
 * ⚠️ Đây là ngoại lệ ĐÃ ĐƯỢC XÁC NHẬN cho quyết định "KHÔNG XÁO THỨ TỰ CÂU"
 * chốt 14/08 (xem diagnose/index.ts) — 14/08 cấm CHEN câu DOK cao lên sớm rồi
 * TRỘN LẪN với câu dễ (phá bậc thang sư phạm để ép mastery). Ở đây KHÔNG trộn:
 * chỉ LỌC theo một mức DOK duy nhất, thứ tự các câu còn lại giữ nguyên
 * (tier ASC, dok ASC, question_key ASC như cũ). Chỉ áp dụng lúc VÀO NODE MỚI
 * (không excludeId) — câu tiếp theo trong lúc đang làm dở node đó luôn dùng
 * TRỌN pool gốc, không lọc, để không bao giờ kẹt nếu học sinh bị đánh giá sai.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Số bằng chứng tối thiểu trong CẢ MÔN trước khi tin được xếp hạng năng lực —
 *  ít hơn thì CHƯA ĐỦ DỮ LIỆU, ai cũng bắt đầu như nhau (hành vi cũ). */
const MIN_EVIDENCE = 20;

/**
 * Trả về null khi chưa đủ dữ liệu (giữ hành vi cũ). Khi đủ, trả về 1/2/3 theo
 * tỉ lệ đúng trên MỌI bằng chứng đã có (mastery_evidence, mọi node đã học).
 */
export async function computeEntryDok(
  supa: SupabaseClient,
  studentId: string,
  kgVersionId: string,
): Promise<number | null> {
  const { data } = await supa
    .from("mastery_evidence")
    .select("correct")
    .eq("student_id", studentId)
    .eq("kg_version_id", kgVersionId);
  const rows = data ?? [];
  if (rows.length < MIN_EVIDENCE) return null;
  const acc = rows.filter((r) => r.correct).length / rows.length;
  if (acc >= 0.85) return 3;
  if (acc >= 0.6) return 2;
  return 1;
}

/**
 * Lọc một nhóm câu CÙNG NODE theo năng lực đã đo. Node chỉ có 1 mức DOK, hoặc
 * chưa đủ dữ liệu đo (entryDok null), hoặc năng lực CHƯA TỚI mức cao nhất của
 * node → trả nguyên nhóm, KHÔNG đổi gì (an toàn mặc định). Chỉ lọc khi đủ dữ
 * liệu VÀ năng lực >= DOK cao nhất mà node có.
 */
export function filterByAbility<T extends { dok: number | null }>(
  qs: T[],
  entryDok: number | null,
): T[] {
  if (entryDok == null || qs.length === 0) return qs;
  const doks = qs.map((q) => q.dok ?? 1);
  const maxDok = Math.max(...doks);
  if (new Set(doks).size <= 1 || entryDok < maxDok) return qs;
  return qs.filter((q) => (q.dok ?? 1) === maxDok);
}
