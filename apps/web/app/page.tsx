"use client";

/**
 * Cửa chính của app (quyết định chủ dự án): "mới vào app → redirect về login
 * hết luôn; đăng nhập là học sinh thì vào THẲNG /learn".
 * Trang gốc chỉ là bộ điều hướng: chưa đăng nhập → /login; có phiên → về nhà
 * theo vai (roleHome). Trang giới thiệu trường dời về /gioi-thieu.
 */

import { useEffect } from "react";
import { useAuth, roleHome } from "../lib/auth";
import Lion from "../components/Lion";

export default function Home() {
  const { session, profile } = useAuth();

  useEffect(() => {
    if (session === undefined) return; // đang hỏi phiên
    if (session === null) {
      window.location.replace("/login/");
      return;
    }
    if (profile) window.location.replace(roleHome(profile.role));
  }, [session, profile]);

  // Splash tối giản trong tích tắc chờ phiên/vai — không nháy layout
  return (
    <main className="auth" style={{ minHeight: "100dvh", placeContent: "center", display: "grid" }}>
      <Lion mood="idle" size={96} decorative />
    </main>
  );
}
