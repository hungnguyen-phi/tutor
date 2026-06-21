"use client";

import { useAuth } from "../lib/auth";

const FEATURES = [
  { e: "💬", t: "Học theo Socratic", d: "Tutor gợi mở từng bước, không cho đáp án sẵn — em tự tìm ra lời giải." },
  { e: "🎯", t: "Mục tiêu lớn (4DX)", d: "Bảng điểm tuần theo WIG, xếp hạng theo nỗ lực chứ không theo điểm." },
  { e: "🤝", t: "Coach & Buddy", d: "Đồng hành cùng giáo viên chủ nhiệm và bạn học mỗi tuần." },
  { e: "🔒", t: "An toàn dữ liệu", d: "Tuân thủ PDPL: đồng thuận kép, ẩn danh trước khi xử lý AI." },
];

export default function Landing() {
  const { session } = useAuth();
  const loggedIn = !!session;
  const cta = loggedIn ? { href: "/app", label: "Vào ứng dụng →" } : { href: "/login", label: "Đăng nhập" };

  return (
    <>
      <div className="land-top">
        <img src="/logo-vietanh.webp" alt="Việt Anh" />
        <div className="nm"><b>AI Tutor</b><span>Trường Liên cấp Việt Anh</span></div>
        <div style={{ flex: 1 }} />
        <a className="btn ghost" href={cta.href}>{cta.label}</a>
      </div>

      <section className="hero">
        <div className="hero-inner">
          <img src="/brand/lion-full.png" alt="Sư tử Việt Anh" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div className="copy">
            <h1>Gia sư AI <span className="g">đồng hành</span> cùng mỗi học sinh</h1>
            <p>Học theo phương pháp Socratic — gợi mở thay vì cho đáp án. Theo dõi tiến bộ theo <b>nỗ lực thật</b>, kết nối học sinh với coach và gia đình. Bắt đầu với Toán và Tiếng Anh.</p>
            <a className="btn gold" href={cta.href}>{loggedIn ? "Vào ứng dụng →" : "Bắt đầu học"}</a>
            <div className="pills"><span>Toán</span><span>Tiếng Anh</span><span>Cá nhân hoá</span><span>PDPL</span></div>
          </div>
        </div>
      </section>

      <div className="land-features">
        {FEATURES.map((f) => (
          <div className="feat" key={f.t}><span className="e">{f.e}</span><b>{f.t}</b><small>{f.d}</small></div>
        ))}
      </div>

      <div className="land-foot">
        Dành cho Học sinh · Giáo viên · Phụ huynh · Nhà trường &nbsp;·&nbsp; © Trường Liên cấp Việt Anh
        {!loggedIn && <> &nbsp;·&nbsp; <a href="/login">Đăng nhập</a></>}
      </div>
    </>
  );
}
