"use client";

import type { ReactNode } from "react";
import { GraduationCap, History, Trophy, Flag, User } from "lucide-react";

export type NavKey = "learn" | "review" | "scoreboard" | "quests" | "profile";

/* Nhãn theo hi-fi 3a: Học · Ôn tập · Hạng · Mục tiêu · Tôi.
   "MỘT TRANG" (quyết định chủ dự án): cả 5 khu sống trong /learn — bấm tab là
   chuyển view TẠI CHỖ qua `onNavigate` (TutorApp), không tải lại trang.
   href chỉ là cửa deep-link (#hash) cho các trang route cũ còn tồn tại. */
const ITEMS: { key: NavKey; href: string; label: string; Icon: typeof GraduationCap }[] = [
  { key: "learn", href: "/learn/", label: "Học", Icon: GraduationCap },
  { key: "review", href: "/learn/#review", label: "Ôn tập", Icon: History },
  { key: "scoreboard", href: "/learn/#scoreboard", label: "Hạng", Icon: Trophy },
  { key: "quests", href: "/learn/#quests", label: "Mục tiêu", Icon: Flag },
  { key: "profile", href: "/learn/#profile", label: "Tôi", Icon: User },
];

/**
 * Khung app: thanh dưới đáy trên mobile, rail dọc 92px từ 900px (hi-fi 3c —
 * crest trường trên đầu, tab dọc 68px). Điều hướng luôn hiện — trừ khi đang
 * trong một câu hỏi (`focus`), lúc đó học sinh chỉ nên thấy câu hỏi.
 *
 * `onNavigate`: có = chế độ MỘT TRANG (nút, chuyển view tức thì);
 * không = trang đứng riêng (thẻ <a>, nhảy về cửa deep-link của /learn).
 */
export default function AppShell({
  current,
  focus = false,
  onNavigate,
  children,
}: {
  current: NavKey;
  focus?: boolean;
  onNavigate?: (key: NavKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      {!focus && (
        <nav className="nav" aria-label="Điều hướng chính">
          {/* Crest chỉ hiện trên rail desktop (CSS) — thuần nhận diện, không phải nút */}
          <img
            src="/brand/logo-crest-80.webp"
            alt=""
            aria-hidden
            className="nav-crest"
            width={44}
            height={44}
          />
          {ITEMS.map(({ key, href, label, Icon }) => {
            const inner = (
              <>
                {/* Active: icon navy ngồi trong viên 40×30 nền --navy-tint (hi-fi) */}
                <span className="nav-ico" aria-hidden>
                  <Icon strokeWidth={2.25} />
                </span>
                <span>{label}</span>
              </>
            );
            return onNavigate ? (
              <button
                key={key}
                type="button"
                className="nav-item"
                aria-current={key === current ? "page" : undefined}
                onClick={() => onNavigate(key)}
              >
                {inner}
              </button>
            ) : (
              <a
                key={key}
                href={href}
                className="nav-item"
                aria-current={key === current ? "page" : undefined}
              >
                {inner}
              </a>
            );
          })}
        </nav>
      )}
      <main className="shell-main">{children}</main>
    </div>
  );
}
