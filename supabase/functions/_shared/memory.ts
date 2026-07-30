/**
 * TRÍ NHỚ CỦA SƯ TỬ — ba lớp TÓM TẮT, dựng từ dữ liệu ĐÃ CÓ, không thêm bảng nào.
 *
 * Vì sao có (rà 29/07, chủ dự án đưa một đoạn hội thoại thật): trong 7 lượt sư
 * tử trả lời thì 4 lượt là câu soạn sẵn, 3 lượt còn lại có gọi mô hình nhưng
 * `user` chỉ gửi lên ĐÚNG MỘT CÂU em vừa gõ. Hậu quả đo được:
 *   · em đã kể cách nghĩ hai lượt liền, lượt sau máy vẫn hỏi "bạn kể xem đã
 *     nghĩ thế nào" — vì nhánh đó không đọc gì cả;
 *   · lượt cuối mô hình mở lời bằng "Chào bạn!" GIỮA cuộc trò chuyện, rồi
 *     giảng lại đúng cái định nghĩa em vừa nêu chuẩn hai lượt trước.
 *
 * ── TRẦN CỨNG, không phải "trung bình" (chủ dự án chốt 29/07) ───────────────
 * Bản đầu gửi NGUYÊN VĂN 12 lượt gần nhất. Trung bình chỉ ~400 token vì em gõ
 * ngắn (21 ký tự) — nhưng TRẦN là 1.031 token, gấp 2,6 lần con số trung bình,
 * và trần mới là thứ quyết định hoá đơn khi 500 em cùng học: $24 → $47/tháng.
 * Trung bình không phải thứ để lập ngân sách.
 *
 * Nay MỌI lớp đi qua một cái van chung `MEM_BUDGET`, cắt theo thứ tự ưu tiên
 * ngược: lịch sử cắt trước, hồ sơ cắt sau, sổ tay giữ tới cùng. Sổ tay là thứ
 * ĐẮT NHẤT về thông tin trên mỗi token — nó nói thẳng "em đã kể rồi" và "em đã
 * sai ở phương án nào", tức là đúng hai lỗi cần chặn.
 *
 * Ba lớp:
 *   1. SỔ TAY  — trạng thái rút từ `attempts` ở CÂU ĐANG LÀM.
 *   2. LỊCH SỬ — 4 lượt gần nhất NGUYÊN VĂN (ngắn) + một dòng CÔ ĐỌNG cho phần
 *      cũ hơn. Cái cần nhớ ở phần cũ không phải câu chữ, mà là "em đã nêu ý gì"
 *      và "mình đã hỏi gì rồi" — đúng hai thứ chặn việc hỏi lại và giảng lại.
 *   3. HỒ SƠ   — quan niệm sai LẶP LẠI qua nhiều buổi, đếm trên
 *      `attempts.matched_misconception`, ưu tiên gần đây. KHÔNG tốn lượt gọi mô
 *      hình nào để tóm tắt: đây là phép đếm, không phải phép hiểu.
 */

import { anonymize } from "./llm.ts";
import { isHelpRequest } from "./intent.ts";

/** TRẦN CỨNG cho cả khối trí nhớ (ký tự). Tiếng Việt ~3,2 ký tự/token ⇒ ~300
 *  token. Đây là con số vào ngân sách, không phải "thường thì khoảng". */
const MEM_BUDGET = 960;
/** Phần dành cho từng lớp, cộng lại vừa đúng trần. Cắt ngược từ dưới lên. */
const CAP_SO_TAY = 300;
const CAP_HO_SO = 140;
const CAP_LICH_SU = MEM_BUDGET - CAP_SO_TAY - CAP_HO_SO; // 520

/** Số lượt gần nhất giữ NGUYÊN VĂN. Bốn lượt = hai nhịp qua lại, đủ để bám
 *  mạch mà không phình. */
const VERBATIM_TURNS = 4;
/** Mỗi lượt nguyên văn tối đa bấy nhiêu ký tự. */
const VERBATIM_CAP = 110;
/** Đọc bấy nhiêu dòng để dựng phần cô đọng (không phải để gửi đi). */
const TURN_SCAN = 14;
/** Quan niệm sai phải lặp ÍT NHẤT 2 lần mới vào hồ sơ — một lần là tai nạn. */
const RECURRING_MIN = 2;
/** Chỉ đếm trên bấy nhiêu lượt thử GẦN ĐÂY. Vừa nén "theo thời gian" (nét cũ
 *  của em không đè nét hiện tại), vừa chặn một truy vấn phình theo tháng học. */
