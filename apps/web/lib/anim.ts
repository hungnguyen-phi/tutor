"use client";

/**
 * HIỆU ỨNG SỐ — số đếm dần và thanh tiến trình tự chạy tới đích.
 *
 * Chủ dự án 30/07: "845 XP hiện cứng ra đấy thì em không thấy mình vừa được
 * gì cả" — số phải CHẢY từ 0 lên, thanh phải CHẠY tới mức, mới ra cảm giác
 * thành quả. Trước đây chỉ màn hoàn thành buổi học có (XpCount).
 *
 * Nguyên tắc:
 *  · Chỉ chạm transform/opacity + state số — không layout thrash, 60fps.
 *  · Chữ số phải `font-variant-numeric: tabular-nums` (class `num` của hệ) —
 *    không thì bề ngang nhảy loạn trong lúc đếm.
 *  · GIẢM CHUYỂN ĐỘNG: tôn trọng cả `prefers-reduced-motion` của máy VÀ cờ thủ
 *    công `html[data-motion="reduce"]` (máy trường không đổi được cài đặt hệ
 *    điều hành — xem lib/prefs.ts). Khi giảm: hiện thẳng số cuối, không đếm.
 *
 * ⚠️ TUYỆT ĐỐI KHÔNG đọc trạng thái trình duyệt (matchMedia, dataset,
 * localStorage) trong hàm khởi tạo `useState`. Đã trả giá 30/07: `useState(() =>
 * wantsLessMotion() ? value : 0)` làm server dựng "7" mà client hydrate ra "0"
 * → React báo hydration mismatch và vẽ lại cả cây. Trang `/learn` không lộ vì
 * nó nằm sau cổng đăng nhập (prerender chỉ ra <Splash/>), nhưng `/demo` prerender
 * thật nên gãy ngay. LUẬT: khung hình ĐẦU phải tất định và giống server; mọi
 * quyết định phụ thuộc trình duyệt để dành cho layout effect bên dưới.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Effect chạy TRƯỚC KHI TRÌNH DUYỆT VẼ.
 *
 * Vì sao phải là layout effect chứ không phải effect thường: khi người dùng xin
 * ít chuyển động, số phải ĐÃ là số cuối ngay khung hình đầu tiên họ THẤY. Layout
 * effect (kể cả setState bên trong) hoàn tất trước khi vẽ; useEffect thì vẽ số 0
 * một nhịp rồi mới nhảy — đúng cú giật mà họ vừa tắt.
 *
 * ⚠️ Cố tình là alias TRỰC TIẾP, KHÔNG phải mẹo "isomorphic layout effect"
 * (`typeof window !== "undefined" ? useLayoutEffect : useEffect`). Đã trả giá
 * 30/07: React so THỨ TỰ VÀ LOẠI hook giữa lượt prerender và lượt hydrate, nên
 * hook số 3 đi từ `useEffect` (server) sang `useLayoutEffect` (client) là lỗi
 * "change in the order of Hooks" ở cả Hud / LearningPath / LearnAside. Mẹo đó
 * chỉ an toàn cho component KHÔNG BAO GIỜ render trên server — mấy component
 * này thì có (/demo prerender thật). Tên đặt là `usePrePaintEffect` để không ai
 * đọc thấy chữ "Iso" rồi vá ngược về nhánh theo môi trường.
 * (Đã kiểm: React 19 không còn cảnh báo "useLayoutEffect does nothing on the
 * server" — console lượt prerender /demo sạch.)
 */
export const usePrePaintEffect = useLayoutEffect;

/** Người dùng đã xin ít chuyển động chưa (máy HOẶC cờ trong Cài đặt).
 *  CHỈ gọi trong effect / handler — xem cảnh báo ở đầu file. */
