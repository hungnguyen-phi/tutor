"use client";

import Lion from "./Lion";
import type { Progress } from "../lib/gamify";
import { useCountUp, useGrow } from "../lib/anim";
import { pickTip, KIND_LABEL } from "../lib/nudges";

/**
 * CỘT PHẢI màn Học: bảng tuần · nhiệm vụ · câu nhắc đổi gió.
 *
 * Ở FILE RIÊNG, đừng nhập lại vào TutorApp — ba lý do:
 *  1. Nó cần hook (đếm số, chạy thanh) mà chỗ render nó trong TutorApp nằm SAU
 *     mấy nhánh `return` sớm (`if (!ses)`, `if (view !== "learn")`…) — gọi hook
 *     ở đó là phạm luật thứ tự hook của React.
 *  2. `/demo` dùng CHÍNH component này để xem trước. Nếu nó nằm trong
 *     TutorApp.tsx thì /demo phải kéo theo cả api client + auth + katex.
 *  3. Số/thanh ở đây phải CHẢY chứ không đập cứng (chủ dự án 30/07).
 */
export default function LearnAside({
  board,
  progress,
  leagueProgress,
  nextLeague,
  studied,
  firstName,
  rot,
  onSeeAll,
}: {
  /* Khuôn HẸP thay vì `Scoreboard` đầy đủ: cột này chỉ đọc hạng nỗ lực + tổng
     XP, khai cả interface 20 trường thì /demo phải bịa ra 20 trường vô nghĩa
     mới xem trước được. Scoreboard thật khớp khuôn này về cấu trúc. */
  board: { effort: { rank: number | null }; xp?: { total: number } | null } | null;
  progress: Progress;
  /** 0..1 — phần đường đã đi tới hạng kế tiếp. */
  leagueProgress: number;
  nextLeague: { name: string; min: number } | null;
  studied: boolean;
  firstName?: string;
  /** Bộ đếm xoay vòng câu nhắc (lib/nudges). */
  rot: number;
  onSeeAll: () => void;
}) {
  const boardXp = board?.xp?.total ?? progress.xp;
  const boardXpShown = useCountUp(boardXp, { duration: 1200, delay: 320 });
  const todayPct = useGrow(studied ? 100 : 0, { delay: 220 });
  const leaguePct = useGrow(Math.round(leagueProgress * 100), { delay: 360 });
  const xpShown = useCountUp(progress.xp, { duration: 1200, delay: 360 });
  const tip = pickTip(rot);

  return (
    <aside className="learn-aside" aria-label="Bảng tin học tập">
      {/* Bảng tuần mini: HẠNG là số server-authoritative (board.effort.rank
          — server chấm theo nỗ lực thật), một hàng "của bạn" nền gold;
          danh sách đầy đủ nằm ở /scoreboard. XP kề bên (progress.xp) hiện
          CÒN là cache máy (lib/gamify) — chỉ để so cảm giác, chưa phải số
          so kè; đổi sang XP server khi có endpoint (xem TODO ở gamify.ts). */}
      {board && board.effort.rank != null && (
        <section className="aside-card">
          <div className="aside-head">
            <b>Bảng tuần</b>
            {/* Chuyển view tại chỗ — không rời trang */}
            <button type="button" className="aside-link" onClick={onSeeAll}>
              xem tất cả
            </button>
          </div>
          <div className="board-row" data-me="true">
            <span className="board-rank num">{board.effort.rank}</span>
            <span className="board-ava" aria-hidden>
              {(firstName ?? "E").charAt(0).toUpperCase()}
            </span>
            <span className="board-name">{firstName ?? "Em"} (bạn)</span>
            {/* Tổng XP server-authoritative (student_xp) — cache máy chỉ là dự phòng.
                aria-hidden vì số đang đếm; câu đầy đủ nằm ở sr-only kế bên. */}
            <span className="board-xp num" aria-hidden>
              {boardXpShown}
            </span>
            <span className="sr-only">{boardXp} điểm kinh nghiệm</span>
          </div>
        </section>
      )}

      <section className="aside-card">
        <div className="aside-head">
          <b>Nhiệm vụ</b>
        </div>
        <div className="aside-quest" data-done={studied || undefined}>
          <div className="aside-quest-head">
            <span>Học hôm nay</span>
            <b className="num">{studied ? 1 : 0}/1</b>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-valuenow={studied ? 1 : 0}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-label="Học hôm nay"
          >
            <i data-fill="navy" style={{ "--p": `${todayPct}%` } as React.CSSProperties} />
          </div>
        </div>
        {nextLeague && (
          <div className="aside-quest">
            <div className="aside-quest-head">
              <span>Thăng hạng {nextLeague.name}</span>
              <b className="num" aria-hidden>
                {xpShown}/{nextLeague.min} XP
              </b>
            </div>
            <div
              className="meter"
              role="progressbar"
              aria-valuenow={progress.xp}
              aria-valuemin={0}
              aria-valuemax={nextLeague.min}
              aria-label={`Thăng hạng ${nextLeague.name}: ${progress.xp} trên ${nextLeague.min} XP`}
            >
              <i style={{ "--p": `${leaguePct}%` } as React.CSSProperties} />
            </div>
          </div>
        )}
      </section>

      {/* Câu nhắc ĐỔI GIÓ: ca dao / tục ngữ / ngụ ngôn / châm ngôn, xoay vòng mỗi
          lần mở app (lib/nudges.ts). `key` để thẻ remount → chạy lại hiện vào. */}
      <section className="aside-tip" key={tip.text}>
        <Lion mood="point" size={56} decorative />
        <div className="aside-tip-body">
          <p>{tip.text}</p>
          <span className="aside-tip-kind">{KIND_LABEL[tip.kind]}</span>
        </div>
      </section>
    </aside>
  );
}
