"use client";

/**
 * Ô VIẾT BÀI TỰ LUẬN — chữ và công thức, KHÔNG một dòng LaTeX nào lộ ra.
 *
 * Vì sao dựng lại (chủ dự án chỉ ra 01/08): "học sinh không biết LaTeX".
 * Bản trước của tôi chèn thẳng `$\frac{-b}{2a}$` vào một ô chữ thường — công
 * thức thì bấm ra được, nhưng em NHÌN THẤY nguyên chuỗi lệnh nằm trong bài của
 * mình. Với em lớp 10 đó là bài mình bị hỏng, không phải bài mình vừa viết.
 *
 * Nay bài là một CHỒNG KHỐI, đúng cách người ta trình bày lời giải toán:
 *   · khối CHỮ    — ô gõ bình thường, mọi thói quen bàn phím giữ nguyên.
 *   · khối CÔNG THỨC — hiện thành công thức ĐÃ VẼ (KaTeX), bấm vào là mở lại
 *     bảng công thức để sửa. Em không bao giờ thấy dấu `$` hay `\frac`.
 *
 * Chuỗi gửi lên server vẫn là văn bản kèm `$…$` — đúng quy ước app dùng khắp
 * nơi (MathText, ô ghi chú của giáo viên, bộ đọc .docx). LaTeX chỉ còn là định
 * dạng TRUYỀN, không còn là thứ em phải đọc.
 *
 * MathLive nạp TRỄ: `next/dynamic` + ssr:false, và chỉ khi em mở bảng công thức.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Pencil, Sigma, X } from "lucide-react";
import { MathText } from "../lib/mathrender";

const MathKeypad = dynamic(() => import("./MathKeypad"), {
  ssr: false,
  loading: () => <p className="mk-loading muted">Đang mở bảng công thức…</p>,
});

type Loai = "chu" | "ct";
interface Khoi { id: number; loai: Loai; noiDung: string }

let demId = 0;
const moiKhoi = (loai: Loai, noiDung = ""): Khoi => ({ id: ++demId, loai, noiDung });

/** Khối → chuỗi gửi server. Công thức bọc `$…$`, mỗi khối một dòng. */
function ghepBai(khoi: Khoi[]): string {
  return khoi
    .map((k) => (k.loai === "ct" ? (k.noiDung.trim() ? `$${k.noiDung.trim()}$` : "") : k.noiDung))
    .filter((s) => s.trim())
    .join("\n")
    .trim();
}

/** Chuỗi → khối. Dòng nào CHỈ có một công thức thì thành khối công thức; các
 *  dòng chữ liền nhau gộp về một khối chữ (không xé bài thành chục ô). */
function taKhoi(text: string): Khoi[] {
  const out: Khoi[] = [];
  for (const dong of (text ?? "").split("\n")) {
    const chiCongThuc = dong.trim().match(/^\$([^$]+)\$$/);
    if (chiCongThuc) { out.push(moiKhoi("ct", chiCongThuc[1]!.trim())); continue; }
    const cuoi = out[out.length - 1];
    if (cuoi?.loai === "chu") cuoi.noiDung += `\n${dong}`;
    else out.push(moiKhoi("chu", dong));
  }
  if (!out.length || out[out.length - 1]!.loai === "ct") out.push(moiKhoi("chu"));
  return out;
}

