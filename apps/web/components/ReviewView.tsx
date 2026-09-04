"use client";

/**
 * Ôn tập — hộp Leitner của bạn (VIEW dùng trong trang MỘT TRANG /learn).
 *
 * VIẾT LẠI 29/07 (lỗi 3). Trước đây view này đọc `localStorage` va-tutor-mastered,
 * mà khoá đó CHỈ được ghi khi học sinh kết thúc TRỌN một buổi học — thoát giữa
 * chừng hay đổi máy là "Chưa có gì để ôn" vĩnh viễn, dù server đang giữ 3 điểm
 * đã thành thạo. Giờ đọc THẲNG hàng đợi server (`review-queue`), vốn dựa trên
 * `student_node_state.next_review_at` mà end-session đã ghi từ lâu.
 *
 * Ba rổ, đúng như hộp Leitner vận hành:
 *   ĐẾN HẠN  — ôn ngay hôm nay (quá hạn lâu nhất đứng trước)
 *   SẮP TỚI  — chưa tới hạn, NÓI RÕ còn mấy ngày (không nói "chưa có gì")
 *   NHỚ BỀN  — đã leo tới hộp cao nhất (21 ngày)
 *
 * `onGoLearn`: trong chế độ một trang → chuyển view tại chỗ; `onReview` mở thẳng
 * một buổi ôn cho đúng bài (TutorApp gọi diagnose theo nodeKey). `onReviewWrong`
 * (chốt 03/09) mở BỘ ÔN SAI TỔNG HỢP — không phải một bài, mà đúng các CÂU học
 * sinh từng làm sai (mọi bài của môn), gom lại cho làm lại một lượt.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpenCheck, Flame, ListChecks, RotateCcw, Sparkles, Target } from "lucide-react";
import Lion from "./Lion";
import Num from "./Num";
import * as G from "../lib/gamify";
import { reviewQueue, type ReviewItem, type ReviewQueue, type Subject } from "../lib/api";

/** Hộp Leitner: mỗi lần nhớ đúng, điểm kiến thức leo lên hộp xa hơn — khoảng
 *  cách ôn giãn dần 1 · 3 · 7 · 21 ngày (khớp LEITNER_DAYS ở server). */
const LEITNER = [
  { days: "1 ngày", label: "Vừa học xong", tone: "sky" as const },
  { days: "3 ngày", label: "Nhớ đúng 1 lần", tone: "navy" as const },
  { days: "7 ngày", label: "Nhớ đúng nhiều lần", tone: "gold" as const },
  { days: "21 ngày", label: "Đã nhớ bền", tone: "gold" as const },
];

/** "hôm nay" / "ngày mai" / "3 ngày nữa" — người đọc hiểu ngay, không cần ISO. */
function whenText(days: number, overdue: boolean): string {
  if (overdue) return days <= 0 ? "đến hạn hôm nay" : `quá hạn ${days} ngày`;
  if (days <= 0) return "hôm nay";
  if (days === 1) return "ngày mai";
  return `${days} ngày nữa`;
}

