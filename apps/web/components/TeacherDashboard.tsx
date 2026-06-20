"use client";

import { useEffect, useState } from "react";
import { teacherStats, teacherReview, type TeacherStats } from "../lib/api";
import { useAuth, signOut } from "../lib/auth";
import Login from "./Login";

export default function TeacherDashboard() {
  const { session, profile } = useAuth();
  const [data, setData] = useState<TeacherStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await teacherStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    if (session) load();
  }, [session]);

  if (session === undefined) return <main className="wrap"><p className="muted">Đang tải…</p></main>;
  if (session === null) return <Login />;

  async function setStatus(kind: "question" | "ladder", id: string, status: string) {
    setBusy(true);
    try {
      await teacherReview(kind, id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return (
      <main className="wrap">
        <div className="banner warn">
          {/forbidden/i.test(error) ? "Tài khoản này không đủ quyền xem bảng điều khiển giáo viên." : error}
        </div>
        <div className="row">
          <a className="btn ghost" href="/">↩ Về phần học sinh</a>
          <button className="btn ghost" onClick={() => signOut()}>Đăng xuất</button>
        </div>
      </main>
    );
  if (!data) return <main className="wrap"><p className="muted">Đang tải dashboard…</p></main>;

  const m = data.metrics;

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
        <h1 className="h1" style={{ margin: 0 }}>Bảng điều khiển giáo viên</h1>
        <div className="row" style={{ marginTop: 0 }}>
          <span className="muted">{profile?.full_name}</span>
          <a className="btn ghost" href="/">↩ HS</a>
          <button className="btn ghost" onClick={() => signOut()}>Đăng xuất</button>
        </div>
      </div>
      <p className="sub">Chỉ số lớp học &amp; duyệt nội dung (pilot). Số liệu tính trên dữ liệu thật của tenant Việt Anh.</p>

      {/* 3 metric cards */}
      <div className="subjects" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="panel" style={{ margin: 0 }}>
          <small className="muted">MISCONCEPTION hàng đầu</small>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {m.misconceptions.length === 0 && <span className="muted">Chưa có dữ liệu</span>}
            {m.misconceptions.slice(0, 5).map((x) => (
              <div key={x.label} className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
                <span style={{ fontSize: ".82rem" }}>{x.label}</span>
                <span className="chip">{x.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel" style={{ margin: 0 }}>
          <small className="muted">EFFORT (nỗ lực)</small>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--navy)" }}>{m.effort.avgAttemptsToCorrect}</div>
          <span className="muted">lượt thử TB tới khi đúng</span>
          <div style={{ marginTop: 8 }}>Độ chính xác: <b>{Math.round(m.effort.accuracy * 100)}%</b> ({m.effort.totalAttempts} lượt)</div>
        </div>
        <div className="panel" style={{ margin: 0 }}>
          <small className="muted">MASTERY (thành thạo)</small>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--green)" }}>{Math.round(m.mastery.rate * 100)}%</div>
          <span className="muted">{m.mastery.mastered}/{m.mastery.tracked} điểm kiến thức đã thành thạo</span>
        </div>
      </div>

      {/* Review queue */}
      <h2 className="h1" style={{ fontSize: "1.15rem", marginTop: 24 }}>Duyệt nội dung (human-in-the-loop)</h2>
      <p className="sub">Chỉ nội dung trạng thái <b>active</b> mới phục vụ học sinh. GV duyệt/thu hồi tại đây.</p>

      <div className="panel">
        <small className="muted">CÂU HỎI</small>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {data.review.questions.map((q) => (
            <div key={q.id} className="row" style={{ justifyContent: "space-between", marginTop: 0, gap: 8 }}>
              <span style={{ flex: 1, fontSize: ".82rem" }}>
                <span className="chip">{q.node}</span> {q.prompt}…
              </span>
              <span className={"chip"} style={{ background: q.status === "active" ? "var(--green-50)" : "#fff7ed", color: q.status === "active" ? "#1d7a44" : "#9a6b00" }}>
                {q.status}
              </span>
              {q.status !== "active" ? (
                <button className="btn" disabled={busy} onClick={() => setStatus("question", q.id, "active")}>Duyệt ✓</button>
              ) : (
                <button className="btn ghost" disabled={busy} onClick={() => setStatus("question", q.id, "retired")}>Thu hồi</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <small className="muted">THANG SOCRATIC</small>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {data.review.ladders.map((l) => (
            <div key={l.id} className="row" style={{ justifyContent: "space-between", marginTop: 0, gap: 8 }}>
              <span style={{ flex: 1, fontSize: ".82rem" }}>
                <span className="chip">{l.node}</span> {l.misconception}
              </span>
              <span className="chip" style={{ background: l.status === "active" ? "var(--green-50)" : "#fff7ed", color: l.status === "active" ? "#1d7a44" : "#9a6b00" }}>{l.status}</span>
              {l.status !== "active" ? (
                <button className="btn" disabled={busy} onClick={() => setStatus("ladder", l.id, "active")}>Duyệt ✓</button>
              ) : (
                <button className="btn ghost" disabled={busy} onClick={() => setStatus("ladder", l.id, "review")}>Gỡ duyệt</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
