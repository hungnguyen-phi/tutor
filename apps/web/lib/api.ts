import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from "./config";
import { supabase } from "./supabase";

/**
 * Lỗi gọi Edge Function có MÃ để UI xử lý nhã nhặn thay vì phơi lỗi trần.
 * `code` bám theo `error` server trả (vd "rate_limited"); `retryAfter` là số
 * GIÂY nên chờ trước khi thử lại (đọc từ header `Retry-After` hoặc body).
 * Kế thừa Error nên mọi nơi bắt lỗi cũ (`e instanceof Error ? e.message`) vẫn chạy.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;
  constructor(message: string, opts: { status: number; code?: string; retryAfter?: number }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfter = opts.retryAfter;
  }
}

/**
 * HÂM NÓNG edge function (lỗi 12 — đăng nhập chậm, có ca hơn 1 phút).
 *
 * Đo 29/07 trên prod: lượt gọi ĐẦU vào một function đang ngủ mất ~1,7s chỉ để
 * dựng isolate; lượt sau còn ~120-200ms. Học sinh mở app → đăng nhập → mới gọi
 * learning-path, nên cú cold start rơi đúng vào lúc em chờ màn lộ trình.
 *
 * Gọi lúc MỞ MÀN ĐĂNG NHẬP: trong lúc em gõ email/mật khẩu (vài giây) thì các
 * function đã tỉnh. Request kèm khoá ANON (đủ qua cổng verify_jwt của Supabase,
 * thiếu là bị chặn 401 TRƯỚC khi isolate kịp dựng — tức không hâm nóng được gì);
 * hàm bên trong vẫn trả "unauthorized" vì không có phiên học sinh, nhưng isolate
 * đã sống. Mọi lỗi nuốt im lặng: đây là tối ưu, không phải chức năng.
 */
