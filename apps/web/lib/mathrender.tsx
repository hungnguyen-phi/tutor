// Render CHUẨN mọi công thức toán qua thư viện KaTeX.
//
// Nguyên tắc (để học sinh học ĐÚNG):
//  1. Nội dung soạn bài là text unicode (x², √, ≤, a/b…) hoặc LaTeX lẫn ($...$,
//     \(...\)). Lõi ở lib/mathtex.ts gom đúng ĐOẠN là toán rồi đưa qua KaTeX;
//     phần văn xuôi giữ nguyên.
//  2. Mỗi đoạn toán phải KaTeX PARSE ĐƯỢC. Không parse được → trả text gốc
//     (KHÔNG bịa, KHÔNG render sai công thức, thà hiện thô còn hơn dạy sai).
//  3. Đề bài (`block`) bày theo lối sách giáo khoa: công thức có phân số đứng
//     riêng một dòng canh giữa; chữ cái đầu câu viết hoa (`cap`).

import React from "react";
import katex from "katex";
import { segmentMath, displayFlags, capitalizeLead } from "./mathtex";

export { segmentMath, capitalizeLead };
export type { Seg } from "./mathtex";

// Bỏ ghi chú soạn bài lọt vào nội dung (metadata của GV, HS không cần thấy).
const stripNote = (s: string) => (s ?? "").replace(/\s*\(khu[ôo]n tham s[ốo][^)]*\)/gi, "");

function katexHtml(tex: string, display: boolean): string | null {
  try { return katex.renderToString(tex, { throwOnError: true, displayMode: display }); }
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
function renderSegs(text: string, keyBase: string, block: boolean): React.ReactNode[] {
  const segs = segmentMath(text);
  const disp = block ? displayFlags(segs) : segs.map(() => false);
  // Dấu chấm/phẩy ngay sau công thức tách dòng phải ĐI THEO công thức, không rơi
  // xuống đầu dòng kế (dòng mở đầu bằng ". (b) …" trông như lỗi gõ).
  const glue = segs.map((s, i) => {
    const nx = segs[i + 1];
    return disp[i] && nx?.t === "text" ? (/^[.,;:]/.exec(nx.v)?.[0] ?? "") : "";
  });
  const html = segs.map((s, i) => {
    if (s.t !== "math") return null;
    if (glue[i]) {
      const glued = katexHtml(`${s.v}\\text{${glue[i]}}`, true);
      if (glued) return glued;
      glue[i] = ""; // dán không được thì thôi, giữ nguyên dấu ở đoạn chữ
    }
    return katexHtml(s.v, disp[i]!);
  });
  return segs.map((seg, i) => {
    // Công thức tách dòng thì nuốt luôn khoảng trắng hai bên, kẻo hở ra một
    // dòng trống lửng lơ trên/dưới công thức.
    const solo = (j: number) => disp[j] === true && html[j] != null;
    if (seg.t === "text") {
      let v = seg.v;
      if (solo(i - 1)) v = v.slice(glue[i - 1]!.length).replace(/^[ \t]+/, "");
      if (solo(i + 1)) v = v.replace(/[ \t]+$/, "");
      return v ? textSeg(v, keyBase + i) : null;
    }
    if (html[i] == null) return textSeg(seg.v, keyBase + i);
    return (
      <span
        key={keyBase + i}
        className={solo(i) ? "math-solo" : undefined}
        dangerouslySetInnerHTML={{ __html: html[i]! }}
      />
    );
  });
}

/**
 * Hiển thị nội dung có công thức: **đậm** → <b>, mọi công thức qua KaTeX.
 * `block` — đang bày ĐỀ BÀI: công thức nặng được tách ra một dòng riêng.
 * `cap`   — viết hoa chữ đầu (chỉ khi câu mở đầu bằng chữ, không phải biến).
 */
export function MathText({ children, block = false, cap = false }: {
  children: string | null | undefined;
  block?: boolean;
  cap?: boolean;
}): React.ReactElement {
  let src = stripNote(String(children ?? ""));
  if (cap) src = capitalizeLead(src);
  const parts = src.split(/\*\*([^*]+)\*\*/g); // lẻ = đậm
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <b key={"b" + i}>{renderSegs(p, "b" + i + "-", block)}</b>
          : <React.Fragment key={"t" + i}>{renderSegs(p, "t" + i + "-", block)}</React.Fragment>,
      )}
    </>
  );
}
