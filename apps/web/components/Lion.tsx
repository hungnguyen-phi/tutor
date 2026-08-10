"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Sư tử — linh vật CHÍNH CHỦ, bản BỘ CẢM XÚC ĐỘNG có chiều sâu.
 * Drop-in thay thế components/Lion.tsx (giữ nguyên toàn bộ API cũ).
 *
 * Hai tầng chuyển động như bản gốc, giờ dày hơn:
 *  1. HOÁN FRAME:
 *     - JS (file này): chớp mắt ngẫu nhiên 3–6s, khẩu hình khi `talking`.
 *     - CSS (lion-motion.css): mỗi mood có lớp overlay frame riêng — lông mày
 *       (sad→confused), khẩu hình (smile→laugh, sleep→content), tay chân
 *       (wave→celebrate), và XOAY NGƯỜI 4 GÓC như 3D (rebel, proud:
 *       turn-front → turn-34 → turn-side → turn-back).
 *  2. CHOREOGRAPHY CSS: nảy, lắc, squash & stretch, hiệu ứng vector
 *     (tim tan vỡ, tia vàng, Zzz, giọt lệ, ?!, khói hứ).
 *
 * One-shot: trophy (+ success nhẹ) bùng 1 lần rồi về nhịp thở — phát lại
 * bằng remount: <Lion key={attempt} mood="trophy" />.
 * Tất cả tắt theo prefers-reduced-motion.
 */

/**
 * ⛔ `sad` và `miss` CÒN TRONG DANH MỤC NHƯNG KHÔNG ĐƯỢC DÙNG TRONG APP HỌC SINH
 * (chủ dự án chốt 10/08: "buồn là không được").
 *
 * `miss` = head-sad + trái tim TAN VỠ, từng dùng ở hero lộ trình khi em nghỉ
 * mấy hôm. Đó là dỗi — bắt em thấy có lỗi vì đã vắng, trái thẳng với bối cảnh
 * sư phạm bất biến (không bao giờ trừng phạt; vắng/sai là dữ liệu, không phải
 * thất bại). Vắng lâu thì MỪNG em quay lại.
 *
 * Giữ lại trong danh mục vì art vẫn nằm trong bộ sprite chính chủ và bảng này
 * là bản kiểm kê của bộ đó — nhưng đừng cắm vào màn nào của học sinh.
 */
export type LionMood =
  // 4 mood gốc — mọi call-site cũ giữ nguyên nghĩa
  | "idle" | "thinking" | "cheer" | "sleepy"
  // mood theo ngữ cảnh app (đợt trước)
  | "greet" | "study" | "idea" | "success" | "confused" | "sad"
  | "notify" | "reminder" | "support" | "trophy"
  | "point" | "read" | "run" | "laptop"
  // MỚI — bộ cảm xúc động
  | "happy" | "excited" | "diligent" | "focus" | "think"
  | "surprised" | "proud" | "miss" | "chaos" | "rebel";

/** @deprecated Các phương án A/B đã chốt (miss=B, chaos=A, rebel=bản xoay 4 frame). Prop giữ lại cho tương thích, hiện không đổi hành vi. */
export type LionFlavor = "a" | "b";

/** Kích thước thật của từng sprite — giữ tỉ lệ, không giật layout. */
const SPRITE: Record<string, { w: number; h: number }> = {
  "head-smile": { w: 289, h: 311 },
  "head-laugh": { w: 294, h: 313 },
  "head-wink": { w: 289, h: 310 },
  "head-surprised": { w: 287, h: 309 },
  "head-curious": { w: 284, h: 310 },
  "head-think": { w: 280, h: 311 },
  "head-sleep": { w: 294, h: 309 },
  "head-sad": { w: 287, h: 308 },
  "head-talk": { w: 288, h: 312 },
  "head-content": { w: 289, h: 314 },
  "head-confused": { w: 300, h: 312 },
  "pose-wave": { w: 297, h: 413 },
  "pose-thumbsup": { w: 260, h: 412 },
  "pose-point": { w: 331, h: 409 },
  "pose-read": { w: 294, h: 408 },
  "pose-celebrate": { w: 318, h: 411 },
  "pose-run": { w: 343, h: 376 },
  "pose-ponder": { w: 323, h: 411 },
  "pose-laptop": { w: 288, h: 374 },
  "scene-study": { w: 324, h: 270 },
  "scene-achievement": { w: 360, h: 278 },
  "scene-reminder": { w: 336, h: 313 },
  "scene-support": { w: 300, h: 313 },
  "scene-success": { w: 310, h: 313 },
  "scene-notification": { w: 312, h: 279 },
  "scene-idea": { w: 299, h: 279 },
  "scene-celebration": { w: 334, h: 279 },
  // 4 sprite mới — cắt từ sheet turnaround (xem assets-src/mascot/slice.mjs)
  "turn-front": { w: 275, h: 435 },
  "turn-34": { w: 272, h: 435 },
  "turn-side": { w: 280, h: 426 },
  "turn-back": { w: 279, h: 426 },
};

