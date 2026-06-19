import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Tutor — Trường Việt Anh",
  description: "Gia sư AI thích ứng — Trường Liên cấp Việt Anh",
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="app-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-vietanh.webp" alt="Trường Việt Anh" />
          <div className="titles">
            <b>AI Tutor</b>
            <br />
            <span>Trường Liên cấp Việt Anh</span>
          </div>
          <div className="spacer" />
          <span className="badge">Pilot · Toán &amp; Tiếng Anh</span>
        </header>
        {children}
      </body>
    </html>
  );
}