export default function ReviewView({
  subject,
  onGoLearn,
  onReview,
  onReviewWrong,
}: {
  subject?: Subject;
  onGoLearn?: () => void;
  /** Ôn một bài cụ thể — mở buổi học đúng node đó. */
  onReview?: (nodeKey: string, label: string) => void;
  /** Bộ ôn sai tổng hợp — không gắn với một node cụ thể. */
  onReviewWrong?: () => void;
}) {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [progress, setProgress] = useState<G.Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setProgress(G.load());
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    reviewQueue(subject)
      .then((r) => {
        if (alive) setQueue(r);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [subject, tries]);

  const goLearn = (e: React.MouseEvent) => {
    if (!onGoLearn) return; // để <a> điều hướng như thường
    e.preventDefault();
    onGoLearn();
  };

  if ((queue === null && !error) || progress === null) {
    return (
      <div className="ws" data-world="1">
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

  const due = queue?.due ?? [];
  const soon = queue?.soon ?? [];
  const strong = queue?.strong ?? [];
  const total = queue?.total ?? 0;
  // RỖNG THẬT = chưa thành thạo bài nào. Khác hẳn "hôm nay chưa tới hạn" —
  // hai chuyện này trước đây bị gộp thành cùng một câu "Chưa có gì để ôn".
  // LỖI TẢI cũng KHÔNG phải rỗng: `queue` là null thì tuyệt đối không được nói
  // "bạn chưa thành thạo bài nào" — đó là nói sai về chính công sức của em.
  const nothingYet = !!queue && total === 0;
  const restingToday = total > 0 && due.length === 0;

  const card = (it: ReviewItem, overdue: boolean) => (
    <li key={it.key} className="rv-card">
      <span className="rv-card-ico" aria-hidden>
        <BookOpenCheck strokeWidth={2.25} />
      </span>
      <span className="rv-card-body">
        <span className="rv-card-name">{it.label}</span>
        <small className="rv-card-when" data-overdue={overdue || undefined}>
          {whenText(it.days, overdue)}
          {it.chapter ? ` · ${it.chapter}` : ""}
        </small>
      </span>
      {onReview ? (
        <button
          type="button"
          className="rv-card-btn"
          onClick={() => onReview(it.key, it.label)}
          aria-label={`Ôn lại ${it.label}`}
          title={`Ôn lại ${it.label}`}
        >
          <RotateCcw aria-hidden strokeWidth={2.25} />
        </button>
      ) : (
        <a className="rv-card-btn" href="/learn/" onClick={goLearn} aria-label={`Ôn lại ${it.label}`}>
          <RotateCcw aria-hidden strokeWidth={2.25} />
        </a>
      )}
    </li>
  );

  return (
    <div className="ws" data-world="1">
      {/* HERO — chữ navy trên trời, sư tử trên cỏ (04/09) */}
      <header className="ws-hero">
        <div className="ws-hero-text">
          <span className="ws-kicker">
            <RotateCcw aria-hidden strokeWidth={2.5} />
            Ôn tập theo trí nhớ
          </span>
          <h1 className="ws-title">Giữ lại những gì bạn đã học</h1>
          <p className="ws-lead">
            Kiến thức chỉ ở lại khi được gặp lại. Mỗi lượt ôn ngắn hôm nay giúp bạn nhớ lâu gấp nhiều
            lần — mình lo phần lịch, bạn chỉ cần ghé qua.
          </p>
        </div>
        <span className="ws-hero-lion" aria-hidden>
          <Lion mood={nothingYet ? "sleepy" : due.length > 0 ? "point" : "proud"} size={132} variant="full" decorative eager />
        </span>
      </header>

      {error && (
        <div className="banner err">
          <AlertTriangle aria-hidden strokeWidth={2} />
          <span>Chưa đọc được lịch ôn — {error}</span>
          <button
            type="button"
            className="banner-retry"
            onClick={() => {
              setQueue(null);
              setTries((t) => t + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Dải chỉ số THẬT: đến hạn hôm nay · đã thành thạo · chuỗi ngày */}
      <div className="ws-stats">
        <div className="ws-stat" data-tone="gold" data-zero={due.length === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <Target strokeWidth={2.25} />
          </span>
          <Num value={due.length} />
          <span>cần ôn hôm nay</span>
        </div>
        <div className="ws-stat" data-tone="navy" data-zero={total === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <BookOpenCheck strokeWidth={2.25} />
          </span>
          <Num value={total} delay={120} />
          <span>đã thành thạo</span>
        </div>
        <div className="ws-stat" data-tone="plain" data-zero={progress.streak === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <Flame strokeWidth={2.25} />
          </span>
          <Num value={progress.streak} delay={240} />
          <span>ngày liên tiếp</span>
        </div>
      </div>

      {/* Bộ ôn sai tổng hợp — độc lập với hộp Leitner ở dưới (đó ôn theo NODE
          tới hạn, đây ôn đúng các CÂU từng sai, không chờ tới hạn). */}
      {onReviewWrong && (
        <button type="button" className="rv-wrongpack" onClick={onReviewWrong}>
          <span className="rv-wrongpack-ico" aria-hidden>
            <ListChecks strokeWidth={2.25} />
          </span>
          <span className="rv-wrongpack-body">
            <b>Làm lại các câu từng sai</b>
            <small>Gom một bộ tổng hợp — làm ĐÚNG câu nào, câu đó biến mất khỏi lần sau.</small>
          </span>
          <ArrowRight aria-hidden strokeWidth={2} />
        </button>
      )}

      {!queue ? (
        /* Không đọc được lịch (mạng/hàm chưa deploy) — banner lỗi ở trên đã nói.
           Ở đây KHÔNG vẽ gì thêm, tuyệt đối không hiện "chưa có gì để ôn". */
        null
      ) : nothingYet ? (
        /* RỖNG THẬT — chưa thành thạo bài nào. Một câu + một nút. */
        <section className="ws-panel rv-empty">
          <h2 className="ws-panel-title">Chưa có gì để ôn</h2>
          <p className="muted">Học xong điểm kiến thức đầu tiên, nó sẽ tự hẹn bạn quay lại đây.</p>
          <a className="btn btn-gold" href="/learn/" onClick={goLearn}>
            Vào học
            <ArrowRight aria-hidden strokeWidth={2} />
          </a>
        </section>
      ) : (
        <div className="ws-grid">
          <section className="ws-panel rv-main">
            <div className="ws-panel-head">
              <h2 className="ws-panel-title">
                <Sparkles aria-hidden strokeWidth={2.25} />
                {due.length > 0 ? "Kệ ôn tập của bạn" : "Hôm nay bạn được nghỉ ôn"}
              </h2>
              {due.length > 0 && onReview && (
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  onClick={() => onReview(due[0]!.key, due[0]!.label)}
                >
                  Ôn ngay
                  <ArrowRight aria-hidden strokeWidth={2} />
                </button>
              )}
            </div>

            {/* KỆ (04/09 — "một thế giới"): mỗi rổ Leitner là một tấm ván gỗ, bài
                là thẻ đứng trên ván. Kệ trên cùng = đến hạn (gần tay nhất). */}
            {due.length > 0 ? (
              <div className="rv-shelf" data-tone="due">
                <div className="rv-shelf-head">
                  <b>Đến hạn ôn</b>
                  <Num value={due.length} duration={500} />
                </div>
                <ul className="rv-cards">{due.map((it) => card(it, true))}</ul>
                <i className="rv-shelf-board" aria-hidden />
              </div>
            ) : (
              /* KHÔNG nói "chưa có gì" khi em đã học: nói rõ ngày hẹn kế tiếp —
                 đây chính là chỗ màn hình cũ nói dối (lỗi 3). */
              <p className="muted rv-rest">
                Bạn đã ôn hết phần đến hạn. Bài gần nhất hẹn lại{" "}
                <b>{soon[0] ? whenText(soon[0].days, false) : "trong vài ngày tới"}</b> — cứ nghỉ ngơi,
                mình sẽ nhắc đúng lúc.
              </p>
            )}

            {soon.length > 0 && (
              <div className="rv-shelf" data-tone="soon">
                <div className="rv-shelf-head">
                  <b>Sắp tới hạn</b>
                  <Num value={soon.length} duration={500} />
                </div>
                <ul className="rv-cards">{soon.slice(0, 8).map((it) => card(it, false))}</ul>
                <i className="rv-shelf-board" aria-hidden />
              </div>
            )}

            {strong.length > 0 && (
              <div className="rv-shelf" data-tone="strong">
                <div className="rv-shelf-head">
                  <b>Đã nhớ bền</b>
                  <Num value={strong.length} duration={500} />
                </div>
                <ul className="rv-cards">{strong.slice(0, 8).map((it) => card(it, false))}</ul>
                <i className="rv-shelf-board" aria-hidden />
              </div>
            )}
          </section>

          <aside className="ws-side">
            <LeitnerCard />
            <div className="rv-says">
              <Lion mood="point" size={64} decorative />
              <p>
                {restingToday
                  ? "Không có gì đến hạn nghĩa là bạn đang nhớ tốt — mình giữ lịch, bạn cứ yên tâm."
                  : "Lịch ôn 1 · 3 · 7 · 21 ngày do mình giữ — bạn cứ vào khi rảnh, phần còn lại để mình lo."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/** Nhịp ôn giãn dần — CHỈ hiện khi học sinh đã có điểm để ôn (nhánh không-rỗng),
 *  vì lúc đó kiến thức này mới dùng được. Bốn mốc là bốn DÒNG trong chính thẻ này. */
function LeitnerCard() {
  return (
    <section className="ws-panel rv-leitner">
      <h2 className="ws-panel-title">
        <Target aria-hidden strokeWidth={2.25} />
        Nhịp ôn 1 · 3 · 7 · 21 ngày
      </h2>
      <p className="muted rv-leitner-lead">
        Mỗi lần bạn nhớ đúng, khoảng cách ôn lại giãn ra — nhớ bền hơn mà tốn ít thời gian hơn.
      </p>
      <ol className="rv-steps">
        {LEITNER.map((b, i) => (
          <li className="rv-step" data-tone={b.tone} key={b.days}>
            <span className="rv-step-n num" aria-hidden>
              {i + 1}
            </span>
            <b className="rv-step-days">{b.days}</b>
            <span className="rv-step-lbl">{b.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
