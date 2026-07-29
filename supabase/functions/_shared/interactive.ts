/**
 * Chấm TẤT ĐỊNH cho các dạng tương tác objective mà CAS không phủ:
 *   - dung_sai : Đúng/Sai (chuẩn hoá đồng nghĩa vi/en)
 *   - sap_xep  : xếp thứ tự — so khớp DÃY (có thứ tự)
 *   - noi_cot  : nối cột — so khớp TẬP CẶP (không phụ thuộc thứ tự trình bày)
 *   - checklist: "Đúng/Sai chùm ý" — mcq CÓ dap_an dạng "a) Đ · b) S · c) Đ · d) Đ"
 *     (nhiều ý con, mỗi ý một nhãn chữ cái) — PHÁT HIỆN theo HÌNH DẠNG của dap_an,
 *     KHÔNG phụ thuộc dang_cau_hoi (nội dung thật trong DB gắn nhãn "mcq", không
 *     phải "dung_sai" — xem ghi chú ở checklistMap).
 *
 * Bộ chấm LIBERAL ở khâu phân tích chuỗi (chấp nhận nhiều kiểu ngăn cách người/
 * máy sinh ra) nhưng NGHIÊM ở khâu so khớp: dãy phải đúng thứ tự, cặp phải đủ &
 * đúng. Trả về null cho dạng không thuộc nhóm này → nơi gọi rơi về CAS.
 */

import { normalizeVnNumbers, normalizeTypography } from "./cas.ts";

export type InteractiveDang = "dung_sai" | "sap_xep" | "noi_cot";

export interface InteractiveVerdict {
  correct: boolean;
  method: "dung_sai" | "sap_xep" | "noi_cot" | "checklist" | "blanks";
}

const norm = (s: string): string =>
  (s ?? "")
    .toLowerCase()
    .replace(/đ/g, "d") // đ KHÔNG tách dưới NFD → thay tay, nếu không "đúng"→"đung"
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt
    .replace(/\s+/g, " ")
    .trim();

// ── dung_sai ─────────────────────────────────────────────────────────────────
const TRUE_WORDS = new Set(["dung", "true", "t", "d", "yes", "co", "1", "phai"]);
const FALSE_WORDS = new Set(["sai", "false", "f", "s", "no", "khong", "0"]);
function truthy(s: string): boolean | null {
  const n = norm(s);
  if (TRUE_WORDS.has(n)) return true;
  if (FALSE_WORDS.has(n)) return false;
  // câu dài: bắt từ khoá đầu tiên xuất hiện
  if (/\b(dung|true|phai)\b/.test(n)) return true;
  if (/\b(sai|false|khong)\b/.test(n)) return false;
  return null;
}

// ── sap_xep: "c - a - b - d" | "(3)→(1)" | "B, C, A, D." → nhãn sạch ──────────
// Gọt dấu bao quanh mỗi token (ngoặc, chấm) để "(3)"→"3", "D."→"D" — nếu không
// nhãn dính ngoặc sẽ dài >1 ký tự và bị hiểu nhầm là "xếp từ" thay vì "xếp nhãn".
function seq(s: string): string[] {
  return norm(s)
    .split(/[\s,;>→\-–—]+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim())
    .filter(Boolean);
}

// ── noi_cot: "1-B, 2-A" | "1:B; 2:A" → Map{1:b, 2:a} ──────────────────────────
function pairs(s: string): Map<string, string> {
  const m = new Map<string, string>();
  const src = norm(s);
  const re = /([a-z0-9]+)\s*[-:=→>]\s*([a-z0-9]+)/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(src)) !== null) m.set(hit[1]!, hit[2]!);
  return m;
}