export function warmUpFunctions(fns: string[] = ["learning-path", "diagnose", "review-queue"]): void {
  if (typeof fetch === "undefined") return;
  for (const fn of fns) {
    void fetch(`${FUNCTIONS_BASE}/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        // PHẢI có Authorization: các function bật `verify_jwt` nên thiếu header
        // này là CỔNG Supabase chặn 401 TRƯỚC khi dựng isolate — tức là không
        // hâm nóng được gì. Khoá anon đủ qua cổng; hàm bên trong vẫn trả
        // "unauthorized" (không có phiên học sinh), nhưng isolate đã tỉnh.
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: "{}",
      keepalive: true,
    }).catch(() => {});
  }
}

/** Phiên đăng nhập đã hết hạn / không còn — mọi nơi gọi bắt mã này để mời đăng
 *  nhập lại, thay vì để màn hình chết câm. */
export const SESSION_EXPIRED = "session_expired";

async function callFn<T>(fn: string, body: unknown): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  // ⚠️ TUYỆT ĐỐI KHÔNG rơi về khoá anon khi hết phiên (lỗi 20, 29/07).
  // Đường cũ `?? SUPABASE_ANON_KEY` gửi khoá publishable làm token người dùng →
  // server không giải được ra userId → 401 cho MỌI lệnh gọi. Học sinh thấy màn
  // trống câm (học liệu 401 → LessonView rỗng; chat-turn 401 → không chấm được)
  // mà không câu nào nói cho biết là đã hết phiên. Thà dừng ngay và nói thật.
  if (!token) {
    throw new ApiError("Phiên đăng nhập đã hết hạn — bạn đăng nhập lại nhé.", {
      status: 401,
      code: SESSION_EXPIRED,
    });
  }
  const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  return await readJsonOrThrow<T>(fn, res);
}

/** Đọc phong bì JSON, dịch mã lỗi thành lời cho học sinh. Tách riêng để đường
 *  PHÁT CHỮ DẦN dùng chung — nó cũng có thể nhận về JSON (server chưa hỗ trợ,
 *  hoặc lượt đó không có gì để phát) và phải dịch lỗi Y HỆT. */
async function readJsonOrThrow<T>(fn: string, res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // ── Rate limit (429) ──────────────────────────────────────────────────
    // Bị chặn vì thao tác quá nhanh (helper rl_hit ở server). Ném lỗi CÓ MÃ
    // "rate_limited" để UI hiện lời dịu ("Em thao tác hơi nhanh, chờ chút
    // nhé") kèm số giây chờ, thay vì stack trace. retryAfter: ưu tiên header
    // chuẩn `Retry-After` (giây), rồi tới `retryAfter` trong body helper.
    if (res.status === 429 || data?.error === "rate_limited") {
      const headerRA = Number(res.headers.get("Retry-After"));
      const bodyRA = typeof data?.retryAfter === "number" ? data.retryAfter : NaN;
      const retryAfter = Number.isFinite(headerRA) && headerRA > 0
        ? Math.ceil(headerRA)
        : Number.isFinite(bodyRA) && bodyRA > 0
          ? Math.ceil(bodyRA)
          : undefined;
      throw new ApiError("Em thao tác hơi nhanh, chờ chút nhé.", {
        status: 429,
        code: "rate_limited",
        retryAfter,
      });
    }
    // Token còn nhưng server từ chối (hết hạn giữa chừng, khoá bị thu hồi) —
    // cũng là hết phiên. Gắn CÙNG mã để UI chỉ cần xử một trường hợp.
    if (res.status === 401) {
      throw new ApiError("Phiên đăng nhập đã hết hạn — bạn đăng nhập lại nhé.", {
        status: 401,
        code: SESSION_EXPIRED,
      });
    }
    throw new ApiError(data?.message ?? data?.error ?? `${fn} failed (${res.status})`, {
      status: res.status,
      code: typeof data?.error === "string" ? data.error : undefined,
    });
  }
  return data as T;
}

/** `nop_bai`: câu tự luận dài — học sinh làm NGOÀI (giấy/Word), tải bài lên,
 *  giáo viên chấm sau. App không chấm dạng này. */
export type QKind = "objective" | "rubric" | "writing" | "speaking" | "nop_bai";

export interface InteractiveItem { key: string; text: string }
/** Cấu trúc bóc sẵn ở server cho dạng tương tác — KHÔNG kèm thứ tự/cặp đúng. */
export interface InteractiveStruct {
  order?: { mode: "label" | "word"; intro: string; items: InteractiveItem[] };
  match?: { intro: string; left: InteractiveItem[]; right: InteractiveItem[] };
  /** "Đúng/Sai chùm ý": nhiều ý con a/b/c/d, mỗi ý tick Đúng hoặc Sai. */
  checklist?: { intro: string; items: InteractiveItem[] };
  /** Điền khuyết NHIỀU ô: n+1 mảnh chữ xen n ô nhập. `hints` gợi ý KIỂU nội dung
   *  từng ô ("một số", "biểu thức"…) — suy từ hình dạng đáp án, không lộ giá trị. */
  blanks?: { segments: string[]; count: number; hints?: string[] };
}

export interface DiagnoseQuestion {
  id: string;
  nodeKey: string;
  tier: number;
  dok: number;
  doKho: string;
  kind: QKind;
  prompt: string;
  options?: string[];
  rubric?: unknown;
  /** 1 trong 17 dạng Studio (mcq, dung_sai, sap_xep, noi_cot…) — dựng UI tương ứng. */
  dangCauHoi?: string | null;
  interactive?: InteractiveStruct;
}

export interface DiagnoseResult {
  sessionId: string;
  kgVersionId: string;
  node: string | null;
  questions: DiagnoseQuestion[];
}

/** Câu do ENGINE ÁP CỨNG tiêm động (vá nền / leo ngược) — khác DiagnoseQuestion
 *  ở chỗ tier có thể null và kind luôn "objective". */
export interface EngineQuestion {
  id: string;
  nodeKey: string;
  tier: number | null;
  dok: number;
  doKho: string;
  kind: string;
  prompt: string;
  options?: string[];
  dangCauHoi?: string | null;
  interactive?: InteractiveStruct;
}

/** XP server-authoritative (bảng student_xp) — số THẬT thay cho cache máy. */
export interface XpState {
  total: number;
  streak: number;
  /** XP thật sự cộng thêm lượt này (0 = nguồn này đã ăn trước đó, chống farm). */
  gained: number;
}

export interface RubricScore { tieu_chi: string; diem: number; nhan_xet: string }
/** Đợt B: kết quả chấm rubric theo kỹ năng (formative — không phải điểm chính thức). */
export interface RubricResult {
  skill: "writing" | "speaking" | "reasoning";
  ten: string;
  scores: RubricScore[];
  tong: number;
  toi_da: number;
  muc: string;
  nhan_xet_chung: string;
  cau_hoi_sua: string;
}

export interface TurnResult {
  correct?: boolean;
  /** false = lượt này KHÔNG được chấm (cổng ý định: xin gợi ý / bài rác / lượt
   *  kể-cách-nghĩ) — client hiện lời dẫn, KHÔNG hiện trạng thái sai. */
  graded?: boolean;
  /** Đợt B: chấm rubric có điểm theo tiêu chí (writing/speaking). */
  rubric?: RubricResult;
  attemptNo?: number;
  gate?: string;
  currentRung?: number;
  message?: string;
  feedback?: string;
  kind?: string;
  note?: string;
  /** Engine áp cứng: mastery sống sau mỗi câu. */
  mastered?: boolean;
  masteryScore?: number;
  /** Server cộng XP mỗi lượt trả lời — UI ghi đè cache máy bằng số này. */
  xp?: XpState;
  /** Sai + hết thang → lan truyền ngược: engine kéo về nguyên tử nền còn hổng. */
  remediate?: { nodeKey: string; label: string; question: EngineQuestion };
  /** Vá xong nền (mastered) → leo ngược về node đang kẹt kèm câu của nó. */
  climb?: { nodeKey: string; question: EngineQuestion };
  /** Đúng nhưng nền chưa vững → câu nền kế tiếp để tiếp tục vá. */
  continue?: { nodeKey: string; question: EngineQuestion };
}

/** Môn học web hỗ trợ. Toan/Anh đã live (có ngân hàng câu hỏi trong DB);
 *  Van đang XEM TRƯỚC — learning-path trả rỗng/lỗi thì web tự về lộ trình tĩnh. */
export type Subject = "Toan" | "Van" | "Anh" | "GDKTPL";

export const diagnose = (subject: Subject, nodeKey?: string, questionId?: string) =>
  callFn<DiagnoseResult>("diagnose", {
    subject,
    ...(nodeKey ? { nodeKey } : {}),
    // Luồng LÀM LẠI: server đưa đúng câu bị trả lên đầu phiên.
    ...(questionId ? { questionId } : {}),
  });

/**
 * PHÁT CHỮ DẦN cho lượt trò chuyện (29/07).
 *
 * Vì sao: mỗi lượt sư tử nói, học sinh nhìn màn hình trống tới khi mô hình viết
 * XONG cả câu. Đó là quãng chờ dài nhất của một lượt và không cách nào mua ngắn
 * lại được — chỉ có cách đừng bắt em đợi trọn câu.
 *
 * Server chỉ phát dần khi ta gửi `stream: true`. Không nhận được dòng SSE (bản
 * function cũ, proxy gom bộ đệm, mạng chập) thì hàm này TỰ ĐỌC JSON như cũ —
 * nên web mới chạy được với function cũ, và ngược lại.
 */
async function callFnStream<T>(
  fn: string,
  body: unknown,
  onDelta: (chunk: string) => void,
  /** Phong bì tới TRƯỚC mẩu chữ đầu tiên — client cần nó để biết lượt này là
   *  "được chấm" hay "chỉ dẫn dắt", vì hai kiểu hiện ra khác nhau. */
  onMeta?: (meta: Record<string, unknown>) => void,
): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) {
    throw new ApiError("Phiên đăng nhập đã hết hạn — bạn đăng nhập lại nhé.", {
      status: 401,
      code: SESSION_EXPIRED,
    });
  }
  const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ ...(body as Record<string, unknown>), stream: true }),
  });
  const ctype = res.headers.get("Content-Type") ?? "";
  // Server trả JSON (bản function cũ chưa biết phát dần, hoặc lượt này không có
  // gì để phát, hoặc lỗi) → ĐỌC CHÍNH PHẢN HỒI NÀY.
  //
  // ⚠️ TUYỆT ĐỐI KHÔNG gọi lại `callFn(fn, body)` ở đây. Yêu cầu đã tới server
  // và đã được xử lý rồi — gọi lại là NỘP BÀI HAI LẦN: thêm một lượt thử vào
  // `attempts`, ăn thêm một nhịp của cổng nỗ lực, và có thể lật cả phán quyết.
  if (!res.ok || !res.body || !ctype.includes("text/event-stream")) {
    return await readJsonOrThrow<T>(fn, res);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let meta: Record<string, unknown> = {};
  let message = "";
  let sawDone = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      let event = "message";
      let data = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let j: Record<string, unknown>;
      try {
        j = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue; // mẩu lỗi lẻ không được giết cả lượt
      }
      if (event === "meta") { meta = j; onMeta?.(j); }
      else if (event === "delta") {
        const t = String(j.t ?? "");
        if (t) { message += t; onDelta(t); }
      } else if (event === "done") {
        // Câu chốt của server là BẢN THẬT (đã hoàn nguyên tên, đã lùi về câu tất
        // định nếu mô hình câm). Ghi đè phần cóp nhặt từ các mẩu.
        message = String(j.message ?? message);
        sawDone = true;
      }
    }
  }
  // Đứt giữa chừng mà CHƯA nhận được chữ nào: nói thật là mạng đứt. Cũng KHÔNG
  // gọi lại — server đã xử lý lượt này rồi (xem ghi chú chống nộp hai lần ở trên).
  if (!sawDone && !message) {
    throw new ApiError("Đường truyền đứt giữa chừng — bạn thử lại giúp mình nhé.", {
      status: 0,
      code: "stream_broken",
    });
  }
  return { ...meta, message } as T;
}

/** `remediation`: bật khi trả lời câu engine TIÊM (vá nền) để engine biết phục
 *  vụ câu nền kế tiếp / leo ngược thay vì coi như luồng chính. */
export const answer = (
  sessionId: string,
  questionId: string,
  studentAnswer: string,
  remediation = false,
  /** Có thì đi đường PHÁT CHỮ DẦN. Chỉ nhánh "mời em nói rõ thêm" mới có chữ để
   *  phát — mọi kết cục khác server trả JSON ngay và hàm đọc thẳng phong bì đó,
   *  KHÔNG gọi lại (gọi lại là nộp bài hai lần). */
  stream?: {
    onDelta: (chunk: string) => void;
    onMeta?: (meta: Record<string, unknown>) => void;
  },
) => {
  const payload = {
    sessionId,
    action: "answer",
    questionId,
    studentAnswer,
    ...(remediation ? { remediation: true } : {}),
  };
  return stream
    ? callFnStream<TurnResult>("chat-turn", payload, stream.onDelta, stream.onMeta)
    : callFn<TurnResult>("chat-turn", payload);
};

/** B0 (29/07) — lượt "KỂ CÁCH EM NGHĨ": gửi suy nghĩ, KHÔNG phải đáp án.
 *  Server không chấm, không ghi lượt thử; chỉ đối thoại (thang Socratic) và
 *  ghi nhớ chất lượng suy nghĩ cho cổng nỗ lực. Cũng là đường của nút Xin gợi ý. */
export const answerReflect = (
  sessionId: string,
  questionId: string,
  reasoning: string,
  onDelta?: (chunk: string) => void,
) =>
  onDelta
    ? callFnStream<TurnResult>(
      "chat-turn",
      { sessionId, action: "answer", questionId, reasoning },
      onDelta,
    )
    : callFn<TurnResult>("chat-turn", { sessionId, action: "answer", questionId, reasoning });

export const writing = (sessionId: string, questionId: string, text: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "writing", questionId, text });

/**
 * Nộp bài tự luận dài — AI CHẤM HẾT (chủ dự án chốt 01/08; trước đó phán quyết
 * là của giáo viên, nhưng đo được 0/69 bản nộp từng được chấm Đạt).
 *
 * Ba cửa vào, server quy về một chuỗi rồi mới chấm:
 *  · `text`     — bài em gõ (công thức bọc trong `$…$`, xem BaiLamEditor).
 *  · `filePath` — ẢNH bài viết tay → mô hình nhìn chép lại, hoặc tệp .docx →
 *    server tự giải nén, đổi công thức Word sang LaTeX. Tệp tải thẳng lên
 *    storage bằng JWT của học sinh (policy `student_work_insert` chặn ghi ra
 *    ngoài thư mục của mình).
 * Gửi cả hai cũng được — em gõ lời giải rồi chụp thêm hình vẽ là chuyện thường,
 * và server chấm trên BÀI GỘP chứ không chấm nửa này bỏ nửa kia.
 */
export const submitWork = (
  sessionId: string,
  questionId: string,
  // KHÔNG có attemptNo: server đếm lần thử từ bảng attempts (client tự khai thì
  // bịa được XP "nỗ lực", mà vào lại bài hôm sau bộ đếm client cũng về 0).
  opts: { text?: string; filePath?: string; mime?: string; size?: number },
) =>
  callFn<{
    kind: string;
    /** false = cổng ý định chặn (bài rác / lời xin trợ giúp / tệp không đọc
     *  được) — chưa nhận bài, ô nhập giữ nguyên cho em sửa. */
    submitted: boolean;
    /**
     * PHÁN QUYẾT (01/08 — AI chấm hết, giáo viên không chấm nữa):
     *   true  = đạt, mastery + XP đã ghi.
     *   false = chưa đạt, xem `thieu`, nộp lại bao nhiêu lần cũng được.
     *   null  = CHƯA chấm được (LLM hỏng / hết ngân sách token). Bài vẫn giữ.
     *           Đây KHÔNG phải điểm trượt — client phải nói đúng như vậy.
     */
    dat?: boolean | null;
    feedback?: string;
    /** Ý còn thiếu, chỉ có khi `dat === false`. */
    thieu?: string;
    /** Chỗ đọc hụt khi bài nộp bằng ảnh/Word (ảnh mờ, công thức Word lạ). */
    canhBao?: string;
    mastered?: boolean;
    xp?: { total: number; streak: number; gained: number };
  }>("chat-turn", {
    sessionId,
    action: "submit-work",
    questionId,
    ...opts,
  });

/** Tải tệp bài làm lên đúng thư mục của học sinh: bai-lam/<trường>/<học sinh>/…
 *  Trả về đường dẫn trong bucket để gửi kèm submitWork. */
export async function uploadWork(file: File): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Bạn cần đăng nhập lại để nộp bài.");
  const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", uid).single();
  const tenant = prof?.tenant_id;
  if (!tenant) throw new Error("Không đọc được thông tin trường của bạn.");
  // Tên tệp: giờ nộp + tên gốc đã làm sạch (giữ đuôi để giáo viên biết mở bằng gì).
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
  const path = `bai-lam/${tenant}/${uid}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("learning-assets").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Tải tệp lên không được: ${error.message}`);
  return path;
}

export const speaking = (sessionId: string, questionId: string, transcript: string) =>
  callFn<TurnResult>("chat-turn", { sessionId, action: "speaking", questionId, transcript });

export interface EndResult {
  sessionId: string;
  nodes: Array<{ node: string; mastered: boolean; score: number }>;
  /** +20 XP hoàn thành buổi (một lần mỗi phiên). */
  xp?: XpState;
}

export const endSession = (sessionId: string) =>
  callFn<EndResult>("end-session", { sessionId });

// ── Teacher (M3.5) ──────────────────────────────────────────────────────────
/** Một học sinh trong roster quản trị (server suy từ attempts + node_state). */
export interface RosterStudent {
  id: string;
  name: string;
  grade: string | null;
  mastered: number;
  tracked: number;
  accuracy: number;   // 0..1
  avgEffort: number;  // lượt thử TB tới khi đúng
  attempts: number;
  lastActiveAt: string | null;
  dueReviews: number;
  flags: string[];    // vd "cần kèm", "đến hạn ôn", "chưa bắt đầu", "lâu chưa học"
}

export interface TeacherStats {
  metrics: {
    misconceptions: Array<{ label: string; count: number }>;
    effort: { avgAttemptsToCorrect: number; accuracy: number; totalAttempts: number };
    mastery: { mastered: number; tracked: number; rate: number };
  };
  review: {
    questions: Array<{
      id: string; key: string; node: string; kind: string; status: string; prompt: string;
      /** Thống kê sống (question-stats) — null khi chưa đủ dữ liệu trả lời. */
      pValue?: number | null; discrimination?: number | null; statsN?: number | null;
    }>;
    ladders: Array<{ id: string; key: string; node: string; misconception: string; status: string }>;
  };
  // ── Quản trị lớp (THÊM — optional để tương thích khi server chưa cập nhật) ──
  roster?: {
    total: number;
    needAttention: number;
    students: RosterStudent[];
  };
  topics?: Array<{ nodeKey: string; label: string; mastered: number; tracked: number; avgScore: number }>;
  /** H6 tra sâu: node states theo từng HS (id → danh sách node đã chạm). */
  studentNodes?: Record<string, Array<{ key: string; label: string; mastered: boolean; score: number; due: boolean }>>;
  activity?: {
    activeSessions: number;
    dueReviewsTotal: number;
    pendingSubmissions: number;
    activeStudents7d: number;
  };
}

export const teacherStats = () => callFn<TeacherStats>("teacher-stats", {});

export const teacherReview = (kind: "question" | "ladder", id: string, status: string) =>
  callFn<{ ok: boolean }>("teacher-review", { kind, id, status });

// ── Chấm bài nộp ngoài (ảnh chụp / file Word học sinh tải lên) ────────────────
export interface GradingItem {
  id: string;
  studentName: string;
  nodeLabel: string;
  prompt: string;
  /** Đáp án mẫu để đối chiếu — CHỈ giáo viên thấy. */
  reference: string;
  /** Bài GÕ của học sinh (nếu em gõ thay vì chỉ chụp ảnh). */
  text: string | null;
  /** Sơ khảo của AI trên bài gõ — giáo viên là người quyết cuối. */
  aiVerdict: { dung?: boolean; thieu?: string } | null;
  hasFile: boolean;
  mime: string | null;
  sizeKb: number | null;
  status: "pending" | "passed" | "redo";
  note: string | null;
  /** Tên tệp chữa bài thầy cô đã đính ở lượt chấm trước (Đ2). */
  noteFileName: string | null;
  submittedAt: string;
  gradedAt: string | null;
}
export const gradingList = (status: "pending" | "passed" | "redo" = "pending") =>
  callFn<{ items: GradingItem[] }>("teacher-grading", { action: "list", status });
/** Link xem bài, hạn 1 giờ (bucket private). */
export const gradingFile = (id: string) =>
  callFn<{ url: string }>("teacher-grading", { action: "file", id });
/** `pass=false` → bài về trạng thái "làm lại": lộ trình học sinh hiện bàn chân đỏ. */
export const gradingGrade = (id: string, pass: boolean, note: string, noteFilePath?: string) =>
  callFn<{ ok: boolean; status: string; mastered?: boolean }>("teacher-grading", {
    action: "grade",
    id,
    pass,
    note,
    ...(noteFilePath ? { noteFilePath } : {}),
  });

/**
 * Đ2 — tải TỆP CHỮA BÀI của thầy cô lên bucket private, trả đường dẫn để gửi
 * kèm lời nhắn. Cùng lối với `uploadWork` của học sinh, khác prefix để policy
 * `teacher_note_file_insert` bắt đúng: cham-bai/<trường>/<giáo viên>/…
 */
export async function uploadTeacherNoteFile(file: File): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Bạn cần đăng nhập lại.");
  const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", uid).single();
  const tenant = prof?.tenant_id;
  if (!tenant) throw new Error("Không đọc được thông tin trường.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
  const path = `cham-bai/${tenant}/${uid}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("learning-assets").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Tải tệp lên không được: ${error.message}`);
  return path;
}

// ── Lớp phủ nội dung GV (H5) — ẩn/sửa câu + lý do; áp lúc phục vụ ─────────────
export interface ContentOverride {
  id: string;
  content_id: string;
  action: "hide" | "edit";
  patch: Record<string, unknown>;
  reason: string;
  created_at: string;
}
export const listOverrides = () =>
  callFn<{ overrides: ContentOverride[] }>("teacher-override", { action: "list" });
export const createOverride = (
  contentId: string,
  reason: string,
  overrideAction: "hide" | "edit" = "hide",
  patch?: Record<string, unknown>,
) =>
  callFn<{ ok: boolean }>("teacher-override", {
    action: "create", contentId, reason, overrideAction, ...(patch ? { patch } : {}),
  });
export const removeOverride = (contentId: string) =>
  callFn<{ ok: boolean }>("teacher-override", { action: "remove", contentId });

/** Quét câu kém: tính p_value/discrimination toàn ngân hàng + tự đưa câu quá
 *  dễ/khó/không phân biệt vào hàng duyệt. Chạy đêm bằng pg_cron; nút này là
 *  đường gọi tay. */
export const recomputeQuestionStats = () =>
  callFn<{ ok: boolean; updated: number; flagged: number }>("question-stats", {});

// ── 4DX Weekly Scoreboard ─────────────────────────────────────────────────────
export interface Scoreboard {
  student: { id: string; name: string };
  weekStart: string;
  viewer: { self: boolean; staff: boolean; mentorKind: "homeroom_coach" | "buddy" | null };
  limited: boolean;
  wigs: Array<{ area: string; areaLabel: string; title: string; targetDesc: string | null; progressPct: number; source: "tutor" | "manual" }>;
  leadMeasures: Array<{ label: string; targetText: string | null; valueText: string | null; status: "green" | "amber" | "red" }>;
  effort: { rank: number | null; scope: "lop" | "khoi" | "cap" | "truong" };
  commitment: string;
  subjectProgress: Array<{ subject: string; pct: number }>;
  coach: { name: string | null; cadenceDays: number; lastMeetingAt: string | null } | null;
  buddy: { name: string | null; lastMeetingAt: string | null } | null;
  sync: { syncedAt: string | null };
  /** XP server của học sinh đang xem: tổng + tuần này + chuỗi ngày. */
  xp?: { total: number; week: number; streak: number; lastDay: string | null };
  /** BẢNG TUẦN THẬT theo KHỐI: bạn cùng khối, XP tuần + chuỗi (self/staff mới có). */
  board?: BoardView | null;
  /** BẢNG TUẦN THẬT theo LỚP: chỉ có khi học sinh thuộc một lớp (classes). */
  classBoard?: BoardView | null;
  /** Nhãn khối, vd "Khối 10". */
  gradeLabel?: string;
  /** Tên lớp, vd "10A1"; null nếu chưa xếp lớp. */
  className?: string | null;
  /** VÌ SAO bảng trống — để màn hình nói đúng lý do (lỗi 5):
   *  `unassigned` = hồ sơ chưa có khối/lớp · `too_few` = chưa đủ người thật. */
  boardIssue?: "unassigned" | "too_few" | null;
}

export interface BoardView {
  scope: string;
  /** Nhãn tab: tên lớp ("10A1") hoặc khối ("Khối 10"). */
  label?: string;
  rows: Array<{ id: string; name: string; xp: number; streak: number; me: boolean }>;
}

export const getScoreboard = (studentId?: string) =>
  callFn<Scoreboard>("scoreboard", { action: "get", studentId });

export const commitScoreboard = (commitment: string, studentId?: string) =>
  callFn<{ ok: boolean; commitment: string }>("scoreboard", { action: "commit", commitment, studentId });

export const syncScoreboard = (studentId?: string) =>
  callFn<{ ok: boolean; syncedAt: string; export: unknown; note: string }>("scoreboard", { action: "sync", studentId });

// ── Lộ trình & học liệu (KG v2.2) ────────────────────────────────────────────
// Hai function này có thể CHƯA deploy — nơi gọi phải tự bắt lỗi và fallback,
// giao diện không được phép vỡ khi server trả 404.
export type PathNodeState = "mastered" | "stale" | "current" | "available" | "locked" | "redo";

export interface LearningPathNode {
  key: string;
  label: string;
  state: PathNodeState;
  /** Với node bị khoá: các điểm tiên quyết còn thiếu (mảng KEY). */
  blockedBy?: string[];
  /** Tên chương/Unit — có thì lộ trình gom thành CHẶNG (điểm dừng khi cuộn). */
  chapter?: string;
  /** Tiến trình dang dở 0..1 = số câu đã làm / số câu của bài (chưa mastered). */
  progress?: number;
  doneCount?: number;
  totalCount?: number;
  /** Số bài nộp đang chờ giáo viên chấm trên node này. */
  pending?: number;
  /** Bài bị TRẢ VỀ: đúng những câu cần làm lại + lời nhắn của thầy cô. */
  redo?: Array<{
    questionId: string;
    note: string | null;
    /** Tệp chữa bài thầy cô gửi kèm — link đã ký, hạn 1 giờ (Đ2). */
    noteFileUrl?: string | null;
    noteFileName?: string | null;
  }>;
  /** Bài ĐÃ ĐẠT mà thầy cô còn nhắn thêm / gửi bài chữa. */
  praise?: Array<{
    questionId: string;
    note: string | null;
    noteFileUrl?: string | null;
    noteFileName?: string | null;
  }>;
  /** Kho báu học liệu đứng CẠNH bài (không nằm trong bài). */
  khoBau?: { mucCoSan: number[]; mucDaQua: number };
}

/** Một bài trong hàng đợi ôn tập (function `review-queue`). */
export interface ReviewItem {
  key: string;
  label: string;
  chapter: string | null;
  /** Hộp Leitner 0..3 → nhịp 1 · 3 · 7 · 21 ngày. */
  box: number;
  nextReviewAt: string | null;
  /** Đã quá hạn bao nhiêu ngày (due) hoặc còn mấy ngày nữa (soon/strong). */
  days: number;
}

export interface ReviewQueue {
  due: ReviewItem[];
  soon: ReviewItem[];
  strong: ReviewItem[];
  total: number;
  /** Ngày hẹn gần nhất — để màn rỗng nói "quay lại ngày …", không nói "chưa có gì". */
  nextAt?: string | null;
}

/** Hàng đợi ôn tập THẬT từ server (student_node_state.next_review_at). Thay cho
 *  localStorage: khoá cũ chỉ ghi khi kết thúc trọn buổi nên đổi máy là mất sạch. */
export const reviewQueue = (subject?: Subject) =>
  callFn<ReviewQueue>("review-queue", subject ? { subject } : {});

export interface LearningPathResult {
  version_id: string;
  version_label: string;
  nodes: LearningPathNode[];
}

export const learningPath = (subject: Subject) =>
  callFn<LearningPathResult>("learning-path", { subject });

// ── Đồng thuận kép (K3, PDPL) ────────────────────────────────────────────────
export interface ConsentStatus {
  record: {
    status: "active" | "withdrawn";
    dual_consent: boolean;
    student_assent: boolean;
    guardian_consent_by: string | null;
  } | null;
  /** Đã đủ đồng thuận để xử lý dữ liệu chưa (gate hasActiveConsent trả cùng ý). */
  complete: boolean;
  /** Còn thiếu ưng thuận của HS. */
  needsAssent: boolean;
  /** Còn thiếu đồng ý của người giám hộ. */
  needsGuardian: boolean;
}
export const consentStatus = () => callFn<ConsentStatus>("consent", { action: "status" });
/** HS tự ưng thuận cho bản ghi của chính mình. */
export const giveAssent = () => callFn<{ ok: boolean }>("consent", { action: "assent" });
/** Người giám hộ đồng ý cho con (studentId bỏ trống → tự suy nếu chỉ 1 con). */
export const grantConsent = (studentId?: string) =>
  callFn<{ ok: boolean }>("consent", { action: "grant", ...(studentId ? { studentId } : {}) });
/** Rút đồng ý → dừng xử lý ngay (PDPL). */
export const withdrawConsent = (studentId?: string) =>
  callFn<{ ok: boolean }>("consent", { action: "withdraw", ...(studentId ? { studentId } : {}) });

// Khớp enum `Resource.format` trong @tutor/shared (kg/types.ts).
export type ResourceFormat =
  | "text"
  | "infographic"
  | "video"
  | "animation"
  | "mindmap"
  | "podcast"
  | "worked_example"
  | "interactive"
  | "slide"
  | "worksheet"
  | "flashcard"
  | "quiz";

export interface NodeResource {
  id: string;
  /** Khoá gom NHÓM: nhiều định dạng của cùng một học liệu dùng chung khoá này. */
  nhom?: string;
  tieuDe?: string | null;
  format: ResourceFormat;
  tier?: 1 | 2 | 3;
  uri?: string;
  ly_do_chon_format?: string;
  dual_coding?: boolean;
}

export interface KhoBauResult {
  resources: NodeResource[];
  /** Đã đi qua tới mức mấy (0..3) · mức đang mở = mucDaQua + 1. */
  mucDaQua: number;
  mucDangMo: number;
  /** Các mức THẬT SỰ có học liệu — bài chỉ có mức 1 thì đừng vẽ ba bậc. */
  mucCoSan: number[];
  conMucSau: boolean;
  /** Server chặn vì bài chưa mở (còn bài tiên quyết chưa thành thạo). */
  khoa?: boolean;
  /** Câu [NOPBAI] của cùng bài — có thì kho báu mở được đường NỘP bài đã làm
   *  ngoài (phiếu bài tập tải về rồi làm giấy). Vắng = bài này chưa có câu nộp. */
  nopBaiQuestionId?: string;
}

export const nodeResources = (subject: Subject, nodeKey: string) =>
  callFn<KhoBauResult>("resources", { subject, node_key: nodeKey });

/** Ghi nhận "đã xong mức này" — server chỉ cộng ĐÚNG MỘT mức và chỉ khi hợp lệ. */
export const khoBauXong = (subject: Subject, nodeKey: string, muc: number) =>
  callFn<KhoBauResult>("resources", { subject, node_key: nodeKey, action: "done", muc });

// ── Học liệu: phía GIÁO VIÊN ────────────────────────────────────────────────
export interface TeacherNode {
  key: string;
  label: string;
  chapter: string;
  soCau: number;
  soHocLieu: number;
  soHien: number;
}
export interface TeacherResourceItem {
  id: string;
  resource_key: string | null;
  tieu_de: string | null;
  format: ResourceFormat;
  tier: number | null;
  uri: string;
  ly_do_chon_format: string | null;
  hien_thi: boolean;
  status: string;
  created_at: string;
}
export const teacherNodes = (subject: Subject = "Toan") =>
  callFn<{
    version: { id: string; label: string; subject: string } | null;
    classes: Array<{ id: string; name: string; grade: string }>;
    phamVi: string;
    nodes: TeacherNode[];
  }>("teacher-resources", { action: "nodes", subject });

export const teacherNodeResources = (nodeKey: string, subject: Subject = "Toan") =>
  callFn<{ node: { key: string; label: string; chapter: string }; items: TeacherResourceItem[] }>(
    "teacher-resources", { action: "list", nodeKey, subject });

export const teacherResourceSave = (opts: {
  id?: string; nodeKey: string; resourceKey?: string; tieuDe?: string;
  format: ResourceFormat; tier: number; uri: string; goiY?: string; hienThi?: boolean;
  subject?: Subject;
}) => callFn<{ ok: boolean; id: string }>("teacher-resources", { action: "save", subject: "Toan", ...opts });

export const teacherResourceToggle = (id: string, hienThi: boolean) =>
  callFn<{ ok: boolean }>("teacher-resources", { action: "toggle", id, hienThi });

export const teacherResourceRemove = (id: string) =>
  callFn<{ ok: boolean }>("teacher-resources", { action: "remove", id });

/** Trần một tệp tải lên, theo cấu hình kho của dự án (đo 28/07: 50 MB).
 *  Video quay màn hình/hoạt hình rất dễ vượt — chặn TỪ TRƯỚC kèm lời khuyên,
 *  thay vì để kho ném ra "The object exceeded the maximum allowed size". */
export const TRAN_TEP_MB = 50;

/** Tải tệp học liệu lên đúng thư mục của trường: hoc-lieu/<trường>/<bài>/… */
export async function uploadHocLieu(file: File, nodeKey: string): Promise<string> {
  const mb = file.size / (1024 * 1024);
  if (mb > TRAN_TEP_MB) {
    throw new Error(
      `Tệp nặng ${mb.toFixed(1)} MB — kho chỉ nhận tối đa ${TRAN_TEP_MB} MB. ` +
      "Với video, cách gọn nhất là tải lên YouTube (để 'không công khai') hoặc Google Drive " +
      "rồi DÁN LINK vào ô bên cạnh — app tự nhúng, học sinh xem ngay trong bài và không tốn kho của trường.",
    );
  }
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Bạn cần đăng nhập lại.");
  const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", uid).single();
  const tenant = prof?.tenant_id;
  if (!tenant) throw new Error("Không đọc được thông tin trường.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
  const path = `hoc-lieu/${tenant}/${nodeKey}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("learning-assets").upload(path, file, {
    // Content-type ĐÚNG là điều kiện để quiz .html hiện ra thay vì bị tải về.
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Tải tệp lên không được: ${error.message}`);
  return path;
}

// ── Role dashboards (one role-gated endpoint) ─────────────────────────────────
export type DashAction = "coach" | "parent" | "buddy" | "leadership" | "admin" | "dpo" | "counselor";
// Loosely typed: each role returns its own shape (see supabase/functions/dashboard).
export const dashboard = <T = Record<string, unknown>>(action: DashAction) =>
  callFn<T>("dashboard", { action });

// ── Đồng bộ nội dung từ Studio (content-sync) ─────────────────────────────────
export interface SyncGroup { subject: string; grade: number; version: string; nodes: number; edges: number; questions: number; ladders: number }
export interface SyncResult { ok: boolean; synced: SyncGroup[]; message?: string }
/** Kéo nội dung ĐÃ verified từ DB Studio → Tutor (upsert, nội dung mới vào review).
 *  Bỏ trống subject/grade = đồng bộ tất cả. autoPublish=true → active thẳng. */
export const contentSync = (opts: { subject?: string; grade?: number; autoPublish?: boolean } = {}) =>
  callFn<SyncResult>("content-sync", opts);

// ── Roster & Admin (Pha 3) ────────────────────────────────────────────────────
export interface RosterClass {
  id: string;
  grade: string;
  name: string;
  schoolYear: string | null;
  homeroom: string | null;
  students: number;
}
export interface RosterOverview {
  classes: RosterClass[];
  totals: { students: number; unassigned: number };
}
export interface RosterStudentRow {
  id: string;
  name: string | null;
  email: string | null;
  grade: string | null;
  classId: string | null;
}
export interface ImportResult {
  ok: boolean;
  created: number;
  updated: number;
  errorCount: number;
  errors: { email: string; error: string }[];
  /** Mật khẩu tạm cho tài khoản MỚI (pilot password-login) — admin phát rồi ép đổi. */
  credentials: { email: string; password: string }[];
}

/** Cửa quản trị roster (chỉ admin). action: overview | roster | createClass |
 *  upsertStudent | import | assignHomeroom | assignMentor | linkParent | sync. */
export const adminRoster = <T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}) =>
  callFn<T>("admin-roster", { action, ...payload });

// ── Nhập liệu từ App sản xuất (Studio) ────────────────────────────────────────
// Server đưa bundle vào review_queue chờ duyệt — KHÔNG publish thẳng.
// Function `import-kg` thuộc GĐ1: chưa deploy thì lỗi — UI nói thật và đưa
// lệnh CLI cho đội vận hành thay vì giả vờ đã nạp.
export type ImportKgResult = {
  ok: boolean;
  version?: string;
  nodes?: number;
  edges?: number;
  message?: string;
};
export const importKg = (bundle: unknown) => callFn<ImportKgResult>("import-kg", bundle);

// ── Cửa cắm bộ câu hỏi (Đợt 2) ────────────────────────────────────────────────
// Gói va.kg-questions/2.2 → câu hỏi vào 'review' của phiên bản khớp version_label.
export type ImportQuestionsResult = {
  ok: boolean;
  version?: string;
  accepted?: number;
  rejected?: number;
  queued?: number;
  coverage?: { nodesWithQuestions: number; totalNodes: number };
  rejectedSample?: { id: string; reason: string }[];
  message?: string;
};
export const importQuestions = (bundle: unknown) =>
  callFn<ImportQuestionsResult>("import-questions", bundle);
