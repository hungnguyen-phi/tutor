"use client";

import Lion from "./Lion";

/**
 * Màn INTRO chuyển cảnh — che các khoảnh khắc chờ/redirect (đăng nhập xong đang
 * về nhà, phiên đang tải) bằng một cảnh trời + sư tử có thương hiệu, thay vì
 * chữ trần "Đang chuyển hướng…" nhấp nháy hay skeleton giật. Cùng nền trời với
 * app nên chuyển vào/ra không có chớp trắng.
 */
export default function Splash({ text }: { text?: string }) {
  return (
    <main className="splash" aria-live="polite">
      <div className="splash-sky" aria-hidden>
        <i className="auth-cloud c1" />
        <i className="auth-cloud c2" />
      </div>
      <div className="splash-inner">
        <span className="splash-lion">
          <Lion mood="idle" size={148} variant="full" eager />
        </span>
        <h1 className="h1 splash-word">AI Tutor</h1>
        <p className="splash-sub">{text ?? "Đang vào lớp học…"}</p>
        <span className="splash-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </div>
    </main>
  );
}
