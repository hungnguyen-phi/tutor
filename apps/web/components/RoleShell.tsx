"use client";

import type { ReactNode } from "react";
import { Home, LogOut, ShieldAlert } from "lucide-react";
import { useAuth, signOut, roleHome, isAllowed } from "../lib/auth";
import RedirectToLogin from "./RedirectToLogin";

/**
 * Khung chung cho mọi màn vai trò: header + cổng đăng nhập + CỔNG PHÂN QUYỀN.
 *
 * `allow` = danh sách role_key được vào khu vực này (admin luôn được).
 * `allowBuddy` = cho phép cả người đang là buddy (quan hệ coaching_links, không
 * phải role_key). Không truyền `allow` = mọi tài khoản đã đăng nhập.
 *
 * Phòng-thủ-chiều-sâu: server (edge functions + RLS) đã chặn DỮ LIỆU sai vai;
 * cổng này chặn UI — học sinh gõ thẳng /admin không còn thấy console admin.
 */
export default function RoleShell({
  title,
  subtitle,
  allow,
  allowBuddy,
  children,
}: {
  title: string;
  subtitle?: string;
  allow?: string[];
  allowBuddy?: boolean;
  children: ReactNode;
}) {
  const { session, profile, roles, isBuddy, ready } = useAuth();

  // Đợi biết CHẮC session + vai trước khi phán quyền (tránh nháy "không có quyền").
  if (session === undefined || (session && !ready)) {
    return (
      <main className="role-main">
        <div className="skel" style={{ height: 28, width: 240, marginBottom: 16 }} />
        <div className="skel" style={{ height: 120 }} />
      </main>
    );
  }
  if (session === null) return <RedirectToLogin />;

  const Header = (
    <header className="role-head">
      <div className="role-head-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-vietanh.webp" alt="" height={34} />
        <div className="role-titles">
          <b>{title}</b>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <a className="btn btn-quiet role-home" href="/app">
          <Home aria-hidden strokeWidth={2} />
          Trang chính
        </a>
        <button
          className="btn btn-quiet"
          onClick={() => signOut().then(() => (window.location.href = "/"))}
        >
          <LogOut aria-hidden strokeWidth={2} />
          Thoát
        </button>
      </div>
    </header>
  );

  const authorized = isAllowed(roles, allow) || (!!allowBuddy && isBuddy);
  if (!authorized) {
    return (
      <>
        {Header}
        <main className="role-main">
          <div className="access-denied">
            <ShieldAlert aria-hidden strokeWidth={2} />
            <h1>Khu vực này không dành cho tài khoản của bạn</h1>
            <p>
              Bạn đang đăng nhập với vai <b>{profile?.role ?? "chưa rõ"}</b>. Trang{" "}
              <b>{title}</b> cần quyền khác. Nếu đây là nhầm lẫn, hãy báo quản trị viên.
            </p>
            <a className="btn" href={roleHome(profile?.role)}>
              Về trang của bạn
            </a>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {Header}
      <main className="role-main">{children}</main>
    </>
  );
}
