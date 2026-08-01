/**
 * ĐỌC .docx TRONG EDGE FUNCTION — không thêm một thư viện nào.
 *
 * Vì sao có (chủ dự án chốt 01/08): bài tự luận nay do AI chấm hết, và một trong
 * ba cửa vào là "học sinh nộp tệp Word". Muốn chấm thì phải đọc được chữ TRONG
 * tệp, mà .docx thực chất chỉ là một tệp ZIP chứa XML.
 *
 * Vì sao TỰ VIẾT thay vì dùng mammoth: mammoth **vứt bỏ công thức** (OMML) —
 * đúng cái phần quan trọng nhất của bài toán. Bài "x = (-b ± √Δ)/2a" qua mammoth
 * ra thành "x = " rồi hết. AI chấm một bài rỗng và đánh trượt em oan.
 *
 * Hai việc:
 *   · docxToText  — giải nén + lấy văn bản, giữ xuống dòng theo đoạn.
 *   · ommlToLatex — đổi công thức Word sang LaTeX (đã bọc trong $…$), đúng lối
 *                   $…$ mà MathText/KaTeX của app đang render.
 *
 * Chỗ nào gặp công thức KHÔNG dịch nổi thì đánh dấu `coMathChuaDoc` để nhánh gọi
 * mời em chuyển sang ô soạn thảo — KHÔNG lặng lẽ nộp một bài thiếu công thức rồi
 * để AI chấm trượt.
 */

