"use client";

/**
 * Ô SOẠN CÔNG THỨC (MathLive) — mở ra khi học sinh bấm "Chèn công thức".
 *
 * Vì sao cần (chủ dự án chốt 01/08): bài tự luận nay AI chấm hết, nên em phải
 * gõ được công thức RA CHỮ chứ không chụp ảnh nữa. Mà em lớp 10 không biết
 * LaTeX. MathLive cho gõ như viết tay: bấm nút phân số là ra khung phân số, và
 * trên điện thoại có bàn phím toán ảo — thứ bàn phím thường không làm được.
 *
 * KHÔNG bao giờ nằm trong gói đầu: tệp này chỉ được nạp qua `next/dynamic`
 * (ssr:false) ở BaiLamEditor, và chỉ khi em bấm nút. Màn đăng nhập và màn lộ
 * trình không gánh một byte nào của MathLive.
 *
 * Dựng phần tử bằng tay thay vì viết <math-field> trong JSX: web component
 * không có kiểu JSX sẵn, và cách này cho đặt thẳng thuộc tính lên phần tử —
 * đúng cách một custom element muốn được dùng.
 */

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

export default function MathKeypad({
  banDau = "",
  onChen,
  onDong,
}: {
  banDau?: string;
  onChen: (latex: string) => void;
  onDong: () => void;
}) {
  const hop = useRef<HTMLDivElement | null>(null);
  const truong = useRef<HTMLElement & { value: string } | null>(null);
  const [san, datSan] = useState(false);

  useEffect(() => {
    let huy = false;
    void (async () => {
      const { MathfieldElement } = await import("mathlive");
      if (huy || !hop.current) return;

      // PHÔNG: MathLive dùng ĐÚNG bộ phông KaTeX mà trang này đã nạp sẵn
      // (TutorApp import "katex/dist/katex.min.css"). Để `fontsDirectory` mặc
      // định là nó đi tải lại 20 tệp woff2 y hệt từ một đường dẫn không tồn tại
      // trong bản xuất tĩnh → vừa 404 vừa thừa. Đặt null: các quy tắc @font-face
      // của KaTeX ở tài liệu ngoài vẫn áp được vào shadow DOM của ô.
      MathfieldElement.fontsDirectory = null;
      // Không có tệp âm thanh trong bản dựng → tắt hẳn, đỡ một loạt 404.
      MathfieldElement.soundsDirectory = null;

      const mf = new MathfieldElement();
      mf.value = banDau;
      // "auto": máy tính thì dùng bàn phím thường, điện thoại/máy tính bảng thì
      // tự bật bàn phím toán ảo — đúng chỗ nó có ích nhất.
      mf.mathVirtualKeyboardPolicy = "auto";
      mf.className = "mk-field";
      mf.setAttribute("aria-label", "Ô soạn công thức toán");

      hop.current.replaceChildren(mf);
      truong.current = mf as HTMLElement & { value: string };
      datSan(true);
      // Đặt con trỏ vào ô ngay — em bấm "Chèn công thức" là để gõ.
      queueMicrotask(() => mf.focus());
    })();
    return () => { huy = true; };
    // banDau cố ý KHÔNG nằm trong deps: dựng lại ô giữa chừng là mất phần em
    // đang gõ dở.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chen = () => {
    const v = (truong.current?.value ?? "").trim();
    if (v) onChen(v);
    else onDong();
  };

  return (
    <div className="mk-wrap" role="group" aria-label="Soạn công thức">
      <div
        className="mk-host"
        ref={hop}
        onKeyDown={(e) => {
          // Enter = chèn, Esc = đóng. Bàn phím toán ảo nuốt Enter của chính nó
          // nên chỉ bắt khi phím đi tới đây.
          if (e.key === "Enter") { e.preventDefault(); chen(); }
          if (e.key === "Escape") { e.preventDefault(); onDong(); }
        }}
      >
        {!san && <p className="mk-loading muted">Đang mở bảng công thức…</p>}
      </div>
      <div className="mk-row">
        <button type="button" className="btn btn-check mk-ok" disabled={!san} onClick={chen}>
          <Check aria-hidden strokeWidth={2.5} />
          Chèn vào bài
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDong}>
          <X aria-hidden strokeWidth={2.25} />
          Bỏ
        </button>
        <span className="muted mk-hint">Gõ như viết tay — bấm nút phân số, căn, mũ ở bàn phím toán.</span>
      </div>
    </div>
  );
}
