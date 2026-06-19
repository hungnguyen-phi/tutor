"use client";

import { useState, useRef } from "react";
import {
  diagnose,
  answer,
  writing,
  speaking,
  type DiagnoseResult,
  type DiagnoseQuestion,
  type TurnResult,
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

  function next() {
    if (!ses) return;
    if (qi + 1 < ses.questions.length) {
      setQi(qi + 1);
      reset();
    } else {
      // session done — back to subject pick, keeping a friendly note
      setSubject(null);
      setSes(null);
      reset();
    }
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

function SpeakBox({ disabled, onTranscript }: { disabled: boolean; onTranscript: (t: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const recRef = useRef<SR | null>(null);

  function getSR(): (new () => SR) | undefined {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
  }

  function toggle() {
    const Ctor = getSR();
    if (!Ctor) {
      setNote("Trình duyệt này chưa hỗ trợ ghi âm giọng nói (hãy dùng Chrome), nhưng em có thể gõ phần trả lời bên dưới.");
      return;
    }
    if (recording) {
      recRef.current?.stop();
      return;
    }
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
        setRecording(false);
      };
      rec.onend = () => setRecording(false);
      recRef.current = rec;
      setHeard("");
      setNote("");
      setRecording(true);
      rec.start();
    } catch {
      setNote("Không khởi động được micro. Em có thể gõ phần trả lời bên dưới.");
      setRecording(false);
    }
  }

  const toSend = (heard || typed).trim();

  return (
    <div>
      <div className="row" style={{ marginTop: 0 }}>
        <button className={"btn mic" + (recording ? " recording" : "")} disabled={disabled} onClick={toggle}>
          {recording ? "⏹ Dừng ghi" : "🎙️ Bắt đầu nói (tiếng Anh)"}
        </button>
        {recording && <span className="muted">Đang nghe… nói xong bấm “Dừng ghi”.</span>}
      </div>

      {heard && (
        <p className="muted" style={{ marginTop: 8 }}>
          Nghe được: “{heard}”
        </p>
      )}
      {note && <div className="banner warn">{note}</div>}

      <p className="muted" style={{ margin: "10px 0 4px" }}>
        Hoặc gõ lại nội dung em muốn nói (dự phòng nếu micro không chạy):
      </p>
      <textarea
        rows={2}
        placeholder="Type what you would say in English…"
        value={typed}
        disabled={disabled}
        onChange={(e) => setTyped(e.target.value)}
      />

      <div className="row">
        <button className="btn gold" disabled={disabled || !toSend} onClick={() => onTranscript(toSend)}>
          Gửi phần nói
        </button>
        <span className="muted">Pilot chấm fluency/coherence từ lời nói; chấm phát âm chi tiết sẽ bổ sung sau (Azure).</span>
      </div>
    </div>
  );
}
