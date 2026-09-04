"use client";

import { useCountUp } from "../lib/anim";

/**
 * Con số ĐẾM lên (04/09 — đợt "một thế giới"). Dùng cho mọi chỉ số đứng sẵn
 * trên các tab Ôn tập / Hạng / Mục tiêu / Tôi: số phải CHẢY từ 0 lên khi mở
 * tab, không hiện cứng (gu chủ dự án: "app tĩnh = không đáng học").
 * Giảm chuyển động → hiện thẳng số cuối (useCountUp lo).
 */
export default function Num({
  value,
  className = "num",
  duration = 900,
  delay = 0,
  suffix = "",
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
  /** Đuôi nối liền (VD "%") — không nằm trong phần đếm. */
  suffix?: string;
}) {
  const shown = useCountUp(value, { duration, delay });
  // Math.round(-0.3) = -0 → toLocaleString in "-0" khi đếm XUỐNG về 0 (thấy
  // khi giá trị đổi 7→0). -0 === 0 nên gán lại 0 là hết.
  const sach = shown === 0 ? 0 : shown;
  return (
    <b className={className}>
      {sach.toLocaleString("vi-VN")}
      {suffix}
    </b>
  );
}
