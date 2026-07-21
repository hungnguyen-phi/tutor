"use client";

/**
 * Xem trước giao diện, không cần Supabase và không cần đăng nhập.
 *
 * Đây KHÔNG phải app thật: mọi dữ liệu ở đây là mẫu cố định. Dùng để duyệt
 * thiết kế (lộ trình, bài học, ribbon, màn hoàn thành, các trạng thái node)
 * trên máy hoặc qua tunnel. App thật nằm ở /learn và gọi Edge Functions.
 */

import { useState } from "react";
import { Check, RefreshCw, Lightbulb, ArrowRight, TrendingUp, Zap } from "lucide-react";
import AppShell from "../../components/AppShell";
import Hud from "../../components/Hud";
import Lion from "../../components/Lion";
import XpCount from "../../components/XpCount";
import LearningPath, { type PathNode } from "../../components/LearningPath";
import LessonView from "../../components/LessonView";
import type { NodeResource } from "../../lib/api";
import { MathText } from "../../lib/mathrender";
import "katex/dist/katex.min.css";
import * as G from "../../lib/gamify";

// Học liệu mẫu do Xưởng Học liệu AI xuất ra (HTML tự chứa trong /public/demo-assets).
// Đây đúng khuôn NodeResource mà fn `resources` trả về khi pipeline có dữ liệu thật.
const DEMO_RESOURCES: NodeResource[] = [
  {
    id: "demo-flashcard",
    format: "flashcard",
    tier: 1,
    uri: "/demo-assets/flashcard-parabol.html",
    ly_do_chon_format: "Thẻ lật giúp ghi nhớ nhanh công thức đỉnh và trục đối xứng trước khi luyện.",
  },
  {
    id: "demo-quiz",
    format: "quiz",
    tier: 1,
    uri: "/demo-assets/quiz-parabol.html",
    ly_do_chon_format: "Quiz tự luyện có phản hồi ngay — kiểm tra hiểu bài, không tính vào điểm.",
  },
  {
    id: "demo-worksheet",
    format: "worksheet",
    tier: 2,
    uri: "/demo-assets/worksheet-parabol.html",
    ly_do_chon_format: "Phiếu bài tập về nhà — in ra hoặc lưu PDF để làm trên giấy.",
  },
];

const PROGRESS: G.Progress = { xp: 1240, streak: 7, lastDay: new Date().toISOString().slice(0, 10) };

const NODES: PathNode[] = [
  { key: "TO10-C01-A01", label: "Hàm số bậc hai — định nghĩa", state: "mastered" },
  { key: "TO10-C01-A02", label: "Đồ thị parabol", state: "mastered" },
  { key: "TO10-C01-A03", label: "Trục đối xứng", state: "stale" },
  { key: "TO10-C01-A04", label: "Đỉnh parabol", state: "current" },
  { key: "TO10-C01-A05", label: "Xét dấu tam thức", state: "available" },
  { key: "TO10-C01-A06", label: "Bất phương trình bậc hai", state: "locked", blockedBy: ["Xét dấu tam thức"] },
  { key: "TO10-C01-A07", label: "Ứng dụng thực tế", state: "locked", blockedBy: ["Bất phương trình bậc hai"] },
];

const OPTIONS = ["(2; −1)", "(−2; 1)", "(2; 1)", "(4; 3)"];
const SCREENS = ["path", "lesson", "special", "retry", "done", "mascot"] as const;
type Screen = (typeof SCREENS)[number];
const LABEL: Record<Screen, string> = {
  path: "Lộ trình",
  lesson: "Bài học",
  special: "Bài đặc biệt",
  retry: "Trả lời sai",
  done: "Hoàn thành",
  mascot: "Mascot",
};

/* Showcase bộ cảm xúc động — so bằng mắt với reference trong
   design_handoff_lion_motion/reference/Mascot Động.dc.html */
const MASCOT_MOODS: { mood: React.ComponentProps<typeof Lion>["mood"]; label: string; note: string }[] = [
  { mood: "happy", label: "Vui vẻ", note: "nhún + thi thoảng cười toe" },
  { mood: "excited", label: "Thích thú", note: "nảy squash-stretch, cười ↔ ồ!" },
  { mood: "greet", label: "Chào", note: "lắc + đảo tay vẫy" },
  { mood: "trophy", label: "Chiến thắng", note: "one-shot: pop + tia vàng" },
  { mood: "success", label: "Đúng rồi", note: "one-shot: pop nhẹ" },
  { mood: "diligent", label: "Chăm chỉ", note: "gõ phím + mồ hôi + tia" },
  { mood: "focus", label: "Tập trung", note: "thở chậm + quầng sáng" },
  { mood: "think", label: "Suy nghĩ", note: "chống cằm ↔ ngước 'à?'" },
  { mood: "surprised", label: "Bất ngờ", note: "giật nảy trợn tròn + !" },
  { mood: "proud", label: "Tự tin", note: "xoay dáng front ↔ ¾ + sao" },
  { mood: "sleepy", label: "Buồn ngủ", note: "thở sâu, miệng theo hơi + Zzz" },
  { mood: "sad", label: "Buồn", note: "trĩu vai + mày run + lệ" },
  { mood: "miss", label: "Nhớ nhung", note: "tim đập chậm dần → nứt đôi" },
  { mood: "chaos", label: "Hỗn loạn", note: "lắc đầu + ?! xoay quanh" },
  { mood: "rebel", label: "Nổi loạn", note: "xoay người 4 frame, dỗi, ngoái" },
];

