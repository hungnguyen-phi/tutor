/**
 * Knowledge Graph types — source of truth is KG_Schema_v2.json.
 * Zod schemas double as runtime validators for seed ingestion (M2).
 * Keep field names aligned with the JSON schema (Vietnamese keys retained
 * where the schema uses them, e.g. `dap_an`, `loi_giai`, `quan_niem_sai`).
 */
import { z } from "zod";

export const Subject = z.enum(["Toan", "Hoa", "Anh", "Van"]);
export type Subject = z.infer<typeof Subject>;

export const NodeType = z.enum(["KN", "QT", "KY", "VD"]); // Khái niệm | Quy tắc | Kỹ năng | Vận dụng
export type NodeType = z.infer<typeof NodeType>;

export const BloomLevel = z.enum([
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
]);
export type BloomLevel = z.infer<typeof BloomLevel>;

export const RelationType = z.enum([
  "prerequisite_hard",
  "related_soft",
  "misconception",
  "cross_subject",
  "part_of",
]);
export type RelationType = z.infer<typeof RelationType>;

export const ContentStatus = z.enum(["active", "review", "retired"]);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const KgNode = z.object({
  id: z.string(),
  subject: Subject,
  grade: z.union([z.number(), z.string()]),
  chapter: z.string(),
  cluster: z.string().optional(),
  label: z.string(),
  type: NodeType,
  bloom_cu_tru: BloomLevel,
  mo_ta: z.string(),
  tieu_chi_dung_grain: z.string().optional(),
  thoi_gian_hoc_uoc_luong_phut: z.union([z.number(), z.string()]).optional(),
});
export type KgNode = z.infer<typeof KgNode>;

export const KgEdge = z.object({
  from: z.string(),
  to: z.string(),
  relation: RelationType,
  weight: z.number().min(0).max(1).default(1),
  ghi_chu: z.string().optional(),
});
export type KgEdge = z.infer<typeof KgEdge>;

export const KgTier = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ten: z.string(),
  bloom: z.string(),
  dok: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  muc_tieu: z.string(),
  resource_ids: z.array(z.string()).default([]),
  question_ids: z.array(z.string()).default([]),
});
export type KgTier = z.infer<typeof KgTier>;

export const Distractor = z.object({
  phuong_an: z.string(),
  quan_niem_sai: z.string(), // every distractor must bind exactly one misconception
});
export type Distractor = z.infer<typeof Distractor>;

export const AssessmentKind = z.enum(["objective", "rubric"]);
export type AssessmentKind = z.infer<typeof AssessmentKind>;

export const QuestionStats = z.object({
  p_value: z.number().nullable().optional(),
  discrimination: z.number().nullable().optional(),
  trang_thai: ContentStatus.default("review"),
});

/** Base shared by both question kinds. DOK and do_kho are INDEPENDENT labels. */
const QuestionBase = z.object({
  id: z.string(),
  node_id: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dok: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  do_kho: z.enum(["de", "TB", "kho"]),
  noi_dung: z.string(),
  tham_so_hoa: z.boolean().default(false),
  thong_ke_sau_trien_khai: QuestionStats.optional(),
});

export const ObjectiveQuestion = QuestionBase.extend({
  loai_danh_gia: z.literal("objective"),
  dap_an: z.string(),
  loi_giai: z.string().optional(),
  distractors: z.array(Distractor).default([]),
});
export type ObjectiveQuestion = z.infer<typeof ObjectiveQuestion>;

export const RubricCriterion = z.object({
  tieu_chi: z.string(),
  thang_muc: z.array(z.string()), // descriptors per band
});

export const RubricQuestion = QuestionBase.extend({
  loai_danh_gia: z.literal("rubric"),
  rubric: z.array(RubricCriterion),
  bai_mau: z.array(z.string()).default([]), // exemplars, prefer boundary cases
  loi_thuong_gap: z.array(z.string()).default([]),
});
export type RubricQuestion = z.infer<typeof RubricQuestion>;

export const Question = z.discriminatedUnion("loai_danh_gia", [
  ObjectiveQuestion,
  RubricQuestion,
]);
export type Question = z.infer<typeof Question>;

export const SocraticRung = z.object({
  bac: z.number(),
  loai: z.string(), // sieu nhan thuc | huong chu y | dan ve tien de | gian giao manh
  cau_hoi: z.string(),
});

export const EffortGateRule = z.object({
  so_lan_thu_toi_thieu: z.number().int().min(1).default(2),
  yeu_cau: z.string(),
  contingent: z.string().optional(),
  cam: z.string().optional(),
});
export type EffortGateRule = z.infer<typeof EffortGateRule>;

export const SocraticLadder = z.object({
  id: z.string(),
  node_id: z.string(),
  misconception: z.string(),
  rungs: z.array(SocraticRung),
  bottom_out: z.object({
    dieu_kien_mo: z.string(),
    noi_dung: z.string(),
  }),
  cong_no_luc: EffortGateRule,
});
export type SocraticLadder = z.infer<typeof SocraticLadder>;

export const Resource = z.object({
  id: z.string(),
  node_id: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  format: z.enum([
    "text",
    "infographic",
    "video",
    "animation",
    "mindmap",
    "podcast",
    "worked_example",
    "interactive",
  ]),
  ly_do_chon_format: z.string().optional(),
  dual_coding: z.boolean().default(false),
  accessibility: z.string().optional(),
  uri: z.string().optional(),
});
export type Resource = z.infer<typeof Resource>;
