"use client";

/**
 * Bảng tuần — xếp theo NỖ LỰC (XP tuần), không theo điểm số.
 *
 * PRODUCTION: KHÔNG còn dữ liệu mẫu. Mọi con số là THẬT từ server
 * (`getScoreboard`, bảng student_xp/xp_events, hàm award_xp):
 *   • Hai bảng thật: `classBoard` (bạn cùng LỚP) + `board` (bạn cùng KHỐI) —
 *     mỗi hàng là XP TUẦN + chuỗi ngày thật; chuỗi "nguội" server đã ẩn.
 *   • Tổng XP tích luỹ + chuỗi: từ `xp` (student_xp) — KHÔNG đọc localStorage.
 *   • Bảng nào server không đủ người thật → null: UI degrade trung thực (ẩn tab,
 *     hoặc hiện lời mời cold-start), tuyệt đối không bịa bạn học.
 * Các khối 4DX (WIG, lead measures, coach/buddy, cam kết, đồng bộ) nằm cột phải.
 *
 * `ScoreboardBody` = THÂN bảng, dùng làm tab Hạng trong trang MỘT TRANG /learn
 * (TutorApp đã gác đăng nhập). Default export = trang đứng riêng /scoreboard.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Flame, Hourglass, Medal, Sparkles, Trophy, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { getScoreboard, commitScoreboard, syncScoreboard, type BoardView, type Scoreboard } from "../lib/api";
import AppShell from "./AppShell";
import RedirectToLogin from "./RedirectToLogin";
import Lion from "./Lion";
import * as G from "../lib/gamify";
import * as Prefs from "../lib/prefs";

/** Tint avatar xoay vòng cho bạn học (hàng của mình luôn vàng riêng). */
const AVA_TINTS = ["sky", "ok", "mane", "navy"] as const;

/** Số ngày còn lại của tuần ISO, tính cả hôm nay — suy từ Date, không cần API. */
function daysLeftInWeek(): number {
  const dow = new Date().getDay(); // 0 = CN
  return dow === 0 ? 1 : 8 - dow;
}

