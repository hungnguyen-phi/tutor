/**
 * CAS answer-equivalence for the Toán pilot (PRD §9.3, Q11).
 * The LLM NEVER decides quantitative correctness — this does, by comparing the
 * student's answer to the stored answer for EQUIVALENCE (not string match):
 *   - coordinate tuples:  "(2; -1)" ≡ "(2,-1)"
 *   - numeric:            "0.5" ≡ "1/2", "-1" ≡ "-1.0"
 *   - symbolic:           "(x-1)(x-3)" ≡ "x^2-4x+3", "1/(x)+1" ≡ "(x+1)/x"
 *     (probabilistic identity test over random sample points)
 *   - roots/sets:         "x=1; x=3" ≡ "{3,1}" (order-independent)
 *
 * Pure & dependency-light (mathjs only) so it runs in both Node (tests) and Deno
 * (Edge Function). No Node/Deno-specific APIs.
 */
import { create, all, type MathJsInstance, type MathNode } from "mathjs";

const math: MathJsInstance = create({ ...all });
const mathFns = math as unknown as Record<string, unknown>;

const TOL = 1e-6;
const SAMPLES = 12;

export interface CasResult {
  correct: boolean;
  method: "tuple" | "set" | "numeric" | "symbolic" | "text" | "error";
  detail?: string;
}

/** Substitute {b},{c}-style placeholders for parametrized questions. */
export function applyParams(expr: string, params?: Record<string, number | string>): string {
  if (!params) return expr;
  return expr.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/**
 * Số kiểu VIỆT → kiểu máy: "0,2"→"0.2", "1.234,5"→"1234.5" (lỗi 16, 29/07).
 * Học sinh lớp 10 viết thập phân bằng DẤU PHẨY còn CAS chỉ hiểu dấu chấm.
 * GIỮ ĐỒNG BỘ với supabase/functions/_shared/cas.ts.
 */
export function normalizeVnNumbers(s: string): string {
  return (s ?? "").replace(/\d{1,3}(?:\.\d{3})+,\d+|\d+,\d+/g, (m) =>
    m.replace(/\./g, "").replace(",", "."),
  );
}

/**
 * KÝ TỰ SÁCH IN → KÝ TỰ BÀN PHÍM (rà 29/07 — gốc thật của "phải nhập đúng đáp án").
 *
 * Ngân hàng soạn theo lối sách giáo khoa nên đáp án đầy ký tự học sinh KHÔNG
 * GÕ ĐƯỢC. Đo trên 1.868 câu đang hoạt động:
 *   chỉ số dưới x₀ : 1.199 câu · căn √ : 592 · ≥≤ : 584
 *   chỉ số trên A² :   297 câu · dấu trừ − (U+2212, khác hyphen) : 203 · ≠ : 39
 * Đáp án lưu "−f(x)" mà em gõ "-f(x)" là chấm SAI — dù em hiểu bài hoàn toàn.
 *
 * Đây thuần là phép quy đổi BÀN PHÍM, không nới lỏng ngữ nghĩa: "≠" và "!=" là
 * một; "x₀" và "x0" là một. Không có đường nào biến đáp án SAI thành đúng.
 */
export function normalizeTypography(s: string): string {
  let t = s ?? "";
  // Dấu trừ/gạch kiểu sách in → hyphen bàn phím.
  t = t.replace(/[−‒–—―]/g, "-");
  // Chỉ số DƯỚI ₀₁₂… → chữ số thường (x₀ → x0).
  t = t.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080));
  // Chỉ số TRÊN ⁰¹²³… → ^n (A² → A^2). ¹²³ nằm ở khối Latin-1, không liên tiếp.
  const SUP: Record<string, string> = {
    "¹": "1", "²": "2", "³": "3",
    "⁰": "0", "⁴": "4", "⁵": "5", "⁶": "6",
    "⁷": "7", "⁸": "8", "⁹": "9",
  };
  t = t.replace(/[¹²³⁰⁴-⁹]+/g, (m) =>
    "^" + [...m].map((c) => SUP[c] ?? "").join(""),
  );
  // Toán tử so sánh.
  t = t.replace(/≠/g, "!=").replace(/≥/g, ">=").replace(/≤/g, "<=");
  // Nhân/chia kiểu sách in.
  t = t.replace(/[×·∙⋅∗]/g, "*").replace(/÷/g, "/");
  // Căn √ → sqrt(...). Sách in viết "√3", "2√3", "√(x+1)"; mathjs KHÔNG đọc nổi
  // ký tự √ nên câu nào có căn mà kèm biến là chấm hụt. Chỉ đổi khi thấy rõ phần
  // dưới căn (số, một tên, hoặc một cặp ngoặc không lồng) — không rõ thì để yên,
  // thà bỏ sót còn hơn hiểu sai phạm vi căn.
  t = t.replace(
    /√\s*(\([^()]*\)|\d+(?:[.,]\d+)?|[A-Za-z][A-Za-z0-9]*)/g,
    (_m, g: string) => (g.startsWith("(") ? `sqrt${g}` : `sqrt(${g})`),
  );
  // Nháy cong → nháy thẳng (đáp án chữ hay dính khi copy từ Word).
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // Khoảng trắng lạ (nbsp, thin space) → khoảng trắng thường.
  t = t.replace(/[    ]/g, " ");
  return t;
}