export function wantsLessMotion(): boolean {
  if (typeof window === "undefined") return true; // SSR: đừng dựng khung hình
  try {
    if (document.documentElement.dataset.motion === "reduce") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** ease-out-quart — khớp `--ease` của hệ thiết kế. */
const easeOut = (k: number) => 1 - Math.pow(1 - k, 4);

/**
 * Số đếm dần tới `value`.
 *  · Lần đầu: đếm từ `from` (mặc định 0) → cảm giác "nạp vào".
 *  · Sau đó `value` đổi: đếm từ số ĐANG hiện → không giật về 0 rồi leo lại.
 */
export function useCountUp(
  value: number,
  { duration = 900, delay = 0, from = 0 }: { duration?: number; delay?: number; from?: number } = {},
): number {
  // Khởi tạo TẤT ĐỊNH = `from`, giống hệt những gì server dựng ra. Ca "xin ít
  // chuyển động" do layout effect bên dưới chốt số cuối TRƯỚC khi vẽ, nên vẫn
  // không có cú nháy qua 0 — mà cũng không lệch hydrate.
  const [shown, setShown] = useState(from);
  // Số đang hiện, đọc trong rAF mà KHÔNG khai vào deps (deps có shown là đếm
  // lại vô hạn: mỗi frame set state → effect chạy lại → khởi động lại).
  const shownRef = useRef(from);
  shownRef.current = shown;

  usePrePaintEffect(() => {
    if (wantsLessMotion()) {
      setShown(value);
      return;
    }
    const start = shownRef.current;
    if (start === value) return;

    let raf = 0;
    let timer = 0;
    const run = () => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / Math.max(1, duration));
        setShown(Math.round(start + (value - start) * easeOut(k)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (delay > 0) timer = window.setTimeout(run, delay);
    else run();

    // LƯỚI AN TOÀN: rAF KHÔNG chạy khi tab bị ẩn (đã dựng lại được: tab ẩn thì
    // 0 khung hình trong 300ms). Không có lưới này thì mở app ở tab nền = số
    // đứng ở 0 tới khi em bấm sang tab đó. setTimeout tuy bị bóp còn ~1 lần/giây
    // ở tab ẩn nhưng VẪN nổ, nên nó chốt số cuối. Chạy bình thường thì lưới nổ
    // sau khi đếm xong ⇒ setShown(value) là no-op.
    // PHẢI huỷ luôn rAF/timer đang chờ: `start` đã chốt = giá trị cũ, nên nếu
    // lưới chốt số cuối rồi mới tới lượt các khung hình xếp hàng chạy (đúng lúc
    // em bấm về tab), số sẽ TỤT VỀ 0 rồi đếm lại — nhìn như app lỗi.
    const guard = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      setShown(value);
    }, delay + duration + 400);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(guard);
    };
  }, [value, duration, delay]);

  return shown;
}

/**
 * Thanh tiến trình tự CHẠY tới đích: trả 0 ở khung hình đầu rồi nhả `pct` ra —
 * transition `transform` sẵn có trên `.meter > i` lo phần mượt.
 * Dùng cho thanh đứng SẴN trên màn (nhiệm vụ, thăng hạng, % chương).
 * Giảm chuyển động: trả thẳng `pct` ngay từ khung đầu, không có cú trượt nào.
 */
export function useGrow(pct: number, { delay = 180 }: { delay?: number } = {}): number {
  // Tất định = 0 (khớp server). Giảm chuyển động → layout effect đẩy thanh tới
  // mức trước khi vẽ, nên không thấy cú trượt nào.
  const [shown, setShown] = useState(0);
  const armed = useRef(false);

  usePrePaintEffect(() => {
    if (wantsLessMotion()) {
      setShown(pct);
      return;
    }
    // Đã chạy xong lần đầu → mọi thay đổi sau đó đi thẳng (transition vẫn mượt).
    if (armed.current) {
      setShown(pct);
      return;
    }
    const timer = window.setTimeout(() => {
      armed.current = true;
      setShown(pct);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pct, delay]);

  return shown;
}

/**
 * Cờ "vừa TĂNG" — bật `ms` rồi tự tắt, để CSS nhấp một nhịp (icon nảy, quầng
 * sáng loé). Chỉ bật khi số TĂNG: XP tụt (đồng bộ lại từ server) không đáng ăn
 * mừng. Trả thêm `gain` để hiện chip "+15".
 */
export function useGain(value: number, ms = 1200): { hot: boolean; gain: number } {
  const prev = useRef(value);
  const [state, setState] = useState({ hot: false, gain: 0 });

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (value <= before) {
      // PHẢI tắt cờ ở đây, không được `return` trơn. React chạy cleanup của lần
      // trước TRƯỚC khi chạy effect này, tức cái timer tắt-cờ đã bị dọn. Bỏ
      // trống nhánh này thì ca "XP loé +20 rồi đồng bộ lại tụt còn 118 trong
      // vòng 1,2s" sẽ để chip sáng và chữ '+20' đứng vĩnh viễn trên màn.
      // Cập nhật theo hàm + trả về CHÍNH object cũ khi đang không loé → React
      // bỏ qua, không đẻ vòng render vô hạn.
      setState((s) => (s.hot ? { hot: false, gain: 0 } : s));
      return;
    }
    setState({ hot: true, gain: value - before });
    const timer = window.setTimeout(() => setState({ hot: false, gain: 0 }), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);

  return state;
}
