"use client";

/**
 * Ôn tập — hộp Leitner của bạn (VIEW dùng trong trang MỘT TRANG /learn).
 *
 * Bản desktop full màn (yêu cầu chủ dự án): nền trắng, hero navy nhấn vàng,
 * các lớp bên trong dùng navy + vàng cho bớt đơn điệu. Full width, không bó
 * 64rem.
 *
 * Trung thực trạng thái (PRODUCT.md): lịch hẹn ôn THẬT (next_review_at) nằm ở
 * server và chưa có endpoint. View hiển thị các điểm đã thành thạo (nguồn cục
 * bộ, cùng nguồn với lộ trình), gom theo chương khi suy được, và mời ôn lại —
 * KHÔNG bịa ngày giờ đến hạn.
 *
 * `onGoLearn`: trong chế độ một trang → chuyển view tại chỗ; trang đứng riêng
 * không truyền → rơi về điều hướng thường.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Flame, RotateCcw, Sparkles, Target } from "lucide-react";
import Lion from "./Lion";
import * as G from "../lib/gamify";

/** Hộp Leitner: mỗi lần nhớ đúng, điểm kiến thức leo lên hộp xa hơn — khoảng
 *  cách ôn giãn dần 1 · 3 · 7 ngày. Đây là GIẢI THÍCH hệ thống (tĩnh), không
 *  phải lịch thật của từng điểm (lịch thật do server giữ). */
const LEITNER = [
  { days: "1 ngày", label: "Vừa học xong", tone: "sky" as const },
  { days: "3 ngày", label: "Nhớ đúng 1 lần", tone: "navy" as const },
  { days: "7 ngày", label: "Nhớ đúng nhiều lần", tone: "gold" as const },
];

type PathNode = { key: string; label: string; chapter: string };