type Overlay = { name: string; cls: string };
type MoodCfg = {
  base: string;
  blink?: string;
  full?: string;
  alt: string;
  /** Frame chồng lên base — CSS trong lion-motion.css đảo opacity theo chu kỳ.
   *  Mood nào base cũng có keyframe ẩn riêng (.lion-<mood> .lion-base). */
  overlays?: Overlay[];
};

/** Mood → sprite + các frame overlay. */
const MOOD: Record<string, MoodCfg> = {
  idle: { base: "head-smile", blink: "head-content", full: "pose-wave", alt: "Sư tử Việt Anh" },
  thinking: { base: "head-think", full: "pose-ponder", alt: "Sư tử đang nghĩ cùng em" },
  cheer: { base: "pose-celebrate", alt: "Sư tử chúc mừng" },
  sleepy: {
    base: "head-sleep",
    alt: "Sư tử đang ngủ",
    overlays: [{ name: "head-content", cls: "lion-f-breath" }], // miệng khép mở theo hơi thở
  },
  greet: {
    base: "pose-wave",
    alt: "Sư tử vẫy chào",
    overlays: [{ name: "pose-celebrate", cls: "lion-f-arm" }], // vẫy 1 tay ↔ vung 2 tay
  },
  study: { base: "scene-study", alt: "Sư tử đang đọc sách" },
  idea: { base: "scene-idea", alt: "Sư tử nảy ra ý tưởng" },
  success: { base: "scene-success", alt: "Sư tử khen đúng rồi" },
  confused: { base: "head-confused", alt: "Sư tử bối rối" },
  sad: {
    base: "head-sad",
    alt: "Sư tử buồn",
    overlays: [
      { name: "head-confused", cls: "lion-f-quiver" }, // lông mày nhíu run
      { name: "head-sleep", cls: "lion-f-blink2" }, // chớp mắt chậm
    ],
  },
  notify: { base: "scene-notification", alt: "Sư tử rung chuông nhắc bạn" },
  reminder: { base: "scene-reminder", alt: "Sư tử nhắc lịch" },
  support: { base: "scene-support", alt: "Sư tử hỗ trợ" },
  trophy: { base: "scene-achievement", alt: "Sư tử nâng cúp" },
  point: { base: "pose-point", alt: "Sư tử chỉ hướng" },
  read: { base: "pose-read", alt: "Sư tử đọc sách" },
  run: { base: "pose-run", alt: "Sư tử chạy" },
  laptop: { base: "pose-laptop", alt: "Sư tử gõ máy tính" },
  // ── MỚI ──
  happy: {
    base: "head-smile",
    blink: "head-content",
    full: "pose-wave",
    alt: "Sư tử vui vẻ",
    overlays: [{ name: "head-laugh", cls: "lion-f-mouth" }], // thi thoảng cười toe
  },
  excited: {
    base: "head-laugh",
    full: "pose-celebrate",
    alt: "Sư tử thích thú",
    overlays: [{ name: "head-surprised", cls: "lion-f-alt" }], // cười lớn ↔ mắt tròn "ồ!"
  },
  diligent: { base: "pose-laptop", alt: "Sư tử chăm chỉ luyện bài" },
  focus: { base: "scene-study", alt: "Sư tử tập trung học" },
  think: {
    base: "head-think",
    full: "pose-ponder",
    alt: "Sư tử đang nghĩ",
    overlays: [{ name: "head-curious", cls: "lion-f-up" }], // buông cằm ngước lên "à?"
  },
  surprised: {
    base: "head-surprised",
    alt: "Sư tử bất ngờ",
    overlays: [{ name: "head-smile", cls: "lion-f-pre" }], // mặt thường trước cú giật
  },
  proud: {
    base: "turn-front",
    alt: "Sư tử tự tin",
    overlays: [{ name: "turn-34", cls: "lion-f-pose" }], // xoay dáng ¾ như chụp hình
  },
  miss: {
    base: "head-sad",
    alt: "Sư tử nhớ em",
    overlays: [{ name: "head-curious", cls: "lion-f-hope" }], // ngóng chờ → buồn khi tim vỡ
  },
  chaos: {
    base: "head-confused",
    alt: "Sư tử rối trí",
    overlays: [{ name: "head-surprised", cls: "lion-f-panic" }], // bật sang hoảng hốt
  },
  rebel: {
    base: "turn-front",
    alt: "Sư tử dỗi — mình hỏi, bạn nghĩ",
    overlays: [
      { name: "turn-34", cls: "lion-t-34" }, // xoay người 4 frame như 3D
      { name: "turn-side", cls: "lion-t-side" },
      { name: "turn-back", cls: "lion-t-back" },
    ],
  },
};