// ── checklist ("Đúng/Sai chùm ý"): dap_an kiểu "a) Đ · b) S · c) Đ · d) Đ" hoặc
// "(a) Đúng, (b) Đúng, (c) Đúng, (d) Sai." → Map{a:true, b:true, c:true, d:false}.
// Nội dung thật gắn nhãn dang_cau_hoi="mcq" (không phải "dung_sai") nên PHẢI phát
// hiện từ HÌNH DẠNG dap_an, không từ dang — xem checklistCandidateKeys() ở dưới.
function splitTop(s: string, seps: string[]): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if ((ch === ")" || ch === "]" || ch === "}") && depth > 0) depth--;
    if (depth === 0 && seps.includes(ch)) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Phân tích dap_an thành Map<nhãn, đúng/sai>. Trả null nếu không đúng hình dạng
 *  "checklist" (≥2 nhãn chữ cái a-d, mỗi nhãn map RÕ RÀNG về đúng/sai, không lặp
 *  nhãn). Thử lần lượt 3 kiểu ngăn cách (; · ,) — dap_an thật chỉ dùng MỘT kiểu
 *  nhất quán trong toàn chuỗi nên thử-rồi-bỏ không sợ lẫn. */
function checklistMap(s: string): Map<string, boolean> | null {
  const src = s ?? "";
  for (const seps of [[";"], ["·"], [","]]) {
    const parts = splitTop(src, seps);
    if (parts.length < 2) continue;
    const map = new Map<string, boolean>();
    let ok = true;
    for (const p of parts) {
      const m = p.trim().match(/^\(?([a-dA-D])\)?\s*[).:]?\s*(.+)$/);
      if (!m) { ok = false; break; }
      const v = truthy(m[2]!);
      if (v === null) { ok = false; break; }
      const k = m[1]!.toLowerCase();
      if (map.has(k)) { ok = false; break; } // nhãn lặp lại → không phải checklist sạch
      map.set(k, v);
    }
    if (ok && map.size >= 2) return map;
  }
  return null;
}

/** Đáp án học sinh cho checklist — client gửi canonical "a:dung,b:sai,c:dung,d:dung"
 *  (xem ChecklistQuestion ở Interactive.tsx). Khoan dung từ đồng nghĩa qua truthy(). */
function checklistAnswerMap(s: string): Map<string, boolean> | null {
  const map = new Map<string, boolean>();
  for (const raw of (s ?? "").split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const val = truthy(part.slice(i + 1));
    if (key && val !== null) map.set(key, val);
  }
  return map.size > 0 ? map : null;
}

/** Chấm một dạng tương tác. Trả null nếu `dang`/`correct` không thuộc nhóm này. */
export function gradeInteractive(
  dang: string | null | undefined,
  student: string,
  correct: string,
): InteractiveVerdict | null {
  if (dang === "dung_sai") {
    const a = truthy(student);
    const b = truthy(correct);
    return { correct: a !== null && b !== null && a === b, method: "dung_sai" };
  }
  if (dang === "sap_xep") {
    const b = seq(correct);
    // Hai kiểu sap_xep: (1) NHÃN chữ cái "c - a - b - d" (token 1 ký tự) → so DÃY;
    // (2) XẾP TỪ thành câu, dap_an là cả câu → so chữ bỏ khoảng trắng (giữ thứ tự
    // + dấu câu, không kẹt vì ô "?" tách rời hay hoa/thường).
    if (b.length > 0 && b.every((t) => t.length === 1)) {
      const a = seq(student);
      const ok = a.length === b.length && a.every((x, i) => x === b[i]);
      return { correct: ok, method: "sap_xep" };
    }
    const na = norm(student).replace(/\s+/g, "");
    const nb = norm(correct).replace(/\s+/g, "");
    return { correct: na.length > 0 && na === nb, method: "sap_xep" };
  }
  if (dang === "noi_cot") {
    const a = pairs(student);
    const b = pairs(correct);
    let ok = b.size > 0 && a.size === b.size;
    if (ok) for (const [k, v] of b) if (a.get(k) !== v) { ok = false; break; }
    return { correct: ok, method: "noi_cot" };
  }
  // blanks (điền nhiều ô): chỉ UI nhiều ô mới nối đáp án bằng ";;", nên chuỗi
  // này là dấu hiệu chắc chắn. So TỪNG PHẦN với từng ô — trước đây học sinh
  // phải gõ trúng nguyên chuỗi "a; b" trong một ô duy nhất mới được tính đúng.
  if (student.includes(";;")) {
    const want = splitTop(correct, [";"]).filter(Boolean);
    const got = student.split(";;").map((x) => x.trim());
    if (want.length >= 2 && got.length === want.length) {
      // Từng ô so chữ đã chuẩn hoá; số kiểu Việt cũng phải khớp số kiểu máy —
      // "0,2" điền vào ô có đáp án "0.2" là ĐÚNG (lỗi 16, 29/07).
      // Ký tự sách in (x₀, √, ≥, dấu trừ U+2212) học sinh KHÔNG gõ được →
      // quy đổi về bàn phím trước khi so, y như checkAnswer (rà 29/07).
      const eq = (a: string, b: string) => {
        const ta = normalizeTypography(a);
        const tb = normalizeTypography(b);
        return (
          norm(ta) === norm(tb) ||
          norm(normalizeVnNumbers(ta)) === norm(normalizeVnNumbers(tb))
        );
      };
      const ok = want.every((w, i) => eq(got[i] ?? "", w));
      return { correct: ok, method: "blanks" };
    }
  }
  // checklist: KHÔNG gate theo `dang` — nội dung thật gắn nhãn "mcq". Phát hiện
  // từ HÌNH DẠNG dap_an (checklistMap trả null nếu không khớp) → an toàn cho mọi
  // câu mcq/dien_dap_an khác (không đổi hành vi chấm của chúng).
  const cb = checklistMap(correct);
  if (cb) {
    const ca = checklistAnswerMap(student);
    // Học sinh KHÔNG gửi dạng canonical "a:dung,b:sai,…" (UI checklist không dựng
    // được → rơi về nút chọn / ô nhập) → TRẢ NULL để CAS chấm y như trước, tuyệt
    // đối không chấm sai oan chỉ vì dap_an trông giống checklist.
    if (!ca) return null;
    let ok = ca.size === cb.size;
    if (ok) for (const [k, v] of cb) if (ca.get(k) !== v) { ok = false; break; }
    return { correct: ok, method: "checklist" };
  }
  return null;
}