const PROFILE_SCAN = 150;

export interface TutorMemory {
  /** Trạng thái câu đang làm. */
  soTay: string;
  /** Hội thoại gần nhất — đã tóm tắt, đã ẩn danh. */
  lichSu: string;
  /** Nét lặp lại của em qua nhiều buổi. */
  hoSo: string;
  /** Em đã NÓI (không phải chỉ bấm đáp án) ít nhất một lần trong buổi này chưa.
   *  Quyết định có gọi mô hình ở nhánh "mời kể cách nghĩ" hay không: chưa nói
   *  câu nào thì chẳng có gì để nhớ, gọi mô hình chỉ tốn thêm một vòng chờ. */
  daNoi: boolean;
  /** Tổng số ký tự thực gửi đi — để đo, và để test khoá được trần. */
  size: number;
  /**
   * Số lượt XIN GIÚP LIÊN TIẾP ở cuối cuộc trò chuyện ("em chưa hiểu", "gợi ý
   * giúp mình với", hoặc lời cụt lủn).
   *
   * Vì sao cần đếm (rà 29/07): lời xin giúp bị hạ tín hiệu suy nghĩ xuống 0,3
   * để không ai bấm nút gợi ý mà mua được bậc thang. Đúng với em lười — nhưng
   * em KẸT THẬT cũng gõ đúng mấy chữ đó, và em không bao giờ nhích được bậc
   * nào: sư tử hỏi lại cùng một câu cho tới khi em bỏ cuộc. Đo trên hội thoại
   * thật: hai lượt "chưa hiểu" liền nhận về gần như y hệt một câu trả lời.
   */
  xinGiupLienTiep: number;
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * Khớp NGUYÊN TỪ tiếng Việt — KHÔNG dùng `\b` được.
 *
 * Bẫy đã trả giá (bộ kiểm bắt được 30/07): trong JS, `\w` chỉ là [A-Za-z0-9_],
 * nên chữ có dấu KHÔNG phải "ký tự chữ". `/\bvì\b/` không bao giờ khớp "vì" —
 * ranh giới từ đứt ngay tại "ì". Cũng thế với "gì", "đâu", "bởi"… Regex trông
 * đúng, chạy không lỗi, và im lặng trả về false MÃI MÃI.
 *
 * Cách đúng: cờ `u` + tự viết ranh giới bằng lớp chữ Unicode.
 */
function viWord(alts: string): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, "iu");
}

/**
 * Bấm một đáp án ("A", "C", "0,5") khác hẳn KỂ một suy nghĩ. Chỉ lời kể mới
 * đáng gọi là "em đã nói" — bấm chữ cái thì không có gì để bám vào.
 *
 * XIN ĐÁP ÁN cũng KHÔNG tính (vá 30/07, bộ kiểm bắt được): "câu nào sai ạ" đủ
 * dài, đủ số từ, nên bản đầu tính là đã trình bày suy nghĩ — rồi sổ tay báo lên
 * "bạn ấy ĐÃ kể cách nghĩ rồi" trong khi em mới chỉ hỏi xin đáp án. Sư tử đáp
 * theo đó là hiểu sai hẳn em đang ở đâu.
 */