/* Khẩu hình khi nói: mở ↔ khép. Chỉ dùng cho mood dạng đầu. */
const TALK_OPEN = "head-talk";
const TALK_CLOSED = "head-smile";

/**
 * Đường dẫn sprite. WEBP, không phải PNG (đo 30/07 trên production): cả bộ 35
 * sprite là 4.495 KB dạng PNG, sang WebP q95 còn 672 KB — giảm 85%. Riêng trang
 * đăng nhập, `pose-wave` từ 157 KB xuống 24 KB, tức một mình nó cắt 23% tổng
 * payload của trang.
 *
 * Đã đo chất lượng chứ không tin lời quảng cáo: vùng NHÌN THẤY ĐƯỢC lệch trung
 * bình 0,9%/255, và kênh ALPHA lệch 0 TUYỆT ĐỐI — nền trong suốt nguyên vẹn,
 * không sinh quầng viền (đúng thứ slice.mjs đã khổ công un-blend).
 *
 * File .png vẫn nằm nguyên trong `public/brand/lion/` làm nguồn + đường lui:
 * đổi hằng số này về "png" là quay lại được ngay, không cần build lại ảnh.
 * Xuất lại: `node assets-src/mascot/webp.mjs`.
 */
const DUOI = "webp";
const src = (name: string) => `/brand/lion/${name}.${DUOI}`;

/* ── Hiệu ứng vector quanh mascot — vị trí inline, chuyển động ở CSS ── */
const pos = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });

