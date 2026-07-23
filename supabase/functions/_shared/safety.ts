// _shared/safety.ts — LƯỚI AN TOÀN thô (J2): quét TEXT tự do của học sinh tìm
// dấu hiệu TỰ-LÀM-HẠI / BẮT NẠT / KHỦNG HOẢNG. Nguyên tắc bất biến:
//  · BẢO THỦ — chỉ khớp cụm RÕ RÀNG để GIẢM dương-tính-giả (gắn cờ oan gây hại,
//    làm mất tin tưởng). Thà bỏ sót ca mơ hồ còn hơn báo động sai hàng loạt.
//  · KHÔNG lưu văn bản thô — chỉ LOẠI cờ + mức độ (quyền riêng tư trẻ; PDPL).
//  · Con người XÁC MINH (counselor) trước; KHÔNG tự báo phụ huynh. Đây KHÔNG
//    thay chuyên gia — chỉ đưa ca vào hàng đợi để người lớn tiếp cận kịp thời.
import { admin } from "./supa.ts";

export type FlagType = "self_harm" | "bullying" | "distress";
export interface SafetySignal {
  type: FlagType;
  severity: "high" | "medium";
}

// self_harm đặt TRƯỚC → ưu tiên cao nhất khi một câu chạm nhiều luật.
const RULES: Array<{ type: FlagType; severity: "high" | "medium"; re: RegExp }> = [
  {
    type: "self_harm",
    severity: "high",
    // "muốn chết" đứng sau từ cường điệu (đói/mệt/khó/chán… muốn chết) là THÀNH
    // NGỮ vô hại → negative-lookbehind loại ra, chỉ giữ "muốn chết" nghĩa thật.
    re: /(tự tử|tự sát|không muốn sống( nữa)?|kết thúc (tất cả|cuộc đời|đời mình)|tự (làm đau|làm hại|rạch tay)|biến mất mãi mãi|chẳng thiết sống|(?<!(đói|mệt|chán|khó|buồn|nóng|lạnh|đau|cười|ngủ|thèm|lười|ghét)\s{0,3})muốn chết)/i,
  },
  {
    type: "bullying",
    severity: "high",
    // "bị" + (chủ ngữ tuỳ chọn có kiểm soát) + hành vi bắt nạt. Danh sách chủ ngữ
    // đóng (tụi nó/cả nhóm/bạn…) tránh khớp bừa "bị cô giáo nhắc", "bị điểm kém".
    re: /(bị\s+((tụi nó|tụi bạn|cả nhóm|nhóm|các bạn|chúng nó|mấy đứa|bạn bè|bạn|nó)\s+)?(đánh|bắt nạt|ăn hiếp|đe dọa|dọa đánh|hành hung|tẩy chay|cô lập)|tụi nó\s+(đánh|ăn hiếp|chửi|dọa|bắt nạt))/i,
  },
  {
    type: "distress",
    severity: "medium",
    re: /(sợ về nhà|bị (bố|mẹ|ba|người nhà) đánh|không ai (thương|quan tâm|hiểu)( mình| em)?|tuyệt vọng|chịu (hết nổi|không nổi)|bế tắc quá)/i,
  },
];

/** Quét một tin nhắn tự do. Trả tín hiệu ĐẦU TIÊN khớp (theo thứ tự ưu tiên),
 *  hoặc null. Bỏ qua tin quá ngắn (giảm nhiễu). */
export function detectSafety(text: string): SafetySignal | null {
  if (!text || text.trim().length < 4) return null;
  for (const r of RULES) if (r.re.test(text)) return { type: r.type, severity: r.severity };
  return null;
}

/** Ghi cờ vào hàng đợi counselor (safety_events). Chống trùng: đã có cờ CÙNG
 *  loại đang mở (new/verifying) cho HS thì KHÔNG tạo thêm. KHÔNG lưu văn bản. */
export async function recordSafetyFlag(
  supa: ReturnType<typeof admin>,
  opts: { tenantId: string; studentId: string; sessionId?: string | null; signal: SafetySignal },
): Promise<void> {
  const { data: open } = await supa
    .from("safety_events")
    .select("id")
    .eq("tenant_id", opts.tenantId)
    .eq("student_id", opts.studentId)
    .eq("flag_type", opts.signal.type)
    .in("status", ["new", "verifying"])
    .limit(1)
    .maybeSingle();
  if (open) return; // đã có cờ cùng loại đang xử lý → không nhân bản
  await supa.from("safety_events").insert({
    tenant_id: opts.tenantId,
    student_id: opts.studentId,
    session_id: opts.sessionId ?? null,
    flag_type: opts.signal.type,
    severity: opts.signal.severity,
    status: "new",
  });
}

/** Lời đáp ẤM ÁP, không lâm sàng, không hoảng — khi bắt tín hiệu. Hướng học sinh
 *  tới NGƯỜI LỚN tin cậy / tư vấn trường. KHÔNG dạy tiếp như chưa có gì. */
export function supportiveReply(type: FlagType): string {
  if (type === "self_harm") {
    return "Cảm ơn em đã tin tưởng chia sẻ với mình. Nghe em nói vậy, mình thật sự quan tâm đến em. Em không hề đơn độc đâu — mình mong em nói chuyện với một người lớn em tin tưởng (thầy cô, bố mẹ, hay cô/thầy tư vấn của trường) NGAY HÔM NAY nhé. Nếu em đang thấy rất khó khăn, hãy tìm một người ở bên để được giúp ngay. Mình luôn ở đây cùng em.";
  }
  if (type === "bullying") {
    return "Cảm ơn em đã kể cho mình. Không ai đáng bị đối xử như vậy, và đây không phải lỗi của em. Em hãy nói với một thầy cô hoặc người lớn em tin tưởng để được bảo vệ nhé — chuyện này người lớn giúp được. Mình luôn ở bên em.";
  }
  return "Cảm ơn em đã chia sẻ. Nghe có vẻ em đang trải qua điều không dễ dàng. Em xứng đáng được lắng nghe và giúp đỡ — em thử nói với một người lớn em tin tưởng nhé. Mình ở đây cùng em.";
}
