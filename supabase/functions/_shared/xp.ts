/**
 * XP server-authoritative — vỏ gọi hàm SQL award_xp (xp-stats.sql).
 *
 * Nguyên tắc: XP là phần thưởng, KHÔNG phải dữ liệu sống của việc chấm —
 * cộng XP hỏng thì nuốt lỗi và trả null, tuyệt đối không làm vỡ lượt trả lời.
 * Chống farm nằm ở DB (unique index từng nguồn XP), không cần kiểm ở đây.
 * Mức thưởng khớp apps/web/lib/gamify.ts (XP.correct v.v.) — đổi thì đổi CẢ HAI.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const XP_AMOUNT = {
  correct: 10, // trả lời đúng (một lần cho mỗi câu, trọn đời)
  persistence: 5, // thử lại sau khi sai — thưởng cho việc không bỏ cuộc
  lesson_done: 20, // hoàn thành buổi học (một lần mỗi phiên)
  node_mastered: 30, // làm chủ một điểm kiến thức (một lần mỗi node × KG version)
} as const;

export type XpKind = keyof typeof XP_AMOUNT;

export interface XpEventInput {
  kind: XpKind;
  sessionId?: string;
  questionId?: string;
  nodeId?: string;
  kgVersionId?: string;
}

export interface XpResult {
  total: number;
  streak: number;
  /** XP thật sự cộng thêm lượt này (0 nếu mọi nguồn đã ăn trước đó). */
  gained: number;
}

/**
 * Ghi các sự kiện XP + chấm công chuỗi ngày trong MỘT round-trip nguyên tử.
 * `events` rỗng vẫn nên gọi ở lượt trả lời: ngày chỉ toàn câu sai vẫn là một
 * ngày có học (chuỗi ngày thưởng sự có mặt, không thưởng điểm số).
 */
export async function awardXp(
  supa: SupabaseClient,
  tenantId: string,
  studentId: string,
  events: XpEventInput[],
): Promise<XpResult | null> {
  try {
    const payload = events.map((e) => ({
      kind: e.kind,
      amount: XP_AMOUNT[e.kind],
      session_id: e.sessionId ?? "",
      question_id: e.questionId ?? "",
      node_id: e.nodeId ?? "",
      kg_version_id: e.kgVersionId ?? "",
    }));
    const { data, error } = await supa.rpc("award_xp", {
      p_tenant: tenantId,
      p_student: studentId,
      p_events: payload,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return { total: Number(row.xp_total), streak: row.streak, gained: row.gained };
  } catch {
    return null;
  }
}
