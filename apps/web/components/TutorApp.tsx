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
    if (!ses || !q || busy || done) return;
    setPicked(ans);
    setMsgs((m) => [...m, { role: "student", text: ans }]);
    setBusy(true);
    setLoading(true);
    try {
      const res = await answer(ses.sessionId, q.id, ans);
      applyTurn(res);
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
          <div className="qprompt">{q.prompt}</div>

          {/* Objective with options (MCQ) */}
          {q.kind === "objective" && q.options && (
            <div className="options">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  className={
                    "option" +
                    (picked === opt ? (done ? " correct" : " wrong") : "") +
                    (done && q.options ? "" : "")
                  }
                  disabled={busy || done}
                  onClick={() => submitObjective(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Objective free-input (parametrized) */}
          {q.kind === "objective" && !q.options && (
            <div className="row">
              <input
                type="text"
                placeholder="Nhập đáp án…"
                value={text}
                disabled={busy || done}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitObjective(text.trim())}
              />
              <button className="btn" disabled={busy || done || !text.trim()} onClick={() => submitObjective(text.trim())}>
                Trả lời
              </button>
            </div>
          )}

          {/* Writing */}
          {q.kind === "writing" && (
            <div>
              <textarea
                rows={4}
                placeholder="Viết bài của em ở đây (3–4 câu)…"
                value={text}
                disabled={busy || done}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="row">
                <button className="btn" disabled={busy || done || !text.trim()} onClick={submitWriting}>
                  Nộp bài viết
                </button>
                <span className="muted">Phản hồi mang tính góp ý (formative), không phải điểm chính thức.</span>
              </div>
            </div>
          )}

          {/* Speaking */}
          {q.kind === "speaking" && (
            <SpeakBox disabled={busy || done} onTranscript={submitSpeaking} />
          )}
        </div>
      )}

      {/* Thread */}
      <div className="thread">
        {msgs.map((m, i) =>
          m.role === "student" ? (
            <div key={i} className="bubble student">
              <div className="who">Em</div>
              {m.text}
            </div>
          ) : m.role === "tutor" ? (
            <div key={i} className="bubble tutor">
              <div className="who">Tutor</div>
              {m.text}
            </div>
          ) : m.role === "hint" ? (
            <div key={i} className="hint">
              <div className="label">GỢI Ý SOCRATIC</div>
              {m.text}
            </div>
          ) : m.role === "ok" ? (
            <div key={i} className="banner ok">
              ✓ {m.text}
            </div>
          ) : (
            <div key={i} className="feedback">
              {m.text}
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

function kindLabel(k: string): string {
  return k === "writing" ? "Viết" : k === "speaking" ? "Nói" : k === "rubric" ? "Tự luận" : "Trắc nghiệm";
}

function SpeakBox({ disabled, onTranscript }: { disabled: boolean; onTranscript: (t: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState("");
  const recRef = useRef<unknown>(null);

  function toggle() {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
          onend: () => void;
          start: () => void;
          stop: () => void;
        })
      | undefined;
    if (!SR) {
      alert("Trình duyệt chưa hỗ trợ ghi âm giọng nói. Hãy dùng Chrome trên máy tính.");
      return;
    }
    if (recording) {
      (recRef.current as { stop: () => void } | null)?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript ?? "";
      setHeard(t);
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    setHeard("");
    setRecording(true);
    rec.start();
  }

  return (
    <div>
      <div className="row">
        <button className={"btn mic" + (recording ? " recording" : "")} disabled={disabled} onClick={toggle}>
          {recording ? "⏹ Dừng ghi" : "🎙️ Bắt đầu nói (tiếng Anh)"}
        </button>
        {heard && (
          <button className="btn gold" disabled={disabled} onClick={() => onTranscript(heard)}>
            Gửi phần nói
          </button>
        )}
      </div>
      {heard && (
        <p className="muted" style={{ marginTop: 8 }}>
          Nghe được: “{heard}”
        </p>
      )}
      <p className="muted">Pilot dùng nhận dạng giọng nói của trình duyệt; chấm phát âm chi tiết sẽ bổ sung sau (Azure).</p>
    </div>
  );
}
