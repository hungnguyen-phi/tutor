"use client";

/**
 * Cài đặt (yêu cầu chủ dự án: "quản lí tài khoản, cài avt, đổi tên, chế độ
 * sáng tối, cùng các chế độ khác mà 1 app học tập có").
 *
 * NGUYÊN TẮC: chỉ bày control THẬT — mọi nút đều làm được việc hôm nay:
 *  · Avatar + tên hiển thị + giao diện + cỡ chữ + giảm chuyển động: tuỳ chọn
 *    thiết bị (lib/prefs) — đổi là ăn ngay.
 *  · Đổi tên: THỬ đổi chính thức trên server trước (profiles.full_name);
 *    RLS chưa mở quyền (policy profiles_self_update chờ deploy) thì update
 *    về 0 dòng → rơi về tên hiển thị cục bộ và NÓI RÕ với học sinh.
 *  · Đổi mật khẩu: supabase.auth.updateUser — chạy thật với phiên hiện tại.
 *  · Xoá tiến độ trên máy: xoá localStorage gamify (XP đang lưu cục bộ cho
 *    tới GĐ1.4) — có confirm, nói rõ hậu quả.
 * Không có: thông báo nhắc học, âm thanh (hệ thống chưa tồn tại — không vẽ
 * công tắc chết; xem ROADMAP GĐ5).
 */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Eraser,
  KeyRound,
  PencilLine,
  Settings,
  ShieldCheck,
  Sun,
  Type,
  UserCircle,
  Users,
  Wind,
  LogOut,
} from "lucide-react";
import { consentStatus, giveAssent, withdrawConsent, type ConsentStatus } from "../lib/api";
import Lion from "./Lion";
import Sheet from "./Sheet";
import { useAuth, signOut } from "../lib/auth";
import { supabase } from "../lib/supabase";
import * as Prefs from "../lib/prefs";
import { PRESENCE_ENABLED } from "../lib/presence";
import { PILOT_PASSWORD_LOGIN } from "../lib/config";

const TONES: { key: Prefs.AvatarTone; label: string }[] = [
  { key: "gold", label: "Vàng sư tử" },
  { key: "navy", label: "Navy trường" },
  { key: "sky", label: "Trời sáng" },
  { key: "ok", label: "Cỏ non" },
  { key: "mane", label: "Bờm cam" },
];