function renderFx(mood: LionMood): ReactNode {
  switch (mood) {
    case "greet":
      return (
        <>
          <i aria-hidden className="fx fx-spark" style={pos({ top: "4%", right: "-12%", width: 13, height: 13 })} />
          <i aria-hidden className="fx fx-spark fx-d2" style={pos({ top: "16%", right: "-22%", width: 9, height: 9 })} />
        </>
      );
    case "excited":
      return (
        <>
          <i aria-hidden className="fx fx-spark" style={pos({ top: "-4%", left: "-14%", width: 14, height: 14 })} />
          <i aria-hidden className="fx fx-spark fx-d2" style={pos({ top: "8%", right: "-16%", width: 11, height: 11 })} />
          <i aria-hidden className="fx fx-spark fx-d3 fx-mane" style={pos({ top: "-12%", right: "6%", width: 9, height: 9 })} />
        </>
      );
    case "trophy":
      return (
        <>
          <i aria-hidden className="fx fx-rays" />
          <i aria-hidden className="fx fx-spark fx-once" style={pos({ top: "-6%", left: "-6%", width: 15, height: 15 })} />
          <i aria-hidden className="fx fx-spark fx-once fx-d2" style={pos({ top: "2%", right: "-8%", width: 12, height: 12 })} />
          <i aria-hidden className="fx fx-spark fx-once fx-d3 fx-mane" style={pos({ top: "34%", left: "-12%", width: 10, height: 10 })} />
        </>
      );
    case "diligent":
      return (
        <>
          <i aria-hidden className="fx fx-sweat" style={pos({ top: "8%", left: "8%" })} />
          <i aria-hidden className="fx fx-key" style={pos({ bottom: "26%", left: "-10%" })} />
          <i aria-hidden className="fx fx-key fx-d2" style={pos({ bottom: "32%", right: "-8%" })} />
        </>
      );
    case "focus":
      return <i aria-hidden className="fx fx-aura" />;
    case "think":
      return (
        <span aria-hidden className="fx fx-bubble" style={pos({ top: "-18%", right: "-24%" })}>
          <i className="fx-dot" />
          <i className="fx-dot fx-d2" />
          <i className="fx-dot fx-d3" />
        </span>
      );
    case "surprised":
      return <b aria-hidden className="fx fx-bang" style={pos({ top: "-16%", right: "-8%" })}>!</b>;
    case "proud":
      return <i aria-hidden className="fx fx-star" style={pos({ top: "-4%", left: "-18%", width: 16, height: 16 })} />;
    case "sleepy":
      return (
        <>
          <b aria-hidden className="fx fx-zzz" style={pos({ top: "-4%", right: "-8%", fontSize: 15 })}>Z</b>
          <b aria-hidden className="fx fx-zzz fx-d2" style={pos({ top: "-1%", right: "-15%", fontSize: 20 })}>Z</b>
          <b aria-hidden className="fx fx-zzz fx-d3" style={pos({ top: "3%", right: "-23%", fontSize: 26 })}>Z</b>
        </>
      );
    case "sad":
      return <i aria-hidden className="fx fx-tear" style={pos({ top: "46%", left: "22%" })} />;
    case "miss":
      // Trái tim tan vỡ dần: đập chậm dần → nứt đôi → rơi lịm → nhớ lại từ đầu
      return (
        <span aria-hidden className="fx fx-heartbreak" style={pos({ top: "-17%", left: "50%", marginLeft: -10 })}>
          <i className="fx-hb-l" />
          <i className="fx-hb-r" />
        </span>
      );
    case "chaos":
      return (
        <span aria-hidden className="fx fx-orbit" style={pos({ top: "-14%", left: "50%" })}>
          <b className="fx-q">?</b>
          <b className="fx-x">!</b>
          <b className="fx-q2">?</b>
        </span>
      );
    case "rebel":
      return (
        <>
          <i aria-hidden className="fx fx-puff75" style={pos({ top: "2%", right: "-10%", width: 12, height: 12 })} />
          <i aria-hidden className="fx fx-puff75 fx-pd2" style={pos({ top: "6%", left: "-14%", width: 9, height: 9 })} />
          <i aria-hidden className="fx fx-puff75 fx-pd3" style={pos({ top: "0%", right: "-18%", width: 9, height: 9 })} />
        </>
      );
    default:
      return null;
  }
}

