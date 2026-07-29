// MIRROR of packages/cas/src/cas.ts (tested there). Edit there, then regenerate.
//
// CAS answer-equivalence for the Toán pilot (PRD §9.3, Q11). The LLM NEVER
// decides quantitative correctness — this does, comparing the student's answer
// to the stored answer for EQUIVALENCE (not string match).
//
// TỐC ĐỘ: đáp án SỐ/TỌA ĐỘ/TẬP thường gặp được chấm bằng bộ tính số NHẸ TỰ VIẾT
// (evalNumeric) — KHÔNG nạp mathjs. mathjs (nặng, ~0.5-0.8s nạp lần đầu) chỉ
// được NẠP ĐỘNG khi thật sự gặp biểu thức có BIẾN (đại số). Nhờ vậy engine
// "thức dậy" nhanh cho phần lớn câu hỏi. checkAnswer/exprEqual do đó là async.

const TOL = 1e-6;
const SAMPLES = 12;

export interface CasResult {
  correct: boolean;
  /** "llm" = câu MỞ chấm bằng mô hình (so Ý, không so chữ) — xem gradeOpenAnswer. */
  method: "tuple" | "set" | "numeric" | "symbolic" | "text" | "error" | "llm";
  detail?: string;
}

/** Substitute {b},{c}-style placeholders for parametrized questions. */
export function applyParams(expr: string, params?: Record<string, number | string>): string {
  if (!params) return expr;
  return expr.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/**
 * Số kiểu VIỆT → kiểu máy: "0,2"→"0.2", "-1,67"→"-1.67", "1.234,5"→"1234.5".
 * Học sinh lớp 10 viết thập phân bằng DẤU PHẨY (chuẩn VN) còn CAS/mathjs chỉ
 * hiểu dấu chấm — trước đây gõ "0,2" đúng nghĩa vẫn bị chấm SAI (lỗi 16, người
 * thử 3 báo 29/07). Chỉ đổi cụm "chữ-số , chữ-số" (kèm dấu chấm ngăn nghìn nếu
 * có) — KHÔNG đụng dấu phẩy ngăn cách của toạ độ "(1, 2)" (có khoảng trắng hoặc
 * đã được splitTuple xử lý ở lượt chấm nguyên bản trước đó).
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
  // dưới căn (số, một tên, hoặc một cặp ngoặc không lồng) — không rõ thì để yên
  // cho bộ tính số tự lo, thà bỏ sót còn hơn hiểu sai phạm vi căn.
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

export async function checkAnswer(
  student: string,
  correct: string,
  params?: Record<string, number | string>,
): Promise<CasResult> {
  // Quy đổi ký tự sách-in → bàn phím NGAY TỪ ĐẦU, cho CẢ hai vế. Đây không phải
  // "nới lỏng": "x₀" với "x0" vốn là một, chỉ khác cách gõ. Không quy đổi thì
  // 1.199 câu có chỉ số dưới là học sinh không tài nào gõ trúng.
  const a = normalizeTypography(applyParams((student ?? "").trim(), params));
  const b = normalizeTypography(applyParams((correct ?? "").trim(), params));
  if (!a) return { correct: false, method: "text", detail: "empty" };
  const first = await gradeExpr(a, b);
  if (first.correct) return first;
  // LƯỢT HAI — chuẩn hoá số kiểu Việt rồi chấm lại. Chỉ chạy khi lượt nguyên
  // bản đã SAI (nên chỉ MỞ RỘNG chấp nhận, không lật kết quả đúng thành sai),
  // và chỉ khi phép chuẩn hoá thực sự đổi được gì.
  //
  // Bài của HỌC SINH luôn được chuẩn hoá. ĐÁP ÁN MẪU thì KHÔNG, nếu nó được
  // bọc ngoặc: ở đó dấu phẩy là DẤU NGĂN của bộ/tập ("(1,2)", "{1,3}"), đổi
  // thành dấu thập phân là biến ĐIỂM (1;2) thành số 1.2 — rồi học sinh gõ "1,2"
  // lại được tính đúng cho một toạ độ.
  //   · "sqrt(0,25)", "2*(1,5+2)"  → không bọc ngoặc ở NGOÀI CÙNG ⇒ vẫn chuẩn hoá.
  //   · "(1.5; 2)", "{0.5}"        → không có cụm "chữ-số,chữ-số" ⇒ vốn không đổi.
  // Lượt hai chỉ MỞ RỘNG chấp nhận (chỉ trả về khi đúng), không lật đúng thành sai.
  const refWrapped = /^\s*[([{][\s\S]*[)\]}]\s*$/.test(b);
  const a2 = normalizeVnNumbers(a);
  const b2 = refWrapped ? b : normalizeVnNumbers(b);
  if (a2 !== a || b2 !== b) {
    const second = await gradeExpr(a2, b2);
    if (second.correct) return second;
  }
  return first;
}

async function gradeExpr(a: string, b: string): Promise<CasResult> {

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
    for (let i = 0; i < ta.length; i++) {
      if (!(await exprEqual(ta[i]!, tb[i]!)).correct) return { correct: false, method: "tuple" };
    }
    return { correct: true, method: "tuple" };
  }

  // 2) Set / multiple roots (order-independent): "x=1; x=3", "{1,3}".
  const sa = splitSet(a);
  const sb = splitSet(b);
  if (sa && sb && (sa.length > 1 || sb.length > 1)) {
    if (sa.length !== sb.length) return { correct: false, method: "set" };
    const subset = async (xs: string[], ys: string[]): Promise<boolean> => {
      for (const x of xs) {
        let found = false;
        for (const y of ys) {
          if ((await exprEqual(x, y)).correct) { found = true; break; }
        }
        if (!found) return false;
      }
      return true;
    };
    const ok = (await subset(sa, sb)) && (await subset(sb, sa));
    return { correct: ok, method: "set" };
  }

  // 3) Numeric / symbolic equivalence.
  const e = await exprEqual(a, b);
  if (e.method !== "error") return e;

  // 4) Text fallback (e.g. "parabol").
  return { correct: normText(a) === normText(b), method: "text" };
}

/** Một distractor đã soạn: phương án nhiễu + quan niệm sai nó bộc lộ. */
export interface Distractor {
  phuong_an: string;
  quan_niem_sai?: string;
}

/** Kết quả chấm câu khách quan KÈM chẩn đoán distractor. */
export interface GradedAnswer {
  result: CasResult;
  /** Distractor khớp (quan niệm sai) — null nếu đúng hoặc không khớp cái nào. */
  distractor: { index: number; misconception: string } | null;
}

/**
 * Chấm đáp án đúng TRƯỚC; NẾU ĐÃ ĐÚNG thì BỎ QUA việc dò distractor (khỏi tốn
 * công + tránh nạp mathjs thừa cho những phương án nhiễu có biến). Nếu SAI thì
 * dò TẤT CẢ distractor SONG SONG (Promise.all) và trả cái khớp đầu tiên — nhanh
 * hơn vòng lặp await tuần tự khi có nhiều phương án. Chữ ký checkAnswer/exprEqual
 * GIỮ NGUYÊN; đây chỉ là helper cộng thêm cho caller nào muốn dùng.
 */
export async function checkWithDistractors(
  student: string,
  correct: string,
  distractors: Distractor[] | null | undefined,
  params?: Record<string, number | string>,
): Promise<GradedAnswer> {
  const result = await checkAnswer(student, correct, params);
  // Đã đúng → không cần chẩn đoán quan niệm sai; thoát sớm (đường nhanh).
  // Array.isArray, không phải `!distractors`: cột là jsonb không ràng buộc kiểu.
  if (result.correct || !Array.isArray(distractors) || distractors.length === 0) {
    return { result, distractor: null };
  }

  // Chấm mọi distractor song song; giữ index để trả về đúng thứ tự đã soạn.
  const hits = await Promise.all(
    distractors.map(async (d, index) => ({
      index,
      misconception: d.quan_niem_sai ?? "",
      matched: (await checkAnswer(student, d.phuong_an, params)).correct,
    })),
  );
  const hit = hits.find((h) => h.matched);
  return {
    result,
    distractor: hit ? { index: hit.index, misconception: hit.misconception } : null,
  };
}

/** Equivalence of two scalar expressions. Số thuần → bộ tính nhẹ; có biến → mathjs. */
export async function exprEqual(a: string, b: string): Promise<CasResult> {
  const na = stripRel(a);
  const nb = stripRel(b);

  // Đường NHANH: cả hai tính được bằng SỐ (không biến) → so số, KHÔNG cần mathjs.
  const va = evalNumeric(na);
  const vb = evalNumeric(nb);
  if (va !== null && vb !== null) {
    if (!isFinite(va) || !isFinite(vb)) return { correct: false, method: "numeric" };
    return { correct: Math.abs(va - vb) <= TOL * (1 + Math.abs(vb)), method: "numeric" };
  }

  // Có biến / bộ nhẹ không tính được → dùng mathjs (nạp động, chỉ khi cần).
  return await exprEqualSymbolic(na, nb);
}

// ── mathjs: NẠP ĐỘNG một lần, chỉ khi gặp biểu thức có biến ────────────────────
// deno-lint-ignore no-explicit-any
let _mathPromise: Promise<any> | null = null;
// deno-lint-ignore no-explicit-any
function getMath(): Promise<any> {
  if (!_mathPromise) {
    _mathPromise = import("npm:mathjs@13").then((m) => m.create({ ...m.all }));
  }
  return _mathPromise;
}

async function exprEqualSymbolic(a: string, b: string): Promise<CasResult> {
  const math = await getMath();
  const mathFns = math as Record<string, unknown>;
  // deno-lint-ignore no-explicit-any
  let nodeA: any, nodeB: any;
  try {
    nodeA = math.parse(a);
    nodeB = math.parse(b);
  } catch {
    return { correct: false, method: "error", detail: "parse" };
  }
  const vars = new Set<string>();
  collectSymbols(nodeA, vars, mathFns);
  collectSymbols(nodeB, vars, mathFns);

  try {
    if (vars.size === 0) {
      const va = Number(math.evaluate(a));
      const vb = Number(math.evaluate(b));
      if (!isFinite(va) || !isFinite(vb)) return { correct: false, method: "numeric" };
      return { correct: Math.abs(va - vb) <= TOL * (1 + Math.abs(vb)), method: "numeric" };
    }
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
        continue;
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

// ── Bộ tính SỐ nhẹ (không mathjs) ─────────────────────────────────────────────
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const FNS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};

type NumTok =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "fn"; v: string }
  | { t: "lp" }
  | { t: "rp" };

/**
 * Tính giá trị SỐ của biểu thức số học: số thập phân, + - * / ^, ngoặc, dấu
 * âm/dương đơn, sqrt/abs/sin/cos/tan/ln/log/exp, pi/e. Gặp BIẾN (chữ lạ) hoặc
 * cú pháp không chắc chắn → trả `null` để nhánh symbolic (mathjs) lo. Nhờ vậy
 * đáp án số/tọa độ thường gặp không phải nạp mathjs.
 */
export function evalNumeric(expr: string): number | null {
  const src = (expr ?? "").trim();
  if (!src) return null;
  const toks: NumTok[] = [];
  let i = 0;
  const prev = () => toks[toks.length - 1];
  // PHÉP NHÂN NGẦM — "2√3", "2(3+1)", "2pi" là lối viết sách giáo khoa. Trước đây
  // chuỗi thiếu dấu * làm ngăn xếp thừa toán hạng → trả null → rơi xuống so chữ →
  // chấm SAI. Chèn "*" khi một TOÁN HẠNG mới đứng ngay sau một toán hạng đã đóng
  // (số hoặc ngoặc đóng). Ưu tiên của "*" ngầm bằng "*" thường: "1/2√3" đọc là
  // (1/2)·√3 = √3/2 — đúng nghĩa sách giáo khoa.
  const pushAtom = (tk: NumTok) => {
    const p = prev();
    if (p && (p.t === "num" || p.t === "rp")) toks.push({ t: "op", v: "*" });
    toks.push(tk);
  };
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t") { i++; continue; }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      let dots = 0;
      while (j < src.length && ((src[j]! >= "0" && src[j]! <= "9") || src[j] === ".")) {
        if (src[j] === ".") dots++;
        j++;
      }
      if (dots > 1) return null;
      const num = Number(src.slice(i, j));
      if (!isFinite(num)) return null;
      pushAtom({ t: "num", v: num });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j]!)) j++;
      const id = src.slice(i, j).toLowerCase();
      if (id in CONSTS) { pushAtom({ t: "num", v: CONSTS[id]! }); i = j; continue; }
      if (id in FNS) { pushAtom({ t: "fn", v: id }); i = j; continue; }
      return null; // định danh lạ → coi là biến → symbolic
    }
    if (c === "(") { pushAtom({ t: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
    if (c === "√") { pushAtom({ t: "fn", v: "sqrt" }); i++; continue; }
    if (c === "·" || c === "×" || c === "∗") { toks.push({ t: "op", v: "*" }); i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
      const p = prev();
      const unary = (c === "+" || c === "-") && (!p || p.t === "op" || p.t === "lp" || p.t === "fn");
      toks.push({ t: "op", v: unary ? "u" + c : c });
      i++;
      continue;
    }
    return null; // ký tự lạ
  }
  if (toks.length === 0) return null;

  // Shunting-yard → RPN. Dấu âm/dương đơn BÉ hơn ^ (để -2^2 = -(2^2) = -4 khớp
  // mathjs) nhưng LỚN hơn * / (để -2*3 = (-2)*3 = -6).
  const prec: Record<string, number> = { "^": 5, "u+": 4, "u-": 4, "*": 3, "/": 3, "+": 2, "-": 2 };
  const rightAssoc = (op: string) => op === "^" || op === "u+" || op === "u-";
  const out: NumTok[] = [];
  const ops: NumTok[] = [];
  for (const tk of toks) {
    if (tk.t === "num") out.push(tk);
    else if (tk.t === "fn") ops.push(tk);
    else if (tk.t === "op") {
      while (ops.length) {
        const top = ops[ops.length - 1]!;
        if (top.t === "fn") { out.push(ops.pop()!); continue; }
        if (top.t === "op" && (prec[top.v]! > prec[tk.v]! || (prec[top.v] === prec[tk.v] && !rightAssoc(tk.v)))) {
          out.push(ops.pop()!);
          continue;
        }
        break;
      }
      ops.push(tk);
    } else if (tk.t === "lp") ops.push(tk);
    else {
      // rp
      let found = false;
      while (ops.length) {
        const top = ops.pop()!;
        if (top.t === "lp") { found = true; break; }
        out.push(top);
      }
      if (!found) return null; // ngoặc lệch
      if (ops.length && ops[ops.length - 1]!.t === "fn") out.push(ops.pop()!);
    }
  }
  while (ops.length) {
    const top = ops.pop()!;
    if (top.t === "lp") return null; // ngoặc lệch
    out.push(top);
  }

  // Đánh giá RPN.
  const st: number[] = [];
  for (const tk of out) {
    if (tk.t === "num") st.push(tk.v);
    else if (tk.t === "fn") {
      const x = st.pop();
      if (x === undefined) return null;
      st.push(FNS[tk.v]!(x));
    } else if (tk.t === "op") {
      if (tk.v === "u-") { const x = st.pop(); if (x === undefined) return null; st.push(-x); }
      else if (tk.v === "u+") { const x = st.pop(); if (x === undefined) return null; st.push(x); }
      else {
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) return null;
        st.push(
          tk.v === "+" ? a + b : tk.v === "-" ? a - b : tk.v === "*" ? a * b : tk.v === "/" ? a / b : Math.pow(a, b),
        );
      }
    }
  }
  if (st.length !== 1) return null;
  const r = st[0]!;
  return isFinite(r) ? r : null;
}

// ── helpers (sync, không mathjs) ──────────────────────────────────────────────

/** Deterministic pseudo-random sample in a safe range, varied per symbol/iter. */
function sampleAt(iter: number, sym: string): number {
  const seed = (iter * 2654435761 + hash(sym)) >>> 0;
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

// deno-lint-ignore no-explicit-any
function collectSymbols(node: any, into: Set<string>, mathFns: Record<string, unknown>): void {
  // deno-lint-ignore no-explicit-any
  node.forEach(function walk(child: any) {
    if (child.type === "SymbolNode") {
      const name = (child as { name: string }).name;
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
