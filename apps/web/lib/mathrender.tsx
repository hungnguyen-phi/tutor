// Render CHUẨN mọi công thức toán qua thư viện KaTeX.
//
// Nguyên tắc (để học sinh học ĐÚNG):
//  1. Nội dung soạn bài là text unicode (x², √, ≤, a/b…) hoặc LaTeX lẫn ($...$,
//     \(...\)). Bộ chuyển dưới đây gom đúng ĐOẠN là toán rồi đưa qua KaTeX;
//     phần văn xuôi giữ nguyên.
//  2. Mỗi đoạn toán phải KaTeX PARSE ĐƯỢC. Không parse được → trả text gốc
//     (KHÔNG bịa, KHÔNG render sai công thức, thà hiện thô còn hơn dạy sai).
//  3. Chạy được cả client (component) lẫn build script (segmentMath thuần).

import React from "react";
import katex from "katex";

// ── unicode toán → LaTeX ────────────────────────────────────────────────────
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
};

// "math-run": gom CỤM LIỀN MẠCH gồm số/biến/toán tử/ngoặc; chỉ coi là TOÁN nếu
// bên trong có ≥1 "dấu hiệu mạnh" (STRONG). Nhờ vậy "y = x² − 4x + 3" thành MỘT
// công thức trọn vẹn thay vì vụn ra. Từ ngữ (≥2 chữ / có dấu tiếng Việt) cắt cụm.
const STRONG = /[=<>≤≥≠±×·÷√^∞⇒⇔∈∉∀∃∪∩⊂⊆°²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉αβγδεθλμπρσφω∆Δ∑∏∠⊥]|\d\s*\/\s*\d|[A-Za-z]\d|\d[A-Za-z]/;
const MATHTOK = /^[A-Za-z0-9()[\]{}.,;:'"|=<>≤≥≠±×·÷√^_/+\-−–—∞⇒⇔∈∉∀∃∪∩⊂⊆°²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉αβγδεθλμπρσφω∆Δ∑∏∠⊥\\]+$/;
const MATHFN = /^(sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|sqrt|arcsin|arccos|arctan|deg|mod)$/i;

// Phân loại token: 'text' (chữ nghĩa) | 'strong' (chắc chắn toán) | 'weak' (số/biến/toán tử).
function classify(tk: string): "text" | "strong" | "weak" {
  // Dấu đánh số / nhãn đáp án → luôn text (không hút vào công thức bên cạnh).
  // Bắt "(1)" "(a)"; "1)" "2)"; "A." "B)" "d." — CHỪA "5." (là toán tử, vd "x = 5.").
  if (/^\(\w{1,3}\)$/.test(tk) || /^\d{1,3}\)$/.test(tk) || /^[A-Za-z]\d?[.)]$/.test(tk)) return "text";
  if (STRONG.test(tk)) return "strong"; // dấu hiệu mạnh (=, ², √, Δ, hệ số kề biến…) → toán
  if (/[À-ỹ]/.test(tk)) return "text"; // dấu tiếng Việt → chữ (check SAU STRONG vì Δ,π… lọt [À-ỹ])
  // "Từ ngữ" = token THUẦN chữ cái (bỏ dấu câu bao quanh) ≥2 chữ: parabol, cho…
  // Token lẫn số/toán tử/ngoặc (4ac, (a+b), -b/(2a)) KHÔNG phải từ → để xuống weak.
  const core = tk.replace(/^[.,;:!?"'()[\]]+|[.,;:!?"'()[\]]+$/g, "");
  if (/^[A-Za-z]+$/.test(core) && core.length >= 2 && !MATHFN.test(core)) return "text";
  if (MATHTOK.test(tk)) return "weak";
  return "text";
}

function toLatexInner(s: string): string {
  let t = s;
  t = t.replace(/√\s*\(([^()]*)\)/g, "\\sqrt{$1}");
  t = t.replace(/√\s*([A-Za-z0-9]+)/g, "\\sqrt{$1}");
  t = t.replace(/\(([^()]{1,20})\)\s*\/\s*\(([^()]{1,20})\)/g, "\\frac{$1}{$2}");
  t = t.replace(/(-?[A-Za-z0-9.]+)\s*\/\s*\(([^()]{1,20})\)/g, "\\frac{$1}{$2}");
  t = t.replace(/\(([^()]{1,20})\)\s*\/\s*(-?[A-Za-z0-9.]+)/g, "\\frac{$1}{$2}");
  t = t.replace(/(?<![/\w])(-?\d+)\s*\/\s*(\d+)(?![/\w])/g, "\\frac{$1}{$2}");
  for (const [k, v] of Object.entries(UNI)) t = t.split(k).join(v);
  // GỘP mũ/chỉ số LIỀN nhau: unicode "4¹⁰" → "^{1}^{0}" (KaTeX báo "Double
  // superscript"). Gộp lại "^{10}". Lặp tới ổn định cho ≥3 chữ số liền.
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\^\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, "^{$1$2}")
      .replace(/_\{([^{}]*)\}\s*_\{([^{}]*)\}/g, "_{$1$2}");
  }
  t = t.replace(/(?<=[\dA-Za-z)])\s*\*\s*(?=[\dA-Za-z(])/g, " \\cdot ");
  return t.trim();
}

