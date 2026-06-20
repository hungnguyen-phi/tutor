"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Đăng nhập thất bại: " + error.message);
    setBusy(false);
  }

  const fill = (em: string) => {
    setEmail(em);
    setPassword("VietAnh@2026");
  };

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="h1">Đăng nhập</h1>
      <p className="sub">AI Tutor — Trường Liên cấp Việt Anh</p>
      <form className="panel" onSubmit={submit}>
        {error && <div className="banner warn">{error}</div>}
        <label className="muted">Email</label>
        <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@vietanh.edu.vn" autoFocus />
        <label className="muted" style={{ marginTop: 10, display: "block" }}>Mật khẩu</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <div className="row">
          <button className="btn" type="submit" disabled={busy || !email || !password}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </div>
      </form>

      <div className="panel">
        <small className="muted">Tài khoản demo (mật khẩu: VietAnh@2026) — bấm để điền nhanh:</small>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => fill("hs1@vietanh.edu.vn")}>👦 Học sinh</button>
          <button className="btn ghost" onClick={() => fill("gv1@vietanh.edu.vn")}>👩‍🏫 Giáo viên</button>
          <button className="btn ghost" onClick={() => fill("ph1@vietanh.edu.vn")}>👨‍👩‍👧 Phụ huynh</button>
        </div>
      </div>
    </main>
  );
}