export default function DemoPage() {
  const [screen, setScreen] = useState<Screen>("path");
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <AppShell current="learn">
      <div className="banner info" style={{ marginBottom: 16 }}>
        <Lightbulb aria-hidden strokeWidth={2} />
        <span>
          <b>Bản xem trước thiết kế.</b> Dữ liệu là mẫu cố định, không nối Supabase. App thật ở{" "}
          <a href="/learn">/learn</a>.
        </span>
      </div>

      <div className="row" style={{ marginBottom: 20 }}>
        {SCREENS.map((s) => (
          <button
            key={s}
            className="btn btn-quiet"
            aria-pressed={s === screen}
            onClick={() => {
              setScreen(s);
              setPicked(null);
            }}
          >
            {LABEL[s]}
          </button>
        ))}
      </div>

      {screen === "path" && (
        <>
          {/* Pill chọn môn nằm ngay trong HUD (hi-fi 3a) — demo chưa đổi môn được */}
          <Hud progress={PROGRESS} subject={{ label: "Toán 10" }} />
          <LearningPath
            unit="Toán 10 · Chương I"
            subtitle="Hàm số bậc hai · dẫn dắt Socratic, chấm bằng CAS"
            nodes={NODES}
            greeting="Bạn đã thành thạo 2 điểm kiến thức. Hôm nay mình với bạn học Đỉnh parabol nhé — mình hỏi, bạn nghĩ."
            onStart={() => setScreen("lesson")}
          />
        </>
      )}

      {(screen === "lesson" || screen === "retry") && (
        <>
          <div className="lesson-bar">
            <button className="btn btn-quiet" onClick={() => setScreen("path")}>
              Thoát
            </button>
            <div
              className="segments"
              role="progressbar"
              aria-valuenow={3}
              aria-valuemin={1}
              aria-valuemax={6}
              aria-label="Câu 3 trên 6"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <i key={i} data-done={i < 2} data-active={i === 2} />
              ))}
            </div>
            <span className="stat stat-xp">
              <Zap aria-hidden strokeWidth={2} />
              <span className="num">+{screen === "retry" ? 5 : 20}</span>
            </span>
          </div>

          <div className="qmeta">
            <span className="chip">TO10-C01-A04</span>
            <span className="chip">Bậc 2</span>
            <span className="chip">DOK 2</span>
            <span className="chip">Trắc nghiệm</span>
          </div>
          <p className="qprompt"><MathText>Toạ độ đỉnh của parabol y = x² − 4x + 3 là gì?</MathText></p>

          {screen === "retry" && (
            <div className="thread">
              <div className="bubble student">
                <div className="who">BẠN</div>
                (−2; 1)
              </div>
              <div className="hint lion-says">
                <Lion mood="thinking" size={64} />
                <div>
                  <div className="label">
                    <Lightbulb aria-hidden strokeWidth={2.5} />
                    GỢI Ý SOCRATIC
                  </div>
                  <MathText>Em nhớ trục đối xứng của parabol nằm ở đâu không? Thử tính x = −b/(2a) với a và b của hàm số này xem.</MathText>
                </div>
              </div>
            </div>
          )}

          <div className="options" style={{ paddingBottom: 140 }}>
            {OPTIONS.map((opt, i) => (
              <button
                key={opt}
                className="option"
                aria-pressed={picked === opt}
                onClick={() => setPicked(opt)}
              >
                <span className="key" aria-hidden>
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>

          {screen === "lesson" ? (
            <div className="ribbon" data-verdict="ok" role="status">
              <div className="ribbon-inner">
                <div className="body">
                  <div className="title">
                    <Check aria-hidden strokeWidth={3} />
                    Chính xác
                  </div>
                  <div className="detail">
                    <span className="xp">+10 XP</span>
                  </div>
                </div>
                <button className="btn btn-ok" onClick={() => setScreen("done")}>
                  Câu tiếp theo
                  <ArrowRight aria-hidden strokeWidth={2} />
                </button>
              </div>
            </div>
          ) : (
            <div className="ribbon" data-verdict="retry" role="status">
              <div className="ribbon-inner">
                <div className="body">
                  <div className="title">
                    <RefreshCw aria-hidden strokeWidth={2.5} />
                    Chưa đúng — thử lại nhé
                  </div>
                  <div className="detail">
                    Đọc gợi ý phía trên rồi trả lời lại.
                    <span className="xp" style={{ marginLeft: 8 }}>
                      +5 XP nỗ lực
                    </span>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => setScreen("lesson")}>
                  Tôi thử lại
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {screen === "done" && (
        <div className="done">
          <Lion mood="cheer" size={132} />
          <div>
            <h1 className="h1">Hoàn thành buổi học</h1>
            <p className="sub" style={{ marginTop: 4 }}>
              Cảm ơn bạn đã kiên trì hôm nay.
            </p>
          </div>

          <p className="xp-big num">
            <XpCount value={85} />
          </p>

          <div className="stats">
            <div className="stat-box">
              <b className="num">2</b>
              <span className="muted">điểm đã luyện</span>
            </div>
            <div className="stat-box">
              <b className="num">1</b>
              <span className="muted">điểm thành thạo</span>
            </div>
            <div className="stat-box">
              <b className="num">8</b>
              <span className="muted">ngày liên tiếp</span>
            </div>
          </div>

          <div className="node-results">
            <div className="node-result" data-mastered="true">
              <Check aria-hidden strokeWidth={2.5} />
              <span>TO10-C01-A04 · Đỉnh parabol</span>
              <span className="score num">100%</span>
            </div>
            <div className="node-result" data-mastered="false">
              <TrendingUp aria-hidden strokeWidth={2.5} />
              <span>TO10-C01-A05 · Xét dấu tam thức</span>
              <span className="score num">60%</span>
            </div>
          </div>

          <div className="banner ok">
            <Check aria-hidden strokeWidth={2.5} />
            <span>Bạn đã thành thạo 1 điểm kiến thức. Mình sẽ nhắc bạn ôn lại sau 1 ngày.</span>
          </div>

          <button className="btn btn-block" onClick={() => setScreen("path")}>
            Về lộ trình
            <ArrowRight aria-hidden strokeWidth={2} />
          </button>
        </div>
      )}

      {screen === "special" && (
        <>
          <div className="lesson-bar">
            <button className="btn btn-quiet" onClick={() => setScreen("path")}>
              Thoát
            </button>
            <div className="qmeta" style={{ margin: 0 }}>
              <span className="chip">TO10-C01-A04</span>
              <span className="chip">Đỉnh parabol</span>
            </div>
            <span className="stat stat-xp">
              <Zap aria-hidden strokeWidth={2} />
              <span className="num">bài học</span>
            </span>
          </div>

          <p className="qprompt" style={{ marginBottom: 14 }}>
            Trước khi luyện, xem học liệu do Xưởng Học liệu AI biên soạn cho điểm kiến thức này.
          </p>

          {/* Chính là component thật dùng trong buổi học — dữ liệu là học liệu mẫu */}
          <LessonView
            resources={DEMO_RESOURCES}
            subtitle="Thẻ ghi nhớ, quiz tự luyện và phiếu bài tập về nhà — mở từng mục để xem."
          />

          <div className="banner info" style={{ marginTop: 16 }}>
            <Lightbulb aria-hidden strokeWidth={2} />
            <span>
              Ba học liệu trên là <b>file HTML tự chứa</b> — đúng khuôn Xưởng xuất ra và app render
              trong iframe cô lập. Đây là phần "bài đặc biệt" sẽ hiện ở đầu mỗi node khi có học liệu.
            </span>
          </div>
        </>
      )}

      {screen === "mascot" && (
        <>
          <header style={{ marginBottom: 20 }}>
            <h1 className="h2">Bộ cảm xúc động</h1>
            <p className="sub">
              14 trạng thái — chớp mắt, khẩu hình, hoán frame, xoay người 4 góc. Trophy/Đúng rồi là
              one-shot: bấm nút để phát lại.
            </p>
          </header>
          <MascotShowcase />
        </>
      )}
    </AppShell>
  );
}

/* Lưới showcase — key nudge để remount các mood one-shot (trophy/success) */
function MascotShowcase() {
  const [replay, setReplay] = useState(0);
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={() => setReplay((n) => n + 1)}>
          <RefreshCw aria-hidden strokeWidth={2} />
          Phát lại one-shot
        </button>
      </div>
      <div className="mascot-grid">
        {MASCOT_MOODS.map(({ mood, label, note }) => (
          <figure key={mood} className="mascot-cell">
            <span className="mascot-stage">
              <Lion key={mood === "trophy" || mood === "success" ? `${mood}-${replay}` : mood} mood={mood} size={96} decorative />
            </span>
            <figcaption>
              <b>{label}</b>
              <span className="muted">{note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
