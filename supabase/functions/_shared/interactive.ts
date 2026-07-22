/**
 * Chấm TẤT ĐỊNH cho các dạng tương tác objective mà CAS không phủ:
 *   - dung_sai : Đúng/Sai (chuẩn hoá đồng nghĩa vi/en)
 *   - sap_xep  : xếp thứ tự — so khớp DÃY (có thứ tự)
 *   - noi_cot  : nối cột — so khớp TẬP CẶP (không phụ thuộc thứ tự trình bày)
 *
 * Bộ chấm LIBERAL ở khâu phân tích chuỗi (chấp nhận nhiều kiểu ngăn cách người/
 * máy sinh ra) nhưng NGHIÊM ở khâu so khớp: dãy phải đúng thứ tự, cặp phải đủ &
 * đúng. Trả về null cho dạng không thuộc nhóm này → nơi gọi rơi về CAS.
 */

export type InteractiveDang = "dung_sai" | "sap_xep" | "noi_cot";

export interface InteractiveVerdict {
  correct: boolean;
  method: "dung_sai" | "sap_xep" | "noi_cot";
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

/** Chấm một dạng tương tác. Trả null nếu `dang` không thuộc nhóm này. */
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
}

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
    if (key) hits.push({ key, content: re.lastIndex, start: m.index });
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
  return null;
}
