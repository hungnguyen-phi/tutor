"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, GraduationCap, IdCard, Mail, Presentation, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { PILOT_DEMO_ACCOUNTS, PILOT_PASSWORD_LOGIN, SCHOOL_EMAIL_DOMAIN } from "../lib/config";
import { warmUpFunctions } from "../lib/api";
import Lion from "./Lion";

/**
 * Đăng nhập production:
 *   · Google Workspace SSO (toàn trường, khoá miền trường qua tham số `hd` +
 *     khoá server-side ở trigger provisioning) — provider chưa bật thì báo thân
 *     thiện, KHÔNG phải nút chết (bắt cả lỗi bounce-back trên URL).
 *   · Phụ huynh: nhập email → trường gửi magic-link (OTP). Chỉ email đã đăng ký;
 *     thông báo GIỮ RIÊNG TƯ (không tiết lộ email có tồn tại hay không).
 *   · Tài khoản trường (email + mật khẩu): admin cấp — GATE sau PILOT_PASSWORD_LOGIN.
 *     Nút "tài khoản thử" GATE sau PILOT_DEMO_ACCOUNTS.
 * Đăng nhập xong /login/page.tsx tự đưa về nhà theo VAI THẬT của profile.
 */

const DEMO = [
  { email: "hs1@vietanh.edu.vn", label: "Học sinh", Icon: GraduationCap },
  { email: "gv1@vietanh.edu.vn", label: "Giáo viên", Icon: Presentation },
  { email: "ph1@vietanh.edu.vn", label: "Phụ huynh", Icon: Users },
];

