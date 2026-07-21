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

/**
 * Danh mục 16 dạng câu hỏi — Schema v2.2 (chốt 08/07/2026).
 * Nguồn: "DANH MỤC DẠNG CÂU HỎI v2.2 — ĐẶC TẢ CHO TRẠM 3 & ĐỘI UI".
 */
export const QuestionForm = z.enum([
  // Nhóm A — chấm tự động, chi phí ~0
  "mcq",
  "dung_sai",
  "dien_dap_an",
  "dien_khuyet",
  "sap_xep",
  "noi_cot",
  "nhieu_buoc",
  // Nhóm B — chấm bằng agent + rubric
  "tu_luan_ngan",
  "tim_loi",
  "viet_doan",
  "giai_thich_cho_ban",
  "du_doan_giai_thich",
  "phan_bien",
  "van_dung_thuc_te",
  "phan_tu",
  // Nhóm C — cần hạ tầng media
  "noi",
  "nghe",
]);
export type QuestionForm = z.infer<typeof QuestionForm>;

/** Router chấm: auto không bao giờ gọi LLM. */
export const GradingGroup = z.enum(["auto", "rubric_agent", "speaking_agent"]);
export type GradingGroup = z.infer<typeof GradingGroup>;

export const UiRequirement = z.enum([
  "none",
  "audio_player",
  "image_upload",
  "drag_drop",
  "microphone",
  "video_player",
]);
export type UiRequirement = z.infer<typeof UiRequirement>;

/** Bảng tra bất biến: mỗi dạng thuộc đúng một nhóm chấm và một yêu cầu UI. */
export const FORM_SPEC: Record<
  QuestionForm,
  { nhom_cham: GradingGroup; ui_can_thiet: UiRequirement; tinh_mastery: boolean }
> = {
  mcq: { nhom_cham: "auto", ui_can_thiet: "none", tinh_mastery: true },
  dung_sai: { nhom_cham: "auto", ui_can_thiet: "none", tinh_mastery: true },
  dien_dap_an: { nhom_cham: "auto", ui_can_thiet: "none", tinh_mastery: true },
  dien_khuyet: { nhom_cham: "auto", ui_can_thiet: "none", tinh_mastery: true },
  sap_xep: { nhom_cham: "auto", ui_can_thiet: "drag_drop", tinh_mastery: true },
  noi_cot: { nhom_cham: "auto", ui_can_thiet: "drag_drop", tinh_mastery: true },
  nhieu_buoc: { nhom_cham: "auto", ui_can_thiet: "none", tinh_mastery: true },
  tu_luan_ngan: { nhom_cham: "rubric_agent", ui_can_thiet: "none", tinh_mastery: true },
  tim_loi: { nhom_cham: "rubric_agent", ui_can_thiet: "none", tinh_mastery: true },
  viet_doan: { nhom_cham: "rubric_agent", ui_can_thiet: "none", tinh_mastery: true },
  giai_thich_cho_ban: { nhom_cham: "rubric_agent", ui_can_thiet: "none", tinh_mastery: true },
  du_doan_giai_thich: { nhom_cham: "rubric_agent", ui_can_thiet: "video_player", tinh_mastery: true },
  phan_bien: { nhom_cham: "rubric_agent", ui_can_thiet: "none", tinh_mastery: true },
  van_dung_thuc_te: { nhom_cham: "rubric_agent", ui_can_thiet: "image_upload", tinh_mastery: true },
  // phan_tu là phản tư siêu nhận thức — ghi log cho GVCN, KHÔNG đóng góp mastery.
  phan_tu: { nhom_cham: "rubric_agent", ui_can_thiet: "none", tinh_mastery: false },
  noi: { nhom_cham: "speaking_agent", ui_can_thiet: "microphone", tinh_mastery: true },
  nghe: { nhom_cham: "auto", ui_can_thiet: "audio_player", tinh_mastery: true },
};

/** Dạng chấm tự động ⇒ loai_danh_gia='objective'; còn lại ⇒ 'rubric'. */
export const kindOfForm = (form: QuestionForm): AssessmentKind =>
  FORM_SPEC[form].nhom_cham === "auto" ? "objective" : "rubric";

export const QuestionStats = z.object({
  p_value: z.number().nullable().optional(),
  discrimination: z.number().nullable().optional(),
  /** Elo hiệu chỉnh từ dữ liệu thật; ghi đè ước lượng do_kho ban đầu. */
  elo: z.number().nullable().optional(),
  trang_thai: ContentStatus.default("review"),
});