export default function Lion({
  mood = "idle",
  size = 96,
  className,
  decorative = false,
  follow = false,
  variant = "auto",
  talking = false,
  eager = false,
}: {
  mood?: LionMood;
  /** Chiều rộng px; chiều cao suy theo tỉ lệ thật của sprite. */
  size?: number;
  className?: string;
  /** Đặt true khi bên cạnh đã có chữ nói đúng điều đó — tránh đọc trùng. */
  decorative?: boolean;
  /** Cả tấm ảnh dõi theo con trỏ rất nhẹ (màn đăng nhập). Tắt khi reduced-motion. */
  follow?: boolean;
  /** Sprite trên màn đầu (path-lion, hero login, finish) — tải ngay, không lazy. */
  eager?: boolean;
  /** `auto`: theo mood. `full`: ép bản toàn thân nếu mood có. `head`: ép chân dung. */
  variant?: "auto" | "head" | "full";
  /** Đảo khẩu hình khi sư tử đang "nói" (bong bóng thoại vừa hiện). */
  talking?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [blinking, setBlinking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // ── Dõi theo con trỏ ──────────────────────────────────────────────────
  // RẺ TRÊN MÁY YẾU (fix bug nền giật theo chuột trên máy không tăng tốc GPU):
  //  • KHÔNG getBoundingClientRect mỗi lần chuột nhích (ép layout liên tục) —
  //    tâm sư tử đo MỘT lần rồi cache, chỉ đo lại khi resize/cuộn.
  //  • Vùng chết 0.25px: giá trị gần như cũ thì thôi, không retarget transition
  //    120ms mỗi frame (chính cú retarget liên tục là thứ làm nền phía sau
  //    repaint không ngớt trên máy vẽ bằng CPU).
  useEffect(() => {
    if (!follow) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let cx = 0, cy = 0, hasCenter = false;
    let lastX = 0, lastY = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height * 0.38;
      hasCenter = true;
    };
    const invalidate = () => { hasCenter = false; };

    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!hasCenter) measure();
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(3, d / 60);
        const nx = (dx / d) * k;
        const ny = (dy / d) * k;
        if (Math.abs(nx - lastX) < 0.25 && Math.abs(ny - lastY) < 0.25) return;
        lastX = nx;
        lastY = ny;
        el.style.setProperty("--lion-lx", `${nx.toFixed(2)}px`);
        el.style.setProperty("--lion-ly", `${ny.toFixed(2)}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", invalidate);
    window.addEventListener("scroll", invalidate, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("scroll", invalidate, { capture: true } as EventListenerOptions);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [follow]);

  const cfg = MOOD[mood] ?? MOOD.idle!;
  const base =
    variant === "full" && cfg.full ? cfg.full :
    variant === "head" ? (cfg.base.startsWith("head-") ? cfg.base : "head-smile") :
    cfg.base;
  const isHead = base.startsWith("head-");
  const isBaseFrame = base === cfg.base;
  const blinkSrc = !talking && isBaseFrame ? cfg.blink : undefined;
  // Overlay chỉ áp khi đang ở frame cơ bản và không "nói" (nói tự hoán khẩu hình)
  const overlays = !talking && isBaseFrame ? cfg.overlays ?? [] : [];

  // ── Chớp mắt: 140ms mỗi 3–6s, lệch pha ngẫu nhiên ─────────────────────
  useEffect(() => {
    if (reduced || !blinkSrc) return;
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = () => {
      t1 = setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        t2 = setTimeout(() => {
          if (!alive) return;
          setBlinking(false);
          loop();
        }, 140);
      }, 3000 + Math.random() * 3000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      setBlinking(false);
    };
  }, [blinkSrc, reduced]);

  // ── Nói: đảo hai khẩu hình khi `talking` (chỉ mood dạng đầu) ──────────
  useEffect(() => {
    if (reduced || !talking || !isHead) return;
    const id = setInterval(() => setMouthOpen((o) => !o), 180);
    return () => {
      clearInterval(id);
      setMouthOpen(true);
    };
  }, [talking, isHead, reduced]);

  const shown = talking && isHead ? (mouthOpen ? TALK_OPEN : TALK_CLOSED) : base;
  const dim = SPRITE[shown] ?? SPRITE["head-smile"]!;
  const h = Math.round((size * dim.h) / dim.w);
  const blinkDim = blinkSrc ? SPRITE[blinkSrc]! : null;

  return (
    <span
      ref={ref}
      className={["lion", `lion-${mood}`, className].filter(Boolean).join(" ")}
      data-sprite={base}
      data-follow={follow || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : cfg.alt}
    >
      <img
        src={src(shown)}
        width={size}
        height={h}
        alt=""
        draggable={false}
        className="lion-base"
        loading={eager ? undefined : "lazy"}
        decoding="async"
        style={blinking ? { opacity: 0 } : undefined}
      />
      {/* Frame chớp mắt nằm chồng, chỉ hoán opacity — không decode lại ảnh */}
      {blinkSrc && blinkDim && (
        <img
          src={src(blinkSrc)}
          width={size}
          height={Math.round((size * blinkDim.h) / blinkDim.w)}
          alt=""
          aria-hidden
          draggable={false}
          className="lion-blink"
          loading="lazy"
          decoding="async"
          style={{ position: "absolute", left: 0, top: 0, opacity: blinking ? 1 : 0 }}
        />
      )}
      {/* Frame overlay theo mood: mày/miệng/tay/góc xoay — CSS đảo opacity.
          Neo đáy-giữa, bề rộng theo tỉ lệ sprite thật nên khớp mọi size. */}
      {overlays.map((o) => {
        const od = SPRITE[o.name]!;
        const ow = (size * od.w) / dim.w;
        return (
          <img
            key={o.name}
            src={src(o.name)}
            alt=""
            aria-hidden
            draggable={false}
            className={`lion-frame ${o.cls}`}
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: Math.round(ow),
              /* height thật (không "auto") — đủ bộ width/height chống CLS */
              height: Math.round((ow * od.h) / od.w),
              opacity: 0,
            }}
          />
        );
      })}
      {renderFx(mood)}
    </span>
  );
}
