"use client";

import {
  BookOpen,
  Target,
  Handshake,
  Presentation,
  BarChart3,
  HeartHandshake,
  GraduationCap,
  ShieldCheck,
  Settings,
  Users,
  ChevronRight,
} from "lucide-react";
import { useAuth, signOut } from "../lib/auth";
import RedirectToLogin from "./RedirectToLogin";
import Lion from "./Lion";

interface Tile {
  href: string;
  Icon: typeof BookOpen;
  label: string;
  desc: string;
  show: boolean;
  /** Họ màu của viên icon (data-hue trong globals.css): học sinh=navy (mặc
   *  định), giáo viên=sky, coach/buddy=ok (cỏ), phụ huynh & cố vấn=mane,
   *  khối quản trị=muted — mỗi vai một họ để hub không xám mồ côi. */
  hue?: "sky" | "ok" | "mane" | "muted";
}

export default function RoleHub() {
  const { session, profile, roles, isBuddy } = useAuth();

  if (session === undefined) {
    return (
      <main className="hub">
        <div className="skel" style={{ height: 96 }} />
      </main>
    );
  }
  if (session === null) return <RedirectToLogin />;

  const r = new Set(roles);
  const admin = r.has("admin");
  const firstName = (profile?.full_name ?? "bạn").trim().split(/\s+/).pop();

  const tiles: Tile[] = [
    { href: "/learn", Icon: BookOpen, label: "Vào học", desc: "Phiên học Socratic với Tutor", show: admin || r.has("student") },
    { href: "/scoreboard", Icon: Target, label: "Bảng điểm tuần", desc: "WIG · lead measures · 4DX", show: admin || r.has("student") },
    { href: "/buddy", Icon: Handshake, label: "Buddy", desc: "Đồng hành cùng bạn học", show: admin || isBuddy, hue: "ok" },
    { href: "/coach", Icon: Presentation, label: "Coach (GVCN)", desc: "Coachee · buổi họp 4 tuần", show: admin || r.has("teacher") || r.has("homeroom_teacher"), hue: "ok" },
    { href: "/subject-lead", Icon: BarChart3, label: "Tổ trưởng chuyên môn", desc: "Chất lượng môn · duyệt nội dung", show: admin || r.has("subject_lead"), hue: "sky" },
    { href: "/counselor", Icon: HeartHandshake, label: "Cố vấn tâm lý", desc: "Hàng đợi an toàn", show: admin || r.has("counselor"), hue: "mane" },
    { href: "/leadership", Icon: GraduationCap, label: "Ban giám hiệu", desc: "Dashboard tổng hợp", show: admin || r.has("leadership"), hue: "muted" },
    { href: "/dpo", Icon: ShieldCheck, label: "Bảo vệ dữ liệu (DPO)", desc: "Consent · audit", show: admin || r.has("dpo"), hue: "muted" },
    { href: "/admin", Icon: Settings, label: "Admin hệ thống", desc: "RBAC · gateway · vận hành", show: admin, hue: "muted" },
    { href: "/parent", Icon: Users, label: "Theo dõi con", desc: "Báo cáo đã lọc", show: r.has("parent"), hue: "mane" },
  ];
  const shown = tiles.filter((t) => t.show);

  return (
    <main className="hub">
      <div className="lion-says">
        {/* Chào hub = khoảnh khắc hero ⇒ sư tử toàn thân trên đồi cỏ (DESIGN.md) */}
        <span className="lion-scene">
          <Lion mood="idle" variant="full" size={112} />
        </span>
        <div className="lion-bubble">
          <h1 className="h3">Xin chào {firstName}</h1>
          <p className="muted">Chọn nơi anh/chị muốn vào.</p>
        </div>
      </div>

      <ul className="tiles">
        {shown.map(({ href, Icon, label, desc, hue }) => (
          <li key={href}>
            <a href={href}>
              <span className="tile-ico" data-hue={hue}>
                <Icon aria-hidden strokeWidth={2} />
              </span>
              <div>
                <b>{label}</b>
                <span className="muted">{desc}</span>
              </div>
              <ChevronRight className="tile-go" aria-hidden strokeWidth={2} />
            </a>
          </li>
        ))}
      </ul>

      <button className="btn btn-ghost" onClick={() => signOut().then(() => (window.location.href = "/"))}>
        Đăng xuất
      </button>
    </main>
  );
}
