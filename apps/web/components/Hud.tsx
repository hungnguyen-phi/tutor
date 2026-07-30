"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Flame, Zap } from "lucide-react";
import { isCold, type Progress } from "../lib/gamify";
import { useCountUp, useGain } from "../lib/anim";

/**
 * HUD hi-fi 3a: trái = pill trắng chọn môn (tuỳ chọn), phải = chuỗi ngày · XP.
 * Pills trắng nổi bằng shadow-chip — màu nằm ở icon/số, không ở nền.
 * Hạng nỗ lực không còn ở HUD (hi-fi) — nó sống ở tab Hạng.
 *
 * SỐNG (30/07): số XP/chuỗi CHẢY từ 0 lên khi vào màn (useCountUp) chứ không
 * đập cứng ra; XP vừa cộng thì chip loé + bay chip "+N" (useGain). Lửa liu riu
 * cháy sẵn trong CSS — chuỗi nguội thì tắt (class `cold`).
 */
export default function Hud({
  progress,
  bump = false,
  justEarned = 0,
  subject,
}: {
  progress: Progress;
  bump?: boolean;
  /**
   * XP vừa kiếm được ở buổi học VỪA XONG — để chip loé + bay "+N" lúc em quay
   * về lộ trình.
   *
   * ⚠️ Vì sao cần prop này mà không chỉ dò `progress.xp` tăng: HUD KHÔNG có mặt
   * trong buổi học (màn bài học dùng `.lesson-bar` riêng), nên nó unmount lúc
   * XP thật sự được cộng rồi mount lại với số đã tăng sẵn. Chỉ dò thay đổi thì
   * hiệu ứng "sét XP" không bao giờ nổ — đúng cái chủ dự án báo 30/07.
   */
  justEarned?: number;
  /** Pill chọn môn bên trái (hi-fi). Bỏ trống thì HUD chỉ có 2 chip phải. */
  subject?: { label: string; onClick?: () => void };
}) {
  const cold = isCold(progress);
  // Chuỗi ngày đếm nhanh hơn XP: số nhỏ (6 ngày) mà đếm 900ms thì lừ đừ.
  const streakShown = useCountUp(progress.streak, { duration: 520, delay: 120 });
  const xpShown = useCountUp(progress.xp, { duration: 1100, delay: 220 });
  const xpGain = useGain(progress.xp);

  // Ăn mừng lúc VỪA VỀ từ buổi học. Chờ số đếm xong (delay 220 + 1100ms) mới
  // loé, kẻo chip nảy trong lúc chữ số còn đang chạy — hai chuyển động chồng
  // nhau ở cùng một chỗ thì thành nhoè, không ra "được thưởng".
  const [entryPop, setEntryPop] = useState(0);
  useEffect(() => {
    if (justEarned <= 0) return;
    const on = window.setTimeout(() => setEntryPop(justEarned), 1200);
    const off = window.setTimeout(() => setEntryPop(0), 2500);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [justEarned]);

  // Sét XP nổ vì một trong hai lẽ: vừa về từ buổi học, hoặc XP tăng ngay trước
  // mắt (đồng bộ lại từ server khi đang ở lộ trình).
  const pop = xpGain.gain || entryPop;
  const hot = xpGain.hot || entryPop > 0;

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
        {/* aria-hidden + sr-only bên dưới: máy đọc không đọc số đang ĐẾM (đọc
            từng nhịp là ồn), nó đọc câu đầy đủ ở cuối. */}
        <span className="num" aria-hidden>
          {streakShown}
        </span>
        <span className="sr-only">{progress.streak} ngày liên tiếp</span>
      </span>

      <span className={"stat stat-xp" + (hot ? " gain" : "")} title={`${progress.xp} điểm kinh nghiệm`}>
        <Zap aria-hidden strokeWidth={2} />
        <span className="num" aria-hidden>
          {xpShown}
        </span>
        <span className="sr-only">{progress.xp} điểm kinh nghiệm</span>
        {/* Chip "+N" bay lên rồi tan — nói cho em biết vừa được cộng bao nhiêu.
            aria-hidden: ribbon trong bài đã xướng số XP bằng lời rồi. */}
        {pop > 0 && (
          <span className="stat-pop num" aria-hidden>
            +{pop}
          </span>
        )}
      </span>
    </div>
  );
}