/**
 * Base shared by both question kinds.
 *
 * DOK và do_kho là HAI TRỤC ĐỘC LẬP. DOK = chiều sâu tư duy, do người soạn đặt.
 * do_kho = tỉ lệ học sinh làm được, ban đầu là ước lượng, sau đó Elo/p_value
 * hiệu chỉnh bằng dữ liệu thật. `mastery.ts` dùng CẢ HAI cùng lúc: thành thạo
 * cần ≥3/4 đúng *ở độ khó mục tiêu* VÀ ≥1 câu *DOK≥3*. Gộp hai trục thì cổng
 * chống-đoán-mò sụp thành một điều kiện.
 */
/** Một tham số của câu khuôn: số nguyên trong [min,max], có thể cấm 0. */
export const ParamDef = z.object({
  name: z.string().regex(/^\w+$/, "tên tham số chỉ gồm chữ/số/gạch dưới"),
  min: z.number().int(),
  max: z.number().int(),
  nonzero: z.boolean().optional(),
});
export const ParamSpec = z.object({ params: z.array(ParamDef).min(1) });
export type ParamSpec = z.infer<typeof ParamSpec>;

const QuestionBase = z.object({
  id: z.string(),
  node_id: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dang_cau_hoi: QuestionForm,
  dok: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  do_kho: z.enum(["de", "TB", "kho"]),
  /** true khi do_kho mới là phỏng đoán của người soạn, chưa có dữ liệu thật. */
  do_kho_uoc_luong: z.boolean().default(true),
  noi_dung: z.string(),
  tham_so_hoa: z.boolean().default(false),
  /**
   * Spec sinh tham số câu khuôn (chỉ khi tham_so_hoa=true). noi_dung/dap_an/
   * distractor dùng {name}; máy sinh (paramgen) thay giá trị cụ thể mỗi lượt,
   * CAS chấm theo params. Duyệt KHUÔN một lần → vô hạn biến thể (Q12).
   */
  tham_so: ParamSpec.optional(),
  /** Bậc 2–3 mặc định hỏi kèm độ tự tin (1–3) để phát hiện "đúng nhờ đoán". */
  hoi_do_tu_tin: z.boolean().default(false),
  thong_ke_sau_trien_khai: QuestionStats.optional(),
});

/** Một bước của câu `nhieu_buoc` — chấm riêng để biết học sinh hỏng Ở BƯỚC NÀO. */
export const QuestionStep = z.object({
  bac: z.number().int().min(1),
  noi_dung: z.string(),
  dap_an: z.string(),
  quan_niem_sai: z.string(), // bước hỏng PHẢI gắn misconception
});
export type QuestionStep = z.infer<typeof QuestionStep>;

/** Lỗi cài sẵn trong câu `tim_loi` — erroneous example. */
export const PlantedError = z.object({
  vi_tri: z.string(),
  mo_ta_loi: z.string(),
  sua_dung: z.string(),
  quan_niem_sai: z.string(),
});
export type PlantedError = z.infer<typeof PlantedError>;

export const ObjectiveQuestion = QuestionBase.extend({
  loai_danh_gia: z.literal("objective"),
  dap_an: z.string(),
  loi_giai: z.string().optional(),
  distractors: z.array(Distractor).default([]),
  /** Bắt buộc khi dang_cau_hoi='nhieu_buoc'. */
  buoc: z.array(QuestionStep).default([]),
  /** Đường dẫn audio, bắt buộc khi dang_cau_hoi='nghe'. */
  audio_uri: z.string().optional(),
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
  /** Bắt buộc khi dang_cau_hoi='tim_loi'. */
  loi_cai_san: z.array(PlantedError).default([]),
});
export type RubricQuestion = z.infer<typeof RubricQuestion>;

const QuestionUnion = z.discriminatedUnion("loai_danh_gia", [
  ObjectiveQuestion,
  RubricQuestion,
]);

/**
 * Ràng buộc liên-trường: dạng câu hỏi quyết định nhóm chấm và payload bắt buộc.
 * Chặn tại cửa, trước khi dữ liệu lệch đi sâu vào hệ.
 */