export function checkAnswer(
  student: string,
  correct: string,
  params?: Record<string, number | string>,
): CasResult {
  // Quy đổi ký tự sách-in → bàn phím NGAY TỪ ĐẦU, cho CẢ hai vế (xem
  // normalizeTypography). GIỮ ĐỒNG BỘ với bản Deno.
  const a = normalizeTypography(applyParams((student ?? "").trim(), params));
  const b = normalizeTypography(applyParams((correct ?? "").trim(), params));
  if (!a) return { correct: false, method: "text", detail: "empty" };
  const first = gradeExpr(a, b);
  if (first.correct) return first;
  // LƯỢT HAI — chuẩn hoá số kiểu Việt rồi chấm lại. Chỉ chạy khi lượt nguyên
  // bản đã SAI nên chỉ MỞ RỘNG chấp nhận. ĐÁP ÁN MẪU bị bọc ngoặc thì KHÔNG
  // đụng: ở đó dấu phẩy là dấu NGĂN của bộ/tập ("(1,2)"), đổi đi là biến điểm
  // thành số rồi học sinh gõ "1,2" lại được tính đúng cho một toạ độ.
  const refWrapped = /^\s*[([{][\s\S]*[)\]}]\s*$/.test(b);
  const a2 = normalizeVnNumbers(a);
  const b2 = refWrapped ? b : normalizeVnNumbers(b);
  if (a2 !== a || b2 !== b) {
    const second = gradeExpr(a2, b2);
    if (second.correct) return second;
  }
  return first;
}

function gradeExpr(a: string, b: string): CasResult {
  // 0) KHỚP CHỮ chính xác (đã chuẩn hoá) → ĐÚNG NGAY, KHÔNG đưa qua CAS. Cứu câu
  //    trắc nghiệm có đáp án là NHÃN chữ cái (A/B/C/D) hay chữ nghĩa: 'A','B','C'
  //    trùng tên ĐƠN VỊ của mathjs (Ampere/Byte/Coulomb) nên CAS hiểu nhầm thành
  //    đơn vị → chấm SAI cả đáp án đúng. Khớp chữ thì chắc chắn cùng đáp án.
  if (normText(a) === normText(b)) return { correct: true, method: "text" };

  // 1) Coordinate tuple / point.
  const ta = splitTuple(a);
  const tb = splitTuple(b);
  if (ta && tb) {
    if (ta.length !== tb.length) return { correct: false, method: "tuple" };
    const ok = ta.every((x, i) => exprEqual(x, tb[i]!).correct);
    return { correct: ok, method: "tuple" };
  }

  // 2) Set / multiple roots (order-independent): "x=1; x=3", "{1,3}".
  const sa = splitSet(a);
  const sb = splitSet(b);
  if (sa && sb && (sa.length > 1 || sb.length > 1)) {
    const ok =
      sa.length === sb.length &&
      sa.every((x) => sb.some((y) => exprEqual(x, y).correct)) &&
      sb.every((y) => sa.some((x) => exprEqual(x, y).correct));
    return { correct: ok, method: "set" };
  }

  // 3) Numeric / symbolic equivalence.
  const e = exprEqual(a, b);
  if (e.method !== "error") return e;

  // 4) Text fallback (e.g. "parabol").
  return { correct: normText(a) === normText(b), method: "text" };
}

