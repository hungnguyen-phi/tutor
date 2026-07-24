// MIRROR phần THUẦN (không React) của apps/web/lib/mathrender.tsx — cùng logic
// tách đoạn toán + chuyển unicode→LaTeX mà app dùng để HIỂN THỊ. Sửa ở
// mathrender.tsx TRƯỚC, rồi đồng bộ file này. Phải khớp 1-1, nếu không cổng
// validate sẽ "pass" thứ mà renderer lại "fail" (đúng lỗi ta đang chặn).
//
// Dùng cho content-sync: kiểm mọi công thức có KaTeX parse được không, để KHÔNG
// auto-publish nội dung sẽ rơi về text thô trước mặt học sinh.
import katex from "npm:katex@0.18.1";

const UNI: Record<string, string> = {
  "²": "^{2}", "³": "^{3}", "⁰": "^{0}", "¹": "^{1}", "⁴": "^{4}", "⁵": "^{5}",
  "⁶": "^{6}", "⁷": "^{7}", "⁸": "^{8}", "⁹": "^{9}", "⁺": "^{+}", "⁻": "^{-}", "ⁿ": "^{n}",
  "₀": "_{0}", "₁": "_{1}", "₂": "_{2}", "₃": "_{3}", "₄": "_{4}", "₅": "_{5}",
  "₆": "_{6}", "₇": "_{7}", "₈": "_{8}", "₉": "_{9}",
  "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ", "±": "\\pm ", "∓": "\\mp ",
  "×": "\\times ", "·": "\\cdot ", "÷": "\\div ", "∞": "\\infty ",
  "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "→": "\\to ", "←": "\\leftarrow ",
  "∈": "\\in ", "∉": "\\notin ", "∀": "\\forall ", "∃": "\\exists ", "∄": "\\nexists ",
  "∪": "\\cup ", "∩": "\\cap ", "⊂": "\\subset ", "⊆": "\\subseteq ", "⊃": "\\supset ",
  "∅": "\\varnothing ", "≈": "\\approx ", "≡": "\\equiv ", "∘": "\\circ ", "°": "^{\\circ}",
  "√": "\\surd ", "∆": "\\Delta ", "Δ": "\\Delta ", "∑": "\\sum ", "∏": "\\prod ",
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\varepsilon ",
  "θ": "\\theta ", "λ": "\\lambda ", "μ": "\\mu ", "π": "\\pi ", "ρ": "\\rho ",
  "σ": "\\sigma ", "τ": "\\tau ", "φ": "\\varphi ", "ω": "\\omega ", "Ω": "\\Omega ",
  "≪": "\\ll ", "≫": "\\gg ", "⊥": "\\perp ", "∥": "\\parallel ", "∠": "\\angle ",
  "‖": "\\|", "−": "-", "–": "-", "—": "-",
  "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}", "ℙ": "\\mathbb{P}", "∖": "\\setminus ", "∣": "\\mid ",
};

