"use client";

/**
 * Mục tiêu (hi-fi 4c) — VIEW dùng trong trang MỘT TRANG /learn.
 *
 * Bản desktop full màn (yêu cầu chủ dự án): nền trắng, hero WIG navy nhấn
 * vàng, lớp bên trong navy + vàng. Thêm 2 khối THẬT: "Cách kiếm XP" (bảng
 * thưởng G.XP) và "Thang hạng nỗ lực" (G.LEAGUES, vị trí hiện tại của bạn).
 *
 * Nhiệm vụ đo NỖ LỰC, không đo năng lực (PRODUCT.md). Mọi con số tính từ dữ
 * liệu thật đang có (XP, chuỗi ngày, số điểm thành thạo); tên chương + hạn WIG
 * nhận qua props từ TutorApp — server chưa trả hạn thì dòng hạn đổi nội dung
 * thật ("mục tiêu học kỳ này"), KHÔNG bịa ngày.
 */

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Flame,
  Medal,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import Lion from "./Lion";
import * as G from "../lib/gamify";

type Quest = {
  key: string;
  Icon: typeof Flame;
  title: string;
  detail: string;
  now: number;
  goal: number;
  unit?: string;
};

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

/** Chỉ tiêu 4DX của trường: 5 buổi/tuần — HẰNG SỐ chính sách, đổi khi có cấu hình server. */
const WEEK_TARGET = 5;

/** Bảng thưởng XP — LẤY THẲNG từ lib/gamify (không bịa số). Thứ tự kể chuyện
 *  sư phạm: đúng → dám thử lại → xong buổi → thành thạo. */
const XP_GUIDE: { key: keyof typeof G.XP; label: string; note: string; Icon: typeof Check }[] = [
  { key: "correct", label: "Trả lời đúng", note: "mỗi câu bạn làm đúng", Icon: Check },
  { key: "persistence", label: "Dám thử lại sau khi sai", note: "nỗ lực luôn được thưởng", Icon: RotateCcw },
  { key: "lessonDone", label: "Hoàn thành một buổi học", note: "học trọn một bài", Icon: BookOpen },
  { key: "nodeMastered", label: "Thành thạo một điểm kiến thức", note: "nắm chắc một điểm", Icon: Sparkles },
];

/** Nửa đêm thứ Hai của tuần hiện tại (giờ địa phương). */
function startOfIsoWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // getDay: 0 = CN
  return d;
}

function studiedDaysThisWeek(p: G.Progress): Set<number> {
  const done = new Set<number>();
  if (!p.lastDay || p.streak === 0) return done;
  const monday = startOfIsoWeek(new Date());
  const last = new Date(`${p.lastDay}T00:00:00`);
  for (let i = 0; i < Math.min(p.streak, 7); i++) {
    const d = new Date(last);
    d.setDate(last.getDate() - i);
    const idx = Math.round((d.getTime() - monday.getTime()) / 86_400_000);
    if (idx >= 0 && idx <= 6) done.add(idx);
  }
  return done;
}

/** Dòng hạn WIG "hạn 20/7 · còn 10 ngày" — tính THẬT từ ISO date server trả. */
function dueLine(iso: string): string {
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "mục tiêu học kỳ này";
  const now = new Date();
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const left = Math.round((due.getTime() - mid.getTime()) / 86_400_000);
  const dm = `hạn ${due.getDate()}/${due.getMonth() + 1}`;
  if (left > 0) return `${dm} · còn ${left} ngày`;
  if (left === 0) return `${dm} · đến hạn hôm nay`;
  return `${dm} · đã quá hạn`;
}