function isSpoken(content: string): boolean {
  const t = clip(content, 400);
  if (t.length < 12) return false;
  if (isHelpRequest(t)) return false;
  // HỎI ≠ TRÌNH BÀY. "câu nào sai ạ" đủ dài, đủ từ, nhưng đó là em ĐANG HỎI
  // XIN đáp án chứ không phải đang kể cách nghĩ. Cố ý KHÔNG nới `isHelpRequest`
  // để bắt ca này: hàm đó gác việc CHẤM ĐIỂM, nới nó ra là nuốt nhầm bài làm
  // thật (đã trả giá một lần ngày 29/07). Luật này chỉ sống trong trí nhớ.
  //
  // Có dấu hiệu LẬP LUẬN thì vẫn tính là trình bày, dù có kèm câu hỏi ở cuối
  // ("em nghĩ là B vì nó khẳng định được, đúng không ạ?"). Câu dài cũng vậy —
  // em viết hẳn một đoạn thì đó là suy nghĩ, không phải câu hỏi cụt.
  const coLapLuan = viWord("vì|bởi|do|nên|suy ra|em nghĩ|mình nghĩ|theo em|theo mình|bước").test(t);
  const doiDapAn = viWord("đáp án|kết quả|câu trả lời").test(t) &&
    viWord("cho|nói|chỉ|bảo|biết|là gì").test(t);
  const dangHoi = /[?？]/.test(t) || viWord("nào|gì|sao|đâu|mấy|thế nào").test(t);
  if (doiDapAn && !coLapLuan) return false;
  if (dangHoi && !coLapLuan && t.length < 60) return false;
  return t.split(/\s+/).filter(Boolean).length >= 3;
}

/**
 * Cô đọng phần hội thoại CŨ thành MỘT dòng.
 *
 * Giữ nguyên văn cả đoạn cũ là cách tốn token nhất mà lại ít tác dụng nhất:
 * thứ cần nhớ ở đó không phải câu chữ, mà là hai điều —
 *   · em đã NÊU ra ý gì (để đừng giảng lại thứ em đã nói đúng);
 *   · mình đã HỎI gì rồi (để đừng hỏi lại y một câu).
 * Chọn "ý dài nhất" của em làm đại diện: lời dài nhất gần như luôn là lời có
 * nội dung nhất, còn "A", "C", "ừ" thì không mang thông tin nào.
 */
