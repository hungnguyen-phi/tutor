"use client";

import { useAuth, signOut } from "../lib/auth";
import Login from "./Login";

interface Tile { href: string; icon: string; label: string; desc: string; show: boolean }

export default function RoleHub() {
  const { session, profile, roles, isBuddy } = useAuth();
  if (session === undefined) return <main className="wrap"><p className="muted">Đang tải…</p></main>;
  if (session === null) return <Login />;

  const r = new Set(roles);
  const admin = r.has("admin");
  const firstName = (profile?.full_name ?? "bạn").trim().split(/\s+/).pop();

  const tiles: Tile[] = [
    { href: "/learn", icon: "📚", label: "Vào học", desc: "Phiên học Socratic với Tutor", show: admin || r.has("student") },
    { href: "/scoreboard", icon: "🎯", label: "Bảng điểm tuần", desc: "WIG · lead measures · 4DX", show: admin || r.has("student") },
    { href: "/buddy", icon: "🤝", label: "Buddy", desc: "Đồng hành cùng bạn học", show: admin || isBuddy },
    { href: "/coach", icon: "🧑‍🏫", label: "Coach (GVCN)", desc: "Coachee · buổi họp 4 tuần", show: admin || r.has("teacher") || r.has("homeroom_teacher") },
    { href: "/subject-lead", icon: "📊", label: "Tổ trưởng chuyên môn", desc: "Chất lượng môn · duyệt nội dung", show: admin || r.has("subject_lead") },
    { href: "/counselor", icon: "🧑‍⚕️", label: "Cố vấn tâm lý", desc: "Hàng đợi an toàn", show: admin || r.has("counselor") },
    { href: "/leadership", icon: "🎓", label: "Ban giám hiệu", desc: "Dashboard tổng hợp", show: admin || r.has("leadership") },
    { href: "/dpo", icon: "🔒", label: "Bảo vệ dữ liệu (DPO)", desc: "Consent · DSAR · audit", show: admin || r.has("dpo") },
    { href: "/admin", icon: "🛠️", label: "Admin hệ thống", desc: "RBAC · gateway · vận hành", show: admin },
    { href: "/parent", icon: "👨‍👩‍👧", label: "Theo dõi con", desc: "Báo cáo đã lọc", show: r.has("parent") },
  ];
  const shown = tiles.filter((t) => t.show);

  return (
    <>
      <header className="app-header">
        <img src="/logo-vietanh.webp" alt="Việt Anh" />
        <div className="titles"><b>AI Tutor</b><span>Trường Liên cấp Việt Anh</span></div>
        <div className="spacer" />
        <button className="btn ghost" style={{ padding: "6px 12px" }} onClick={() => signOut()}>Thoát</button>
      </header>
      <main className="wrap">
        <div className="sb-mascot">
          <img src="/brand/lion-head.png" alt="Sư tử Việt Anh" onError={(e) => ((e.currentTarget.style.display = "none"))} />
          <div className="say">Xin chào {firstName}! Chọn nơi anh/chị muốn vào.</div>
        </div>
        <div className="subjects" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {shown.map((t) => (
            <a key={t.href} className="subject-card" href={t.href}>
              <span className="emoji">{t.icon}</span>
              <b>{t.label}</b>
              <small>{t.desc}</small>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