export function ScoreboardBody({ onGoLearn }: { onGoLearn?: () => void } = {}) {
  const { profile } = useAuth();
  const [sb, setSb] = useState<Scoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitment, setCommitment] = useState("");
  const [savingCommit, setSavingCommit] = useState(false);
  // Tab bảng đang xem — "lop" | "khoi". Mặc định Lớp khi có bảng lớp thật.
  const [tab, setTab] = useState<"lop" | "khoi">("khoi");
  // Đếm lần thử — nút "Thử lại" trong banner lỗi tăng số này để gọi lại API.
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setError(null);
    getScoreboard()
      .then((d) => {
        setSb(d);
        setCommitment(d.commitment ?? "");
        // Mở tab có XP để không rơi vào bảng "nguội" khi bảng kia đang "ấm".
        const cXp = d.classBoard?.rows.some((r) => r.xp > 0);
        const gXp = d.board?.rows.some((r) => r.xp > 0);
        setTab(cXp ? "lop" : gXp ? "khoi" : d.classBoard && d.classBoard.rows.length > 0 ? "lop" : "khoi");
        // XP server → đồng bộ cache máy cho các màn khác đọc nhanh. KHÔNG dùng
        // cache này làm nguồn cho bảng — bảng đọc thẳng số server bên dưới.
        if (d.xp) G.syncFromServer(d.xp);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tries]);

  // Đồng bộ 4DX TỰ ĐỘNG, ngầm (yêu cầu chủ dự án: bỏ nút, tự cập nhật). Chạy
  // một lần sau khi bảng nạp xong, chỉ khi người xem được phép ghi (self/staff);
  // mọi lỗi im lặng — 4DX chưa sẵn sàng không được chặn bảng tuần.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!sb || syncedRef.current) return;
    if (!(sb.viewer.self || sb.viewer.staff)) return;
    syncedRef.current = true;
    syncScoreboard()
      .then((r) => setSb((s) => (s ? { ...s, sync: { syncedAt: r.syncedAt } } : s)))
      .catch(() => {
        /* 4DX chưa sẵn sàng */
      });
  }, [sb]);

  // Tên hiển thị: override cục bộ (Cài đặt) thắng tên server.
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

  // ── Nguồn số THẬT (server-authoritative) ─────────────────────────────────
  const myTotalXp = sb?.xp?.total ?? 0; // tổng XP tích luỹ (student_xp)
  const serverStreak = sb?.xp?.streak ?? 0; // chuỗi ngày (student_xp)

  // Hai bảng THẬT (self/staff mới có). Rỗng/không có → null, KHÔNG bịa mẫu.
  const classBoard: BoardView | null =
    sb?.classBoard && sb.classBoard.rows.length > 0 ? sb.classBoard : null;
  const gradeBoard: BoardView | null =
    sb?.board && sb.board.rows.length > 0 ? sb.board : null;
  const hasClass = !!classBoard;
  const hasGrade = !!gradeBoard;
  const classHasXp = !!classBoard?.rows.some((r) => r.xp > 0);
  const gradeHasXp = !!gradeBoard?.rows.some((r) => r.xp > 0);
  // COLD-START (lời mời toàn màn) CHỈ khi KHÔNG bảng nào có XP — để một lớp
  // "nguội" không che mất bảng khối đang "ấm" (và giữ được nút chuyển bảng).
  const coldStart = !classHasXp && !gradeHasXp;

  // Bảng đang xem theo tab; nếu tab Lớp không có thì rơi về Khối (và ngược lại).
  const activeBoard: BoardView | null =
    tab === "lop" ? classBoard ?? gradeBoard : gradeBoard ?? classBoard;
  const scopeWord = activeBoard?.scope === "lop" ? "lớp" : "khối";
  const boardRows = activeBoard?.rows ?? [];

  const myIdx = boardRows.findIndex((r) => r.me);
  const myRow = myIdx >= 0 ? boardRows[myIdx]! : null;
  const myWeekXp = myRow?.xp ?? 0;
  // Chuỗi: từ bảng (đã ẩn nguội) khi có, không thì student_xp.
  const myStreak = myRow?.streak ?? serverStreak;
  // Hạng chỉ có nghĩa khi mình đã có XP tuần này — 0 XP thì hiện "–", không
  // khoe "#1" giả (đúng lỗi cũ: đứng nhất khi chưa học buổi nào).
  const myRank = myWeekXp > 0 && myIdx >= 0 ? myIdx + 1 : null;
  const above = myIdx > 0 ? boardRows[myIdx - 1]! : null;

  // Hàng HIỂN THỊ: top 50 người CÓ XP + LUÔN có chính mình (kể cả 0 XP). Cắt đuôi
  // 0-XP để bảng không bị độn hàng chục dòng "0 XP" (misrepresent nỗ lực).
  const topRows = boardRows.filter((r) => r.xp > 0).slice(0, 50);
  const displayRows =
    myRow && !topRows.some((r) => r.me) ? [...topRows, myRow] : topRows;

  // Cột phải 4DX — dữ liệu thật từ server (dùng cho cả cold-start).
  const sideContent = (
    <>
      <section className="ws-panel">
        <h2 className="ws-panel-title">
          <Trophy aria-hidden strokeWidth={2.25} />
          Mục tiêu lớn của {firstName}
        </h2>
        {sb && sb.wigs.length === 0 && <p className="muted">Chưa thiết lập WIG.</p>}
        {sb?.wigs.map((w) => (
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
        {sb && sb.leadMeasures.length === 0 && <p className="muted">Chưa có lead measure cho tuần này.</p>}
        {sb?.leadMeasures.map((l, i) => (
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

      {sb && sb.subjectProgress.length > 0 && (
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
    </>
  );

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
          {/* Dải chỉ số THẬT của chính bạn: hạng · tổng XP · chuỗi ngày */}
          <div className="ws-stats">
            <div className="ws-stat" data-tone="navy" data-zero={myRank == null || undefined}>
              <span className="ws-stat-ico" aria-hidden>
                <Medal strokeWidth={2.25} />
              </span>
              {/* Nhãn NGẮN để không xuống 2 dòng trên điện thoại; "nỗ lực" đã do
                  chip hero nói rồi, không cần nhắc trong từng ô. */}
              <b className="num">{myRank != null ? `#${myRank}` : "–"}</b>
              <span>hạng {scopeWord}</span>
            </div>
            <div className="ws-stat" data-tone="gold" data-zero={myTotalXp === 0 || undefined}>
              <span className="ws-stat-ico" aria-hidden>
                <Zap strokeWidth={2.25} />
              </span>
              <b className="num">{myTotalXp}</b>
              <span>tổng XP</span>
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
            {/* CỘT CHÍNH: bảng xếp hạng THẬT — hoặc lời mời khi chưa ai có XP */}
            <section className="ws-panel sb-board">
              {coldStart ? (
                /* COLD-START: chưa ai trong bảng có XP tuần này. Thay danh sách
                   vắng bằng lời mời đầy đặn — cân với cột phải, không để trống. */
                <div className="sb-cold">
                  {/* KHÔNG lặp sư tử: hero ngay trên đã có đúng tư thế này (excited
                      132px). Một màn — một sư tử (DESIGN.md: "không rải sư tử lên
                      mọi góc"). */}
                  <h2 className="sb-cold-title">
                    Bảng tuần đang chờ buổi học đầu tiên của {firstName}
                  </h2>
                  {/* Bỏ "Xếp theo nỗ lực, không theo điểm số" — chip ở hero đã nói
                      nguyên văn câu đó rồi. */}
                  <p className="sb-cold-lead">
                    Học <b>1 bài</b> hôm nay là {firstName} có tên trên bảng {scopeWord} ngay — ai quay
                    lại đều đặn đều lên hạng được.
                  </p>
                  {/* GỠ danh sách 3 gạch đầu dòng giảng luật chơi (XP mỗi buổi học,
                      giữ chuỗi ngày, bảng làm mới hàng tuần): màn RỖNG không phải
                      chỗ dạy cơ chế — tab Mục tiêu đã có bảng "Cách kiếm XP" đầy
                      đủ. Ở đây chỉ cần một câu và một lối ra. */}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => (onGoLearn ? onGoLearn() : (window.location.href = "/learn/"))}
                  >
                    <Sparkles aria-hidden strokeWidth={2.25} />
                    Bắt đầu học ngay
                  </button>
                </div>
              ) : (
                <>
                  <div className="ws-panel-head">
                    {hasClass && hasGrade ? (
                      /* Cả hai bảng thật → segmented Lớp / Khối, cùng XP tuần. */
                      <div className="sb-scope" role="radiogroup" aria-label="Phạm vi bảng xếp hạng">
                        <button type="button" role="radio" aria-checked={tab === "lop"} onClick={() => setTab("lop")}>
                          {classBoard?.label ?? "Lớp"}
                        </button>
                        <button type="button" role="radio" aria-checked={tab === "khoi"} onClick={() => setTab("khoi")}>
                          {gradeBoard?.label ?? "Khối"}
                        </button>
                      </div>
                    ) : (
                      /* Chỉ một bảng thật → nhãn tĩnh, không tab giả. */
                      <span className="sb-scope-one">{activeBoard?.label ?? "Bảng tuần"}</span>
                    )}
                    <span className="sb-caption">XP tuần này</span>
                  </div>

                  <ol className="sb-list" aria-label={`Bảng xếp hạng nỗ lực ${scopeWord} — XP tuần này`}>
                    {displayRows.map((r, i) => {
                      // Hạng THẬT = vị trí trong bảng đầy đủ (không phải vị trí sau khi cắt).
                      const trueRank = boardRows.indexOf(r) + 1;
                      const letter = r.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "?";
                      const showNum = r.xp > 0; // 0 XP → chưa xếp hạng (không huy chương)
                      const podium = !r.me && showNum && trueRank <= 3;
                      return (
                        <li className={r.me ? "sb-row me" : "sb-row"} key={r.id}>
                          <span
                            className="sb-rank num"
                            data-podium={podium ? trueRank : undefined}
                            data-unranked={showNum ? undefined : true}
                            aria-label={showNum ? `Hạng ${trueRank}` : "Chưa xếp hạng"}
                          >
                            {podium ? <Medal aria-hidden strokeWidth={2.5} /> : showNum ? trueRank : "–"}
                          </span>
                          <span className="sb-ava" data-tint={r.me ? "gold" : AVA_TINTS[i % AVA_TINTS.length]} aria-hidden>
                            {letter}
                          </span>
                          <div className="sb-who">
                            <b>{r.me ? `${r.name} (bạn)` : r.name}</b>
                            <span>
                              {r.me
                                ? (showNum ? `hạng nỗ lực trong ${scopeWord}` : "chưa có XP tuần này") +
                                  (r.streak > 0 ? ` · chuỗi ${r.streak} ngày` : "")
                                : `chuỗi ${r.streak} ngày`}
                            </span>
                          </div>
                          <span className="sb-xp num" title={r.me ? "XP bạn kiếm được tuần này" : undefined}>
                            {r.xp}
                            <span className="sb-xp-u"> XP</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  {/* Nudge sư tử — câu động TRUNG THỰC theo bảng đang hiện */}
                  <div className="sb-nudge" data-zero={myWeekXp === 0 || undefined}>
                    <Lion mood="idle" size={40} decorative />
                    {myWeekXp === 0 ? (
                      <p>
                        Học <b>1 bài</b> tuần này là {firstName} có XP lên bảng {scopeWord} ngay!
                      </p>
                    ) : myIdx === 0 || !above ? (
                      <p>
                        Tuyệt vời — {firstName} đang giữ hạng 1! Thêm <b>1 buổi học</b> nữa để giữ vững ngôi
                        đầu tuần này nhé!
                      </p>
                    ) : (
                      <p>
                        Thêm <b>{Math.ceil((above.xp - myWeekXp + 1) / G.XP.lessonDone)} buổi học</b> nữa là{" "}
                        {firstName} vượt {above.name} lên hạng {myIdx}!
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* CỘT PHẢI: nhịp 4DX — dữ liệu thật từ server */}
            <aside className="ws-side">{sideContent}</aside>
          </div>

          {/* Dải full-width: người đồng hành + cam kết dàn NGANG. */}
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
