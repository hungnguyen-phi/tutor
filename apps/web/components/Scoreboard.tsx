"use client";

/**
 * Bảng tuần (hi-fi 4b) — xếp theo NỖ LỰC (XP), không theo điểm số.
 * Dựng Y CHANG mock: segmented Lớp/Khối + danh sách 6 hàng + nudge sư tử.
 * API scoreboard chỉ trả hạng của CHÍNH MÌNH (effort.rank + scope) — danh
 * sách bạn cùng lớp/khối là DỮ LIỆU MẪU (xem SAMPLE_* bên dưới); số của
 * chính học sinh (tên, XP, chuỗi, hạng API) không bao giờ là mẫu.
 * Các khối 4DX (WIG, lead measures, coach/buddy, cam kết, đồng bộ) giữ nguyên
 * dữ liệu và luồng — nằm DƯỚI nudge, cuộn xuống thấy.
 *
 * `ScoreboardBody` = THÂN bảng, dùng làm tab Hạng trong trang MỘT TRANG
 * /learn (TutorApp đã gác đăng nhập). Default export = trang đứng riêng
 * /scoreboard (cửa deep-link), tự gác cổng.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Flame, Hourglass, Info, Medal, Trophy, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { getScoreboard, commitScoreboard, syncScoreboard, type Scoreboard } from "../lib/api";
import AppShell from "./AppShell";
import RedirectToLogin from "./RedirectToLogin";
import Lion from "./Lion";
import * as G from "../lib/gamify";
import * as Prefs from "../lib/prefs";

const SCOPE_LABEL: Record<string, string> = { lop: "lớp", khoi: "khối", cap: "cấp", truong: "trường" };

/* ═══════════════════════════════════════════════════════════════════════════
   MẪU — thay bằng dữ liệu server khi API scoreboard trả danh sách bạn cùng
   lớp/khối (xem docs/HANDOFF.md). Hàng của CHÍNH học sinh không bao giờ là
   mẫu: tên + hạng lấy từ API, XP/chuỗi từ localStorage (lib/gamify).
   Danh sách lớp đúng như hi-fi 4b; danh sách khối khác vài tên để tab sống.
   ═══════════════════════════════════════════════════════════════════════════ */
type SampleRow = { name: string; streak: number; xp: number };
const SAMPLE_CLASS: SampleRow[] = [
  { name: "Minh", streak: 21, xp: 820 },
  { name: "Lan", streak: 9, xp: 560 },
  { name: "Huy", streak: 5, xp: 380 },
  { name: "Thảo", streak: 12, xp: 350 },
  { name: "Đạt", streak: 3, xp: 310 },
];
const SAMPLE_GRADE: SampleRow[] = [
  { name: "Khánh", streak: 17, xp: 940 },
  { name: "Minh", streak: 21, xp: 820 },
  { name: "Ngọc", streak: 11, xp: 700 },
  { name: "Lan", streak: 9, xp: 560 },
  { name: "Phúc", streak: 6, xp: 430 },
];
/** Tint avatar xoay theo thứ tự hi-fi: sky → ok → mane → navy. */
const AVA_TINTS = ["sky", "ok", "mane", "navy"] as const;

/** Số ngày còn lại của tuần ISO, tính cả hôm nay — suy từ Date, không cần API. */
function daysLeftInWeek(): number {
  const dow = new Date().getDay(); // 0 = CN
  return dow === 0 ? 1 : 8 - dow;
}