type Step = "choice" | "school" | "parent";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Logo Google chính chủ (inline — không phụ thuộc asset ngoài, không 404). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Login({ loiNgoai }: { loiNgoai?: string | null } = {}) {
  const [step, setStep] = useState<Step>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lỗi do TRANG CHA đưa xuống (từ chối miền / thiếu hồ sơ sau SSO) — trang cha
  // biết session, component này thì không.
  useEffect(() => { if (loiNgoai) setError(loiNgoai); }, [loiNgoai]);

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "school" && window.matchMedia("(min-width: 900px)").matches) {
      emailRef.current?.focus();
    }
  }, [step]);

  // HÂM NÓNG edge function ngay khi mở màn đăng nhập (lỗi 12): cold start đo
  // được ~1,7s/function, và nó rơi đúng vào lúc học sinh chờ lộ trình hiện ra.
  // Gọi ở đây thì vài giây em gõ mật khẩu là đủ để function tỉnh.
  useEffect(() => {
    warmUpFunctions();
  }, []);

  // SSO lỗi bounce về /login/ với error_description ở query hoặc hash → hiện rõ,
  // rồi dọn URL để refresh không lặp lại thông báo.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const desc = qs.get("error_description") || hs.get("error_description") || qs.get("error") || hs.get("error");
    if (desc) {
      setError(`Đăng nhập không thành công: ${decodeURIComponent(desc)}. Bạn thử lại với tài khoản Google của trường nhé.`);
      window.history.replaceState({}, "", "/login/");
    }
  }, []);


  /** Chuyển bước — LUÔN dọn thông báo cũ để banner không "dính" sang bước mới. */
  const go = (next: Step) => {
    setStep(next);
    setError(null);
    setSent(false);
  };

  // ── Google Workspace SSO ────────────────────────────────────────────────────
  async function google() {
    setBusy(true);
    setError(null);
    // skipBrowserRedirect: tự điều hướng SAU khi có url → lỗi provider (disabled)
    // trả về ngay ở đây thay vì lặng lẽ bounce.
    // KHÔNG dùng `hd` (04/09): trường có HAI miền (truongvietanh.com +
    // student.truongvietanh.com), `hd` chỉ khoá được một. Cho chọn tài khoản,
    // rồi KIỂM MIỀN sau khi về (useEffect dưới) + trigger DB chặn thật.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login/`,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      setBusy(false);
      setError(
        `Đăng nhập Google chưa sẵn sàng${error ? ` (${error.message})` : ""}. Trường có thể chưa bật provider — hãy dùng tài khoản trường hoặc báo quản trị viên.`,
      );
      return;
    }
    window.location.assign(data.url);
  }

  // ── Tài khoản trường: email + mật khẩu (admin cấp) ─────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Dịch lỗi Supabase sang tiếng Việt (audit 04/09: học sinh 15 tuổi đọc
      // "Invalid login credentials"). KHÔNG nói email có tồn tại hay không.
      const m = error.message;
      setError(
        /invalid login|invalid credentials|invalid_grant/i.test(m)
          ? "Email hoặc mật khẩu chưa đúng — bạn kiểm tra lại rồi thử lần nữa nhé."
          : /email not confirmed/i.test(m)
            ? "Tài khoản chưa được xác nhận email. Bạn liên hệ thầy cô/quản trị viên nhé."
            : /rate|too many|after \d+ seconds/i.test(m)
              ? "Bạn thử hơi nhanh — chờ khoảng một phút rồi đăng nhập lại nhé."
              : /network|fetch/i.test(m)
                ? "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé."
                : "Chưa đăng nhập được lúc này. Bạn thử lại sau hoặc báo thầy cô nhé.",
      );
      setBusy(false);
      return;
    }
    // Không tự điều hướng — wrapper /login/page.tsx đưa về nhà theo VAI THẬT.
  }

  // ── Phụ huynh: magic-link qua email (chỉ email đã đăng ký) ──────────────────
  async function sendParentLink(e: React.FormEvent) {
    e.preventDefault();
    const em = parentEmail.trim();
    if (!EMAIL_RE.test(em)) {
      setError("Email chưa hợp lệ — hãy kiểm tra lại.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: {
        emailRedirectTo: `${window.location.origin}/login/`,
        shouldCreateUser: false, // chỉ phụ huynh trường đã đăng ký mới nhận link
      },
    });
    setBusy(false);
    if (error) {
      // Dịch lỗi sang tiếng Việt; KHÔNG lộ email có đăng ký hay không (chống dò).
      const msg = /after\s+\d+\s+seconds|rate|too many/i.test(error.message)
        ? "Bạn vừa yêu cầu một link. Vui lòng chờ khoảng 1 phút rồi thử lại."
        : "Chưa gửi được link lúc này. Hãy kiểm tra lại email hoặc liên hệ trường.";
      setError(msg);
      return;
    }
    setSent(true); // thông báo giữ riêng tư "nếu đã đăng ký" ở dưới
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
        <header className="auth-brand">
          <span className="auth-crest">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-crest-80.webp" alt="" width={46} />
          </span>
          <h1 className="h1">AI Tutor</h1>
          <p className="auth-wordmark">TRƯỜNG VIỆT ANH</p>
          <p className="auth-tagline">Gia sư luôn đặt câu hỏi để bạn tự tìm ra lời giải</p>
        </header>

        <div className="auth-stage">
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

            {step === "choice" && (
              <div className="auth-choice">
                {/* SSO là đường chính cho toàn trường */}
                <button className="btn btn-block" type="button" onClick={google} disabled={busy} data-loading={busy || undefined}>
                  <GoogleG />
                  Đăng nhập với Google
                </button>
                {PILOT_PASSWORD_LOGIN && (
                  <button className="btn btn-white btn-block" type="button" onClick={() => go("school")}>
                    <IdCard aria-hidden strokeWidth={2} />
                    Tài khoản trường (email + mật khẩu)
                  </button>
                )}
                <button className="btn btn-quiet btn-block" type="button" onClick={() => go("parent")}>
                  <Mail aria-hidden strokeWidth={2} />
                  Phụ huynh — nhận link qua email
                </button>
              </div>
            )}

            {step === "school" && (
              <form className="panel auth-form" onSubmit={submit}>
                <div className="field">
                  <label htmlFor="email">Tài khoản</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`email@${SCHOOL_EMAIL_DOMAIN}`}
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

            {step === "parent" && (
              <form className="panel auth-form" onSubmit={sendParentLink}>
                {sent ? (
                  <div className="auth-sent">
                    <Mail aria-hidden strokeWidth={2} />
                    <p>
                      Nếu <b>{parentEmail.trim()}</b> đã đăng ký với trường, chúng tôi đã gửi một link
                      đăng nhập tới email đó. Mở email và bấm link để vào xem tình hình của con — nhớ
                      kiểm tra cả hộp thư rác.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="auth-note">
                      Nhập email bạn đã đăng ký với trường. Chúng tôi gửi một link đăng nhập an toàn —
                      không cần mật khẩu.
                    </p>
                    <div className="field">
                      <label htmlFor="parent-email">Email phụ huynh</label>
                      <input
                        id="parent-email"
                        type="email"
                        autoComplete="email"
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        placeholder="email@example.com"
                        enterKeyHint="go"
                        autoCapitalize="none"
                      />
                    </div>
                    <button className="btn btn-block" type="submit" disabled={busy || !parentEmail.trim()} data-loading={busy || undefined}>
                      <Mail aria-hidden strokeWidth={2} />
                      Gửi link đăng nhập
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Tài khoản thử + đổi cách đăng nhập — chỉ ở bước phụ, dưới hàng */}
        {step !== "choice" && (
          <div className="auth-extra">
            {step === "school" && PILOT_DEMO_ACCOUNTS && (
              <div className="auth-demo">
                <p className="auth-note">Tài khoản thử (pilot) — bấm để điền nhanh</p>
                <div className="row">
                  {DEMO.map(({ email: em, label, Icon }) => (
                    <button key={em} className="btn btn-white" type="button" onClick={() => fill(em)}>
                      <Icon aria-hidden strokeWidth={2} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-quiet" type="button" onClick={() => go("choice")}>
              <ArrowLeft aria-hidden strokeWidth={2} />
              Chọn cách đăng nhập khác
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
