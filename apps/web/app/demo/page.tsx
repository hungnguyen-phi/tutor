"use client";

/**
 * Xem trước giao diện, không cần Supabase và không cần đăng nhập.
 *
 * Đây KHÔNG phải app thật: mọi dữ liệu ở đây là mẫu cố định. Dùng để duyệt
 * thiết kế (lộ trình, bài học, ribbon, màn hoàn thành, các trạng thái node)
 * trên máy hoặc qua tunnel. App thật nằm ở /learn và gọi Edge Functions.
 */

import { useState } from "react";
import { Check, RefreshCw, Lightbulb, ArrowRight, TrendingUp, Zap, X, Sunrise, Shapes } from "lucide-react";
import AppShell from "../../components/AppShell";
import Hud from "../../components/Hud";
import LearnAside from "../../components/LearnAside";
import Lion from "../../components/Lion";
import XpCount from "../../components/XpCount";
import LearningPath, { type PathNode } from "../../components/LearningPath";
import LessonView from "../../components/LessonView";
import type { NodeResource } from "../../lib/api";
import { MathText } from "../../lib/mathrender";
import "katex/dist/katex.min.css";
import * as G from "../../lib/gamify";
import { useRotation, pickGreeting } from "../../lib/nudges";

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

/* Node đang học mang ĐỦ thứ nặng nhất có thể: tên DÀI (đúng ca chủ dự án báo
   lệch 30/07 — "Xác định tính đúng sai của mệnh đề"), tiến trình dang dở, và bài
   chờ chấm. Thẻ .node-card phải gánh được cả ba mà vẫn thẳng trục dấu chân. */
const NODES: PathNode[] = [
  { key: "TO10-C01-A01", label: "Hàm số bậc hai — định nghĩa", state: "mastered" },
  { key: "TO10-C01-A02", label: "Đồ thị parabol", state: "mastered" },
  { key: "TO10-C01-A03", label: "Trục đối xứng", state: "stale" },
  {
    key: "TO10-C01-A04",
    label: "Xác định tính đúng sai của mệnh đề",
    state: "current",
    progress: 1,
    doneCount: 8,
    totalCount: 8,
    pending: 1,
  },
  { key: "TO10-C01-A05", label: "Xét dấu tam thức", state: "available", pending: 1 },
  { key: "TO10-C01-A06", label: "Bất phương trình bậc hai", state: "locked", blockedBy: ["Xét dấu tam thức"] },
  {
    key: "TO10-C01-A07",
    label: "Khái niệm mệnh đề logic",
    state: "redo",
    redo: [
      { questionId: "q1", note: "Em làm chưa đúng — thiếu bước xét $\\Delta$.", noteFileUrl: null, noteFileName: null },
      { questionId: "q2", note: null, noteFileUrl: null, noteFileName: null },
      { questionId: "q3", note: null, noteFileUrl: null, noteFileName: null },
    ],
  },
];

const OPTIONS = ["(2; −1)", "(−2; 1)", "(2; 1)", "(4; 3)"];

/* Bốn hình dạng câu mà sân khấu bài tập phải gánh (app thật có 8 — bốn dạng
   tương tác còn lại tự dựng widget riêng, không đụng phiến đề). */