function condense(old: Array<{ role: string; content: string }>): string {
  if (!old.length) return "";
  const said = old.filter((r) => r.role === "student" && isSpoken(r.content))
    .map((r) => clip(r.content, 300))
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);
  const asked = old.filter((r) => r.role !== "student")
    .map((r) => clip(r.content, 300))
    .slice(-1);
  const parts: string[] = [`trước đó ${old.length} lượt`];
  if (said.length) parts.push(`bạn ấy đã nêu: ${said.map((x) => `"${clip(x, 70)}"`).join(" · ")}`);
  if (asked.length) parts.push(`mình đã hỏi: "${clip(asked[0]!, 70)}"`);
  return parts.join(" — ");
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
      .select("role, content, meta")
      .eq("session_id", opts.sessionId)
      .order("created_at", { ascending: false })
      .limit(TURN_SCAN),
    opts.questionId
      ? supa
        .from("attempts")
        .select("attempt_no, raw_answer, is_correct, matched_misconception")
        .eq("session_id", opts.sessionId)
        .eq("question_id", opts.questionId)
        .order("attempt_no", { ascending: true })
        .limit(20)
      : Promise.resolve({ data: [] }),
    // Hồ sơ dài hạn: đếm quan niệm sai lặp lại, chỉ trên các lượt GẦN ĐÂY.
    supa
      .from("attempts")
      .select("matched_misconception")
      .eq("student_id", opts.studentId)
      .not("matched_misconception", "is", null)
      .order("created_at", { ascending: false })
      .limit(PROFILE_SCAN),
  ]);

  // ── Lớp 2: lịch sử (đảo lại cho đúng thứ tự thời gian) ────────────────────
  //
  // ⚠️ LỌC THEO CÂU, không chỉ theo phiên (vá 30/07). Bản đầu chỉ lọc
  // `session_id` nên hội thoại của câu TRƯỚC tràn sang câu SAU: đo được trên
  // hội thoại thật — em vừa mở câu mới, chưa thử lần nào, mà sư tử nói "bạn đã
  // thử ba lần và vẫn ra cùng một đáp án". Đó là chuyện của câu cũ, và nó khiến
  // trí nhớ từ chỗ đáng tin thành chỗ bịa ra quá khứ không có thật.
  //
  // Dòng KHÔNG mang mã câu thì BỎ (chỉ khi biết mình đang ở câu nào): thà mất
  // vài dòng cũ còn hơn để lẫn câu. Từ bản này mọi lời sư tử đều mang mã câu.
  const omit = clip(opts.omitContent ?? "", 400);
  const rows = ([...(turnsRes.data ?? [])].reverse() as Array<
    { role: string; content: string; meta: { questionId?: string } | null }
  >)
    .filter((r) => !opts.questionId || r.meta?.questionId === opts.questionId)
    .filter((r) => !(omit && r.role === "student" && clip(r.content, 400) === omit));
  const daNoi = rows.some((r) => r.role === "student" && isSpoken(r.content));
  // Đếm NGƯỢC từ cuối: chỉ tính chuỗi xin giúp LIỀN NHAU sát lượt hiện tại. Em
  // xin giúp ở đầu buổi rồi tự làm được thì không tính là đang kẹt.
  let xinGiupLienTiep = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!;
    if (r.role !== "student") continue;
    if (isHelpRequest(r.content) || !isSpoken(r.content)) xinGiupLienTiep++;
    else break;
  }

  const recent = rows.slice(-VERBATIM_TURNS);
  const older = rows.slice(0, Math.max(0, rows.length - VERBATIM_TURNS));
  const lines: string[] = [];
  const gist = condense(older);
  if (gist) lines.push(`(${gist})`);
  for (const r of recent) {
    lines.push(`${r.role === "student" ? "BẠN ẤY" : "MÌNH"}: ${clip(r.content, VERBATIM_CAP)}`);
  }
  // Vẫn quá trần thì BỎ TỪ ĐẦU — dòng cũ nhất đi trước, lượt gần nhất giữ tới
  // cùng. Không dùng clip() ở đây: nó gộp mọi khoảng trắng nên nuốt luôn xuống
  // dòng, mà xuống dòng chính là thứ tách các lượt ra cho mô hình đọc.
  while (lines.join("\n").length > CAP_LICH_SU && lines.length > 1) lines.shift();
  const lichSu = lines.join("\n").slice(0, CAP_LICH_SU);

  // ── Lớp 1: sổ tay câu đang làm ────────────────────────────────────────────
  const att = (attRes.data ?? []) as Array<{
    raw_answer: string | null;
    is_correct: boolean | null;
    matched_misconception: string | null;
  }>;
  const soTayParts: string[] = [];
  if (att.length) {
    soTayParts.push(`đã thử ${att.length} lần ở câu này`);
    const sai = [...new Set(
      att.filter((a) => a.is_correct === false).map((a) => clip(a.raw_answer, 24)).filter(Boolean),
    )].slice(0, 5);
    if (sai.length) soTayParts.push(`đã thử rồi mà chưa đúng: ${sai.join(" · ")}`);
    const qn = [...new Set(att.map((a) => a.matched_misconception).filter(Boolean))] as string[];
    if (qn.length) soTayParts.push(`chỗ hiểu lệch đã lộ: ${clip(qn[0], 80)}`);
  }
  if (daNoi) soTayParts.push("bạn ấy ĐÃ kể cách nghĩ — ĐỪNG hỏi lại như chưa nghe gì");

  // ── Lớp 3: hồ sơ dài hạn ──────────────────────────────────────────────────
  const tally = new Map<string, number>();
  for (const r of (recurRes.data ?? []) as Array<{ matched_misconception: string | null }>) {
    const k = clip(r.matched_misconception, 70);
    if (k) tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const recurring = [...tally.entries()]
    .filter(([, n]) => n >= RECURRING_MIN)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, n]) => `${k} (${n} lần)`);

  // Ẩn danh MỘT LƯỢT rồi vứt bảng tra: prompt không cần tên thật, và lời sư tử
  // nói ra sau đó do nhánh gọi tự hoàn nguyên phần của nó.
  const soTay = clip(anonymize(soTayParts.join(" · "), opts.names).text, CAP_SO_TAY);
  const hoSo = recurring.length ? clip(`hay vướng lại: ${recurring.join(" · ")}`, CAP_HO_SO) : "";
  const safeHistory = anonymize(lichSu, opts.names).text.slice(0, CAP_LICH_SU);

  return {
    soTay,
    lichSu: safeHistory,
    hoSo,
    daNoi,
    size: soTay.length + safeHistory.length + hoSo.length,
    xinGiupLienTiep,
  };
}
