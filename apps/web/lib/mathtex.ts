// LÕI THUẦN (không React/JSX) của bộ hiển thị toán: cắt chuỗi thành đoạn
// chữ / đoạn toán, và đổi nội dung soạn bài (unicode + ASCII) sang LaTeX cho
// KaTeX. Tách khỏi mathrender.tsx để script kiểm thử (node) và edge function
// dùng chung được mà không kéo theo React.
//
// Nguyên tắc (để học sinh học ĐÚNG):
//  1. Nội dung soạn bài là text unicode (x², √, ≤, a/b…) hoặc LaTeX lẫn ($...$,
//     \(...\)). Bộ chuyển dưới đây gom đúng ĐOẠN là toán rồi đưa qua KaTeX;
//     phần văn xuôi giữ nguyên.
//  2. Mỗi đoạn toán phải KaTeX PARSE ĐƯỢC. Không parse được → nơi gọi trả text
//     gốc (KHÔNG bịa, KHÔNG render sai công thức, thà hiện thô còn hơn dạy sai).
//  3. Phân số phải là GẠCH NGANG như sách giáo khoa — "x²/16" hiện ra dấu "/"
//     là trình bày sai (xem khối "Phân số thật" bên dưới).

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
  // Tập số blackboard-bold: KHÔNG có trong MATHTOK/STRONG sẽ cắt đứt math-run
  // (làm "{x ∈" hở ngoặc → KaTeX lỗi) và không đổi. Đưa vào đây + STRONG/MATHTOK.
  "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}", "ℙ": "\\mathbb{P}", "∖": "\\setminus ", "∣": "\\mid ",
};

