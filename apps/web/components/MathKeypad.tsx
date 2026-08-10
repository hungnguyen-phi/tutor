"use client";

/**
 * BẢNG SOẠN CÔNG THỨC — bấm hình, không gõ lệnh.
 *
 * Chủ dự án chốt 01/08: "học sinh không biết LaTeX, nếu điền công thức thì phải
 * là trình soạn thảo có sẵn công thức rồi nhấn hoặc kéo thả vào."
 *
 * Bản đầu của tôi CHỈ có ô MathLive trần. Trên điện thoại thì ổn (MathLive tự
 * bật bàn phím toán ảo), nhưng trên máy tính của trường — nơi phần lớn em ngồi
 * học — nó hiện ra một ô trống, và em vẫn phải biết gõ `\frac`. Đó vẫn là bắt
 * em học LaTeX, chỉ giấu kỹ hơn một tầng. Nên:
 *
 *   · BẢNG CÔNG THỨC luôn hiện, nút vẽ ĐÚNG HÌNH DẠNG công thức (khung phân số
 *     rỗng, dấu căn rỗng) bằng chính KaTeX của app — em nhìn thấy cái mình cần
 *     rồi bấm, không phải nhớ tên lệnh nào.
 *   · Bấm xong con trỏ nằm sẵn trong ô trống đầu tiên (placeholder `#0` của
 *     MathLive), gõ số vào là xong; Tab nhảy sang ô trống kế.
 *   · Nút "Bàn phím toán" mở bàn phím ảo đầy đủ của MathLive — trước đây chỉ
 *     thiết bị cảm ứng mới có, nay máy tính cũng gọi được.
 *
 * Nhóm công thức bám chương trình Toán 10 (lib/congthuc.ts), không phải bảng ký
 * hiệu toán học chung chung.
 *
 * Tệp này KHÔNG bao giờ nằm trong gói đầu: chỉ nạp qua `next/dynamic` (ssr:false)
 * ở BaiLamEditor, và chỉ khi em mở bảng.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Keyboard, X } from "lucide-react";
import { MathText } from "../lib/mathrender";
import { NHOM_CONG_THUC } from "../lib/congthuc";

type Mf = HTMLElement & {
  value: string;
  insert: (latex: string, opts?: Record<string, unknown>) => void;
  mathVirtualKeyboardPolicy: string;
};

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
  const truong = useRef<Mf | null>(null);
  const [san, datSan] = useState(false);
  const [nhom, datNhom] = useState(NHOM_CONG_THUC[0]!.id);

  useEffect(() => {
    let huy = false;
    void (async () => {
      const { MathfieldElement } = await import("mathlive");
      if (huy || !hop.current) return;

      // PHÔNG: MathLive dùng ĐÚNG bộ phông KaTeX mà trang này đã nạp sẵn
      // (TutorApp import "katex/dist/katex.min.css"). Đo trong trình duyệt: ký
      // hiệu trong ô render bằng KaTeX_Math / KaTeX_Main, 0 lỗi tải. Để mặc
      // định thì nó đi tải lại 20 tệp woff2 y hệt từ đường dẫn không tồn tại
      // trong bản xuất tĩnh.
      MathfieldElement.fontsDirectory = null;
      MathfieldElement.soundsDirectory = null;

      const mf = new MathfieldElement() as unknown as Mf;
      mf.value = banDau;
      // "manual": bàn phím ảo chỉ mở khi em bấm nút bên dưới. Để "auto" thì trên
      // điện thoại nó bật đè lên bảng công thức, hai bàn phím tranh chỗ nhau.
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.className = "mk-field";
      mf.setAttribute("aria-label", "Ô công thức");

      // replaceChildren an toàn vì `.mk-host` KHÔNG có con nào của React (xem
      // ghi chú ở JSX bên dưới). Vẫn dùng replace thay vì append để lần gắn thứ
      // hai (StrictMode gọi effect hai lượt) không để lại hai ô công thức.
      hop.current.replaceChildren(mf as unknown as Node);
      truong.current = mf;
      datSan(true);
      queueMicrotask(() => mf.focus());
    })();
    return () => { huy = true; };
    // banDau cố ý KHÔNG nằm trong deps: dựng lại ô giữa chừng là mất phần đang gõ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Bấm một nút trong bảng → chèn tại con trỏ, dừng ở ô trống đầu tiên. */
  const bam = (latex: string) => {
    const mf = truong.current;
    if (!mf) return;
    mf.insert(latex, {
      insertionMode: "replaceSelection",
      // Nhảy thẳng vào ô trống đầu tiên — bấm "phân số" xong là gõ TỬ được ngay,
      // không phải tự mò con trỏ vào trong khung.
      selectionMode: "placeholder",
      focus: true,
      format: "latex",
    });
    mf.focus();
  };

  const moBanPhimAo = () => {
    const vk = (window as unknown as { mathVirtualKeyboard?: { show: () => void } }).mathVirtualKeyboard;
    truong.current?.focus();
    vk?.show();
  };

  const chen = () => {
    const v = (truong.current?.value ?? "").trim();
    if (v) onChen(v); else onDong();
  };

  const nhomHienTai = NHOM_CONG_THUC.find((n) => n.id === nhom) ?? NHOM_CONG_THUC[0]!;

  return (
    <div className="mk-wrap" role="group" aria-label="Bảng soạn công thức">
      {/* ⚠️ `.mk-host` phải RỖNG dưới mắt React — effect ở trên gắn ô MathLive
          vào đây bằng DOM tay. Bản đầu đặt dòng "Đang mở bảng công thức…" NẰM
          TRONG div này, và đó là lỗi làm sập cả app mỗi lần bấm "Chèn công
          thức" (báo 10/08, "Application error: a client-side exception"):
          React gắn <p> → effect `replaceChildren` gỡ mất <p> → `datSan(true)`
          khiến React đi xoá <p> mà nó không còn là con của .mk-host nữa →
          `removeChild` ném NotFoundError, thoát ra tới ranh giới lỗi gốc.
          Luật: node nào mình mutate bằng tay thì KHÔNG cho React con nào ở đó.
          Dòng chờ nay là ANH EM của host, không phải con. */}
      {!san && <p className="mk-loading muted">Đang mở bảng công thức…</p>}
      <div
        className="mk-host"
        ref={hop}
        onKeyDown={(e) => {
          // Esc đóng. Enter KHÔNG chèn: trong ô toán, Enter là xuống dòng của
          // chính công thức (hệ phương trình), cướp nó là hỏng đúng cái em cần.
          if (e.key === "Escape") { e.preventDefault(); onDong(); }
        }}
      />

      {/* BẢNG CÔNG THỨC — nút vẽ đúng hình dạng, bấm là chèn. */}
      <div className="mk-tabs" role="tablist" aria-label="Nhóm công thức">
        {NHOM_CONG_THUC.map((n) => (
          <button
            key={n.id}
            type="button"
            role="tab"
            aria-selected={n.id === nhom}
            className="mk-tab"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => datNhom(n.id)}
          >
            {n.nhan}
          </button>
        ))}
      </div>

      <div className="mk-grid" role="group" aria-label={`Công thức nhóm ${nhomHienTai.nhan}`}>
        {nhomHienTai.muc.map((mc) => (
          <button
            key={`${nhomHienTai.id}:${mc.ten}`}
            type="button"
            className="mk-key"
            title={mc.ten}
            aria-label={mc.ten}
            disabled={!san}
            /* Giữ con trỏ trong ô công thức: bấm nút mà ô mất focus thì chèn
               xong con trỏ rơi về đầu, em gõ tiếp ra sai chỗ. */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => bam(mc.chen)}
          >
            <MathText>{`$${mc.hien}$`}</MathText>
          </button>
        ))}
      </div>

      <div className="mk-row">
        <button type="button" className="btn btn-check mk-ok" disabled={!san} onClick={chen}>
          <Check aria-hidden strokeWidth={2.5} />
          Chèn vào bài
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!san}
          onMouseDown={(e) => e.preventDefault()}
          onClick={moBanPhimAo}
          title="Mở bàn phím toán đầy đủ (có cả ký hiệu không nằm trong bảng)"
        >
          <Keyboard aria-hidden strokeWidth={2.25} />
          Bàn phím toán
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDong}>
          <X aria-hidden strokeWidth={2.25} />
          Bỏ
        </button>
      </div>
    </div>
  );
}