export default function SettingsView({ onBack }: { onBack?: () => void }) {
  const { session, profile, ready } = useAuth();
  const uid = session?.user.id;

  // Tuỳ chọn hiện hành — đọc một lần lúc mount (prefs là nguồn sự thật)
  const [font, setFontState] = useState<Prefs.FontScale>("md");
  const [motion, setMotionState] = useState(false);
  const [presence, setPresenceState] = useState(false);
  const [ava, setAva] = useState<{ kind: Prefs.AvatarKind; tone: Prefs.AvatarTone }>({
    kind: "initial",
    tone: "gold",
  });

  const [name, setName] = useState("");
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [parentLinked, setParentLinked] = useState(false);
  const [cleared, setCleared] = useState(false);
  // Sheet xác nhận xoá — thay window.confirm (hộp thoại trình duyệt lộ web)
  const [askClear, setAskClear] = useState(false);
  // Esc = Quay lại Hồ sơ (audit 04/09: Esc không đóng, chỉ có nút mũi tên).
  // Không bắt khi sheet xác nhận đang mở — Esc lúc đó phải đóng sheet trước.
  useEffect(() => {
    if (!onBack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !askClear) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, askClear]);

  useEffect(() => {
    setFontState(Prefs.getFont());
    setMotionState(Prefs.getReduceMotion());
    setPresenceState(Prefs.getPresenceOptIn());
    setAva(Prefs.getAvatar());
    setName(Prefs.getDisplayName() ?? "");
  }, []);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase
      .from("guardian_links")
      .select("id")
      .eq("student_id", uid)
      .limit(1)
      .then(({ data, error }) => {
        if (alive && !error) setParentLinked((data?.length ?? 0) > 0);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  // Cung benh voi man Toi (va 13/08): `profile` ve cham nua giay, nen ten
  // roi ve "Hoc sinh Viet Anh" roi nhay sang ten that ngay truoc mat em.
  // Chua biet thi cho — dung ve mot cai ten khong phai cua em roi trao lai.
  const officialName = ready ? (profile?.full_name ?? "Học sinh Việt Anh") : "";
  const shownName = Prefs.displayNameOf(officialName) ?? officialName;
  const initial = shownName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "";

  const pickFont = (s: Prefs.FontScale) => {
    Prefs.setFont(s);
    setFontState(s);
  };
  const toggleMotion = () => {
    const next = !motion;
    Prefs.setReduceMotion(next);
    setMotionState(next);
  };
  const togglePresence = () => {
    const next = !presence;
    Prefs.setPresenceOptIn(next);
    setPresenceState(next);
  };
  const pickAva = (kind: Prefs.AvatarKind, tone: Prefs.AvatarTone) => {
    Prefs.setAvatar(kind, tone);
    setAva({ kind, tone });
  };

  async function saveName() {
    const clean = name.trim();
    if (!clean) {
      // Xoá override — quay về tên chính thức
      Prefs.setDisplayName(null);
      setNameMsg({ ok: true, text: `Đã quay về tên chính thức: ${officialName}.` });
      return;
    }
    setSavingName(true);
    setNameMsg(null);
    // Thử đổi CHÍNH THỨC trước. RLS chưa mở → update 0 dòng, KHÔNG lỗi —
    // phải select lại để biết server có nhận hay không.
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: clean })
      .eq("id", uid!)
      .select("full_name");
    if (!error && data && data.length > 0 && data[0]!.full_name === clean) {
      Prefs.setDisplayName(null); // server là nguồn sự thật — bỏ override máy
      setNameMsg({ ok: true, text: "Đã đổi tên chính thức trên hệ thống trường." });
    } else if (error) {
      // Lỗi THẬT (mạng/khác) — KHÔNG ghi override máy (tránh tên máy lệch âm thầm
      // với server); báo lỗi rõ + để người dùng thử lại.
      setNameMsg({ ok: false, text: "Không đổi được tên lúc này — kiểm tra kết nối rồi thử lại." });
    } else {
      // Không lỗi nhưng update 0 dòng = RLS chưa mở quyền đổi tên → tên hiển thị cục bộ.
      Prefs.setDisplayName(clean);
      setNameMsg({
        ok: true,
        text:
          "Trường chưa mở quyền đổi tên chính thức — tên này sẽ hiển thị trên máy của bạn. " +
          `Tên trong sổ của trường vẫn là "${officialName}".`,
      });
    }
    setSavingName(false);
  }

  async function savePassword() {
    if (pw.length < 8) {
      setPwMsg({ ok: false, text: "Mật khẩu mới cần ít nhất 8 ký tự." });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: "Hai ô mật khẩu chưa khớp nhau." });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setPwMsg({ ok: false, text: "Đổi mật khẩu thất bại: " + error.message });
    } else {
      setPw("");
      setPw2("");
      setPwMsg({ ok: true, text: "Đã đổi mật khẩu — lần đăng nhập sau dùng mật khẩu mới nhé." });
    }
    setSavingPw(false);
  }

  function clearLocal() {
    try {
      window.localStorage.removeItem("va-tutor-progress");
      window.localStorage.removeItem("va-tutor-mastered");
      setCleared(true);
    } catch {
      /* bị chặn — thôi */
    }
    setAskClear(false);
  }

  // SSO-only (04/09): tài khoản Google không có mật khẩu để đổi — chỉ hiện ô
  // đổi mật khẩu khi đăng nhập mật khẩu còn bật (pilot).
  const coMatKhau = PILOT_PASSWORD_LOGIN && session?.user.app_metadata?.provider !== "google";

  return (
    <div className="ws" data-world="3">
      {/* HERO gọn — cài đặt là "hậu trường", không cần sân khấu lớn */}
      <header className="ws-hero st-hero">
        {onBack && (
          <button type="button" className="st-back" onClick={onBack} aria-label="Quay lại Hồ sơ">
            <ArrowLeft strokeWidth={2.25} />
          </button>
        )}
        <div className="ws-hero-text">
          <span className="ws-kicker">
            <Settings aria-hidden strokeWidth={2.5} />
            Cài đặt
          </span>
          <h1 className="ws-title">Không gian của {shownName.split(/\s+/).pop()}</h1>
          <p className="ws-lead">
            Chỉnh app theo ý bạn — avatar, giao diện, cỡ chữ. Mọi thay đổi ăn ngay, không cần lưu.
          </p>
        </div>
        <span className="ws-hero-lion" aria-hidden>
          <Lion mood="idle" size={120} variant="full" decorative eager />
        </span>
      </header>

      <div className="ws-grid">
        {/* ── CỘT CHÍNH: Tài khoản ── */}
        <section className="ws-panel">
          <h2 className="ws-panel-title">
            <UserCircle aria-hidden strokeWidth={2.25} />
            Tài khoản
          </h2>

          {/* Avatar: đĩa màu + chữ cái, hoặc sư tử — tuỳ chọn trên máy */}
          <div className="st-row">
            <b className="st-row-title">Avatar</b>
            <div className="st-ava-line">
              <span className="ws-hero-ava st-ava-preview" data-tone={ava.tone} aria-hidden>
                {ava.kind === "lion" ? <Lion mood="idle" size={40} decorative /> : initial}
              </span>
              <div className="st-ava-opts">
                <div className="st-seg" role="radiogroup" aria-label="Kiểu avatar">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ava.kind === "initial"}
                    onClick={() => pickAva("initial", ava.tone)}
                  >
                    Chữ cái
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ava.kind === "lion"}
                    onClick={() => pickAva("lion", ava.tone)}
                  >
                    Sư tử
                  </button>
                </div>
                <div className="st-tones" role="radiogroup" aria-label="Màu avatar">
                  {TONES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="radio"
                      aria-checked={ava.tone === t.key}
                      className="st-tone"
                      data-tone={t.key}
                      title={t.label}
                      aria-label={t.label}
                      onClick={() => pickAva(ava.kind, t.key)}
                    >
                      {ava.tone === t.key && <Check strokeWidth={3} aria-hidden />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Đổi tên — server trước, máy sau (nói rõ từng trường hợp) */}
          <div className="st-row">
            <b className="st-row-title">
              <PencilLine aria-hidden strokeWidth={2.25} />
              Tên hiển thị
            </b>
            <div className="st-name-line">
              <input
                type="text"
                value={name}
                maxLength={60}
                placeholder={officialName}
                onChange={(e) => setName(e.target.value)}
                aria-label="Tên hiển thị"
                autoComplete="nickname"
                autoCapitalize="words"
                enterKeyHint="done"
              />
              <button
                className="btn btn-sm"
                onClick={saveName}
                disabled={savingName}
                data-loading={savingName || undefined}
              >
                Lưu tên
              </button>
            </div>
            {nameMsg && (
              <p className={nameMsg.ok ? "st-msg ok" : "st-msg err"} role="status">
                {nameMsg.text}
              </p>
            )}
          </div>

          {/* Đổi mật khẩu — thật qua supabase.auth */}
          {coMatKhau && (
          <div className="st-row">
            <b className="st-row-title">
              <KeyRound aria-hidden strokeWidth={2.25} />
              Đổi mật khẩu
            </b>
            <div className="st-name-line">
              <input
                type="password"
                value={pw}
                autoComplete="new-password"
                placeholder="Mật khẩu mới (≥ 8 ký tự)"
                onChange={(e) => setPw(e.target.value)}
                aria-label="Mật khẩu mới"
                enterKeyHint="next"
              />
              <input
                type="password"
                value={pw2}
                autoComplete="new-password"
                placeholder="Nhập lại"
                onChange={(e) => setPw2(e.target.value)}
                aria-label="Nhập lại mật khẩu mới"
                enterKeyHint="done"
              />
              <button
                className="btn btn-sm"
                onClick={savePassword}
                disabled={savingPw || !pw || !pw2}
                data-loading={savingPw || undefined}
              >
                Đổi
              </button>
            </div>
            {pwMsg && (
              <p className={pwMsg.ok ? "st-msg ok" : "st-msg err"} role="status">
                {pwMsg.text}
              </p>
            )}
          </div>
          )}

          {/* Thông tin chỉ đọc — trường quản lý */}
          <div className="st-row">
            <b className="st-row-title">Thông tin do trường quản lý</b>
            <dl className="st-facts">
              <div>
                <dt>Email</dt>
                <dd>{session?.user.email ?? "—"}</dd>
              </div>
              <div>
                <dt>Vai trò</dt>
                <dd>{roleLabel(profile?.role)}</dd>
              </div>
              <div>
                <dt>Tên chính thức</dt>
                <dd>{officialName}</dd>
              </div>
            </dl>
            {parentLinked && (
              <div className="pf-acct-row">
                <span>
                  <Users aria-hidden strokeWidth={2} />
                  Phụ huynh đã liên kết
                </span>
                <BadgeCheck className="pf-acct-ok" strokeWidth={2} aria-hidden />
              </div>
            )}
          </div>

          <button
            className="btn btn-ghost btn-block"
            onClick={() => signOut().then(() => (window.location.href = "/"))}
          >
            <LogOut aria-hidden strokeWidth={2} />
            Đăng xuất
          </button>
        </section>

        {/* ── CỘT PHẢI: Giao diện · Trợ năng · Dữ liệu ── */}
        <aside className="ws-side">
          <section className="ws-panel">
            <h2 className="ws-panel-title">
              <Sun aria-hidden strokeWidth={2.25} />
              Giao diện
            </h2>
            {/* Chế độ màu đã GỠ (quyết định chủ dự án 29/07, lỗi 7): app chỉ còn
                giao diện sáng. Cỡ chữ + giảm chuyển động ở lại — đó là TRỢ NĂNG,
                không phải sở thích thẩm mỹ. */}
            <div className="st-row">
              <b className="st-row-title">
                <Type aria-hidden strokeWidth={2.25} />
                Cỡ chữ
              </b>
              <div className="st-seg st-seg-3" role="radiogroup" aria-label="Cỡ chữ">
                <button type="button" role="radio" aria-checked={font === "sm"} onClick={() => pickFont("sm")}>
                  Nhỏ
                </button>
                <button type="button" role="radio" aria-checked={font === "md"} onClick={() => pickFont("md")}>
                  Vừa
                </button>
                <button type="button" role="radio" aria-checked={font === "lg"} onClick={() => pickFont("lg")}>
                  Lớn
                </button>
              </div>
            </div>
          </section>

          <section className="ws-panel">
            <h2 className="ws-panel-title">
              <Wind aria-hidden strokeWidth={2.25} />
              Trợ năng
            </h2>
            <label className="st-switch">
              <span>
                <b>Giảm chuyển động</b>
                <span className="muted">Sư tử đứng yên, thẻ thôi nhún — đỡ mỏi mắt.</span>
              </span>
              <input type="checkbox" checked={motion} onChange={toggleMotion} role="switch" aria-checked={motion} aria-label="Giảm chuyển động" />
            </label>
          </section>

          {/* "Học cùng nhau" tạm gỡ qua cờ PRESENCE_ENABLED (lib/presence). */}
          {PRESENCE_ENABLED && (
            <section className="ws-panel">
              <h2 className="ws-panel-title">
                <Users aria-hidden strokeWidth={2.25} />
                Học cùng nhau
              </h2>
              <label className="st-switch">
                <span>
                  <b>Hiện mình đang học cùng bạn</b>
                  <span className="muted">
                    Bật để thấy bạn cùng khối đang online — và để các bạn thấy bạn.
                    Chỉ hiện tên gọi + đang học môn nào, KHÔNG lộ gì thêm. Mặc định tắt.
                  </span>
                </span>
                <input type="checkbox" checked={presence} onChange={togglePresence} role="switch" aria-checked={presence} aria-label="Hiện mình đang học cùng bạn" />
              </label>
            </section>
          )}

          <section className="ws-panel">
            <h2 className="ws-panel-title">
              <Eraser aria-hidden strokeWidth={2.25} />
              Dữ liệu trên máy
            </h2>
            {/* Copy đúng bản chất (audit 04/09): XP/chuỗi ngày/thành thạo THẬT đã
                nằm trên hệ thống trường (student_xp, student_node_state); máy chỉ
                giữ bản sao hiển thị. Nói "lưu trên máy" làm em tưởng xoá là mất
                điểm thật — hoặc tưởng xoá được để reset. */}
            <p className="muted">
              Máy này chỉ giữ một <b>bản sao hiển thị</b> (XP, chuỗi ngày, bài đã học) để mở app là
              thấy ngay. Điểm thật nằm trên hệ thống trường — xoá bản sao KHÔNG làm mất XP hay tiến
              độ của bạn, mở lại app là số tự về.
            </p>
            {cleared ? (
              <p className="st-msg ok" role="status">
                Đã xoá bản sao trên máy này.
              </p>
            ) : (
              <button className="btn btn-ghost btn-block btn-danger" onClick={() => setAskClear(true)}>
                <Eraser aria-hidden strokeWidth={2} />
                Xoá tiến độ trên máy này
              </button>
            )}
          </section>

          <StudentConsent />
        </aside>
      </div>

      {/* Sheet xác nhận xoá — autofocus vào "Giữ lại": Enter vô ý không phá dữ liệu */}
      <Sheet open={askClear} onClose={() => setAskClear(false)} title="Xoá bản sao trên máy này?">
        <p>
          Máy này sẽ quên XP, chuỗi ngày và bài đã học đang hiển thị — nhưng đó chỉ là bản sao.
          Điểm thật trên hệ thống trường không đổi; mở lại app là số tự về.
        </p>
        <div className="sheet-actions">
          <button className="btn btn-ghost" data-autofocus onClick={() => setAskClear(false)}>
            Giữ lại
          </button>
          <button className="btn" onClick={clearLocal}>
            Xoá tiến độ
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/** Đồng thuận của HS (K3) — HS tự ưng thuận / rút. Đọc trạng thái khi mở; hiện
 *  nút hợp cảnh. Chưa có bản ghi → không vẽ (tránh control chết). */
function StudentConsent() {
  const [st, setSt] = useState<ConsentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => consentStatus().then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); }, []);
  // Hai bước cho "Rút đồng ý" — khai TRƯỚC mọi return sớm (luật thứ tự hook).
  const [xacNhanRut, setXacNhanRut] = useState(false);
  if (!st || !st.record) return null;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await load(); } finally { setBusy(false); }
  };
  return (
    <section className="ws-panel">
      <h2 className="ws-panel-title">
        <ShieldCheck aria-hidden strokeWidth={2.25} />
        Đồng ý dữ liệu (PDPL)
      </h2>
      {st.complete ? (
        <>
          <p className="st-msg ok" role="status">
            <Check aria-hidden strokeWidth={2.5} /> Đã đủ đồng thuận — em học bình thường.
          </p>
          {/* Hai bước tại chỗ (audit 04/09: nút hệ quả lớn — dừng học — mà cùng
              kiểu với Đăng xuất, không xác nhận). Bấm lần 1 chỉ "lên đạn". */}
          {!xacNhanRut ? (
            <button className="btn btn-ghost btn-block btn-danger" disabled={busy} onClick={() => setXacNhanRut(true)}>
              Rút đồng ý (dừng xử lý dữ liệu)
            </button>
          ) : (
            <div className="st-danger-confirm" role="group" aria-label="Xác nhận rút đồng ý">
              <p className="muted">Rút đồng ý là AI Tutor <b>dừng hẳn</b> việc dạy bạn cho tới khi đồng ý lại. Chắc chứ?</p>
              <div className="row">
                <button className="btn btn-ghost" disabled={busy} onClick={() => setXacNhanRut(false)}>Thôi, giữ nguyên</button>
                <button className="btn btn-danger-solid" disabled={busy} onClick={() => act(() => withdrawConsent())}>Rút đồng ý</button>
              </div>
            </div>
          )}
        </>
      ) : st.needsAssent ? (
        <>
          <p className="muted">
            Em cần đồng ý cho AI Tutor giúp em học — bố/mẹ cũng cần đồng ý (đồng thuận kép).
          </p>
          <button className="btn btn-gold btn-block" disabled={busy} onClick={() => act(giveAssent)}>
            Em đồng ý dùng AI Tutor
          </button>
        </>
      ) : (
        <p className="muted">Đang chờ bố/mẹ đồng ý. Khi đủ hai bên, em sẽ học được ngay.</p>
      )}
    </section>
  );
}

function roleLabel(role?: string | null): string {
  switch (role) {
    case "teacher":
      return "Giáo viên";
    case "parent":
      return "Phụ huynh";
    case "admin":
      return "Quản trị";
    default:
      return "Học sinh";
  }
}
