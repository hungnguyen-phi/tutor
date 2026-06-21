"use client";

import type { ReactNode } from "react";
import { useAuth, signOut } from "../lib/auth";
import Login from "./Login";

/** Shared chrome for every staff/role page: header + auth gate. */
export default function RoleShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { session } = useAuth();
  if (session === undefined) return <main className="wrap"><p className="muted">Đang tải…</p></main>;
  if (session === null) return <Login />;
  return (
    <>
      <header className="app-header">
        <img src="/logo-vietanh.webp" alt="Việt Anh" />
        <div className="titles"><b>{title}</b>{subtitle && <span>{subtitle}</span>}</div>
        <div className="spacer" />
        <nav className="sb-nav"><a href="/">⌂ Trang chính</a></nav>
        <button className="btn ghost" style={{ marginLeft: 10, padding: "6px 12px" }} onClick={() => signOut()}>Thoát</button>
      </header>
      <main className="wrap" style={{ maxWidth: 920 }}>{children}</main>
    </>
  );
}