export const Question = QuestionUnion.superRefine((q, ctx) => {
  const expected = kindOfForm(q.dang_cau_hoi);
  if (q.loai_danh_gia !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["loai_danh_gia"],
      message: `dang_cau_hoi='${q.dang_cau_hoi}' phải đi với loai_danh_gia='${expected}', nhận '${q.loai_danh_gia}'`,
    });
  }

  // Câu khuôn tham số: phải có spec, và mọi {name} trong đề phải được khai —
  // chặn placeholder mồ côi (thay hụt → học sinh thấy "{b}" thô) tại cửa.
  if (q.tham_so_hoa) {
    if (!q.tham_so?.params?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tham_so"], message: "tham_so_hoa=true cần spec tham_so (≥1 tham số)" });
    } else {
      const declared = new Set(q.tham_so.params.map((p) => p.name));
      for (const m of q.noi_dung.matchAll(/\{(\w+)\}/g)) {
        if (!declared.has(m[1]!)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["noi_dung"], message: `dùng {${m[1]}} nhưng chưa khai trong tham_so` });
        }
      }
    }
  }

  if (q.loai_danh_gia === "objective") {
    if (q.dang_cau_hoi === "nhieu_buoc" && q.buoc.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buoc"],
        message: "nhieu_buoc cần 3–5 bước, mỗi bước gắn một quan_niem_sai",
      });
    }
    if (q.dang_cau_hoi === "nghe" && !q.audio_uri) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audio_uri"],
        message: "dạng 'nghe' bắt buộc có audio_uri",
      });
    }
    // mcq chẩn đoán qua distractor — distractor rỗng thì mất khả năng bắt quan niệm sai.
    if (q.dang_cau_hoi === "mcq" && q.distractors.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["distractors"],
        message: "mcq phải có distractor, mỗi cái gắn đúng một quan_niem_sai",
      });
    }
  } else if (q.dang_cau_hoi === "tim_loi" && q.loi_cai_san.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["loi_cai_san"],
      message: "tim_loi bắt buộc có lỗi cài sẵn, mỗi lỗi gắn một quan_niem_sai",
    });
  }
});
export type Question = z.infer<typeof QuestionUnion>;

/** Ngân hàng câu hỏi mỗi node phải ≥70% nhóm A — giữ chi phí LLM trong tầm kiểm soát. */
export const AUTO_GRADED_MIN_RATIO = 0.7;

export type BankCheck = {
  ok: boolean;
  total: number;
  autoRatio: number;
  reason?: string;
};

export const checkNodeBank = (questions: Question[]): BankCheck => {
  const total = questions.length;
  if (total === 0) return { ok: false, total, autoRatio: 0, reason: "ngân hàng rỗng" };
  const auto = questions.filter((q) => FORM_SPEC[q.dang_cau_hoi].nhom_cham === "auto").length;
  const autoRatio = auto / total;
  if (autoRatio < AUTO_GRADED_MIN_RATIO) {
    return {
      ok: false,
      total,
      autoRatio,
      reason: `chỉ ${(autoRatio * 100).toFixed(0)}% chấm tự động, cần ≥${AUTO_GRADED_MIN_RATIO * 100}%`,
    };
  }
  return { ok: true, total, autoRatio };
};

/**
 * Gói CHỈ CÂU HỎI — cửa cắm bộ câu hỏi cho giáo viên (Đợt 2). Khác KgBundle:
 * KHÔNG mang nodes/edges, chỉ nhét câu hỏi vào một phiên bản KG ĐÃ CÓ (khớp
 * subject + version_label). Đầu ra của `convert:questions` là mảng Question;
 * bọc mảng đó bằng envelope này rồi thả vào /teacher. Mọi câu vào trạng thái
 * 'review' → giáo viên duyệt mới phục vụ học sinh (human-in-the-loop).
 */
export const QuestionSet = z.object({
  schema: z.literal("va.kg-questions/2.2"),
  subject: Subject,
  version_label: z.string(),
  nguon: z.string().optional(),
  questions: z.array(Question).min(1),
});
export type QuestionSet = z.infer<typeof QuestionSet>;

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
    // Học liệu xuất từ Studio (Trạm 5)
    "slide",
    "worksheet",
    "flashcard",
    // quiz tự luyện: KHÔNG ghi mastery_evidence, khác hẳn bảng `questions`
    "quiz",
  ]),
  ly_do_chon_format: z.string().optional(),
  dual_coding: z.boolean().default(false),
  accessibility: z.string().optional(),
  uri: z.string().optional(),
});
export type Resource = z.infer<typeof Resource>;

/**
 * Gói nội dung một môn/khối, khớp đầu ra của quy trình 6 Trạm.
 * Đây là hình dạng JSON mà importer nhận: `pnpm --filter @tutor/db import:kg <file>`.
 */
export const KgBundle = z.object({
  schema: z.literal("va.kg-bundle/2.2"),
  subject: Subject,
  grade: z.union([z.number(), z.string()]),
  version_label: z.string(),
  nguon: z.string().optional(), // vd "KG_Tracker.xlsx · Trạm 1–5 · 2026-07-10"
  nodes: z.array(KgNode).default([]),
  edges: z.array(KgEdge).default([]),
  tiers: z.array(KgTier.extend({ node_id: z.string() })).default([]),
  questions: z.array(Question).default([]),
  ladders: z.array(SocraticLadder).default([]),
  resources: z.array(Resource).default([]),
});
export type KgBundle = z.infer<typeof KgBundle>;