export const INTERACTIVE_DANG = new Set(["dung_sai", "sap_xep", "noi_cot"]);

// ── Bóc cấu trúc đề để client dựng UI — DÙNG dap_an DẪN ĐƯỜNG ──────────────────
// Server có cả noi_dung + dap_an nên biết CHÍNH XÁC nhãn nào cần tìm (từ đáp án),
// bóc bền hơn hẳn đoán mù ở client. KHÔNG kèm thứ tự đúng / cặp đúng vào payload —
// chỉ gửi các mục để hiển thị; chấm vẫn ở server (gradeInteractive).
export interface OrderItem { key: string; text: string }
export interface InteractiveStruct {
  order?: { mode: "label" | "word"; intro: string; items: OrderItem[] };
  match?: { intro: string; left: OrderItem[]; right: OrderItem[] };
  checklist?: { intro: string; items: OrderItem[] };
  /** Điền khuyết NHIỀU ô: câu bị cắt tại mỗi chỗ trống → n+1 mảnh chữ, n ô nhập.
   *  `hints` = gợi ý KIỂU nội dung cho từng ô ("số", "biểu thức", "một cụm từ"…),
   *  suy từ HÌNH DẠNG đáp án — KHÔNG lộ đáp án. Người thử 3 đề nghị: em cần biết
   *  trước phải gõ kiểu gì thay vì đoán. */
  blanks?: { segments: string[]; count: number; hints: string[] };
}

/** Chỗ trống trong đề: từ 2 gạch dưới liền trở lên ("___", "______"). */
const BLANK_RE = /_{2,}/g;

/** Đề nhiều chỗ trống + đáp án tách bằng ";" ĐÚNG BẰNG số ô → bóc thành các
 *  mảnh chữ để client dựng ô nhập riêng cho từng chỗ. Trước đây cả câu chỉ có
 *  MỘT ô nhập nên học sinh phải gõ nguyên chuỗi "độ lệch chuẩn; số trung bình"
 *  mới đúng — và các ô trống sau vẫn trơ "______" trên màn hình.
 *  Trả null nếu số ô ≠ số phần đáp án (không suy diễn bừa). */