/** Equivalence of two scalar expressions (numeric or symbolic). */
export function exprEqual(a: string, b: string): CasResult {
  const na = stripRel(a);
  const nb = stripRel(b);
  let nodeA, nodeB;
  try {
    nodeA = math.parse(na);
    nodeB = math.parse(nb);
  } catch {
    return { correct: false, method: "error", detail: "parse" };
  }
  const vars = new Set<string>();
  collectSymbols(nodeA, vars);
  collectSymbols(nodeB, vars);

  try {
    if (vars.size === 0) {
      const va = Number(math.evaluate(na));
      const vb = Number(math.evaluate(nb));
      if (!isFinite(va) || !isFinite(vb)) return { correct: false, method: "numeric" };
      return { correct: Math.abs(va - vb) <= TOL * (1 + Math.abs(vb)), method: "numeric" };
    }
    // Probabilistic identity test over random points (deterministic seed sequence).
    const fa = nodeA.compile();
    const fb = nodeB.compile();
    const symbols = [...vars];
    let matched = 0;
    let evaluated = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const scope: Record<string, number> = {};
      for (const sym of symbols) scope[sym] = sampleAt(s, sym);
      let ya: number, yb: number;
      try {
        ya = Number(fa.evaluate(scope));
        yb = Number(fb.evaluate(scope));
      } catch {
        continue; // skip points outside the domain (e.g. division by zero)
      }
      if (!isFinite(ya) || !isFinite(yb)) continue;
      evaluated++;
      if (Math.abs(ya - yb) <= TOL * (1 + Math.abs(yb))) matched++;
    }
    if (evaluated === 0) return { correct: false, method: "symbolic", detail: "no-valid-points" };
    return { correct: matched === evaluated, method: "symbolic" };
  } catch {
    return { correct: false, method: "error", detail: "eval" };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random sample in a safe range, varied per symbol/iter. */
function sampleAt(iter: number, sym: string): number {
  const seed = (iter * 2654435761 + hash(sym)) >>> 0;
  // map to roughly [-3.3, 3.4], avoiding 0 to dodge common domain holes
  const r = ((seed % 1000) / 1000) * 6.7 - 3.3;
  return Math.abs(r) < 0.2 ? r + 0.7 : r;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Remove a leading "x =", "y=" etc. so "x=1" compares as "1". */
function stripRel(s: string): string {
  const m = s.match(/^\s*[A-Za-z]\w*\s*=\s*(.+)$/);
  return (m ? m[1]! : s).replace(/;$/, "").trim();
}

function splitTuple(s: string): string[] | null {
  const m = s.match(/^\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const parts = splitTop(m[1]!, [",", ";"]);
  return parts.length >= 2 ? parts : null;
}

function splitSet(s: string): string[] | null {
  let inner = s.trim();
  const braced = inner.match(/^\{\s*(.+)\s*\}$/);
  if (braced) inner = braced[1]!;
  const parts = splitTop(inner, [";", ",", "∨"]).map((p) => stripRel(p)).filter(Boolean);
  return parts.length ? parts : null;
}

/** Split on top-level separators only (ignores separators inside parens). */
function splitTop(s: string, seps: string[]): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (depth === 0 && seps.includes(ch)) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function collectSymbols(node: MathNode, into: Set<string>): void {
  node.forEach(function walk(child) {
    if (child.type === "SymbolNode") {
      const name = (child as unknown as { name: string }).name;
      // Exclude constants and any name that resolves to a mathjs function
      // (e.g. sqrt, sin, log appear as SymbolNodes during traversal).
      const isConst = ["e", "pi", "PI", "i", "Inf", "NaN", "true", "false"].includes(name);
      const isFn = typeof mathFns[name] === "function";
      if (!isConst && !isFn) into.add(name);
    }
    child.forEach(walk);
  });
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