export interface Seg { t: "text" | "math"; v: string }

function autoSpans(text: string): Seg[] {
  const toks = text.split(/(\s+)/).filter((t) => t.length); // giữ khoảng trắng
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

/** Cắt chuỗi thành đoạn text / toán (đoạn toán đã là LaTeX, chờ KaTeX render). */
export function segmentMath(input: string | null | undefined): Seg[] {
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

// Bỏ ghi chú soạn bài lọt vào nội dung (metadata của GV, HS không cần thấy).
const stripNote = (s: string) => (s ?? "").replace(/\s*\(khu[ôo]n tham s[ốo][^)]*\)/gi, "");

function katexHtml(tex: string): string | null {
  try { return katex.renderToString(tex, { throwOnError: true, displayMode: false }); }
  catch { return null; } // parse fail → để nơi gọi rơi về text gốc
}

/** Text segment → node, GIỮ xuống dòng (\n) bằng <br>. HTML nuốt \n, nên câu hỏi
 *  MCQ (đề rồi A/B/C/D mỗi đáp án một dòng) hay nội dung nhiều dòng phải chèn <br>
 *  tường minh. An toàn: segmentMath đã tách CÔNG THỨC ra segment riêng trước, nên
 *  không đụng \n bên trong $...$/$$...$$. */
function textSeg(v: string, key: string): React.ReactNode {
  if (!v.includes("\n")) return <React.Fragment key={key}>{v}</React.Fragment>;
  const lines = v.split("\n");
  return (
    <React.Fragment key={key}>
      {lines.map((ln, j) => (
        <React.Fragment key={j}>
          {j > 0 && <br />}
          {ln}
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/** Render 1 chuỗi (đã tách **đậm**) thành các node: text thường + <span> KaTeX. */
function renderSegs(text: string, keyBase: string): React.ReactNode[] {
  return segmentMath(text).map((seg, i) => {
    if (seg.t === "text") return textSeg(seg.v, keyBase + i);
    const html = katexHtml(seg.v);
    if (html == null) return textSeg(seg.v, keyBase + i);
    return <span key={keyBase + i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

/**
 * Hiển thị nội dung có công thức: **đậm** → <b>, mọi công thức qua KaTeX.
 * Dùng thay cho prettyMath/renderRich cũ (vốn chỉ "làm đẹp" thô, không chuẩn).
 */
export function MathText({ children }: { children: string | null | undefined }): React.ReactElement {
  const src = stripNote(String(children ?? ""));
  const parts = src.split(/\*\*([^*]+)\*\*/g); // lẻ = đậm
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <b key={"b" + i}>{renderSegs(p, "b" + i + "-")}</b>
          : <React.Fragment key={"t" + i}>{renderSegs(p, "t" + i + "-")}</React.Fragment>,
      )}
    </>
  );
}