/** Gợi ý KIỂU nội dung của một ô, suy từ đáp án. CHỈ nói DẠNG, tuyệt đối không
 *  nói giá trị — "12" và "97" đều ra "một số", nên không moi được đáp án. */
function blankHint(part: string): string {
  const p = (part ?? "").trim();
  if (!p) return "…";
  if (/^[-+]?[\d.,]+$/.test(p)) return "một số";
  if (/^[<>=≥≤≠!]+$/.test(p)) return "dấu so sánh";
  if (/[=+\-*/^√()]|[₀-₉]|[²³]/.test(p)) return "biểu thức";
  const words = p.split(/\s+/).filter(Boolean).length;
  return words > 1 ? `một cụm ${words} từ` : "một từ";
}

function parseBlanks(
  noiDung: string,
  dapAn: string,
): { segments: string[]; count: number; hints: string[] } | null {
  const text = noiDung ?? "";
  const holes = text.match(BLANK_RE);
  if (!holes || holes.length < 2) return null;
  const parts = splitTop(dapAn ?? "", [";"]).filter(Boolean);
  if (parts.length !== holes.length) return null;
  const segments = text.split(BLANK_RE);
  if (segments.length !== holes.length + 1) return null;
  return { segments, count: holes.length, hints: parts.map(blankHint) };
}

/* Đáp án học sinh cho dạng nhiều ô: client nối các ô bằng ";;" — người gõ tay
   gần như không bao giờ tạo ra chuỗi đó, nên không đụng nhầm ô nhập thường. */

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Nhãn trong dap_an GIỮ NGUYÊN HOA/THƯỜNG (khác seq/pairs vốn chuẩn hoá) để khớp
// đúng nhãn trong đề (tránh "(cột B)" đụng nhãn phải 'b' khi so không phân biệt hoa).
const seqRaw = (s: string): string[] =>
  (s ?? "").split(/[\s,;>→–—-]+/).map((t) => t.trim()).filter(Boolean);
function pairsRaw(s: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /([A-Za-z0-9]+)\s*[-:=→>]\s*([A-Za-z0-9]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s ?? "")) !== null) out.push([m[1]!, m[2]!]);
  return out;
}

/** Tìm text của từng nhãn trong `keys` bên trong `text`, cắt lát tại mốc nhãn kế.
 *  Cho phép tiền tố cột kiểu "B-" trước nhãn (B-a → a). Trả theo THỨ TỰ XUẤT HIỆN.
 *  `ci`=phân biệt hoa/thường: bật cho nhãn chữ cái sap_xep, TẮT cho noi_cot. */
function extractByKeys(
  text: string,
  keys: string[],
  ci: boolean,
  allowColon: boolean,
): Array<{ key: string; text: string; at: number }> {
  const alt = [...keys].sort((a, b) => b.length - a.length).map(escRe).join("|");
  if (!alt) return [];
  // `:` chỉ là dấu KẾT nhãn cho noi_cot ("A1:"); KHÔNG cho sap_xep (kẻo nuốt nhầm
  // nhãn người thoại "A:"/"B:" trong nội dung câu).
  const term = allowColon ? "[).:]" : "[).]";
  const re = new RegExp(`(?<=^|[\\s,;|(:>\\u2013\\u2014])((?:[A-Za-z]-)?(?:${alt}))\\s*${term}\\s`, ci ? "gmi" : "gm");
  const canon = new Map(keys.map((k) => [ci ? k.toLowerCase() : k, k]));
  const hits: Array<{ key: string; content: number; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]!.replace(/^[A-Za-z]-/, ""); // bỏ tiền tố cột "B-"
    const key = canon.get(ci ? raw.toLowerCase() : raw);
    if (key) {
      // "(" mở nhãn kiểu "(a)" chỉ dùng làm lookbehind (zero-width) → KHÔNG bị
      // regex "nuốt". Lùi start qua nó để intro/nội dung mục trước không dính
      // dấu "(" thừa (nếu không "(a) X (b) Y" → mục a có text kết thúc bằng "(").
      let start = m.index;
      if (start > 0 && text[start - 1] === "(") start--;
      hits.push({ key, content: re.lastIndex, start });
    }
  }
  const out: Array<{ key: string; text: string; at: number }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < hits.length; i++) {
    if (seen.has(hits[i]!.key)) continue; // chỉ lấy lần xuất hiện ĐẦU của mỗi nhãn
    const to = i + 1 < hits.length ? hits[i + 1]!.start : text.length;
    const body = text.slice(hits[i]!.content, to).replace(/[\s,;|]+$/, "").trim();
    if (body) { out.push({ key: hits[i]!.key, text: body, at: hits[i]!.start }); seen.add(hits[i]!.key); }
  }
  return out;
}

