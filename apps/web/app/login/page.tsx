"use client";

import { useEffect } from "react";
import { useAuth } from "../../lib/auth";
import Login from "../../components/Login";

export default function LoginPage() {
  const { session } = useAuth();
  useEffect(() => { if (session) window.location.replace("/app"); }, [session]);
  if (session) return <main className="wrap"><p className="muted">Đang chuyển hướng…</p></main>;
  return <Login />;
}
