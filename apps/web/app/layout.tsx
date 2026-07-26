import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
// Bộ cảm xúc động của mascot — PHẢI đứng sau globals.css: choreography trong
// này ghi đè nhịp cơ bản (.lion-greet đảo tay đè lion-sway, v.v.).
// Không dùng @import giữa globals.css: CSS spec chỉ cho @import ở đầu file,
// css-loader sẽ lặng lẽ bỏ qua — import tại đây cho thứ tự tường minh.
import "./lion-motion.css";

// Hai họ chữ theo hi-fi handoff (design_handoff_ai_tutor): serif cho display
// (tiêu đề trang, tên chương, biểu thức toán italic), sans cho toàn bộ UI.
// Cả hai đều có subset vietnamese — dấu không va nhau.
const sans = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const serif = Source_Serif_4({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Tutor — Trường Việt Anh",
  description: "Gia sư AI thích ứng — Trường Liên cấp Việt Anh",
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1428" },
  ],
  viewportFit: "cover", // để env(safe-area-inset-*) có giá trị thật trên iPhone
  // Android/Chrome: bàn phím mở thì layout viewport CO LẠI → 100dvh thu theo,
  // .lfoot (fixed đáy) nổi trên bàn phím thay vì bị che. iOS bỏ qua key này —
  // đã có Enter-to-submit + scroll-margin ở ô đáp án gánh.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: script chống-nháy trong <body> gắn data-theme/
    // font/motion lên <html> TRƯỚC hydrate — lệch attr này là chủ đích, không
    // phải bug. Chỉ tắt cảnh báo ở đúng phần tử này (chuẩn next-themes).
    <html lang="vi" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>
        {/* Tuỳ chọn Cài đặt (sáng/tối, cỡ chữ, giảm chuyển động) phải lên
            <html> TRƯỚC khi vẽ khung hình đầu — không thì nháy sáng→tối.
            Key localStorage khớp lib/prefs.ts; lỗi gì cũng nuốt (ẩn danh). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var e=document.documentElement,t=localStorage.getItem('va-theme');(t==='dark'||t==='light')&&(e.dataset.theme=t);var f=localStorage.getItem('va-font');(f==='sm'||f==='lg')&&(e.dataset.font=f);localStorage.getItem('va-motion')==='reduce'&&(e.dataset.motion='reduce')}catch(n){}})()",
          }}
        />
        {/* App-shell 1:1 viewport (yêu cầu chủ dự án): body khoá cuộn, mọi
            trang cuộn NGẦM trong .viewport — không bao giờ thấy thanh kéo.
            Màn Học còn siết thêm: chỉ dải bài học cuộn bên trong cảnh. */}
        <div className="viewport">{children}</div>
      </body>
    </html>
  );
}