export default function QuestsView({
  onGoLearn,
  wigTitle,
  wigDeadline,
}: {
  onGoLearn?: () => void;
  wigTitle?: string;
  wigDeadline?: string;
}) {
  const [progress, setProgress] = useState<G.Progress | null>(null);
  const [masteredCount, setMasteredCount] = useState(0);

  useEffect(() => {
    setProgress(G.load());
    setMasteredCount(G.loadMastered().length);
  }, []);

  if (!progress) {
    return (
      <div className="ws">
        <div className="skel ws-skel-hero" />
        <div className="ws-skel-stats" aria-hidden>
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
        </div>
        <div className="ws-grid">
          <div className="skel ws-skel-panel" />
          <div className="skel ws-skel-panel" />
        </div>
      </div>
    );
  }

  const league = G.leagueOf(progress.xp);
  const leagueIdx = G.LEAGUES.findIndex((l) => l.name === league.name);
  const studied = G.studiedToday(progress);
  const doneDays = studiedDaysThisWeek(progress);
  const todayIdx = (new Date().getDay() + 6) % 7;

  const wigGoal = 5;
  const wigNow = Math.min(masteredCount, wigGoal);
  const wigPct = Math.round((wigNow / wigGoal) * 100);
  const wigName = wigTitle ?? "Thành thạo 5 điểm kiến thức";

  const quests: Quest[] = [
    {
      key: "today",
      Icon: BookOpen,
      title: "Học một bài hôm nay",
      detail: studied ? "Xong! Chuỗi ngày của bạn vẫn đang cháy." : "Một bài ngắn thôi cũng giữ được chuỗi ngày.",
      now: studied ? 1 : 0,
      goal: 1,
      unit: "bài",
    },
    {
      key: "streak",
      Icon: Flame,
      title: "Giữ chuỗi 7 ngày liên tiếp",
      detail: "Đều đặn thắng chăm chỉ dồn cục — mỗi ngày một chút.",
      now: Math.min(progress.streak, 7),
      goal: 7,
      unit: "ngày",
    },
    ...(league.next !== null
      ? [
          {
            key: "league",
            Icon: Medal,
            title: `Thăng hạng ${G.LEAGUES[leagueIdx + 1]!.name}`,
            detail: "XP cộng cho cả những lần bạn dám thử lại — hạng này đo nỗ lực.",
            now: progress.xp,
            goal: league.next,
            unit: "XP",
          } satisfies Quest,
        ]
      : []),
  ];
  const daily = quests.filter((q) => q.key === "today");
  const longer = quests.filter((q) => q.key !== "today");
  const TINTS = ["gold", "sky", "ok"] as const;

  return (
    <div className="ws">
      {/* HERO = WIG navy nhấn vàng — mục tiêu lớn nhất */}
      <header className="ws-hero">
        <div className="ws-hero-text">
          <span className="ws-kicker">
            <Target aria-hidden strokeWidth={2.5} />
            Mục tiêu lớn · WIG
          </span>
          <h1 className="ws-title">{wigName}</h1>
          <p className="ws-lead">
            Mọi mục tiêu ở đây đo <b>nỗ lực</b> — thứ bạn kiểm soát được — không đo điểm số.
          </p>
          <div className="gl-hero-meter">
            <div
              className="meter meter-onnavy"
              role="progressbar"
              aria-valuenow={wigNow}
              aria-valuemin={0}
              aria-valuemax={wigGoal}
              aria-label={wigName}
            >
              <i style={{ "--p": `${wigPct}%` } as React.CSSProperties} />
            </div>
            <b className="num">{wigPct}%</b>
          </div>
          <span className="ws-hero-chip">
            <CalendarDays aria-hidden strokeWidth={2.25} />
            {wigDeadline ? dueLine(wigDeadline) : "mục tiêu học kỳ này"}
          </span>
        </div>
        <span className="ws-hero-lion" aria-hidden>
          {/* Nhân vật hoá: có học hôm nay thì hãnh diện, chưa thì mời gọi */}
          <Lion mood={studied ? "proud" : "point"} size={132} variant="full" decorative />
        </span>
      </header>

      {/* Dải chỉ số tuần — số THẬT */}
      <div className="ws-stats">
        <div className="ws-stat" data-tone="navy" data-zero={doneDays.size === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <CalendarDays strokeWidth={2.25} />
          </span>
          <b className="num">
            {doneDays.size}/{WEEK_TARGET}
          </b>
          <span>buổi học tuần này</span>
        </div>
        <div className="ws-stat" data-tone="gold" data-zero={progress.streak === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <Flame strokeWidth={2.25} />
          </span>
          <b className="num">{progress.streak}</b>
          <span>ngày liên tiếp</span>
        </div>
        <div className="ws-stat" data-tone="plain" data-zero={progress.xp === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <Zap strokeWidth={2.25} />
          </span>
          <b className="num">{progress.xp.toLocaleString("vi-VN")}</b>
          <span>tổng XP · hạng {league.name}</span>
        </div>
      </div>

      <div className="ws-grid">
        {/* CỘT CHÍNH: nhịp tuần + nhiệm vụ */}
        <section className="ws-panel">
          <h2 className="ws-panel-title">
            <CalendarDays aria-hidden strokeWidth={2.25} />
            Nhịp tuần này
          </h2>
          <div className="week-days gl-week">
            {DAY_LABELS.map((label, i) => {
              const st = doneDays.has(i) ? "done" : i === todayIdx ? "today" : "rest";
              return (
                <div className="week-day" key={label} data-today={i === todayIdx || undefined}>
                  <span className="week-lbl">{label}</span>
                  <span className="day-dot" data-state={st}>
                    {st === "done" && <Check aria-hidden strokeWidth={3} />}
                    {st === "today" && <i aria-hidden />}
                    <span className="sr-only">
                      {st === "done" ? "đã học" : st === "today" ? "hôm nay, chưa học" : "chưa học"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="goals-group">
            <span className="eyebrow">Nhiệm vụ hôm nay</span>
            <ul className="tasks">
              {daily.map((q, i) => (
                <TaskRow key={q.key} q={q} tint={TINTS[i % 3]!} xp={G.XP.lessonDone} />
              ))}
            </ul>
          </div>

          <div className="goals-group">
            <span className="eyebrow">Mục tiêu dài hơn</span>
            <ul className="tasks">
              {longer.map((q, i) => (
                <TaskRow key={q.key} q={q} tint={TINTS[(i + 1) % 3]!} />
              ))}
            </ul>
          </div>

          {!studied && (
            <a
              className="btn btn-block"
              href="/learn/"
              onClick={(e) => {
                if (!onGoLearn) return;
                e.preventDefault();
                onGoLearn();
              }}
              style={{ marginTop: 16 }}
            >
              Học bài hôm nay
              <ArrowRight aria-hidden strokeWidth={2} />
            </a>
          )}
        </section>

        {/* CỘT PHẢI: cách kiếm XP + thang hạng — dữ liệu thật */}
        <aside className="ws-side">
          <section className="ws-panel">
            <h2 className="ws-panel-title">
              <Zap aria-hidden strokeWidth={2.25} />
              Cách kiếm XP
            </h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              XP thưởng cho <b>nỗ lực</b> — kể cả khi bạn thử lại sau lúc sai.
            </p>
            <ul className="gl-xp">
              {XP_GUIDE.map(({ key, label, note, Icon }) => (
                <li className="gl-xp-row" key={key}>
                  <span className="gl-xp-ico" aria-hidden>
                    <Icon strokeWidth={2.25} />
                  </span>
                  <div className="gl-xp-body">
                    <b>{label}</b>
                    <span className="muted">{note}</span>
                  </div>
                  <span className="gl-xp-amt num">+{G.XP[key]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ws-panel">
            <h2 className="ws-panel-title">
              <Trophy aria-hidden strokeWidth={2.25} />
              Thang hạng nỗ lực
            </h2>
            <ul className="gl-ladder">
              {G.LEAGUES.map((l, i) => {
                const state = i < leagueIdx ? "past" : i === leagueIdx ? "current" : "future";
                return (
                  <li className="gl-rung" key={l.name} data-state={state}>
                    <span className="gl-rung-ico" aria-hidden>
                      <Medal strokeWidth={2.25} />
                    </span>
                    <b className="gl-rung-name">{l.name}</b>
                    <span className="gl-rung-min num">
                      {l.min === 0 ? "khởi đầu" : `${l.min.toLocaleString("vi-VN")} XP`}
                    </span>
                    {state === "current" && <span className="gl-rung-you">bạn ở đây</span>}
                  </li>
                );
              })}
            </ul>
            {league.next !== null && (
              <p className="muted gl-ladder-foot">
                Còn <b>{(league.next - progress.xp).toLocaleString("vi-VN")} XP</b> nữa tới hạng kế
                tiếp. Hạng đo nỗ lực, không đo điểm.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Một hàng nhiệm vụ. */
function TaskRow({ q, tint, xp }: { q: Quest; tint: "gold" | "sky" | "ok"; xp?: number }) {
  const { Icon } = q;
  const done = q.now >= q.goal;
  const partial = !done && q.now > 0;
  return (
    <li className="task-row" data-done={done || undefined}>
      <span className="task-ico" data-tint={tint} aria-hidden>
        {done ? <Check strokeWidth={2.5} /> : <Icon strokeWidth={2} />}
      </span>
      <div className="task-body">
        <b>
          {done && <span className="sr-only">Đã xong: </span>}
          {q.title}
        </b>
        {partial ? (
          <span className="task-meter">
            <span
              className="meter"
              role="progressbar"
              aria-valuenow={q.now}
              aria-valuemin={0}
              aria-valuemax={q.goal}
              aria-label={q.title}
            >
              <i style={{ "--p": `${Math.min(100, (q.now / q.goal) * 100)}%` } as React.CSSProperties} />
            </span>
            <b className="num">
              {q.now}/{q.goal}
              {q.unit ? ` ${q.unit}` : ""}
            </b>
          </span>
        ) : (
          <span className="task-sub">{q.detail}</span>
        )}
      </div>
      <span className="task-xp num">{xp != null ? `+${xp} XP` : "nỗ lực"}</span>
    </li>
  );
}
