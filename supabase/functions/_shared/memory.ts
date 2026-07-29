/**
 * TRÍ NHỚ CỦA SƯ TỬ — ba lớp, dựng từ dữ liệu ĐÃ CÓ, không thêm bảng nào.
 *
 * Vì sao có (rà 29/07, chủ dự án đưa một đoạn hội thoại thật): trong 7 lượt sư
 * tử trả lời thì 4 lượt là câu soạn sẵn, 3 lượt còn lại có gọi mô hình nhưng
 * `user` chỉ gửi lên ĐÚNG MỘT CÂU em vừa gõ. Hậu quả đo được:
 *   · em đã kể cách nghĩ hai lượt liền, lượt sau máy vẫn hỏi "bạn kể xem đã
 *     nghĩ thế nào" — vì nhánh đó không đọc gì cả;
 *   · lượt cuối mô hình mở lời bằng "Chào bạn!" GIỮA cuộc trò chuyện, rồi
 *     giảng lại đúng cái định nghĩa em vừa nêu chuẩn hai lượt trước.
 *
 * Ba lớp, xếp theo giá:
 *   1. SỔ TAY   (~100 token) — trạng thái rút từ `attempts`: em đã thử mấy lần,
 *      sai vào phương án nào, quan niệm sai nào lộ ra, đã kể cách nghĩ chưa.
 *   2. LỊCH SỬ  (~260 token) — 6 lượt qua lại gần nhất trong `session_turns`.
 *      Bảng này VỐN ĐÃ GHI ĐỦ, chỉ là chưa ai đọc lại.
 *   3. HỒ SƠ    (~40 token)  — quan niệm sai LẶP LẠI của em qua nhiều buổi,
 *      đếm thẳng trên `attempts.matched_misconception`. KHÔNG tốn lượt gọi mô
 *      hình nào để tóm tắt: đây là phép đếm, không phải phép hiểu.
 *
 * Đo trên prod: em gõ trung bình 21 ký tự, sư tử 114 → cả ba lớp cộng lại còn
 * NHẸ HƠN lời dặn vai (536 token) vẫn gửi mỗi lượt. Trí nhớ không phải thứ đắt;
 * thứ đắt là SỐ LƯỢT GỌI.
 */

import { anonymize } from "./llm.ts";

/** Số lượt qua lại gần nhất mang theo. 6 lượt ≈ 12 dòng ≈ 260 token. */
const TURN_WINDOW = 12;
/** Cắt mỗi dòng: một bài tự luận dài dán vào chat không được nuốt cả cửa sổ. */
const LINE_CAP = 220;
/** Quan niệm sai phải lặp ÍT NHẤT 2 lần mới vào hồ sơ — một lần là tai nạn. */
const RECURRING_MIN = 2;

export interface TutorMemory {
  /** Trạng thái câu đang làm. */
  soTay: string;
  /** Hội thoại gần nhất, đã ẩn danh. */
  lichSu: string;
  /** Nét lặp lại của em qua nhiều buổi. */
  hoSo: string;
  /** Em đã NÓI (không phải chỉ bấm đáp án) ít nhất một lần trong buổi này chưa.
   *  Quyết định có gọi mô hình ở nhánh "mời kể cách nghĩ" hay không: chưa nói
   *  câu nào thì chẳng có gì để nhớ, gọi mô hình chỉ tốn thêm một vòng chờ. */
  daNoi: boolean;
}

const clip = (s: unknown, n = LINE_CAP) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Bấm một đáp án ("A", "C", "0,5") khác hẳn KỂ một suy nghĩ. Chỉ lời kể mới
 *  đáng gọi là "em đã nói" — bấm chữ cái thì không có gì để bám vào. */
function isSpoken(content: string): boolean {
  const t = clip(content, 400);
  if (t.length < 12) return false;
  return t.split(/\s+/).filter(Boolean).length >= 3;
}

