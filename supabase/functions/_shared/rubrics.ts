/**
 * Khuôn rubric THEO KỸ NĂNG cho câu mở (Đợt B hợp đồng Studio). Thay rubric CHUNG
 * 3 tiêu chí bằng 3 khuôn: Viết / Nói / Lập luận — mỗi tiêu chí thang 0–3. Đây là
 * "khuôn" tutor CHỐT để Studio cấp rubric riêng từng câu sau; khi câu chưa có
 * rubric riêng (hoặc chỉ có rubric chung), tutor chấm theo khuôn kỹ năng này.
 */

export type Skill = "writing" | "speaking" | "reasoning";

export interface RubricCriterion { tieu_chi: string; mo_ta: string }
export interface SkillRubric { skill: Skill; ten: string; tieu_chi: RubricCriterion[] }

export const SKILL_RUBRICS: Record<Skill, SkillRubric> = {
  writing: {
    skill: "writing",
    ten: "Viết",
    tieu_chi: [
      { tieu_chi: "Nội dung & Nhiệm vụ", mo_ta: "bám đúng yêu cầu đề, đủ ý, phát triển ý rõ" },
      { tieu_chi: "Từ vựng & Ngữ pháp", mo_ta: "dùng từ chính xác, đa dạng; đúng thì/cấu trúc" },
      { tieu_chi: "Bố cục & Liên kết", mo_ta: "mở–thân–kết rõ; câu ý liên kết mạch lạc" },
    ],
  },
  speaking: {
    skill: "speaking",
    ten: "Nói",
    tieu_chi: [
      { tieu_chi: "Trôi chảy & Mạch lạc", mo_ta: "nói liền mạch, ý sắp xếp hợp lý" },
      { tieu_chi: "Từ vựng & Ngữ pháp", mo_ta: "dùng từ đúng ngữ cảnh, câu đúng ngữ pháp" },
      { tieu_chi: "Đáp ứng đề", mo_ta: "trả lời đúng và đủ nội dung được hỏi" },
    ],
  },
  reasoning: {
    skill: "reasoning",
    ten: "Lập luận",
    tieu_chi: [
      { tieu_chi: "Luận điểm", mo_ta: "nêu rõ quan điểm/khẳng định trọng tâm" },
      { tieu_chi: "Lập luận & Dẫn chứng", mo_ta: "lý lẽ chặt chẽ, có ví dụ/bằng chứng hỗ trợ" },
      { tieu_chi: "Diễn đạt", mo_ta: "trình bày rõ ràng, ngôn ngữ chính xác" },
    ],
  },
};

const WRITING_DANG = new Set(["viet_doan", "tu_luan_ngan", "dien_khuyet"]);
const SPEAKING_DANG = new Set(["noi"]);

/** Ánh xạ dạng câu → kỹ năng. Mặc định (phan_bien, giai_thich_cho_ban,
 *  du_doan_giai_thich, van_dung_thuc_te…) = lập luận. */
export function skillFor(dang: string | null | undefined): Skill {
  if (dang && SPEAKING_DANG.has(dang)) return "speaking";
  if (dang && WRITING_DANG.has(dang)) return "writing";
  return "reasoning";
}

/** Rubric để chấm: ưu tiên rubric RIÊNG của câu nếu Studio đã cấp (khác rubric
 *  chung mặc định); nếu chưa thì dùng khuôn kỹ năng. */
export function rubricFor(dang: string | null | undefined, questionRubric: unknown): SkillRubric {
  const skill = skillFor(dang);
  const arr = Array.isArray(questionRubric) ? questionRubric : [];
  // rubric chung cũ có tiêu chí "Nội dung — đúng trọng tâm yêu cầu"; coi là "chưa
  // riêng" → dùng khuôn kỹ năng. Rubric riêng (Studio cấp sau) thì tôn trọng.
  const isGeneric = arr.length === 0 ||
    arr.some((c) => typeof c?.tieu_chi === "string" && /đúng trọng tâm yêu cầu/i.test(c.tieu_chi));
  if (isGeneric) return SKILL_RUBRICS[skill];
  return {
    skill,
    ten: SKILL_RUBRICS[skill].ten,
    tieu_chi: arr.map((c) => ({ tieu_chi: String(c.tieu_chi ?? ""), mo_ta: Array.isArray(c.thang_muc) ? c.thang_muc.join(" · ") : String(c.mo_ta ?? "") })),
  };
}

export interface RubricScore { tieu_chi: string; diem: number; nhan_xet: string }
export interface RubricResult {
  skill: Skill;
  ten: string;
  scores: RubricScore[];
  tong: number;
  toi_da: number;
  muc: string; // nhãn mức tổng (Cần cố gắng / Khá / Tốt / Xuất sắc)
  nhan_xet_chung: string;
  cau_hoi_sua: string;
}

/** Gộp kết quả LLM (đã parse) + khuôn thành RubricResult chuẩn để trả client. */
export function buildRubricResult(rubric: SkillRubric, parsed: {
  scores?: Array<{ tieu_chi?: string; diem?: number; nhan_xet?: string }>;
  nhan_xet_chung?: string;
  cau_hoi_sua?: string;
}): RubricResult {
  const scores: RubricScore[] = rubric.tieu_chi.map((c, i) => {
    const hit = parsed.scores?.find((s) => s.tieu_chi && s.tieu_chi.trim() === c.tieu_chi) ?? parsed.scores?.[i];
    const diem = Math.max(0, Math.min(3, Math.round(Number(hit?.diem ?? 0))));
    return { tieu_chi: c.tieu_chi, diem, nhan_xet: String(hit?.nhan_xet ?? "").trim() };
  });
  const tong = scores.reduce((s, x) => s + x.diem, 0);
  const toi_da = rubric.tieu_chi.length * 3;
  const r = toi_da ? tong / toi_da : 0;
  const muc = r >= 0.9 ? "Xuất sắc" : r >= 0.7 ? "Tốt" : r >= 0.5 ? "Khá" : "Cần cố gắng";
  return {
    skill: rubric.skill,
    ten: rubric.ten,
    scores,
    tong,
    toi_da,
    muc,
    nhan_xet_chung: String(parsed.nhan_xet_chung ?? "").trim(),
    cau_hoi_sua: String(parsed.cau_hoi_sua ?? "").trim(),
  };
}

/** Bóc JSON rubric từ output LLM (chịu được code fence / chữ thừa quanh). */
export function parseRubricJson(raw: string): {
  scores?: Array<{ tieu_chi?: string; diem?: number; nhan_xet?: string }>;
  nhan_xet_chung?: string;
  cau_hoi_sua?: string;
} | null {
  const m = (raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (o && Array.isArray(o.scores)) return o;
  } catch { /* rơi về null → caller hiện text thô */ }
  return null;
}
