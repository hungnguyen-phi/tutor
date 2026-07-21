"use client";

import { useEffect } from "react";
import { useAuth, roleHome } from "../../lib/auth";
import Login from "../../components/Login";
import Splash from "../../components/Splash";

export default function LoginPage() {
  const { session, profile } = useAuth();
  useEffect(() => {
    if (!session) return;
    // Ưu tiên VAI người dùng vừa chọn ở màn đăng nhập (Login ghi đích vào
    // sessionStorage trước khi signIn). Không có (vào /login khi đã đăng nhập
    // sẵn) → về nhà theo vai thật của profile: học sinh vào THẲNG /learn.
    const stored = sessionStorage.getItem("va-login-dest");
    if (stored) {
      sessionStorage.removeItem("va-login-dest");
      window.location.replace(stored);
      return;
    }
    if (profile) window.location.replace(roleHome(profile.role));
  }, [session, profile]);
  if (session) return <Splash text="Đang vào lớp học…" />;
  return <Login />;
}
