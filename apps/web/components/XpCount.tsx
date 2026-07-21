"use client";

import { useEffect, useState } from "react";

/**
 * Số XP đếm tăng ở màn hoàn thành — nơi DUY NHẤT được phép có choreography.
 * Đếm bằng rAF trên state số (chữ tabular-nums nên không nhảy bề ngang).
 * prefers-reduced-motion: hiện thẳng giá trị cuối, không đếm.
 */
export default function XpCount({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      // ease-out-quart — khớp --ease của hệ thống
      setShown(Math.round(value * (1 - Math.pow(1 - k, 4))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>+{shown} XP</>;
}