const SHAPES = ["mcq", "steps", "quote", "typed"] as const;
type Shape = (typeof SHAPES)[number];
const SHAPE_LABEL: Record<Shape, string> = {
  mcq: "Trắc nghiệm",
  steps: "Nhiều bước",
  quote: "Lời trích",
  typed: "Gõ đáp án",
};
/* Nhãn lệnh làm bài — đúng chuỗi kindEyebrow() của TutorApp trả về cho từng dạng. */
const KIND_LABEL_DEMO: Record<Shape, string> = {
  mcq: "Chọn đáp án đúng",
  steps: "Trả lời từng bước",
  quote: "Tìm chỗ sai",
  typed: "Nhập đáp án của bạn",
};
const DEMO_STEPS = [
  "Số 12 chia hết cho 4. Vậy 12 có chia hết cho 2 không?",
  "Số 6 chia hết cho 2. Vậy 6 có chia hết cho 4 không?",
  "Mệnh đề đảo của $P$ có đúng không?",
];
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
  /* Sét XP: trong app thật hiệu ứng nổ lúc em VỪA VỀ từ buổi học (Hud nhận
     `justEarned`). Ở demo không có buổi học thật nên có nút phát lại — key đổi
     ⇒ Hud remount ⇒ hiệu ứng chạy từ đầu, xem được bằng mắt. */
  const [xpReplay, setXpReplay] = useState(0);
  /* Trang này CÓ prerender (khác /learn nằm sau cổng đăng nhập), nên bộ đếm xoay
     vòng phải lấy qua hook — đọc localStorage ngay trong render là lệch hydrate. */
  const rot = useRotation();
  /* 9 bầu trời của sân khấu bài tập: trong app thật nó theo CHƯƠNG đang học, ở
     đây có nút xoay để duyệt hết 9 sắc mà không phải học qua 9 chương. */
  const [world, setWorld] = useState(0);
  /* Hình dạng câu đang xem + trạng thái trả lời của từng dạng. */
  const [shape, setShape] = useState<Shape>("mcq");
  const [stepAns, setStepAns] = useState<Record<number, string>>({});
  const [typed, setTyped] = useState("");

  const lamBai = screen === "lesson" || screen === "retry";

  return (
    /* `focus` = ẩn rail/nav — ĐÚNG như production làm khi vào bài (AppShell
       focus). Thiếu cờ này thì rail 92px đẩy cột đề bài lệch 46px so với tâm
       màn, và bản xem trước đi báo một lỗi canh giữa KHÔNG có thật. */
    <AppShell current="learn" focus={lamBai}>
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
        {screen === "path" && (
          <button className="btn btn-quiet" onClick={() => setXpReplay((n) => n + 1)}>
            <RefreshCw aria-hidden strokeWidth={2} />
            Phát lại sét XP
          </button>
        )}
        {lamBai && (
          <>
            <button className="btn btn-quiet" onClick={() => setWorld((w) => (w + 1) % 9)}>
              <Sunrise aria-hidden strokeWidth={2} />
              Bầu trời {world + 1}/9
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => setShape((s) => SHAPES[(SHAPES.indexOf(s) + 1) % SHAPES.length]!)}
            >
              <Shapes aria-hidden strokeWidth={2} />
              Dạng: {SHAPE_LABEL[shape]}
            </button>
          </>
        )}
      </div>

      {screen === "path" && (
        /* Bọc ĐÚNG khung của app thật (.learn-layout > .learn-main + cột phải
           .learn-aside): nền cảnh và các rule bố cục màn Học đều móc vào các lớp
           này, nên thiếu chúng thì bản xem trước sẽ khác production — đúng thứ
           demo sinh ra để tránh. */
        <div className="learn-layout">
          <div className="learn-main">
          {/* Pill chọn môn nằm ngay trong HUD (hi-fi 3a) — demo chưa đổi môn được */}
          <Hud
            key={xpReplay}
            progress={PROGRESS}
            justEarned={35}
            subject={{ label: "Toán 10" }}
          />
          <LearningPath
            unit="Toán 10 · Chương I"
            subtitle="Hàm số bậc hai · dẫn dắt Socratic, chấm bằng CAS"
            nodes={NODES}
            greeting={pickGreeting("back", rot, { ten: "An", n: 2 })}
            onStart={() => setScreen("lesson")}
          />
          </div>
          {/* Component THẬT của cột phải — xem trước được câu nhắc đổi gió, số
              XP chảy dần và thanh nhiệm vụ tự chạy. */}
          <LearnAside
            board={{ effort: { rank: 3 }, xp: { total: PROGRESS.xp } }}
            progress={PROGRESS}
            leagueProgress={G.leagueOf(PROGRESS.xp).progress}
            nextLeague={{ name: "Ngọc", min: 2000 }}
            studied
            firstName="An"
            rot={rot}
            onSeeAll={() => {}}
          />
        </div>
      )}

      {lamBai && (
        /* MẶT ĐANG LÀM BÀI — dựng lại ĐÚNG DOM mà TutorApp sinh ra (qstage ·
           lesson-top/qtrail · lesson-kind · qcard · ans-grid/ans-tile · thread ·
           lfoot), không phải bộ lớp hi-fi cũ (qprompt/option/ribbon) mà bản demo
           dùng trước đây. Lý do: demo tồn tại để DUYỆT THIẾT KẾ không cần
           Supabase — mà markup lệch production thì nó duyệt hộ một màn không tồn
           tại. Dữ liệu vẫn là mẫu cố định. */
        <div className="qworld" data-world={world}>
        <div className="lsn-grid">
          <div className="qstage" aria-hidden>
            <i className="qstage-glow" />
            <span className="qstage-motes">
              <i /><i /><i /><i /><i /><i />
            </span>
          </div>

          <aside className="lsn-aside">
            <LessonView resources={DEMO_RESOURCES} />
          </aside>

          <div className="lsn-main">
            <div className="lesson-top">
              <button className="lesson-x" onClick={() => setScreen("path")} aria-label="Thoát buổi học">
                <X aria-hidden strokeWidth={2.5} />
              </button>
              <div
                className="qtrail"
                role="progressbar"
                aria-valuenow={3}
                aria-valuemin={1}
                aria-valuemax={8}
                aria-label="Câu 3 trên 8"
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="qtrail-paw" data-s={i < 2 ? "done" : i === 2 ? "now" : "next"}>
                    {i === 2 && <Lion mood="idle" size={26} decorative />}
                  </span>
                ))}
                <span className="qtrail-flag" />
              </div>
              <span className="lesson-count num">3/8</span>
            </div>

            {/* BỐN HÌNH DẠNG CÂU — sân khấu phải gánh được cả bốn, không chỉ trắc
                nghiệm: phiến đề, thẻ từng bước, lời trích, ô gõ đáp án. Đây đúng
                các lớp mà TutorApp sinh ra cho từng dạng. */}
            <p className="eyebrow lesson-kind">{KIND_LABEL_DEMO[shape]}</p>

            {shape === "steps" ? (
              <>
                <div className="qcard">
                  <div className="qcard-text">
                    <MathText block cap>{"Cho mệnh đề $P$: “Mọi số chia hết cho 4 thì chia hết cho 2”."}</MathText>
                  </div>
                </div>
                <ol className="steps">
                  {DEMO_STEPS.map((st, i) => (
                    <li key={i} className="step-card" data-answered={stepAns[i] ? true : undefined}>
                      <span className="step-num num" aria-hidden>{i + 1}</span>
                      <div className="step-body">
                        <div className="step-text"><MathText cap>{st}</MathText></div>
                        <div className="step-yn" role="group" aria-label={`Bước ${i + 1}: chọn Có hoặc Không`}>
                          {["Có", "Không"].map((v) => (
                            <button
                              key={v}
                              type="button"
                              className="step-pill"
                              aria-pressed={stepAns[i] === v}
                              onClick={() => setStepAns((a) => ({ ...a, [i]: v }))}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : shape === "quote" ? (
              <div className="qcard">
                <div className="qcard-text">
                  <MathText block cap>{"Bạn An giải bài tìm đỉnh parabol như sau:"}</MathText>
                </div>
                <blockquote className="qquote">
                  {/* "√" UNICODE nằm TRONG $...$ — CỐ Ý giữ nguyên dạng dính lỗi 22
                      (AI hay viết vậy): normalizeTex phải đổi ra \sqrt{4} có thanh
                      ngang. Đừng "sửa đẹp" thành \sqrt — mất ca kiểm tra sống. */}
                  <MathText block>{"Đỉnh có hoành độ $x = -b/a = 4$ và $√4 = ±2$, nên đỉnh là $(4; 3)$."}</MathText>
                </blockquote>
                <div className="qcard-text qq-post">
                  <MathText block cap>{"Bạn ấy sai ở bước nào?"}</MathText>
                </div>
              </div>
            ) : (
              <div className="qcard">
                <div className="qcard-expr">
                  <MathText block cap>{"Toạ độ đỉnh của parabol $y = x^2 - 4x + 3$ là gì?"}</MathText>
                </div>
              </div>
            )}

            {screen === "retry" && (
              <div className="thread">
                <div className="bubble student">
                  <div className="who">BẠN</div>
                  (−2; 1)
                </div>
                <div className="hint-says">
                  <Lion mood="thinking" size={52} />
                  <div className="hint-bubble">
                    <MathText>Bạn nhớ trục đối xứng của parabol nằm ở đâu không? Thử tính $x = -b/(2a)$ với a và b của hàm số này xem.</MathText>
                  </div>
                </div>
              </div>
            )}

            {shape === "typed" || shape === "steps" ? (
              <textarea
                className="ans-input"
                rows={1}
                placeholder={shape === "steps" ? "Kết luận của em…" : "Nhập đáp án của bạn…"}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            ) : (
              <div className="ans-grid">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    className="ans-tile num"
                    aria-pressed={picked === opt}
                    onClick={() => setPicked(opt)}
                  >
                    <MathText cap>{opt}</MathText>
                  </button>
                ))}
              </div>
            )}

            <div className="lesson-pad" aria-hidden />
          </div>

          {screen === "lesson" ? (
            picked ? (
              /* Đã chọn + đã kiểm tra → thanh chân trời bung sáng vàng. */
              <div className="lfoot" data-verdict="ok" role="status">
                <div className="lfoot-inner">
                  <div className="lfoot-says">
                    <Lion mood="cheer" size={56} decorative />
                    <b className="lfoot-title">Chính xác!</b>
                    <span className="xp-chip num">+10 XP</span>
                  </div>
                  <button className="btn btn-gold btn-block" onClick={() => setScreen("done")}>
                    TIẾP TỤC
                  </button>
                </div>
              </div>
            ) : (
              <div className="lfoot">
                <div className="lfoot-inner">
                  <button className="btn btn-block btn-check" disabled>
                    KIỂM TRA
                  </button>
                  <button type="button" className="reflect-early">
                    💡 Bí quá? Xin sư tử gợi ý
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="lfoot" data-verdict="retry" role="status">
              <div className="lfoot-inner">
                <div className="lfoot-row">
                  <RefreshCw aria-hidden strokeWidth={2.5} />
                  <b className="lfoot-title">Chưa đúng — thử lại nhé</b>
                  <span className="xp-chip num">+5 XP nỗ lực</span>
                </div>
                <div className="reflect-row">
                  <input
                    className="reflect-input"
                    type="text"
                    placeholder="Kể cách em nghĩ cho sư tử nghe…"
                    readOnly
                  />
                  <button type="button" className="btn btn-ghost reflect-send" disabled>
                    Gửi
                  </button>
                  <button type="button" className="btn btn-ghost reflect-hint">
                    💡 Xin gợi ý
                  </button>
                </div>
                <button className="btn btn-block" onClick={() => setScreen("lesson")}>
                  THỬ LẠI
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
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