export default function ReviewView({ onGoLearn }: { onGoLearn?: () => void }) {
  const [mastered, setMastered] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<G.Progress | null>(null);
  // Bản đồ key/label → chương (từ lộ trình tĩnh) để gom "Ôn theo chương".
  const [pathMap, setPathMap] = useState<Map<string, string>>(new Map());
  // Bản đồ key → NHÃN (tên bài) để hiện tên người-đọc-được thay vì mã node thô.
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setMastered(G.loadMastered());
    setProgress(G.load());
  }, []);

  // Nạp cả hai lộ trình tĩnh để tra chương của mỗi điểm đã thành thạo. Lỗi/
  // thiếu file → map rỗng, danh sách vẫn hiện (chỉ không gom theo chương).
  useEffect(() => {
    let alive = true;
    Promise.all(
      ["toan", "anh"].map((s) =>
        fetch(`/kg/path-${s}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((sets) => {
      if (!alive) return;
      const m = new Map<string, string>();
      const lm = new Map<string, string>();
      for (const d of sets) {
        if (d && Array.isArray(d.nodes)) {
          for (const n of d.nodes as PathNode[]) {
            if (n.label) lm.set(n.key, n.label);
            if (n.chapter) {
              m.set(n.key, n.chapter);
              m.set(n.label, n.chapter);
            }
          }
        }
      }
      setPathMap(m);
      setLabelMap(lm);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Gom điểm đã thành thạo theo chương (giữ thứ tự xuất hiện). Điểm không tra
  // được chương rơi vào nhóm "Khác" — không bỏ sót, không bịa.
  const groups = useMemo(() => {
    if (!mastered) return [];
    const byChapter = new Map<string, string[]>();
    for (const k of mastered) {
      const ch = pathMap.get(k) ?? "Khác";
      if (!byChapter.has(ch)) byChapter.set(ch, []);
      byChapter.get(ch)!.push(k);
    }
    return [...byChapter.entries()].map(([chapter, items]) => ({ chapter, items }));
  }, [mastered, pathMap]);

  const goLearn = (e: React.MouseEvent) => {
    if (!onGoLearn) return; // để <a> điều hướng như thường
    e.preventDefault();
    onGoLearn();
  };

  if (mastered === null || progress === null) {
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

  const count = mastered.length;
  const empty = count === 0;

  return (
    <div className="ws">
      {/* HERO navy — khối màu lớn, chữ trắng, nhấn vàng */}
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
          <Lion mood={empty ? "sleepy" : "proud"} size={132} variant="full" decorative />
        </span>
      </header>

      {/* Dải chỉ số — tile navy + vàng xen kẽ, số THẬT của chính bạn */}
      <div className="ws-stats">
        <div className="ws-stat" data-tone="navy" data-zero={count === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <BookOpenCheck strokeWidth={2.25} />
          </span>
          <b className="num">{count}</b>
          <span>điểm đã thành thạo</span>
        </div>
        {/* Nhịp Leitner THẬT thay tile nhân đôi số count (phê bình zero-state) */}
        <div className="ws-stat" data-tone="gold">
          <span className="ws-stat-ico" aria-hidden>
            <Target strokeWidth={2.25} />
          </span>
          <b className="num">1·3·7</b>
          <span>nhịp ôn (ngày)</span>
        </div>
        <div className="ws-stat" data-tone="plain" data-zero={progress.streak === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <Flame strokeWidth={2.25} />
          </span>
          <b className="num">{progress.streak}</b>
          <span>ngày liên tiếp</span>
        </div>
      </div>

      {empty ? (
        /* Trạng thái rỗng vẫn đầy đặn desktop: giải thích Leitner bên trái,
           lời mời học điểm đầu tiên bên phải. */
        <div className="ws-grid">
          <LeitnerCard />
          <section className="ws-panel rv-empty">
            <Lion mood="idle" size={92} decorative />
            <div>
              <h2 className="ws-panel-title">Hộp ôn tập còn đang ngủ</h2>
              <p className="muted">
                Thành thạo điểm kiến thức đầu tiên ở phần Học là đánh thức nó ngay — mỗi điểm bạn nắm
                chắc sẽ vào đây chờ bạn ghé ôn lại.
              </p>
            </div>
            <a className="btn btn-gold" href="/learn/" onClick={goLearn}>
              Vào học điểm đầu tiên
              <ArrowRight aria-hidden strokeWidth={2} />
            </a>
          </section>
        </div>
      ) : (
        <div className="ws-grid">
          {/* Cột chính: các điểm đã thành thạo, gom theo chương */}
          <section className="ws-panel rv-main">
            <div className="ws-panel-head">
              <h2 className="ws-panel-title">
                <Sparkles aria-hidden strokeWidth={2.25} />
                Điểm bạn đã thành thạo
              </h2>
              <a className="btn btn-gold btn-sm" href="/learn/" onClick={goLearn}>
                Ôn một lượt
                <ArrowRight aria-hidden strokeWidth={2} />
              </a>
            </div>

            {groups.map((g) => (
              <div className="rv-group" key={g.chapter}>
                <div className="rv-group-head">
                  <span className="rv-group-name">{g.chapter}</span>
                  <span className="rv-group-count num">{g.items.length}</span>
                </div>
                <ul className="rv-cards">
                  {g.items.map((k) => (
                    <li key={k} className="rv-card">
                      <span className="rv-card-ico" aria-hidden>
                        <BookOpenCheck strokeWidth={2.25} />
                      </span>
                      <span className="rv-card-name">{labelMap.get(k) ?? k}</span>
                      <a
                        className="rv-card-btn"
                        href="/learn/"
                        onClick={goLearn}
                        aria-label={`Ôn lại ${labelMap.get(k) ?? k}`}
                      >
                        <RotateCcw aria-hidden strokeWidth={2.25} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {/* Cột phải: giải thích Leitner + lời sư tử */}
          <aside className="ws-side">
            <LeitnerCard />
            <div className="rv-says">
              <Lion mood="point" size={64} decorative />
              <p>
                Lịch ôn 1 · 3 · 7 ngày do mình giữ — bạn cứ vào khi rảnh, phần còn lại để mình lo.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/** Thẻ giải thích hộp Leitner — 3 hộp màu (trời → navy → vàng). */
function LeitnerCard() {
  return (
    <section className="ws-panel rv-leitner">
      {/* Sư tử tò mò ló đầu qua mép thẻ — cửa sổ overflow cắt tại mép */}
      <span className="rv-peek" aria-hidden>
        <Lion mood="think" size={58} decorative />
      </span>
      <h2 className="ws-panel-title">
        <Target aria-hidden strokeWidth={2.25} />
        Vì sao ôn lại 1 · 3 · 7 ngày?
      </h2>
      <p className="muted rv-leitner-lead">
        Mỗi lần bạn nhớ đúng, điểm kiến thức leo lên hộp xa hơn — khoảng cách ôn giãn dần để bạn nhớ
        thật bền mà không tốn nhiều thời gian.
      </p>
      <div className="rv-boxes">
        {LEITNER.map((b, i) => (
          <div className="rv-box" data-tone={b.tone} key={b.days}>
            <span className="rv-box-n num">{i + 1}</span>
            <b className="rv-box-days">{b.days}</b>
            <span className="rv-box-lbl">{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
