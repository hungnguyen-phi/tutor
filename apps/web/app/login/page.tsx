"use client";

import { useEffect, useState } from "react";
import { useAuth, roleHome } from "../../lib/auth";
import { isSchoolEmail, SCHOOL_EMAIL_DOMAINS } from "../../lib/config";
import { supabase } from "../../lib/supabase";
import Login from "../../components/Login";
import Splash from "../../components/Splash";

export default function LoginPage() {
  const { session, profile, ready } = useAuth();
  // Lời từ chối khi tài khoản Google KHÔNG thuộc miền trường (SSO, 04/09) —
  // giữ ở đây (không phải trong <Login/>) vì trang này ẩn <Login/> ngay khi có
  // session, useEffect trong đó không kịp chạy.
  const [tuChoi, setTuChoi] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const em = session.user.email ?? "";
    // NGOÀI MIỀN TRƯỜNG: trigger DB không dựng hồ sơ → `profile` sẽ null mãi và
    // trang này treo ở Splash "Đang vào lớp học…" vô thời hạn. Nói thẳng, đăng
    // xuất, cho chọn lại. Không lộ gì: chỉ email của chính phiên vừa tạo.
    if (em && !isSchoolEmail(em)) {
      void supabase.auth.signOut().then(() => {
        setTuChoi(
          `Tài khoản ${em} không phải của trường. Bạn đăng nhập lại bằng email ${SCHOOL_EMAIL_DOMAINS.map((d) => `@${d}`).join(" hoặc ")} nhé.`,
        );
      });
      return;
    }
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

  // Email ĐÚNG miền nhưng vẫn không có hồ sơ (trigger hỏng / tenant chưa có) —
  // đừng treo Splash: nói rõ để báo quản trị, không phải "app hỏng".
  const dungMienMaThieuHoSo = !!session && ready && !profile && isSchoolEmail(session.user.email);

  if (session && !dungMienMaThieuHoSo) return <Splash text="Đang vào lớp học…" />;
  return <Login loiNgoai={tuChoi ?? (dungMienMaThieuHoSo ? "Tài khoản của bạn chưa được nhà trường cấp hồ sơ. Bạn báo thầy cô hoặc quản trị viên giúp nhé." : null)} />;
}