// ── ZIP ───────────────────────────────────────────────────────────────────────
// Đọc theo BẢNG THƯ MỤC TRUNG TÂM (central directory) chứ không quét chữ ký
// PK\x03\x04 từ đầu tệp: khi Word ghi kiểu dòng chảy, kích thước nằm ở "data
// descriptor" SAU phần dữ liệu nên header cục bộ ghi 0 — quét từ đầu sẽ đọc ra
// tệp rỗng. Bảng trung tâm luôn có số thật.

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readCentralDirectory(buf: Uint8Array): ZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // EOCD nằm ở cuối, sau nó chỉ còn phần chú thích (tối đa 65.535 byte).
  let eocd = -1;
  const from = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= from; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("docx: không thấy EOCD — tệp không phải ZIP hợp lệ");

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // offset bảng trung tâm
  const out: ZipEntry[] = [];
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (dv.getUint32(p, true) !== CEN_SIG) break;
    const method = dv.getUint16(p + 10, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    out.push({ name, method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lấy MỘT tệp trong .docx ra dạng chuỗi. Trả null nếu không có tệp đó. */
export async function zipReadText(buf: Uint8Array, want: string): Promise<string | null> {
  // So tên sau khi ĐỔI \ THÀNH / : chuẩn OPC bắt buộc dùng "/", nhưng vài bộ nén
  // trên Windows vẫn ghi "word\document.xml" (đo được với System.IO.Compression
  // của .NET). Khớp cứng theo "/" thì những tệp đó bị coi là không có bài làm.
  const norm = (s: string) => s.replace(/\\/g, "/");
  const target = norm(want);
  const entry = readCentralDirectory(buf).find((e) => norm(e.name) === target);
  if (!entry) return null;

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lo = entry.localOffset;
  // Độ dài tên/extra ở header CỤC BỘ có thể khác bảng trung tâm — phải đọc lại.
  const nameLen = dv.getUint16(lo + 26, true);
  const extraLen = dv.getUint16(lo + 28, true);
  const start = lo + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compressedSize);

  const bytes = entry.method === 0 ? raw : await inflateRaw(raw);
  return new TextDecoder().decode(bytes);
}

// ── XML tối giản ──────────────────────────────────────────────────────────────
// Deno không có DOMParser cho XML. Đây là bộ đọc vừa đủ cho document.xml: thẻ,
// thuộc tính, con, chữ. Không xử lý CDATA / chỉ thị xử lý vì document.xml của
// Word không dùng.

export interface XNode {
  tag: string;
  attrs: Record<string, string>;
  kids: XNode[];
  text: string;
}

const ENTS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function unent(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g: string) => {
    if (g[0] === "#") {
      const n = g[1] === "x" || g[1] === "X"
        ? parseInt(g.slice(2), 16)
        : parseInt(g.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTS[g] ?? m;
  });
}

export function parseXml(src: string): XNode {
  const root: XNode = { tag: "#root", attrs: {}, kids: [], text: "" };
  const stack: XNode[] = [root];
  const re = /<([!?/]?)([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const [, prefix, tag, attrStr, selfClose, chunk] = m;
    const top = stack[stack.length - 1]!;
    if (chunk !== undefined) { top.text += unent(chunk); continue; }
    if (prefix === "!" || prefix === "?") continue; // <?xml …?>, <!-- … -->
    if (prefix === "/") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    const ar = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(attrStr ?? "")) !== null) {
      attrs[a[1] ?? a[3]!] = unent(a[2] ?? a[4] ?? "");
    }
    const node: XNode = { tag: tag!, attrs, kids: [], text: "" };
    top.kids.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

const kidsNamed = (n: XNode, tag: string) => n.kids.filter((k) => k.tag === tag);
const kidNamed = (n: XNode, tag: string) => n.kids.find((k) => k.tag === tag) ?? null;

// ── OMML → LaTeX ──────────────────────────────────────────────────────────────

/** Cờ dựng-được-hết hay không, dùng chung cho cả lượt dịch một tệp. */
interface MathCtx { chuaDoc: boolean }

/** Chỗ đánh dấu công thức Word không dịch nổi. Cố ý là chữ đọc được, không phải
 *  ký hiệu LaTeX — nó sẽ nằm NGOÀI $…$ nên không bao giờ chạm tới KaTeX. */
export const MATH_CHUA_DOC = "⟦công thức chưa đọc được⟧";

/** Ký tự toán tử lớn của <m:nary> → lệnh LaTeX. */
const NARY: Record<string, string> = {
  "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint",
  "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap", "⨆": "\\bigsqcup",
};

/** Dấu mũ của <m:acc> → lệnh LaTeX. */
const ACC: Record<string, string> = {
  "‾": "\\overline", "¯": "\\overline", "→": "\\vec", "⃗": "\\vec",
  "^": "\\hat", "~": "\\tilde", "˙": "\\dot", "¨": "\\ddot",
};

/** Bọc bằng {} khi cụm dài hơn một ký tự — {x}^{2} luôn đúng, x^2 chỉ đúng khi ngắn. */
const brace = (s: string) => (s.length === 1 ? s : `{${s}}`);

function mathKids(n: XNode, ctx: MathCtx): string {
  return n.kids.map((k) => mathNode(k, ctx)).join("");
}

/** Nội dung của thẻ bọc <m:e>/<m:num>/… — nhiều Word lồng thêm một tầng. */
function mathOf(n: XNode | null, ctx: MathCtx): string {
  return n ? mathKids(n, ctx) : "";
}

function mathNode(n: XNode, ctx: MathCtx): string {
  switch (n.tag) {
    // Chữ trong công thức.
    case "m:t":
      return n.text;
    // Bọc: chạy qua con.
    case "m:r":
    case "m:e":
    case "m:num":
    case "m:den":
    case "m:oMath":
    case "m:oMathPara":
    case "m:sub":
    case "m:sup":
    case "m:deg":
    case "m:fName":
    case "m:lim":
      return mathKids(n, ctx);
    // Thuộc tính định dạng — không sinh chữ.
    case "m:rPr":
    case "m:ctrlPr":
    case "m:fPr":
    case "m:radPr":
    case "m:sSupPr":
    case "m:sSubPr":
    case "m:sSubSupPr":
    case "m:naryPr":
    case "m:dPr":
    case "m:funcPr":
    case "m:accPr":
    case "m:barPr":
    case "m:limLowPr":
    case "m:limUppPr":
    case "w:rPr":
      return "";

    case "m:f": {
      const num = mathOf(kidNamed(n, "m:num"), ctx);
      const den = mathOf(kidNamed(n, "m:den"), ctx);
      // Kiểu "lin" là phân số viết ngang a/b, không phải \frac.
      const type = kidNamed(kidNamed(n, "m:fPr"), "m:type")?.attrs["m:val"];
      if (type === "lin") return `${num}/${den}`;
      return `\\frac{${num}}{${den}}`;
    }
    case "m:sSup":
      return `${brace(mathOf(kidNamed(n, "m:e"), ctx))}^${brace(mathOf(kidNamed(n, "m:sup"), ctx))}`;
    case "m:sSub":
      return `${brace(mathOf(kidNamed(n, "m:e"), ctx))}_${brace(mathOf(kidNamed(n, "m:sub"), ctx))}`;
    case "m:sSubSup":
      return `${brace(mathOf(kidNamed(n, "m:e"), ctx))}` +
        `_${brace(mathOf(kidNamed(n, "m:sub"), ctx))}` +
        `^${brace(mathOf(kidNamed(n, "m:sup"), ctx))}`;
    case "m:rad": {
      const deg = mathOf(kidNamed(n, "m:deg"), ctx);
      const e = mathOf(kidNamed(n, "m:e"), ctx);
      return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
    }
    case "m:d": {
      // Ngoặc. Word ghi ký tự mở/đóng ở dPr; thiếu thì mặc định là ( ).
      const pr = kidNamed(n, "m:dPr");
      const beg = kidNamed(pr, "m:begChr")?.attrs["m:val"] ?? "(";
      const end = kidNamed(pr, "m:endChr")?.attrs["m:val"] ?? ")";
      const sep = kidNamed(pr, "m:sepChr")?.attrs["m:val"] ?? ",";
      const parts = kidsNamed(n, "m:e").map((e) => mathKids(e, ctx));
      const esc = (c: string) => (c === "{" || c === "}" ? `\\${c}` : c === "" ? "." : c);
      return `\\left${esc(beg)}${parts.join(sep)}\\right${esc(end)}`;
    }
    case "m:nary": {
      const pr = kidNamed(n, "m:naryPr");
      const chr = kidNamed(pr, "m:chr")?.attrs["m:val"] ?? "∫";
      const op = NARY[chr];
      if (!op) { ctx.chuaDoc = true; return "⟦công thức⟧"; }
      const sub = mathOf(kidNamed(n, "m:sub"), ctx);
      const sup = mathOf(kidNamed(n, "m:sup"), ctx);
      const e = mathOf(kidNamed(n, "m:e"), ctx);
      return `${op}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""}{${e}}`;
    }
    case "m:func": {
      const name = mathOf(kidNamed(n, "m:fName"), ctx);
      const e = mathOf(kidNamed(n, "m:e"), ctx);
      // sin/cos/log… có lệnh riêng trong LaTeX; tên khác thì để chữ thẳng.
      const known = /^(sin|cos|tan|cot|sec|csc|log|ln|lim|exp|max|min|det|gcd)$/i.test(name.trim());
      // LUÔN bọc {} cho đối số, kể cả một ký tự: `\sin` + `x` dính lại thành
      // `\sinx` — KaTeX đọc ra một lệnh không tồn tại và cả công thức vỡ.
      return `${known ? `\\${name.trim().toLowerCase()}` : `\\operatorname{${name}}`}{${e}}`;
    }
    case "m:acc": {
      const chr = kidNamed(kidNamed(n, "m:accPr"), "m:chr")?.attrs["m:val"] ?? "^";
      const cmd = ACC[chr];
      const e = mathOf(kidNamed(n, "m:e"), ctx);
      if (!cmd) { ctx.chuaDoc = true; return e; }
      return `${cmd}{${e}}`;
    }
    case "m:bar":
      return `\\overline{${mathOf(kidNamed(n, "m:e"), ctx)}}`;
    case "m:limLow":
      return `${mathOf(kidNamed(n, "m:e"), ctx)}_{${mathOf(kidNamed(n, "m:lim"), ctx)}}`;
    case "m:limUpp":
      return `${mathOf(kidNamed(n, "m:e"), ctx)}^{${mathOf(kidNamed(n, "m:lim"), ctx)}}`;

    // Ma trận / phương trình nhiều dòng / hộp — hiếm ở bài lớp 10 và dịch sai
    // thì tệ hơn không dịch. Đánh dấu để nhánh gọi mời em gõ tay.
    case "m:m":
    case "m:eqArr":
    case "m:groupChr":
    case "m:borderBox":
      ctx.chuaDoc = true;
      return MATH_CHUA_DOC;

    default:
      // Thẻ m: lạ → đánh dấu. Thẻ w: lồng trong công thức (w:r…) thì chạy tiếp.
      if (n.tag.startsWith("m:")) { ctx.chuaDoc = true; return mathKids(n, ctx); }
      return mathKids(n, ctx);
  }
}

/** Đổi một cây <m:oMath> sang LaTeX. Dùng được độc lập (bộ kiểm gọi thẳng). */
export function ommlToLatex(node: XNode): { latex: string; chuaDoc: boolean } {
  const ctx: MathCtx = { chuaDoc: false };
  const latex = mathNode(node, ctx).replace(/\s+/g, " ").trim();
  return { latex, chuaDoc: ctx.chuaDoc };
}

// ── document.xml → văn bản ────────────────────────────────────────────────────

export interface DocxText {
  /** Văn bản bài làm, công thức đã bọc trong $…$. */
  text: string;
  /** Số công thức đọc được. */
  soCongThuc: number;
  /** Có công thức KHÔNG dịch nổi → mời em gõ lại bằng ô soạn thảo. */
  coMathChuaDoc: boolean;
}

/** Duyệt một đoạn <w:p>, trả chuỗi của đoạn đó. */
function walkPara(n: XNode, ctx: MathCtx, count: { n: number }): string {
  let out = "";
  for (const k of n.kids) {
    switch (k.tag) {
      case "m:oMath":
      case "m:oMathPara": {
        const { latex, chuaDoc } = ommlToLatex(k);
        if (chuaDoc) ctx.chuaDoc = true;
        if (!latex) break;
        // Công thức có chỗ chưa dịch nổi thì KHÔNG bọc $…$: chuỗi dở dang đi qua
        // KaTeX là vỡ nguyên khối, em nhìn thấy một vệt đỏ thay vì bài của mình.
        // Để nguyên chữ, và `coMathChuaDoc` sẽ mời em gõ lại bằng ô soạn thảo.
        if (latex.includes(MATH_CHUA_DOC)) { out += ` ${latex} `; break; }
        out += ` $${latex}$ `;
        count.n++;
        break;
      }
      case "w:t":
        out += k.text;
        break;
      case "w:br":
        out += "\n";
        break;
      case "w:tab":
        out += "\t";
        break;
      case "w:rPr":
      case "w:pPr":
        break; // định dạng, không sinh chữ
      default:
        out += walkPara(k, ctx, count);
    }
  }
  return out;
}

/**
 * Lấy bài làm ra khỏi .docx.
 *
 * `max` cắt trần độ dài (mặc định 12k) — bài tự luận lớp 10 dài nhất cũng không
 * tới 6k; dài hơn nữa là tệp sai chứ không phải bài.
 */
export async function docxToText(buf: Uint8Array, max = 12_000): Promise<DocxText> {
  const xml = await zipReadText(buf, "word/document.xml");
  if (xml == null) throw new Error("docx: thiếu word/document.xml");
  const doc = parseXml(xml);

  const ctx: MathCtx = { chuaDoc: false };
  const count = { n: 0 };
  const lines: string[] = [];

  // Duyệt tìm mọi <w:p> ở mọi độ sâu (đoạn nằm trong bảng thì lồng sâu hơn).
  // Đẩy con theo thứ tự NGƯỢC để `pop` nhả ra theo đúng thứ tự đọc — nhờ vậy
  // `paras` đã đúng trình tự, KHÔNG được reverse lại lần nữa.
  const stack: XNode[] = [doc];
  const paras: XNode[] = [];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.tag === "w:p") { paras.push(n); continue; } // đoạn không lồng đoạn
    for (let i = n.kids.length - 1; i >= 0; i--) stack.push(n.kids[i]!);
  }

  for (const p of paras) {
    const line = walkPara(p, ctx, count)
      .replace(/[ \t]+/g, " ")
      // Khoảng trắng do việc chèn " $…$ " đẻ ra, đứng ngay trước dấu câu.
      .replace(/\s+([.,;:!?)\]])/g, "$1")
      .trim();
    if (line) lines.push(line);
  }

  return {
    text: lines.join("\n").slice(0, max),
    soCongThuc: count.n,
    coMathChuaDoc: ctx.chuaDoc,
  };
}
