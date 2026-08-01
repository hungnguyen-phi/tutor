"use client";

/**
 * Ô VIẾT BÀI TỰ LUẬN — chữ + công thức, dùng chung cho mọi chỗ nộp bài.
 *
 * Vì sao là "ô chữ + nút chèn công thức" chứ không phải một trình soạn thảo
 * toàn-công-thức: bài tự luận lớp 10 phần lớn là LỜI ("Ta có Δ = 1 > 0 nên
 * phương trình có hai nghiệm phân biệt…"), công thức chỉ xen vào. Bắt em gõ cả
 * bài trong một ô toán là bắt sai việc. Nên:
 *   · ô chữ giữ nguyên mọi thói quen bàn phím (kể cả bàn phím điện thoại);
 *   · bấm "Chèn công thức" mới mở MathLive, chèn `$…$` vào ĐÚNG chỗ con trỏ;
 *   · dưới ô có bản xem trước dựng bằng KaTeX — em thấy công thức thành hình
 *     ngay, y như lúc nó hiện trên đề bài.
 *
 * Cú pháp `$…$` cố ý trùng với lối app đã dùng khắp nơi (MathText, ô ghi chú
 * chấm bài của giáo viên) — một quy ước cho cả nhà, không đẻ thêm cái thứ hai.
 *
 * MathLive nạp TRỄ: `next/dynamic` + ssr:false, và chỉ khi em bấm nút. Không
 * bấm thì không tải một byte nào.
 */

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Sigma } from "lucide-react";
import { MathText } from "../lib/mathrender";

const MathKeypad = dynamic(() => import("./MathKeypad"), {
  ssr: false,
  loading: () => <p className="mk-loading muted">Đang mở bảng công thức…</p>,
});

export default function BaiLamEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Viết bài làm của em ở đây — giải thích như đang nói với bạn…",
  rows = 3,
  maxHeight = 320,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxHeight?: number;
  id?: string;
}) {
  const oRef = useRef<HTMLTextAreaElement | null>(null);
  // Vị trí con trỏ lúc em rời ô để bấm nút — bấm nút là ô mất focus, đọc
  // selectionStart lúc đó sẽ ra 0 và công thức rơi lên đầu bài.
  const viTri = useRef<number>(0);
  const [moBang, datMoBang] = useState(false);

  const nhoViTri = () => {
    const el = oRef.current;
    if (el) viTri.current = el.selectionStart ?? el.value.length;
  };

  const chenCongThuc = (latex: string) => {
    const el = oRef.current;
    const v = value;
    const i = Math.min(viTri.current, v.length);
    // Chừa khoảng trắng hai bên khi cần: "…có$x^2$nên…" đọc ra thì dính chữ.
    const truoc = v.slice(0, i);
    const sau = v.slice(i);
    const dem1 = truoc && !/\s$/.test(truoc) ? " " : "";
    const dem2 = sau && !/^\s/.test(sau) ? " " : "";
    const chen = `${dem1}$${latex}$${dem2}`;
    onChange(truoc + chen + sau);
    datMoBang(false);
    // Trả con trỏ về ngay sau công thức vừa chèn để em viết tiếp.
    queueMicrotask(() => {
      if (!el) return;
      el.focus();
      const p = i + chen.length;
      el.setSelectionRange(p, p);
      viTri.current = p;
    });
  };

  const coCongThuc = /\$[^$]+\$/.test(value);

  return (
    <div className="ble">
      <textarea
        id={id}
        ref={oRef}
        className="ans-input work-input"
        rows={rows}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
        }}
        onSelect={nhoViTri}
        onKeyUp={nhoViTri}
        onClick={nhoViTri}
        onBlur={nhoViTri}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
      />

      <div className="ble-tools">
        <button
          type="button"
          className="btn btn-ghost ble-fx"
          disabled={disabled}
          aria-expanded={moBang}
          onMouseDown={(e) => e.preventDefault() /* giữ vị trí con trỏ trong ô */}
          onClick={() => { nhoViTri(); datMoBang((m) => !m); }}
        >
          <Sigma aria-hidden strokeWidth={2.25} />
          {moBang ? "Đóng bảng công thức" : "Chèn công thức"}
        </button>
        <span className="muted ble-tip">
          Không cần nhớ cú pháp — bấm nút là có khung phân số, căn, mũ.
        </span>
      </div>

      {moBang && (
        <MathKeypad onChen={chenCongThuc} onDong={() => datMoBang(false)} />
      )}

      {/* XEM TRƯỚC: chỉ hiện khi bài CÓ công thức. Không có công thức mà vẫn vẽ
          một khối lặp lại y nguyên đoạn em vừa gõ thì chỉ tổ chiếm màn hình. */}
      {coCongThuc && (
        <div className="ble-preview">
          <span className="ble-preview-label">Bài của em trông sẽ như vầy</span>
          <div className="ble-preview-body">
            <MathText>{value}</MathText>
          </div>
        </div>
      )}
    </div>
  );
}