// "math-run": gom CỤM LIỀN MẠCH gồm số/biến/toán tử/ngoặc; chỉ coi là TOÁN nếu
// bên trong có ≥1 "dấu hiệu mạnh" (STRONG). Nhờ vậy "y = x² − 4x + 3" thành MỘT
// công thức trọn vẹn thay vì vụn ra. Từ ngữ (≥2 chữ / có dấu tiếng Việt) cắt cụm.
const STRONG = /[=<>≤≥≠±×·÷√^∞⇒⇔∈∉∀∃∪∩⊂⊆°²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉αβγδεθλμπρσφωΩ∆Δ∑∏∠⊥ℝℕℤℚℂℙ∖∣]|\d\s*\/\s*\d|[A-Za-z]\d|\d[A-Za-z]/;
const MATHTOK = /^[A-Za-z0-9()[\]{}.,;:'"|=<>≤≥≠±×·÷√^_/+\-−–—∞⇒⇔∈∉∀∃∪∩⊂⊆°²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉αβγδεθλμπρσφω∆Δ∑∏∠⊥ℝℕℤℚℂℙ∖∣\\]+$/;
const MATHFN = /^(sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|sqrt|arcsin|arccos|arctan|deg|mod)$/i;

/** Phân loại token: 'text' (chữ nghĩa) | 'strong' (chắc chắn toán) | 'weak' (số/biến/toán tử). */
export function classify(tk: string): "text" | "strong" | "weak" {
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

// ── Phân số THẬT (gạch ngang, không phải dấu "/") ───────────────────────────
// Nội dung soạn bài viết phân số bằng "/" ("x²/16", "√3/2", "a/sin A"). Hiện
// nguyên dấu "/" là SAI quy ước trình bày → mọi phân số phải thành \frac.
//
// "Hạng tử" (ATOM) CỐ Ý hẹp — số, biến 1 chữ (kèm hệ số/mũ/chỉ số), căn, hàm
// lượng giác — để đơn vị đo và cặp từ KHÔNG bị biến thành phân số: "km/h",
// "max/min", "đúng/sai" đều có ≥2 chữ cái nên không khớp.
const FN = "sin|cos|tan|cot|sec|csc|ln|log";
// Đối số hàm dính liền cũng nhận: "sin30°" viết không cách vẫn là sin của 30°.
const ARG = String.raw`(?:\d+(?:[.,]\d+)?(?:\^\{\\circ\})?|[A-Za-z])`;
// Căn có thể lồng một lớp ngoặc nhọn: \sqrt{x^{2}-9}.
const SQRT = String.raw`\\sqrt\{(?:[^{}]|\{[^{}]*\})*\}`;
// Chữ Hi Lạp & ký hiệu do UNI sinh ra — "−Δ/4a" cũng là phân số.
const GREEK = "Delta|delta|pi|alpha|beta|gamma|theta|lambda|mu|rho|sigma|tau|varepsilon|varphi|omega|Omega|infty";
// Ô điền khuyết: đề "tan α = ___/___" chính là KHUNG PHÂN SỐ để học sinh điền.
const UNDER = String.raw`\\underline\{[^{}]*\}`;
// [A-Z]{2,3} = tên đoạn thẳng/tam giác trong hình học ("R = BC/2", "S_ABC/2").
const ATOM =
  String.raw`(?:\\(?:${FN})\s*${ARG}?|\d*${SQRT}|${UNDER}|\\(?:${GREEK})|\|[^|]{1,20}\||\d+(?:[.,]\d+)?|[A-Z]{2,3}|\d*[A-Za-z])` +
  String.raw`(?:\^\{[^{}]*\}|_\{[^{}]*\}|\^[A-Za-z0-9]|_[A-Za-z0-9])?!?`; // "!" = giai thừa: 5!/(3!·2!)
// Nhóm ngoặc SAU khi unicode đã thành LaTeX (lồng được một lớp, mang được số mũ):
// "x²/(m−1)", "(2a−b)²/(5(a²+b²))", "n!/((n−k)!·k!)".
const PAREN = String.raw`(?:\((?:[^()]|\([^()]*\)){1,120}\)|\[(?:[^[\]]|\[[^[\]]*\]){1,120}\])(?:\^\{[^{}]*\})?`;
/** Bỏ cặp ngoặc BAO TRỌN một vế (gạch phân số đã gom rồi), giữ nguyên nếu ngoặc
 *  không bao hết hoặc còn mang số mũ. */
function unwrap(s: string): string {
  const [L, R] = s.startsWith("(") ? ["(", ")"] : s.startsWith("[") ? ["[", "]"] : ["", ""];
  if (!L || !s.endsWith(R)) return s;
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === L) d++;
    else if (s[i] === R && --d === 0) return i === s.length - 1 ? s.slice(1, -1) : s;
  }
  return s;
}
// Đơn vị đo 1-chữ-cái / 1-chữ-cái — "5 m/s" nằm trong công thức vẫn là ĐƠN VỊ.
const UNITS = new Set(["m/s", "m/h", "g/l", "g/s", "N/m", "J/s", "W/m", "V/A", "C/s", "w/o"]);
// Tử/mẫu không được dính vào chữ–số bên cạnh ("60km/h" phải trượt), không nuốt
// phần mở ngoặc nhọn LaTeX ngay sau, và KHÔNG chạm vào chuỗi nhiều dấu gạch
// ("12/05/2026" là NGÀY THÁNG, không phải phân số lồng).
const FRAC_ATOM = new RegExp(String.raw`(?<![\w}/])(-?(?:${ATOM}|${PAREN}))\s*/\s*(-?(?:${ATOM}|${PAREN}))(?![\w{/])`, "g");
const FRAC_ABS = new RegExp(String.raw`\|([^|]{1,40})\|\s*/\s*(-?${ATOM})`, "g");
const FRAC_ABS_P = /\|([^|]{1,40})\|\s*\/\s*\(([^()]{1,40})\)/g;
// Tên hàm phải là chữ ĐỨNG (\sin), không phải tích s·i·n in nghiêng. Sau "_"/"^"
// thì KHÔNG đổi: "S_min" mà thành "S_\min" là lỗi cú pháp (thiếu nhóm sau "_").
const FN_NAME = /(?<![\\A-Za-z_^])(arcsin|arccos|arctan|sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|deg)(?![A-Za-z])/g;