export function parseInteractive(
  dang: string | null | undefined,
  noiDung: string,
  dapAn: string,
): InteractiveStruct | null {
  const prompt = noiDung ?? "";
  if (dang === "sap_xep") {
    // WORD: xếp TỪ thành câu — các từ trong nháy ngăn bởi "/".
    const quoted = prompt.match(/[‘'"“]([^’'"”]*\/[^’'"”]*)[’'"”]/);
    if (quoted && quoted[1]) {
      const toks = quoted[1].split("/").map((t) => t.trim()).filter(Boolean);
      if (toks.length >= 3) {
        const intro = prompt.slice(0, quoted.index).replace(/[:：]\s*$/, "").trim();
        return { order: { mode: "word", intro, items: toks.map((t, i) => ({ key: `w${i}`, text: t })) } };
      }
    }
    // LABEL: nhãn = token trong dap_an ("c - a - b - d" / "(3) → (1) → (2)").
    const keys = seqRaw(dapAn).map((t) => t.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean);
    const uniq = [...new Set(keys)];
    if (uniq.length < 2 || !uniq.every((k) => k.length <= 2 && /^[A-Za-z0-9]+$/.test(k))) return null;
    const found = extractByKeys(prompt, uniq, true, false);
    if (found.length < uniq.length) return null;
    const first = Math.min(...found.map((f) => f.at));
    const items = found.map((f) => ({ key: f.key, text: f.text })); // thứ tự xuất hiện (KHÔNG phải đáp án)
    return { order: { mode: "label", intro: prompt.slice(0, first).trim(), items } };
  }
  if (dang === "noi_cot") {
    const prs = pairsRaw(dapAn);
    if (prs.length < 2) return null;
    const leftKeys = [...new Set(prs.map((p) => p[0]))];
    const rightKeys = [...new Set(prs.map((p) => p[1]))];
    const lf = extractByKeys(prompt, leftKeys, false, true);
    const rf = extractByKeys(prompt, rightKeys, false, true);
    if (lf.length < leftKeys.length || rf.length < rightKeys.length) return null;
    const firstAt = Math.min(...lf.map((x) => x.at), ...rf.map((x) => x.at));
    return {
      match: {
        intro: prompt.slice(0, firstAt).trim(),
        left: lf.map((x) => ({ key: x.key, text: x.text })),
        right: rf.map((x) => ({ key: x.key, text: x.text })),
      },
    };
  }
  // BLANKS trước CHECKLIST: điều kiện của nó chặt hơn hẳn (đề phải có ≥2 chỗ
  // trống VÀ số phần đáp án phải khớp đúng số ô), nên xét trước thì không sợ
  // checklistMap "nhận vơ" một đáp án nhiều phần bắt đầu bằng chữ a–d.
  const bl = parseBlanks(prompt, dapAn);
  if (bl) return { blanks: bl };
  // CHECKLIST: đúng/sai chùm ý — phát hiện từ HÌNH DẠNG dap_an, KHÔNG phụ thuộc
  // dang_cau_hoi (dữ liệu thật đang gắn nhãn "mcq" cho dạng này, không phải
  // "dung_sai"). dap_an dạng "a) Đ · b) S · c) Đ · d) Đ" → checklistMap.
  const cb = checklistMap(dapAn);
  if (cb) {
    const keys = [...cb.keys()];
    const found = extractByKeys(prompt, keys, true, false);
    if (found.length < keys.length) return null;
    const first = Math.min(...found.map((f) => f.at));
    const items = found.map((f) => ({ key: f.key, text: f.text }));
    return { checklist: { intro: prompt.slice(0, first).trim(), items } };
  }
  return null;
}