export async function buildMemory(
  // deno-lint-ignore no-explicit-any
  supa: any,
  opts: {
    sessionId: string;
    studentId: string;
    questionId?: string;
    /** Tên thật cần ẩn trước khi đưa vào prompt. */
    names: string[];
    /** Lời em VỪA gõ ở lượt này. Nhánh gọi đã `persist` nó theo kiểu bắn-rồi-quên
     *  nên nó có thể đã kịp nằm trong `session_turns` — mà nó cũng sắp đi riêng
     *  trong thẻ <hoc_sinh>. Loại ở đây để mô hình khỏi đọc một câu hai lần rồi
     *  tưởng em nói hai lần. */
    omitContent?: string;
  },
): Promise<TutorMemory> {
  const [turnsRes, attRes, recurRes] = await Promise.all([
    supa
      .from("session_turns")
      .select("role, content, meta, created_at")
      .eq("session_id", opts.sessionId)
      .order("created_at", { ascending: false })
      .limit(TURN_WINDOW),
    opts.questionId
      ? supa
        .from("attempts")
        .select("attempt_no, raw_answer, is_correct, matched_misconception, thinking_quality")
        .eq("session_id", opts.sessionId)
        .eq("question_id", opts.questionId)
        .order("attempt_no", { ascending: true })
        .limit(20)
      : Promise.resolve({ data: [] }),
    // Hồ sơ dài hạn: đếm quan niệm sai lặp lại của em, MỌI buổi. Trần 400 dòng
    // để một em học nhiều tháng không kéo cả lịch sử về.
    supa
      .from("attempts")
      .select("matched_misconception")
      .eq("student_id", opts.studentId)
      .not("matched_misconception", "is", null)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  // ── Lớp 2: lịch sử (đảo lại cho đúng thứ tự thời gian) ────────────────────
  const omit = clip(opts.omitContent ?? "", 400);
  const rows = ([...(turnsRes.data ?? [])].reverse() as Array<{ role: string; content: string }>)
    .filter((r) => !(omit && r.role === "student" && clip(r.content, 400) === omit));
  const lichSu = rows
    .map((r) => `${r.role === "student" ? "BẠN ẤY" : "MÌNH"}: ${clip(r.content)}`)
    .join("\n");
  const daNoi = rows.some((r) => r.role === "student" && isSpoken(r.content));

  // ── Lớp 1: sổ tay câu đang làm ────────────────────────────────────────────
  const att = (attRes.data ?? []) as Array<{
    attempt_no: number;
    raw_answer: string | null;
    is_correct: boolean | null;
    matched_misconception: string | null;
    thinking_quality: number | null;
  }>;
  const soTayParts: string[] = [];
  if (att.length) {
    const sai = att.filter((a) => a.is_correct === false).map((a) => clip(a.raw_answer, 40)).filter(Boolean);
    soTayParts.push(`đã thử ${att.length} lần ở câu này`);
    if (sai.length) soTayParts.push(`đã chọn/điền rồi mà chưa đúng: ${[...new Set(sai)].join(" · ")}`);
    const qn = [...new Set(att.map((a) => a.matched_misconception).filter(Boolean))] as string[];
    if (qn.length) soTayParts.push(`chỗ hiểu lệch đã lộ ra: ${qn.map((x) => clip(x, 90)).join(" · ")}`);
  }
  if (daNoi) soTayParts.push("bạn ấy ĐÃ kể cách nghĩ rồi — ĐỪNG hỏi lại như thể chưa nghe gì");

  // ── Lớp 3: hồ sơ dài hạn ──────────────────────────────────────────────────
  const tally = new Map<string, number>();
  for (const r of (recurRes.data ?? []) as Array<{ matched_misconception: string | null }>) {
    const k = clip(r.matched_misconception, 90);
    if (k) tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const recurring = [...tally.entries()]
    .filter(([, n]) => n >= RECURRING_MIN)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${k} (${n} lần)`);

  // Ẩn danh MỘT LƯỢT cho cả ba lớp rồi vứt bảng tra: prompt không cần tên thật,
  // và lời sư tử nói ra sau đó do nhánh gọi tự rehydrate phần của nó.
  const { text: safeHistory } = anonymize(lichSu, opts.names);
  const { text: safeNote } = anonymize(soTayParts.join(" · "), opts.names);

  return {
    soTay: safeNote,
    lichSu: safeHistory,
    hoSo: recurring.length ? `hay vướng lại: ${recurring.join(" · ")}` : "",
    daNoi,
  };
}
