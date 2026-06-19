"use client";

import { useState, useRef, useEffect } from "react";
import {
  diagnose,
  answer,
  writing,
  speaking,
  endSession,
  type DiagnoseResult,
  type DiagnoseQuestion,
  type TurnResult,
  type EndResult,
} from "../lib/api";

type Msg =
  | { role: "student"; text: string }
  | { role: "tutor"; text: string }
  | { role: "hint"; text: string }
  | { role: "ok"; text: string }
  | { role: "feedback"; text: string };

export default function TutorApp() {
  const [subject, setSubject] = useState<"Toan" | "Anh" | null>(null);
  const [ses, setSes] = useState<DiagnoseResult | null>(null);
  const [qi, setQi] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [finished, setFinished] = useState<EndResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q: DiagnoseQuestion | undefined = ses?.questions[qi];

  async function start(subj: "Toan" | "Anh") {
    setError(null);
    setBusy(true);
    setSubject(subj);
    try {
      const d = await diagnose(subj);
      setSes(d);
      setQi(0);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubject(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMsgs([]);
    setText("");
    setPicked(null);
    setDone(false);
  }

  function applyTurn(res: TurnResult) {
    if (res.correct) {
      setMsgs((m) => [...m, { role: "ok", text: res.message ?? "Chính xác!" }]);
      setDone(true);
    } else if (res.gate === "require_attempt") {
      setMsgs((m) => [...m, { role: "tutor", text: res.message ?? "" }]);
    } else {
      setMsgs((m) => [...m, { role: "hint", text: res.message ?? "" }]);
    }
  }

  async function submitObjective(ans: string) {
    if (!ses || !q || busy || done || !ans) return;
    setPicked(ans);
    setText(""); // fresh input box for the next attempt
    setMsgs((m) => [...m, { role: "student", text: ans }]);
    setBusy(true);
    setLoading(true);
    try {
      const res = await answer(ses.sessionId, q.id, ans);
      applyTurn(res);
      if (!res.correct) setPicked(null); // allow a clean re-pick / re-entry
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function submitWriting() {
    if (!ses || !q || busy || !text.trim()) return;
    const t = text.trim();
    setMsgs((m) => [...m, { role: "student", text: t }]);
    setText("");
    setBusy(true);
    setLoading(true);
    try {
      const res = await writing(ses.sessionId, q.id, t);
      setMsgs((m) => [...m, { role: "feedback", text: res.feedback ?? "" }]);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function submitSpeaking(transcript: string) {
    if (!ses || !q || busy || !transcript.trim()) return;
    setMsgs((m) => [...m, { role: "student", text: `🎙️ "${transcript}"` }]);
    setBusy(true);
    setLoading(true);
    try {
      const res = await speaking(ses.sessionId, q.id, transcript);
      setMsgs((m) => [...m, { role: "feedback", text: res.feedback ?? "" }]);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function next() {
    if (!ses) return;
    if (qi + 1 < ses.questions.length) {
      setQi(qi + 1);
      reset();
      return;
    }
    // Last question → end session: recompute mastery + Leitner (WF-EndSession).
    setBusy(true);
    try {
      const r = await endSession(ses.sessionId);
      setFinished(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function backHome() {
    setSubject(null);
    setSes(null);
    setFinished(null);
    reset();
  }

  // ── Home ──────────────────────────────────────────────────────────────
  if (!subject || !ses) {
    return (
      <main className="wrap">
        <h1 className="h1">Chào em! Hôm nay mình học gì nhé?</h1>
        <p className="sub">
          Gia sư AI sẽ dẫn dắt em tự tìm ra đáp án — không cho đáp án sẵn. Chọn một môn để bắt đầu.
        </p>
        {error && <div className="banner warn">{error}</div>}
        <div className="subjects">
          <button className="subject-card" disabled={busy} onClick={() => start("Toan")}>
            <span className="emoji">📐</span>
            <b>Toán 10</b>
            <small>Hàm số bậc hai · dẫn dắt Socratic, chấm bằng CAS</small>
          </button>
          <button className="subject-card" disabled={busy} onClick={() => start("Anh")}>
            <span className="emoji">🗣️</span>
            <b>Tiếng Anh</b>
            <small>Present simple · trắc nghiệm, viết &amp; nói</small>
          </button>
        </div>
        {busy && (
          <p className="muted" style={{ marginTop: 16 }}>
            Đang chuẩn bị buổi học…
          </p>
        )}
        <p className="muted" style={{ marginTop: 24 }}>
          <a href="/teacher">Dành cho giáo viên — bảng điều khiển &amp; duyệt nội dung →</a>
        </p>
      </main>
    );
  }

  // ── Completion ────────────────────────────────────────────────────────
  if (finished) {
    const mastered = finished.nodes.filter((n) => n.mastered).length;
    return (
      <main className="wrap">
        <div className="panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.4rem" }}>🎉</div>
          <h1 className="h1">Hoàn thành buổi học!</h1>
          <p className="sub">Cảm ơn em đã nỗ lực hôm nay. Đây là tiến bộ của em:</p>
          <div style={{ display: "grid", gap: 8, maxWidth: 420, margin: "0 auto" }}>
            {finished.nodes.map((n) => (
              <div key={n.node} className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
                <span className="chip">{n.node}</span>
                <span>
                  {n.mastered ? "✅ Thành thạo" : "📈 Đang tiến bộ"} · {Math.round(n.score * 100)}%
                </span>
              </div>
            ))}
          </div>
          {mastered > 0 && (
            <div className="banner ok" style={{ marginTop: 14 }}>
              Em đã thành thạo {mastered} điểm kiến thức — hệ thống sẽ nhắc em ôn lại sau 1 ngày (spaced repetition).
            </div>
          )}
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn gold" onClick={backHome}>
              Học môn khác →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Lesson ────────────────────────────────────────────────────────────
  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
        <span className="muted">
          {subject === "Toan" ? "Toán 10" : "Tiếng Anh"} · Câu {qi + 1}/{ses.questions.length}
        </span>
        <button className="btn ghost" onClick={() => { setSubject(null); setSes(null); reset(); }}>
          ↩ Đổi môn
        </button>
      </div>

      {q && (
        <div className="panel">
          <div className="qmeta">
            <span className="chip">{q.nodeKey}</span>
            <span className="chip">Bậc {q.tier}</span>
            <span className="chip">DOK {q.dok}</span>
            <span className="chip">Độ khó: {q.doKho}</span>
            <span className="chip">{kindLabel(q.kind)}</span>
          </div>
          <div className="qprompt">{prettyMath(q.prompt)}</div>
        </div>
      )}

      {/* Thread */}
      <div className="thread">
        {msgs.map((m, i) =>
          m.role === "student" ? (
            <div key={i} className="bubble student">
              <div className="who">Em</div>
              {prettyMath(m.text)}
            </div>
          ) : m.role === "tutor" ? (
            <div key={i} className="bubble tutor">
              <div className="who">Tutor</div>
              {prettyMath(m.text)}
            </div>
          ) : m.role === "hint" ? (
            <div key={i} className="hint">
              <div className="label">GỢI Ý SOCRATIC</div>
              {prettyMath(m.text)}
            </div>
          ) : m.role === "ok" ? (
            <div key={i} className="banner ok">
              ✓ {prettyMath(m.text)}
            </div>
          ) : (
            <div key={i} className="feedback">
              {prettyMath(m.text)}
            </div>
          ),
        )}
        {loading && (
          <div className="bubble tutor">
            <span className="typing">
              <i></i>
              <i></i>
              <i></i>
            </span>
          </div>
        )}
      </div>

      {/* Composer — always visible below the conversation while unanswered */}
      {q && !done && (
        <div className="composer">
          {msgs.some((m) => m.role === "hint" || m.role === "tutor") && (
            <div className="composer-label">
              {q.kind === "objective" && q.options ? "Chọn lại đáp án:" : "Nhập câu trả lời mới của em:"}
            </div>
          )}

          {q.kind === "objective" && q.options && (
            <div className="options">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  className={"option" + (picked === opt ? " sel" : "")}
                  disabled={busy}
                  onClick={() => submitObjective(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.kind === "objective" && !q.options && (
            <div className="row" style={{ marginTop: 0 }}>
              <input
                type="text"
                placeholder="Nhập đáp án…"
                value={text}
                disabled={busy}
                autoFocus
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitObjective(text.trim())}
              />
              <button className="btn" disabled={busy || !text.trim()} onClick={() => submitObjective(text.trim())}>
                Trả lời
              </button>
            </div>
          )}

          {q.kind === "writing" && (
            <div>
              <textarea
                rows={4}
                placeholder="Viết bài của em ở đây (3–4 câu)…"
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="row">
                <button className="btn" disabled={busy || !text.trim()} onClick={submitWriting}>
                  Nộp bài viết
                </button>
                <span className="muted">Phản hồi góp ý (formative), không phải điểm chính thức.</span>
              </div>
            </div>
          )}

          {q.kind === "speaking" && <SpeakBox disabled={busy} onTranscript={submitSpeaking} />}
        </div>
      )}

      {error && <div className="banner warn">{error}</div>}

      {done && (
        <div className="row">
          <button className="btn gold" onClick={next}>
            {ses.questions.length > qi + 1 ? "Câu tiếp theo →" : "Hoàn thành buổi học ✓"}
          </button>
        </div>
      )}
    </main>
  );
}

// Lightweight inline-math prettifier (avoids a heavy KaTeX dependency).
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", n: "ⁿ", x: "ˣ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const toMap = (s: string, m: Record<string, string>) => [...s].map((c) => m[c] ?? c).join("");

function prettyMath(s: string): string {
  return (s ?? "")
    .replace(/\$/g, "")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, "√($1)")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\pm/g, "±")
    .replace(/\\,/g, " ")
    .replace(/\^\{([^{}]+)\}/g, (_, p) => toMap(p, SUP))
    .replace(/\^(-?\w)/g, (_, p) => toMap(p, SUP))
    .replace(/_\{([^{}]+)\}/g, (_, p) => toMap(p, SUB))
    .replace(/_(\w)/g, (_, p) => toMap(p, SUB));
}

function kindLabel(k: string): string {
  return k === "writing" ? "Viết" : k === "speaking" ? "Nói" : k === "rubric" ? "Tự luận" : "Trắc nghiệm";
}

interface SR {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

const ERR_VI: Record<string, string> = {
  "not-allowed": "Trình duyệt chặn micro. Bấm vào biểu tượng micro trên thanh địa chỉ để Cho phép, rồi thử lại.",
  "service-not-allowed": "Trình duyệt chặn micro. Hãy cho phép quyền micro và thử lại.",
  "no-speech": "Chưa nghe thấy giọng nói. Em nói to và rõ hơn rồi thử lại nhé.",
  "audio-capture": "Không tìm thấy micro. Kiểm tra micro của máy.",
  network: "Lỗi mạng khi nhận dạng giọng nói. Em có thể gõ phần trả lời bên dưới.",
};

const SPEAK_DURATION = 30; // seconds
const PRE_COUNT = 5; // get-ready countdown
const WARN_AT = 5; // last-N-seconds warning

type Phase = "idle" | "pre" | "rec" | "review";

function SpeakBox({ disabled, onTranscript }: { disabled: boolean; onTranscript: (t: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pre, setPre] = useState(PRE_COUNT);
  const [remaining, setRemaining] = useState(SPEAK_DURATION);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");

  const recRef = useRef<SR | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getSR(): (new () => SR) | undefined {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
  }

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioRef.current?.close().catch(() => {});
    recRef.current = null;
    streamRef.current = null;
    audioRef.current = null;
    setLevel(0);
  }

  useEffect(() => cleanup, []);

  function startPre() {
    if (!getSR()) {
      setNote("Trình duyệt này chưa hỗ trợ ghi âm giọng nói (hãy dùng Chrome trên máy tính). Em có thể gõ phần trả lời bên dưới.");
      return;
    }
    setNote("");
    setHeard("");
    setPre(PRE_COUNT);
    setPhase("pre");
    let n = PRE_COUNT;
    tickRef.current = setInterval(() => {
      n -= 1;
      setPre(n);
      if (n <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        beginRec();
      }
    }, 1000);
  }

  async function beginRec() {
    setPhase("rec");
    setRemaining(SPEAK_DURATION);

    // 1) Live mic level meter (real "signal received" feedback).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
      const ctx = new AC();
      audioRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const x = (buf[i]! - 128) / 128;
          sum += x * x;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      /* level meter optional — recognition still runs */
    }

    // 2) Speech-to-text transcript.
    const Ctor = getSR()!;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let t = "";
        for (let i = 0; i < e.results.length; i++) t += e.results[i]![0]!.transcript;
        setHeard(t.trim());
      };
      rec.onerror = (e) => {
        setNote(ERR_VI[e.error] ?? `Lỗi ghi âm: ${e.error}. Em có thể gõ phần trả lời bên dưới.`);
      };
      recRef.current = rec;
      rec.start();
    } catch {
      setNote("Không khởi động được micro. Em có thể gõ phần trả lời bên dưới.");
    }

    // 3) 30s countdown → auto stop.
    let r = SPEAK_DURATION;
    tickRef.current = setInterval(() => {
      r -= 1;
      setRemaining(r);
      if (r <= 0) stopRec();
    }, 1000);
  }

  function stopRec() {
    cleanup();
    setPhase("review");
  }

  const toSend = (heard || typed).trim();

  return (
    <div>
      {phase === "idle" && (
        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn mic" disabled={disabled} onClick={startPre}>
            🎙️ Bắt đầu nói (30 giây)
          </button>
          <span className="muted">Có 30 giây để nói. Đếm ngược 5 giây chuẩn bị trước khi bắt đầu.</span>
        </div>
      )}

      {phase === "pre" && (
        <div className="speak-stage">
          <div className="muted">Chuẩn bị… hãy nghĩ về câu trả lời</div>
          <div className="countdown-big" key={pre}>
            {pre > 0 ? pre : "Nói đi!"}
          </div>
        </div>
      )}

      {phase === "rec" && (
        <div className="speak-stage">
          <div
            className="mic-orb live"
            style={{ transform: `scale(${1 + Math.min(level * 0.5, 0.45)})` }}
          >
            🎙️
            <span
              className="ring"
              style={{ opacity: 0.25 + level * 0.7, transform: `scale(${1 + level * 0.5})` }}
            />
          </div>
          <div className="level-bar">
            <i style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <div className={"timer-pill" + (remaining <= WARN_AT ? " warn" : "")}>
            {remaining <= WARN_AT ? `Sắp hết — còn ${remaining}s` : `Còn ${remaining}s`}
          </div>
          <div className="live-transcript">{heard ? `“${heard}”` : "Đang nghe… em cứ nói tiếng Anh"}</div>
          {note && <div className="banner warn">{note}</div>}
          <button className="btn ghost" onClick={stopRec}>
            ⏹ Dừng sớm
          </button>
        </div>
      )}

      {phase === "review" && (
        <div className="speak-stage">
          <div className="muted">Phần nói của em:</div>
          <div className="live-transcript">{heard ? `“${heard}”` : "(không bắt được giọng — em gõ lại bên dưới nhé)"}</div>
          {note && <div className="banner warn">{note}</div>}
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn ghost" disabled={disabled} onClick={startPre}>
              🔁 Nói lại
            </button>
            <button className="btn gold" disabled={disabled || !toSend} onClick={() => onTranscript(toSend)}>
              Gửi phần nói
            </button>
          </div>
        </div>
      )}

      {/* Typed fallback — always available */}
      <p className="muted" style={{ margin: "12px 0 4px" }}>
        Hoặc gõ lại nội dung em muốn nói (dự phòng nếu micro không chạy):
      </p>
      <textarea
        rows={2}
        placeholder="Type what you would say in English…"
        value={typed}
        disabled={disabled}
        onChange={(e) => setTyped(e.target.value)}
      />
      {phase !== "rec" && phase !== "pre" && (
        <div className="row">
          <button className="btn gold" disabled={disabled || !toSend} onClick={() => onTranscript(toSend)}>
            Gửi phần nói
          </button>
          <span className="muted">Pilot chấm fluency/coherence; chấm phát âm chi tiết bổ sung sau (Azure).</span>
        </div>
      )}
    </div>
  );
}
