"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import * as Prefs from "../lib/prefs";

/**
 * Nút SÁNG/TỐI nổi ở góc TRÊN–PHẢI mọi trang (mount ở layout) — ai cũng thấy,
 * bấm một phát là đảo. Cài đặt vẫn giữ tuỳ chọn đầy đủ (kèm "theo máy"); nút này
 * là lối tắt nhanh: chỉ đảo sáng ↔ tối.
 *
 * Trạng thái khởi tạo đọc THẲNG data-theme mà script bootstrap (layout.tsx) đã
 * gắn TRƯỚC khi vẽ → icon đúng ngay từ frame đầu ở client, không nháy. Server
 * (static export) không có document nên mặc định 'light' → suppressHydrationWarning.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => effectiveDark());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    setDark(effectiveDark());
    // Đang để "theo máy" mà hệ đổi sáng/tối → cập nhật icon theo.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => {
      if (Prefs.getTheme() === "system") setDark(mq.matches);
    };
    mq.addEventListener?.("change", onSys);
    return () => mq.removeEventListener?.("change", onSys);
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    Prefs.setTheme(next); // áp ngay lên <html>
    setDark(!dark);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      suppressHydrationWarning
      aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={dark ? "Giao diện sáng" : "Giao diện tối"}
      data-ready={ready || undefined}
    >
      {dark ? <Sun aria-hidden strokeWidth={2.25} /> : <Moon aria-hidden strokeWidth={2.25} />}
    </button>
  );
}

/** Giao diện đang hiển thị có phải TỐI không (đọc data-theme đã áp, hoặc theo máy). */
function effectiveDark(): boolean {
  if (typeof document === "undefined") return false;
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}
