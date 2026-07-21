"use client";

import type { ReactNode } from "react";
import { Home, LogOut } from "lucide-react";
import { useAuth, signOut } from "../lib/auth";
import RedirectToLogin from "./RedirectToLogin";

/** Khung chung cho mọi màn vai trò: header + cổng đăng nhập. */
export default function RoleShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { session } = useAuth();

  if (session === undefined) {
    return (
      <main className="role-main">
        <div className="skel" style={{ height: 28, width: 240, marginBottom: 16 }} />
        <div className="skel" style={{ height: 120 }} />
      </main>
    );
  }
  if (session === null) return <RedirectToLogin />;

  return (
    <>
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
      <main className="role-main">{children}</main>
    </>
  );
}
