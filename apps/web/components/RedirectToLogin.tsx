"use client";

import { useEffect } from "react";

/**
 * Chưa đăng nhập → về CỬA DUY NHẤT /login (quyết định chủ dự án: "mới vào
 * app, redirect về trang login hết luôn" — đổi URL thật, không render form
 * tại chỗ). Dùng `replace` để nút Back không kẹt vào trang bị chặn.
 */
export default function RedirectToLogin() {
  useEffect(() => {
    window.location.replace("/login/");
  }, []);
  return null;
}
