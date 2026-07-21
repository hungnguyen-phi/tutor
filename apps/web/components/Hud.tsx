"use client";

import { BookOpen, ChevronDown, Flame, Zap } from "lucide-react";
import { isCold, type Progress } from "../lib/gamify";

/**
 * HUD hi-fi 3a: trái = pill trắng chọn môn (tuỳ chọn), phải = chuỗi ngày · XP.
 * Pills trắng nổi bằng shadow-chip — màu nằm ở icon/số, không ở nền.
 * Hạng nỗ lực không còn ở HUD (hi-fi) — nó sống ở tab Hạng.
 */
export default function Hud({
  progress,
  bump = false,
  subject,
}: {
  progress: Progress;
  bump?: boolean;
  /** Pill chọn môn bên trái (hi-fi). Bỏ trống thì HUD chỉ có 2 chip phải. */
  subject?: { label: string; onClick?: () => void };
}) {
  const cold = isCold(progress);

  return (
    <div className="hud">
      {subject && (
        <button
          type="button"
          className="hud-subject"
          onClick={subject.onClick}
          aria-haspopup={subject.onClick ? "menu" : undefined}
          title={`Môn đang học: ${subject.label}`}
        >
          <BookOpen aria-hidden strokeWidth={2.25} />
          {subject.label}
          <ChevronDown aria-hidden strokeWidth={2.25} className="hud-caret" />
        </button>
      )}

      <span className="hud-spacer" />

      <span
        className={"stat stat-streak" + (cold ? " cold" : "") + (bump ? " bump" : "")}
        title={
          cold
            ? "Chuỗi ngày đã nguội — học hôm nay để bắt đầu lại"
            : `Em đã học ${progress.streak} ngày liên tiếp`
        }
      >
        <Flame className="flame" aria-hidden strokeWidth={2} />
        <span className="num">{progress.streak}</span>
        <span className="sr-only">ngày liên tiếp</span>
      </span>

      <span className="stat stat-xp" title={`${progress.xp} điểm kinh nghiệm`}>
        <Zap aria-hidden strokeWidth={2} />
        <span className="num">{progress.xp}</span>
        <span className="sr-only">điểm kinh nghiệm</span>
      </span>
    </div>
  );
}