export default function BaiLamEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Viết bài làm của em ở đây — giải thích như đang nói với bạn…",
  rows = 3,
  maxHeight = 320,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxHeight?: number;
}) {
  const [khoi, datKhoi] = useState<Khoi[]>(() => taKhoi(value));
  /** id khối công thức đang mở bảng để sửa; 0 = đang thêm khối mới. */
  const [dangSua, datDangSua] = useState<number | null>(null);
  /** Khối chữ được chạm gần nhất — công thức mới chèn NGAY SAU nó. */
  const oCuoi = useRef<number | null>(null);
  const daGhep = useRef(value);

  const capNhat = useCallback((ds: Khoi[]) => {
    datKhoi(ds);
    const s = ghepBai(ds);
    daGhep.current = s;
    onChange(s);
  }, [onChange]);

  // Cha xoá trắng (nộp xong, đổi câu) → dựng lại từ đầu. Chỉ chạy khi giá trị
  // ngoài KHÁC thứ chính mình vừa phát ra, nếu không thì mỗi phím gõ là một
  // vòng dựng lại và con trỏ nhảy về đầu ô.
  useEffect(() => {
    if (value !== daGhep.current) {
      daGhep.current = value;
      datKhoi(taKhoi(value));
    }
  }, [value]);

  const suaKhoi = (id: number, noiDung: string) =>
    capNhat(khoi.map((k) => (k.id === id ? { ...k, noiDung } : k)));

  /** GỘP HAI Ô CHỮ DÍNH NHAU (vá 13/08).
   *  Chèn công thức thì `chotCongThuc` CẮT ô chữ làm đôi (mở sẵn một ô mới sau
   *  công thức để em viết tiếp). Nhưng lúc xoá công thức đi, bản cũ chỉ lọc bỏ
   *  đúng khối công thức — hai ô chữ nằm cạnh nhau ở lại NGUYÊN, nên bài em vỡ
   *  thành hai đoạn vĩnh viễn dù công thức đã biến mất. Chủ dự án bắt tại trận:
   *  "thêm công thức, nó ngắt ra, xong tôi xoá công thức, nó vẫn tách đoạn".
   *  Nối lại bằng xuống dòng — giữ đúng chỗ ngắt em đã tự gõ, không dán dính
   *  hai câu vào nhau. Ô rỗng thì bỏ hẳn, không đẻ ra dòng trắng. */
  const gopChu = (ds: Khoi[]): Khoi[] =>
    ds.reduce<Khoi[]>((ra, k) => {
      const truoc = ra[ra.length - 1];
      if (k.loai === "chu" && truoc?.loai === "chu") {
        const a = truoc.noiDung.replace(/\s+$/, "");
        const b = k.noiDung.replace(/^\s+/, "");
        ra[ra.length - 1] = { ...truoc, noiDung: a && b ? `${a}\n${b}` : a || b };
        return ra;
      }
      ra.push(k);
      return ra;
    }, []);

  const xoaKhoi = (id: number) => {
    const con = gopChu(khoi.filter((k) => k.id !== id));
    capNhat(con.length ? con : [moiKhoi("chu")]);
  };

  const chotCongThuc = (latex: string) => {
    if (dangSua && dangSua > 0) {
      suaKhoi(dangSua, latex);
      datDangSua(null);
      return;
    }
    // Thêm mới: chèn sau khối vừa gõ, và mở sẵn một dòng chữ phía dưới để em
    // viết tiếp — không thì viết xong công thức là cụt đường.
    const i = khoi.findIndex((k) => k.id === oCuoi.current);
    const chen = i >= 0 ? i + 1 : khoi.length;
    const ds = [...khoi];
    ds.splice(chen, 0, moiKhoi("ct", latex));
    if (ds[chen + 1]?.loai !== "chu") ds.splice(chen + 1, 0, moiKhoi("chu"));
    capNhat(ds);
    datDangSua(null);
  };

  return (
    <div className="ble">
      <div className="ble-khoi">
        {khoi.map((k) =>
          k.loai === "chu" ? (
            <textarea
              key={k.id}
              className="ans-input work-input"
              rows={rows}
              placeholder={khoi.indexOf(k) === 0 ? placeholder : "Viết tiếp…"}
              value={k.noiDung}
              disabled={disabled}
              onFocus={() => { oCuoi.current = k.id; }}
              onChange={(e) => {
                suaKhoi(k.id, e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
              }}
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
            />
          ) : (
            /* Công thức ĐÃ VẼ, không phải chuỗi lệnh. Bấm vào là mở lại bảng. */
            <div key={k.id} className="ble-ct">
              <button
                type="button"
                className="ble-ct-mat"
                disabled={disabled}
                title="Bấm để sửa công thức"
                onClick={() => datDangSua(k.id)}
              >
                <MathText>{`$${k.noiDung}$`}</MathText>
                <Pencil className="ble-ct-but" aria-hidden strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="ble-ct-xoa"
                disabled={disabled}
                aria-label="Xoá công thức này"
                onClick={() => xoaKhoi(k.id)}
              >
                <X aria-hidden strokeWidth={2.5} />
              </button>
            </div>
          ),
        )}
      </div>

      <div className="ble-tools">
        <button
          type="button"
          className="btn btn-ghost ble-fx"
          disabled={disabled}
          aria-expanded={dangSua !== null}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => datDangSua((d) => (d === null ? 0 : null))}
        >
          <Sigma aria-hidden strokeWidth={2.25} />
          {dangSua !== null ? "Đóng bảng công thức" : "Chèn công thức"}
        </button>
        <span className="muted ble-tip">
          Bấm vào hình công thức muốn dùng — không cần nhớ cú pháp gì cả.
        </span>
      </div>

      {dangSua !== null && (
        <MathKeypad
          key={dangSua}
          banDau={dangSua > 0 ? (khoi.find((k) => k.id === dangSua)?.noiDung ?? "") : ""}
          onChen={chotCongThuc}
          onDong={() => datDangSua(null)}
        />
      )}
    </div>
  );
}
