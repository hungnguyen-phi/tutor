"use client";

import { MessageCircleQuestion, Target, Handshake, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import Lion from "./Lion";

/* Mỗi tính năng một họ màu theo chức năng (DESIGN.md "Icon — có hồn, không
   xám"): học = navy · mục tiêu = cỏ · đồng hành = cam bờm · info/tin cậy = trời. */
const FEATURES = [
  {
    Icon: MessageCircleQuestion,
    hue: "navy",
    t: "Học theo Socratic",
    d: "Tutor gợi mở từng bước, không cho đáp án sẵn — bạn tự tìm ra lời giải.",
  },
  {
    Icon: Target,
    hue: "ok",
    t: "Mục tiêu lớn (4DX)",
    d: "Bảng tuần của lớp, xếp hạng theo nỗ lực chứ không theo điểm số.",
  },
  {
    Icon: Handshake,
    hue: "mane",
    t: "Coach & Buddy",
    d: "Đồng hành cùng giáo viên chủ nhiệm và bạn học mỗi tuần.",
  },
  {
    Icon: ShieldCheck,
    hue: "sky",
    t: "An toàn dữ liệu",
    d: "Tuân thủ PDPL: đồng thuận kép, ẩn danh trước khi xử lý AI.",
  },
];

export default function Landing() {
  const { session } = useAuth();
  const loggedIn = !!session;
  const cta = loggedIn ? { href: "/app", label: "Vào ứng dụng" } : { href: "/login", label: "Đăng nhập" };

  return (
    <>
      {/* Hero navy — khoảnh khắc thương hiệu. Sư tử chính chủ vẫy tay chào. */}
      <section className="hero">
        <header className="hero-top">
          {/* Logo trường thiết kế cho nền sáng — đặt trên chip trắng khi ở nền navy */}
          <span className="hero-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-vietanh.webp" alt="Trường Liên cấp Việt Anh" height={44} />
          </span>
          <a className="btn btn-ghost" href={cta.href}>
            {cta.label}
          </a>
        </header>

        <div className="hero-inner">
          <div className="hero-copy">
            <h1>Gia sư AI của riêng em</h1>
            <p className="sub">
              Sư tử Việt Anh sẽ không đưa đáp án. Mình hỏi, bạn nghĩ — và bạn tự tìm ra. Mỗi ngày một chút,
              đúng điểm kiến thức bạn cần.
            </p>
            <div className="hero-cta">
              <a className="btn btn-gold" href={cta.href}>
                {cta.label}
                <ArrowRight aria-hidden strokeWidth={2} />
              </a>
            </div>
          </div>
          <div className="hero-lion">
            {/* Vẫy chào — đúng nghĩa trang chào mừng; celebrate để dành màn hoàn thành */}
            <Lion mood="greet" size={210} decorative />
          </div>
        </div>
      </section>

      <div className="land">
        <ul className="land-features">
          {FEATURES.map(({ Icon, hue, t, d }) => (
            <li key={t}>
              <span className="tile-ico" data-hue={hue}>
                <Icon aria-hidden strokeWidth={2} />
              </span>
              <div>
                <b>{t}</b>
                <p className="muted">{d}</p>
              </div>
            </li>
          ))}
        </ul>

        <footer className="land-foot muted">
          Dành cho Học sinh · Giáo viên · Phụ huynh · Nhà trường — © Trường Liên cấp Việt Anh
          {!loggedIn && (
            <>
              {" · "}
              <a href="/login">Đăng nhập</a>
            </>
          )}
        </footer>
      </div>
    </>
  );
}