function toLatexInner(s: string): string {
  let t = s;
  // Ngoặc nhọn TRẦN trong KaTeX là NHÓM VÔ HÌNH → "{1;2}" hiện ra "1;2", mất sạch
  // dấu tập hợp (dạy SAI: A = 1;2). Trong nội dung soạn bài, "{…}" LUÔN là TẬP HỢP
  // — LaTeX thật của người soạn đi qua $…$ / \(…\) và segmentMath tách trước, KHÔNG
  // vào hàm này — nên bọc \{ \} cho mọi ngoặc. "|" bên trong là "sao cho" → \mid.
  // Phải chạy TRƯỚC mọi luật sinh ra ngoặc LaTeX (\sqrt{}, \frac{}, ^{2}, \mathbb{})
  // ở dưới, kẻo bọc nhầm chính ngoặc mình vừa tạo.
  t = t.replace(/\{([^{}]*)\}/g, (_m, inner: string) => `\\{${inner.replace(/\|/g, " \\mid ")}\\}`);
  // Chỗ điền khuyết "___" (≥2 gạch dưới liền): KaTeX hiểu "_" là chỉ-số → lỗi
  // "Expected group after '_'". Đổi thành ô gạch chân trống (hiện đúng dạng điền).
  t = t.replace(/_{2,}/g, (m) => `\\underline{${"\\ ".repeat(m.length)}}`);
  t = t.replace(/√\s*\(([^()]*)\)/g, "\\sqrt{$1}");
  t = t.replace(/√\s*([A-Za-z0-9]+)/g, "\\sqrt{$1}");
  // Phân số có ngoặc. Ngoặc bao TRỌN một vế thì bỏ đi (gạch phân số đã gom rồi:
  // "(a+b+c)/2" → a+b+c trên gạch), nhưng tên hàm/biến đứng trước ngoặc thì
  // thuộc về vế đó: "n(A)/n(Ω)", "A(n,k)/k!", "1/g(x)" — thiếu nó là sai công thức.
  // Ngoặc được LỒNG một lớp: "(1·3 + 2·(−1))/(√5·√10)".
  const P = String.raw`([A-Za-z]?)\(((?:[^()]|\([^()]*\)){1,60})\)`;
  // Vế "trần" (chưa qua UNI nên chỉ có căn / ô điền / chữ + số).
  const B = String.raw`-?(?:${SQRT}|${UNDER}|[A-Za-z0-9.]+)`;
  const side = (id: string, inner: string) => (id ? `${id}(${inner})` : inner);
  t = t.replace(new RegExp(String.raw`${P}\s*/\s*${P}`, "g"),
    (_m, i1: string, n1: string, i2: string, n2: string) => `\\frac{${side(i1, n1)}}{${side(i2, n2)}}`);
  t = t.replace(new RegExp(String.raw`(${B})\s*/\s*${P}`, "g"),
    (_m, num: string, id: string, inner: string) => `\\frac{${num}}{${side(id, inner)}}`);
  // Mẫu bọc ngoặc VUÔNG cũng là mẫu: "ab/[x + √(x²−a²)]".
  t = t.replace(new RegExp(String.raw`(${B})\s*/\s*\[((?:[^[\]]|\[[^[\]]*\]){1,120})\]`, "g"), "\\frac{$1}{$2}");
  // Mẫu không được kết thúc bằng dấu chấm: "(y+3)/5." là mẫu 5 rồi HẾT CÂU.
  t = t.replace(new RegExp(String.raw`${P}\s*/\s*(${SQRT}|${UNDER}|-?[A-Za-z0-9.]*[A-Za-z0-9]!?)`, "g"),
    (_m, id: string, inner: string, den: string) => `\\frac{${side(id, inner)}}{${den}}`);
  // Số / số, có nhận số thập phân — "4/0,8" phải là 4 trên 0,8 (không phải 4/0 rồi ",8").
  t = t.replace(/(?<![/\w])(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)(?![/\w])/g, "\\frac{$1}{$2}");
  t = t.replace(FN_NAME, "\\$1");
  for (const [k, v] of Object.entries(UNI)) t = t.split(k).join(v);
  // GỘP mũ/chỉ số LIỀN nhau: unicode "4¹⁰" → "^{1}^{0}" (KaTeX báo "Double
  // superscript"). Gộp lại "^{10}". Lặp tới ổn định cho ≥3 chữ số liền.
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\^\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, "^{$1$2}")
      .replace(/_\{([^{}]*)\}\s*_\{([^{}]*)\}/g, "_{$1$2}");
  }
  // Phân số "trần" — chạy SAU khi unicode đã thành LaTeX nên tử/mẫu mang được
  // mũ (x^{2}), căn (\sqrt{3}), độ (30^{\circ}): "x²/16" → gạch ngang thật.
  // "d₁ // d₂" là SONG SONG (ký hiệu ∥), không phải phân số cũng không phải hai
  // dấu gạch. Đòi khoảng trắng hai bên để không đụng "http://". Chạy TRƯỚC luật
  // phân số để cặp gạch không bị hiểu nhầm thành tử/mẫu.
  t = t.replace(/(?:(?<=\s)|^)\/\/(?=\s|$)/g, "\\parallel ");
  t = t.replace(FRAC_ABS_P, "\\frac{|$1|}{$2}");
  t = t.replace(FRAC_ABS, "\\frac{|$1|}{$2}");
  t = t.replace(FRAC_ATOM, (m, num: string, den: string) =>
    UNITS.has(`${num}/${den}`) ? m : `\\frac{${unwrap(num)}}{${unwrap(den)}}`);
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
  const open = (s: string) => (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0);
  let depth = 0; // ngoặc đang mở dở trong cụm
  let prev = ""; // token (không phải khoảng trắng) vừa đưa vào cụm
  for (const tk of toks) {
    if (/^\s+$/.test(tk)) { if (run.length) run.push(tk); else segs.push({ t: "text", v: tk }); continue; }
    let c = classify(tk);
    // Hai chỗ luật "nhãn đáp án" (A. / b) / n.) bắt nhầm, làm cụt công thức:
    //  · còn ngoặc mở dở  → "R = a/(2 sin A)" cắt ở "A)" là mất dấu đóng ngoặc;
    //  · ngay sau dấu "/" → "= ______ / n." cắt ở "n." là mất luôn MẪU SỐ.
    if (c === "text" && MATHTOK.test(tk) && (depth > 0 || prev.endsWith("/"))) c = "weak";
    if (c === "text") { flushRun(); depth = 0; prev = ""; segs.push({ t: "text", v: tk }); }
    else {
      if (c === "strong") hasStrong = true;
      run.push(tk); prev = tk; depth = Math.max(0, depth + open(tk));
    }
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

// ── Công thức đứng RIÊNG MỘT DÒNG ───────────────────────────────────────────
// Công thức có PHÂN SỐ (hay ∑/∏/∫) chồng hai tầng — nhét giữa dòng chữ thì dòng
// bị đội cao, chữ nhảy. Đúng lối sách giáo khoa: tách ra, canh giữa một dòng.
const TALL = /\\frac|\\dfrac|\\begin|\\sum|\\prod|\\int/;

// Bộ gom công thức chạy theo TOKEN nên đôi khi cắt giữa chừng: "…= 12,72 ⇒ a"
// rồi phần "≈ 3,57" rớt ra ngoài, hay "'0" là mẩu đầu câu nói của học sinh.
// Mẩu CỤT như thế mà đem canh giữa một dòng thì trông hỏng hơn là để trong dòng.
const CUT_HEAD = /^\s*(?:=|\+|-|\\Rightarrow|\\Leftrightarrow|\\to|\\cdot|\\times|\\le|\\ge|\\approx|\\pm)/;
const CUT_TAIL = /(?:=|\+|-|\\Rightarrow|\\Leftrightarrow|\\to|\\cdot|\\times|\\le|\\ge|\\approx|\\pm)\s*(?:\\?[A-Za-z]{1,7})?\s*$/;

/** Công thức "cao" VÀ trọn vẹn — đủ tư cách đứng riêng một dòng. */
function isTall(tex: string): boolean {
  const t = tex.trim();
  if (!TALL.test(t) || t.length < 12) return false;
  if (CUT_HEAD.test(t) || CUT_TAIL.test(t)) return false; // cụt đầu / cụt đuôi
  if ((t.match(/'/g)?.length ?? 0) % 2 === 1) return false; // nháy lẻ → cắt giữa câu nói
  return true;
}

/**
 * Đề nào thì tách công thức ra dòng riêng — trả cờ cho TỪNG đoạn.
 * CHỈ tách khi đề có ĐÚNG MỘT công thức đáng tách (hoặc cả đề chỉ là một công
 * thức). Đề nhiều bước rải 5–6 mẩu toán mà tách hết thì câu chữ bị băm nát —
 * thà để trong dòng còn đọc được.
 */
export function displayFlags(segs: Seg[]): boolean[] {
  const flags = segs.map(() => false);
  const math = segs.map((s, i) => (s.t === "math" ? i : -1)).filter((i) => i >= 0);
  const tall = math.filter((i) => isTall(segs[i]!.v));
  if (tall.length === 1) { flags[tall[0]!] = true; return flags; }
  // Cả đề CHỈ là một công thức (chữ xung quanh không có nghĩa) → cho đứng giữa.
  const bare = segs.every((s) => s.t === "math" || !/\p{L}/u.test(s.v));
  if (math.length === 1 && bare && segs[math[0]!]!.v.length >= 6) flags[math[0]!] = true;
  return flags;
}

/**
 * Viết hoa chữ cái đầu câu. CHỈ khi câu mở đầu bằng CHỮ NGHĨA — đề bắt đầu bằng
 * biến ("x² + 1 = 0 có nghiệm không?") hay nhãn ("(a) Vì sao…") phải giữ nguyên,
 * viết hoa vào đó là đổi nghĩa toán học.
 */
export function capitalizeLead(s: string): string {
  const head = /^[\s*"'“([]*\S+/.exec(s)?.[0];
  if (!head) return s;
  const tok = head.replace(/^[\s*"'“([]*/, "");
  if (classify(tok) !== "text" || !/\p{L}\p{L}/u.test(tok)) return s;
  const i = head.search(/\p{L}/u); // chữ cái ĐẦU TIÊN, không phải chữ thường đầu tiên
  const ch = i < 0 ? "" : s[i]!;
  return ch && ch !== ch.toUpperCase() ? s.slice(0, i) + ch.toUpperCase() + s.slice(i + 1) : s;
}
