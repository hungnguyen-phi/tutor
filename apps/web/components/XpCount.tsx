"use client";

import { useCountUp } from "../lib/anim";

/**
 * Số XP đếm tăng ở màn hoàn thành.
 * Đếm bằng rAF trên state số (chữ tabular-nums nên không nhảy bề ngang).
 * prefers-reduced-motion: hiện thẳng giá trị cuối, không đếm (lo trong useCountUp).
 */
export default function XpCount({ value, duration = 900 }: { value: number; duration?: number }) {
  const shown = useCountUp(value, { duration });
  return <>+{shown} XP</>;
}