const STRONG = /[=<>≤≥≠±×·÷√^∞⇒⇔∈∉∀∃∪∩⊂⊆°²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉αβγδεθλμπρσφω∆Δ∑∏∠⊥ℝℕℤℚℂℙ∖∣]|\d\s*\/\s*\d|[A-Za-z]\d|\d[A-Za-z]/;
const MATHTOK = /^[A-Za-z0-9()[\]{}.,;:'"|=<>≤≥≠±×·÷√^_/+\-−–—∞⇒⇔∈∉∀∃∪∩⊂⊆°²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉αβγδεθλμπρσφω∆Δ∑∏∠⊥ℝℕℤℚℂℙ∖∣\\]+$/;
const MATHFN = /^(sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|sqrt|arcsin|arccos|arctan|deg|mod)$/i;

function classify(tk: string): "text" | "strong" | "weak" {
  if (/^\(\w{1,3}\)$/.test(tk) || /^\d{1,3}\)$/.test(tk) || /^[A-Za-z]\d?[.)]$/.test(tk)) return "text";
  if (STRONG.test(tk)) return "strong";
  if (/[À-ỹ]/.test(tk)) return "text";
  const core = tk.replace(/^[.,;:!?"'()[\]]+|[.,;:!?"'()[\]]+$/g, "");
  if (/^[A-Za-z]+$/.test(core) && core.length >= 2 && !MATHFN.test(core)) return "text";
  if (MATHTOK.test(tk)) return "weak";
  return "text";
}

function toLatexInner(s: string): string {
  let t = s;
  t = t.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, inner: string) => `\\{${inner.replace(/\|/g, " \\mid ")}\\}`);
  t = t.replace(/_{2,}/g, (m) => `\\underline{${"\\ ".repeat(m.length)}}`);
  t = t.replace(/√\s*\(([^()]*)\)/g, "\\sqrt{$1}");
  t = t.replace(/√\s*([A-Za-z0-9]+)/g, "\\sqrt{$1}");
  t = t.replace(/\(([^()]{1,20})\)\s*\/\s*\(([^()]{1,20})\)/g, "\\frac{$1}{$2}");
  t = t.replace(/(-?[A-Za-z0-9.]+)\s*\/\s*\(([^()]{1,20})\)/g, "\\frac{$1}{$2}");
  t = t.replace(/\(([^()]{1,20})\)\s*\/\s*(-?[A-Za-z0-9.]+)/g, "\\frac{$1}{$2}");
  t = t.replace(/(?<![/\w])(-?\d+)\s*\/\s*(\d+)(?![/\w])/g, "\\frac{$1}{$2}");
  for (const [k, v] of Object.entries(UNI)) t = t.split(k).join(v);
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\^\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, "^{$1$2}")
      .replace(/_\{([^{}]*)\}\s*_\{([^{}]*)\}/g, "_{$1$2}");
  }
  t = t.replace(/(?<=[\dA-Za-z)])\s*\*\s*(?=[\dA-Za-z(])/g, " \\cdot ");
  return t.trim();
}

interface Seg { t: "text" | "math"; v: string }

function autoSpans(text: string): Seg[] {
  const toks = text.split(/(\s+)/).filter((t) => t.length);
  const segs: Seg[] = [];
  let run: string[] = [], hasStrong = false;
  const flushRun = () => {
    if (!run.length) return;
    const s = run.join("");
    run = []; const strong = hasStrong; hasStrong = false;
    if (!strong) { segs.push({ t: "text", v: s }); return; }
    const lead = s.match(/^\s+/)?.[0] ?? "";
    const trail = s.match(/\s+$/)?.[0] ?? "";
    const core = s.slice(lead.length, s.length - trail.length);
    if (lead) segs.push({ t: "text", v: lead });
    if (core) segs.push({ t: "math", v: toLatexInner(core) });
    if (trail) segs.push({ t: "text", v: trail });
  };
  for (const tk of toks) {
    if (/^\s+$/.test(tk)) { if (run.length) run.push(tk); else segs.push({ t: "text", v: tk }); continue; }
    const c = classify(tk);
    if (c === "text") { flushRun(); segs.push({ t: "text", v: tk }); }
    else { if (c === "strong") hasStrong = true; run.push(tk); }
  }
  flushRun();
  return segs;
}

function segmentMath(input: string | null | undefined): Seg[] {
  const s = String(input ?? "");
  if (!s) return [];
  const out: Seg[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  let last = 0, m: RegExpExecArray | null;
  const pushText = (txt: string) => { if (txt) out.push(...autoSpans(txt)); };
  while ((m = re.exec(s))) {
    pushText(s.slice(last, m.index));
    out.push({ t: "math", v: (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim() });
    last = re.lastIndex;
  }
  pushText(s.slice(last));
  return out;
}

/** LaTeX của mọi đoạn toán KHÔNG KaTeX parse được trong 1 chuỗi (rỗng = ổn). */
export function mathFailures(text: string | null | undefined): string[] {
  const bad: string[] = [];
  for (const seg of segmentMath(text)) {
    if (seg.t !== "math") continue;
    try { katex.renderToString(seg.v, { throwOnError: true, displayMode: false }); }
    catch { bad.push(seg.v); }
  }
  return bad;
}

/** Kiểm mọi trường chữ của 1 câu hỏi; trả số công thức hỏng. */
export function questionMathFailCount(q: {
  noi_dung?: unknown; dap_an?: unknown; loi_giai?: unknown;
  distractors?: Array<{ phuong_an?: unknown }>;
}): number {
  let n = mathFailures(q.noi_dung as string).length
    + mathFailures(q.dap_an as string).length
    + mathFailures(q.loi_giai as string).length;
  for (const d of q.distractors ?? []) n += mathFailures(String(d?.phuong_an ?? "")).length;
  return n;
}