export function ScoreboardBody() {
  const { profile } = useAuth();
  const [sb, setSb] = useState<Scoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitment, setCommitment] = useState("");
  const [savingCommit, setSavingCommit] = useState(false);
  // XP/chuỗi ngày cục bộ — nguồn số thật cho hàng của mình (API chưa trả XP tuần)
  const [progress, setProgress] = useState<G.Progress | null>(null);
  // Phạm vi bảng đang xem — "class" = scope thật từ API, "grade" = bảng mẫu khối
  const [scope, setScope] = useState<"class" | "grade">("class");
  // Đếm lần thử — nút "Thử lại" trong banner lỗi tăng số này để gọi lại API
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setError(null);
    setProgress(G.load());
    getScoreboard()
      .then((d) => {
        setSb(d);
        setCommitment(d.commitment ?? "");
        // XP server có trong payload → cache máy chỉ chép lại số thật.
        if (d.xp) setProgress(G.syncFromServer(d.xp));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tries]);

  // Đồng bộ 4DX TỰ ĐỘNG, ngầm (yêu cầu chủ dự án: bỏ nút, tự cập nhật). Chạy
  // một lần sau khi bảng nạp xong, chỉ khi người xem được phép ghi (self/staff);
  // mọi lỗi im lặng — không có UI cho việc này nữa.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!sb || syncedRef.current) return;
    if (!(sb.viewer.self || sb.viewer.staff)) return;
    syncedRef.current = true;
    syncScoreboard()
      .then((r) => setSb((s) => (s ? { ...s, sync: { syncedAt: r.syncedAt } } : s)))
      .catch(() => {
        /* 4DX chưa sẵn sàng — không chặn bảng tuần */
      });
  }, [sb]);

  // Tên hiển thị: override cục bộ (Cài đặt) thắng tên server
  const myName = Prefs.displayNameOf(sb?.student.name ?? profile?.full_name) ?? "bạn";
  const firstName = myName.trim().split(/\s+/).pop();

  async function saveCommit() {
    setSavingCommit(true);
    try {
      await commitScoreboard(commitment);
    } finally {
      setSavingCommit(false);
    }
  }

  // ── Danh sách xếp hạng đang hiện ─────────────────────────────────────────
  // BẢNG THẬT khi server trả `board` (roadmap 1.5): bạn cùng khối, XP TUẦN +
  // chuỗi từ student_xp — mọi hàng đều là số thật, chuỗi nguội server đã ẩn.
  // Server chưa deploy bản mới / người xem không có quyền board → rơi về bảng
  // MẪU như cũ (minh bạch bằng chip "số mẫu"); hàng của mình vẫn là số thật.
  const real = sb?.board?.rows?.length ? sb.board.rows : null;
  const myRealRow = real?.find((r) => r.me) ?? null;
  const myStreak = real
    ? myRealRow?.streak ?? 0
    : progress && progress.streak > 0 && !G.isCold(progress) ? progress.streak : 0;
  /** Số dùng để XẾP trong bảng: bảng thật xếp theo XP TUẦN; bảng mẫu theo XP máy. */
  const myXp = real ? myRealRow?.xp ?? 0 : progress?.xp ?? 0;
  /** Tổng XP tích luỹ (tile vàng) — server thắng, cache máy là fallback. */
  const myTotalXp = sb?.xp ? sb.xp.total : progress?.xp ?? 0;
  const sample = scope === "class" ? SAMPLE_CLASS : SAMPLE_GRADE;
  const rows = real
    ? real.map((r, i) => ({
        name: r.name,
        streak: r.streak,
        xp: r.xp,
        me: r.me,
        tint: r.me ? undefined : AVA_TINTS[i % AVA_TINTS.length],
      }))
    : sb
      ? [
          ...sample.map((r, i) => ({ ...r, me: false, tint: AVA_TINTS[i % AVA_TINTS.length] })),
          { name: myName, streak: myStreak, xp: myXp, me: true, tint: undefined },
        ].sort((a, b) => b.xp - a.xp) // sort ổn định — XP bằng nhau thì mình đứng sau
      : [];
  const myIdx = rows.findIndex((r) => r.me);
  // Người đứng ngay trên mình trong bảng ĐANG HIỆN — nguồn của câu nudge
  const above = myIdx > 0 ? rows[myIdx - 1]! : null;

  const scopeWord = SCOPE_LABEL[sb?.effort.scope ?? "lop"] ?? "lớp";
  // Nhãn tab trái = scope thật từ API, viết hoa đầu. API chưa trả TÊN lớp —
  // khi có thì nối vào đây ("Lớp 10A"); tab phải "Khối" (chưa biết khối mấy).
  const classTab = scopeWord.charAt(0).toUpperCase() + scopeWord.slice(1);
  // Hạng hiện ở hàng mình: bảng thật → vị trí thật trong bảng (server đã sort);
  // bảng mẫu → hạng seed từ API nếu có, không thì vị trí trong danh sách mẫu.
  const useApiRank = real ? true : scope === "class" && sb?.effort.rank != null;
  const myShownRank = real ? myIdx + 1 : useApiRank ? sb!.effort.rank! : myIdx + 1;

  return (
    <div className="ws">
      {/* HERO navy — "Bảng tuần" + khung nỗ lực + sư tử; chip còn N ngày */}
      <header className="ws-hero">
        <div className="ws-hero-text">
          <span className="ws-kicker">
            <Trophy aria-hidden strokeWidth={2.5} />
            Xếp theo nỗ lực · không theo điểm số
          </span>
          <h1 className="ws-title">Bảng tuần của {firstName}</h1>
          <p className="ws-lead">
            Mỗi buổi học là XP — thứ ai cũng tăng được bằng cách quay lại đều đặn. Thêm một buổi hôm
            nay là bạn tiến thêm một bậc.
          </p>
          <span className="ws-hero-chip">
            <Hourglass aria-hidden strokeWidth={2.25} />
            Tuần này còn {daysLeftInWeek()} ngày
          </span>
        </div>
        <span className="ws-hero-lion" aria-hidden>
          <Lion mood="excited" size={132} variant="full" decorative />
        </span>
      </header>

      {error && (
        <div className="banner err">
          <AlertTriangle aria-hidden strokeWidth={2} />
          <span>{error}</span>
          {/* Retry THẬT: về skeleton rồi gọi lại getScoreboard — không nút chết */}
          <button
            type="button"
            className="banner-retry"
            onClick={() => {
              setSb(null);
              setTries((t) => t + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {!sb && !error && (
        <>
          <div className="ws-skel-stats" aria-hidden>
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </div>
          <div className="ws-grid">
            <div className="skel ws-skel-panel" />
            <div className="skel ws-skel-panel" />
          </div>
        </>
      )}

      {sb && (
        <>
          {/* Dải chỉ số THẬT của chính bạn: hạng · XP · chuỗi ngày */}
          <div className="ws-stats">
            {/* data-zero: giá trị 0 lùi về nền, không khoe số chết; hạng tính
                từ bảng mẫu nên cũng lùi khi chưa có XP thật */}
            <div className="ws-stat" data-tone="navy" data-zero={myXp === 0 || undefined}>
              <span className="ws-stat-ico" aria-hidden>
                <Medal strokeWidth={2.25} />
              </span>
              <b className="num">#{myShownRank}</b>
              <span>hạng nỗ lực {scope === "class" ? scopeWord : "khối"}</span>
            </div>
            <div className="ws-stat" data-tone="gold" data-zero={myTotalXp === 0 || undefined}>
              <span className="ws-stat-ico" aria-hidden>
                <Zap strokeWidth={2.25} />
              </span>
              <b className="num">{myTotalXp}</b>
              <span>tổng XP của bạn</span>
            </div>
            <div className="ws-stat" data-tone="plain" data-zero={myStreak === 0 || undefined}>
              <span className="ws-stat-ico" aria-hidden>
                <Flame strokeWidth={2.25} />
              </span>
              <b className="num">{myStreak}</b>
              <span>ngày liên tiếp</span>
            </div>
          </div>

          <div className="ws-grid">
            {/* CỘT CHÍNH: bảng xếp hạng */}
            <section className="ws-panel sb-board">
              <div className="ws-panel-head">
                {real ? (
                  /* BẢNG THẬT: server trả bạn cùng khối theo XP TUẦN — không còn
                     tab mẫu, nói rõ phạm vi + thước đo. */
                  <div className="sb-scope" role="radiogroup" aria-label="Phạm vi bảng xếp hạng">
                    <button type="button" role="radio" aria-checked>
                      Khối · XP tuần này
                    </button>
                  </div>
                ) : (
                  <div className="sb-scope" role="radiogroup" aria-label="Phạm vi bảng xếp hạng">
                    <button type="button" role="radio" aria-checked={scope === "class"} onClick={() => setScope("class")}>
                      {classTab}
                    </button>
                    <button type="button" role="radio" aria-checked={scope === "grade"} onClick={() => setScope("grade")}>
                      Khối
                    </button>
                  </div>
                )}
                {/* Minh bạch: nói rõ bảng là số thật hay còn dữ liệu mẫu */}
                {real ? (
                  <span className="sb-sample" title="Toàn bộ bảng là số thật từ server — XP tuần này của các bạn cùng khối">
                    <Info aria-hidden strokeWidth={2.25} />
                    bảng thật
                  </span>
                ) : (
                  <span className="sb-sample" title="Danh sách bạn học đang là dữ liệu mẫu — hàng của bạn là số thật">
                    <Info aria-hidden strokeWidth={2.25} />
                    bạn học: số mẫu
                  </span>
                )}
              </div>

              <ol className="sb-list">
                {rows.map((r, i) => {
                  const rank = r.me ? myShownRank : i + 1;
                  const letter = r.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "?";
                  const podium = !r.me && i < 3;
                  return (
                    <li
                      className={r.me ? "sb-row me" : "sb-row"}
                      key={r.me ? "me" : `${r.name}-${i}`}
                      title={
                        r.me && useApiRank
                          ? real
                            ? "Bảng thật từ server — XP tuần này của các bạn cùng khối"
                            : "Hạng nỗ lực thật từ server — các bạn khác trong bảng là dữ liệu mẫu"
                          : undefined
                      }
                    >
                      <span className={podium ? "sb-rank num" : "sb-rank num"} data-podium={podium ? i + 1 : undefined} aria-label={`Hạng ${rank}`}>
                        {podium ? <Medal aria-hidden strokeWidth={2.5} /> : rank}
                      </span>
                      <span className="sb-ava" data-tint={r.me ? "gold" : r.tint} aria-hidden>
                        {letter}
                      </span>
                      <div className="sb-who">
                        <b>{r.me ? `${r.name} (bạn)` : r.name}</b>
                        <span>
                          {r.me
                            ? `hạng nỗ lực trong ${scope === "class" ? scopeWord : "khối"}` +
                              (myStreak > 0 ? ` · chuỗi ${myStreak} ngày` : "")
                            : `chuỗi ${r.streak} ngày`}
                        </span>
                      </div>
                      <span
                        className="sb-xp num"
                        title={r.me ? (real ? "XP bạn kiếm được tuần này" : "Tổng XP tích luỹ của bạn") : undefined}
                      >
                        {r.xp}
                        <span className="sb-xp-u"> XP</span>
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* Nudge sư tử — câu động TRUNG THỰC theo bảng đang hiện: 0 XP thì
                  mời buổi đầu; còn lại tính đúng số buổi (XP.lessonDone) để vượt */}
              <div className="sb-nudge" data-zero={myXp === 0 || undefined}>
                <Lion mood="idle" size={40} decorative />
                {myXp === 0 ? (
                  <p>
                    Bảng đang chờ buổi học đầu tiên của {firstName} — học <b>1 bài</b> là có XP lên
                    bảng ngay!
                  </p>
                ) : myIdx === 0 || !above ? (
                  <p>
                    Tuyệt vời — {firstName} đang giữ hạng 1! Thêm <b>1 buổi học</b> nữa để giữ vững ngôi
                    đầu tuần này nhé!
                  </p>
                ) : (
                  <p>
                    Thêm <b>{Math.ceil((above.xp - myXp + 1) / G.XP.lessonDone)} buổi học</b> nữa là{" "}
                    {firstName} vượt {above.name} lên hạng {myIdx}!
                  </p>
                )}
              </div>
            </section>

            {/* CỘT PHẢI: nhịp 4DX — dữ liệu thật từ server */}
            <aside className="ws-side">
              <section className="ws-panel">
                <h2 className="ws-panel-title">
                  <Trophy aria-hidden strokeWidth={2.25} />
                  Mục tiêu lớn của {firstName}
                </h2>
                {sb.wigs.length === 0 && <p className="muted">Chưa thiết lập WIG.</p>}
                {sb.wigs.map((w) => (
                  <div className="wig" key={w.area}>
                    <div className="wig-head">
                      <b>
                        {w.areaLabel}: {w.title}
                      </b>
                      <span className="num">{w.progressPct}%</span>
                    </div>
                    {w.targetDesc && (
                      <p className="muted">
                        {w.targetDesc}
                        {w.source === "tutor" ? " · do Tutor theo dõi" : ""}
                      </p>
                    )}
                    <div className="meter" role="progressbar" aria-valuenow={w.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={w.title}>
                      <i style={{ "--p": `${w.progressPct}%` } as React.CSSProperties} />
                    </div>
                  </div>
                ))}
              </section>

              <section className="ws-panel">
                <h2 className="ws-panel-title">
                  <Check aria-hidden strokeWidth={2.25} />
                  Lead measures tuần này
                </h2>
                {sb.leadMeasures.length === 0 && <p className="muted">Chưa có lead measure cho tuần này.</p>}
                {sb.leadMeasures.map((l, i) => (
                  <div className="lead-row" key={i}>
                    <span className="tl" data-status={l.status} aria-hidden />
                    <span className="lead-label">
                      {l.label}
                      {l.targetText && <span className="muted"> · mục tiêu {l.targetText}</span>}
                    </span>
                    <span className="num">{l.valueText}</span>
                  </div>
                ))}
              </section>

              {sb.subjectProgress.length > 0 && (
                <section className="ws-panel">
                  <h2 className="ws-panel-title">
                    <Zap aria-hidden strokeWidth={2.25} />
                    Tiến độ theo môn
                  </h2>
                  <p className="muted">Do Tutor theo dõi tự động.</p>
                  {sb.subjectProgress.map((s) => (
                    <div className="wig" key={s.subject}>
                      <div className="wig-head">
                        <b>{s.subject}</b>
                        <span className="num">{s.pct}%</span>
                      </div>
                      <div className="meter" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label={s.subject}>
                        <i style={{ "--p": `${s.pct}%` } as React.CSSProperties} />
                      </div>
                    </div>
                  ))}
                </section>
              )}

            </aside>
          </div>

          {/* Dải full-width: người đồng hành + cam kết dàn NGANG (bỏ cột dài
              mảnh). Đồng bộ 4DX đã chuyển sang chạy ngầm tự động — không còn
              container. */}
          {(sb.coach || sb.buddy || sb.viewer.self) && (
            <div className="sb-support">
              {(sb.coach || sb.buddy) && (
                <section className="ws-panel">
                  <h2 className="ws-panel-title">
                    <Medal aria-hidden strokeWidth={2.25} />
                    Người đồng hành
                  </h2>
                  <div className="sb-who-grid">
                    {sb.coach && (
                      <div className="sb-who-row">
                        <span className="sb-who-tag" data-role="coach">Coach</span>
                        <div>
                          <p className="who-name">{sb.coach.name ?? "GVCN"}</p>
                          <p className="muted">
                            Họp {sb.coach.cadenceDays >= 28 ? "4 tuần/lần" : `mỗi ${sb.coach.cadenceDays} ngày`}
                            {sb.coach.lastMeetingAt ? ` · gần nhất ${new Date(sb.coach.lastMeetingAt).toLocaleDateString("vi-VN")}` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                    {sb.buddy && (
                      <div className="sb-who-row">
                        <span className="sb-who-tag" data-role="buddy">Buddy</span>
                        <div>
                          <p className="who-name">{sb.buddy.name ?? "Bạn đồng hành"}</p>
                          <p className="muted">
                            Họp hàng tuần
                            {sb.buddy.lastMeetingAt ? ` · gần nhất ${new Date(sb.buddy.lastMeetingAt).toLocaleDateString("vi-VN")}` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {sb.viewer.self && (
                <section className="ws-panel">
                  <h2 className="ws-panel-title">
                    <Check aria-hidden strokeWidth={2.25} />
                    Cam kết tuần tới
                  </h2>
                  <p className="muted">Chính bạn viết, không ai viết hộ.</p>
                  <textarea
                    rows={2}
                    value={commitment}
                    maxLength={280}
                    onChange={(e) => setCommitment(e.target.value)}
                    placeholder={`Ví dụ: "${firstName} cam kết ôn hết thẻ trước Chủ nhật"`}
                    autoCapitalize="sentences"
                  />
                  <button className="btn btn-block" onClick={saveCommit} disabled={savingCommit} data-loading={savingCommit || undefined}>
                    Lưu cam kết
                  </button>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Trang đứng riêng /scoreboard — cửa deep-link, tự gác cổng đăng nhập. */
export default function ScoreboardPage() {
  const { session } = useAuth();

  if (session === undefined) {
    return (
      <AppShell current="scoreboard">
        <div className="stack">
          <div className="skel" style={{ height: 92 }} />
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 120 }} />
        </div>
      </AppShell>
    );
  }
  if (session === null) return <RedirectToLogin />;

  return (
    <AppShell current="scoreboard">
      <ScoreboardBody />
    </AppShell>
  );
}
