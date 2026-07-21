"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, GraduationCap, IdCard, Presentation, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import Lion from "./Lion";

/**
 * Đăng nhập — Y CHANG hi-fi 4e (mandate chủ dự án): cảnh sân trường + crest +
 * AI Tutor serif + tagline + sư tử lớn trên đồi, và HAI nút:
 *   · "Đăng nhập bằng tài khoản trường" (navy) → bước 2: form email/mật khẩu
 *   · "Đăng nhập với Google" (trắng) → OAuth thật qua Supabase; trường chưa
 *     bật provider thì báo thân thiện, KHÔNG phải nút chết.
 * Không hỏi vai: đăng nhập xong /login/page.tsx tự đưa về nhà theo VAI THẬT
 * của profile (roleHome — học sinh vào thẳng /learn).
 */

const DEMO = [
  { email: "hs1@vietanh.edu.vn", label: "Học sinh", Icon: GraduationCap },
  { email: "gv1@vietanh.edu.vn", label: "Giáo viên", Icon: Presentation },
  { email: "ph1@vietanh.edu.vn", label: "Phụ huynh", Icon: Users },
];

export default function Login() {
  const [step, setStep] = useState<"choice" | "school">("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Desktop: focus sẵn ô email khi vào bước form. Mobile KHÔNG auto-focus —
  // bàn phím bật ngoài ý muốn làm giật viewport (mandate native-feel).
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "school" && window.matchMedia("(min-width: 900px)").matches) {
      emailRef.current?.focus();
    }
  }, [step]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Đăng nhập thất bại: " + error.message);
      setBusy(false);
      return;
    }
    // Không tự điều hướng ở đây — wrapper /login/page.tsx thấy session là đưa
    // về nhà theo VAI THẬT (roleHome): học sinh → /learn, GV → /teacher…
  }

  const fill = (em: string) => {
    setEmail(em);
    setPassword("VietAnh@2026");
  };

  return (
    <main className="auth-scene" data-step={step}>
      {/* Cảnh sân trường buổi sáng (hi-fi 4e) — thuần trang trí */}
      <div className="auth-sky" aria-hidden>
        <i className="auth-sun" />
        <i className="auth-cloud c1" />
        <i className="auth-cloud c2" />
        <i className="auth-cloud c3" />
        <i className="auth-hill back" />
        <i className="auth-hill front" />
      </div>

      <div className="auth">
        {/* Branding lên trên cùng — chung cho cả 2 bước */}
        <header className="auth-brand">
          <span className="auth-crest">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-crest-80.webp" alt="" width={46} />
          </span>
          <h1 className="h1">AI Tutor</h1>
          <p className="auth-wordmark">TRƯỜNG VIỆT ANH</p>
          <p className="auth-tagline">Gia sư luôn đặt câu hỏi để bạn tự tìm ra lời giải</p>
        </header>

        {/* auth-stage: bước CHỌN = cột (sư tử lớn + nút); bước NHẬP = HÀNG,
            sư tử bị đẩy sang trái, form tài khoản/mật khẩu đứng NGANG sư tử. */}
        <div className="auth-stage">
          {/* Toàn thân trên đồi cỏ — sư tử LỚN của màn đăng nhập (DESIGN.md);
             cả tấm ảnh vẫn nghiêng rất nhẹ theo con trỏ. */}
          <span className="lion-scene">
            <Lion mood="idle" size={196} variant="full" follow eager />
          </span>

          <div className="auth-panel">
            {error && (
              <div className="banner err">
                <AlertTriangle aria-hidden strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            {step === "choice" ? (
              /* Màn 1 — chỉ MỘT nút vào tài khoản trường; không hỏi vai */
              <div className="auth-choice">
                <button className="btn btn-block" type="button" onClick={() => setStep("school")}>
                  <IdCard aria-hidden strokeWidth={2} />
                  Đăng nhập bằng tài khoản trường
                </button>
              </div>
            ) : (
              /* Màn 2 — CHỈ form (tài khoản + mật khẩu + nút) đứng ngang sư tử */
              <form className="panel auth-form" onSubmit={submit}>
                <div className="field">
                  <label htmlFor="email">Tài khoản</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@vietanh.edu.vn"
                    ref={emailRef}
                    enterKeyHint="next"
                    autoCapitalize="none"
                  />
                </div>

                <div className="field">
                  <label htmlFor="password">Mật khẩu</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    enterKeyHint="go"
                  />
                </div>

                <button
                  className="btn btn-block"
                  type="submit"
                  disabled={busy || !email || !password}
                  data-loading={busy || undefined}
                >
                  <IdCard aria-hidden strokeWidth={2} />
                  Đăng nhập
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Demo + đổi cách đăng nhập — nằm DƯỚI hàng (chỉ ở bước nhập) để
            form phía trên đứng đúng ngang sư tử. */}
        {step === "school" && (
          <div className="auth-extra">
            <div className="auth-demo">
              <p className="auth-note">Tài khoản thử — bấm để điền nhanh</p>
              <div className="row">
                {DEMO.map(({ email: em, label, Icon }) => (
                  <button key={em} className="btn btn-white" type="button" onClick={() => fill(em)}>
                    <Icon aria-hidden strokeWidth={2} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-quiet" type="button" onClick={() => setStep("choice")}>
              <ArrowLeft aria-hidden strokeWidth={2} />
              Chọn cách đăng nhập khác
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
