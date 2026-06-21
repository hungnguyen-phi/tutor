"use client";

import { useEffect, useState } from "react";
import { dashboard, teacherStats, type DashAction } from "../lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
function useDash(action: DashAction) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { dashboard<any>(action).then(setD).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, [action]);
  return { d, err };
}
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");
const Loading = ({ err }: { err: string | null }) =>
  err ? <div className="banner warn">{err === "forbidden" ? "Bạn không có quyền xem mục này." : "Lỗi: " + err}</div> : <p className="muted">Đang tải…</p>;

// ── COACH (GVCN) ──────────────────────────────────────────────────────────────
export function CoachView() {
  const { d, err } = useDash("coach");
  if (!d) return <Loading err={err} />;
  return (
    <>
      <div className="statgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="statcard"><span className="h-eyebrow">Coachee</span><div className="n">{d.counts.total}</div></div>
        <div className="statcard"><span className="h-eyebrow">Cần chú ý</span><div className="n" style={{ color: d.counts.attention ? "var(--red)" : undefined }}>{d.counts.attention}</div></div>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <span className="h-eyebrow">🧑‍🏫 Danh sách coachee · họp 4 tuần/lần</span>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Học sinh</th><th>WIG Kiến thức</th><th>Họp gần nhất</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {d.coachees.map((c: any) => (
              <tr key={c.studentId}>
                <td>{c.name}</td>
                <td><b style={{ color: "var(--navy)" }}>{c.knowledge}%</b></td>
                <td>{date(c.lastMeetingAt)}</td>
                <td>{c.needsAttention ? <span className="pill2 r">{c.overdue ? "Quá hạn họp" : "Cần hỗ trợ"}</span> : <span className="pill2 g">Ổn định</span>}</td>
              </tr>
            ))}
            {d.coachees.length === 0 && <tr><td colSpan={4} className="muted">Chưa có coachee.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ── PARENT (filtered) ─────────────────────────────────────────────────────────
export function ParentView() {
  const { d, err } = useDash("parent");
  if (!d) return <Loading err={err} />;
  if (!d.child) return <div className="banner warn">Chưa liên kết với học sinh nào.</div>;
  const c = d.child;
  const first = c.name.trim().split(/\s+/).pop();
  return (
    <>
      <div className="sb-mascot"><img src="/brand/lion-head.png" alt="" onError={(e) => (e.currentTarget.style.display = "none")} /><div className="say">Tuần này của {first} — những điểm tích cực và vùng đang luyện thêm.</div></div>
      <div className="statgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="statcard"><span className="h-eyebrow" style={{ color: "var(--green)" }}>🌟 Đã làm được</span><div className="n">{c.masteredNodes}</div><small className="muted">điểm kiến thức đã thành thạo</small></div>
        <div className="statcard"><span className="h-eyebrow">🌱 Đang luyện thêm</span><div className="n">{c.practicingNodes}</div><small className="muted">điểm đang củng cố</small></div>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <span className="h-eyebrow">📊 Tiến độ mục tiêu (Tutor theo dõi)</span>
        {c.wigs.map((w: any) => (
          <div key={w.subject} style={{ marginTop: 12 }}>
            <div className="lead-row" style={{ border: "none", padding: "2px 0" }}><span className="lbl">{w.subject}: {w.title}</span><span className="val">{w.pct}%</span></div>
            <div className="level-bar" style={{ width: "100%", height: 10 }}><i style={{ width: `${w.pct}%` }} /></div>
          </div>
        ))}
      </section>
      <section className="panel">
        <span className="h-eyebrow">🔐 Đồng ý xử lý dữ liệu (PDPL)</span>
        <div style={{ marginTop: 8 }}>{c.consent.map((x: any) => (<div className="lead-row" key={x.purpose}><span className="lbl">{x.purpose}</span><span className={`pill2 ${x.status === "active" ? "g" : "r"}`}>{x.status === "active" ? "Đang bật" : "Đã rút"}</span></div>))}</div>
      </section>
      <div className="banner" style={{ background: "#fbfbfd", border: "1px solid var(--border)", color: "var(--slate)" }}>{d.note}</div>
    </>
  );
}

// ── BUDDY (peer) ──────────────────────────────────────────────────────────────
export function BuddyView() {
  const { d, err } = useDash("buddy");
  if (!d) return <Loading err={err} />;
  const tl = (s: string) => (s === "green" ? "green" : s === "red" ? "red" : "amber");
  return (
    <>
      <div className="sb-mascot"><img src="/brand/lion-head.png" alt="" onError={(e) => (e.currentTarget.style.display = "none")} /><div className="say">Cùng nhìn lại tiến độ của {d.buddy.name} và động viên bạn nhé!</div></div>
      <section className="panel">
        <span className="h-eyebrow">🎯 Mục tiêu của {d.buddy.name}</span>
        {d.wigs.map((w: any) => (
          <div key={w.area} style={{ marginTop: 12 }}>
            <div className="lead-row" style={{ border: "none", padding: "2px 0" }}><span className="lbl">{w.title}</span><span className="val">{w.pct}%</span></div>
            <div className="level-bar" style={{ width: "100%", height: 10 }}><i style={{ width: `${w.pct}%` }} /></div>
          </div>
        ))}
      </section>
      <section className="panel">
        <span className="h-eyebrow">⚡ Lead measures tuần này</span>
        <div style={{ marginTop: 8 }}>{d.leadMeasures.map((l: any, i: number) => (<div className="lead-row" key={i}><span className={`tl ${tl(l.status)}`} /><span className="lbl">{l.label}</span><span className="val">{l.valueText}</span></div>))}</div>
        {d.commitment && <p className="muted" style={{ marginTop: 10 }}>Cam kết của bạn: <i>"{d.commitment}"</i></p>}
      </section>
      <div className="banner" style={{ background: "#fbfbfd", border: "1px solid var(--border)", color: "var(--slate)" }}>Bạn chỉ thấy tiến độ (WIG &amp; lead measures) — không thấy bài làm hay hội thoại.</div>
    </>
  );
}

// ── SUBJECT LEAD (reuses teacher-stats) ───────────────────────────────────────
export function SubjectLeadView() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { teacherStats().then(setD).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, []);
  if (!d) return <Loading err={err} />;
  const m = d.metrics;
  return (
    <>
      <div className="statgrid">
        <div className="statcard"><span className="h-eyebrow">Mastery TB</span><div className="n">{Math.round(m.mastery.rate * 100)}%</div></div>
        <div className="statcard"><span className="h-eyebrow">Node theo dõi</span><div className="n">{m.mastery.tracked}</div></div>
        <div className="statcard"><span className="h-eyebrow">Nỗ lực TB</span><div className="n">{m.effort.avgAttemptsToCorrect}</div><small className="muted">lần thử/đúng</small></div>
        <div className="statcard"><span className="h-eyebrow">Độ chính xác</span><div className="n">{Math.round(m.effort.accuracy * 100)}%</div></div>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <span className="h-eyebrow">📍 Quan niệm sai phổ biến</span>
        <table className="tbl" style={{ marginTop: 10 }}><tbody>
          {m.misconceptions.slice(0, 6).map((x: any, i: number) => (<tr key={i}><td>{x.label}</td><td style={{ textAlign: "right" }}><b style={{ color: "var(--red)" }}>{x.count}×</b></td></tr>))}
          {m.misconceptions.length === 0 && <tr><td className="muted">Chưa có dữ liệu.</td></tr>}
        </tbody></table>
      </section>
      <section className="panel">
        <span className="h-eyebrow">✅ Hàng chờ duyệt nội dung</span>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Câu</th><th>Node</th><th>Loại</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {d.review.questions.slice(0, 8).map((q: any) => (<tr key={q.id}><td>{q.key}</td><td>{q.node}</td><td>{q.kind}</td><td><span className={`pill2 ${q.status === "active" ? "g" : "a"}`}>{q.status}</span></td></tr>))}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ── COUNSELOR (safety queue) ──────────────────────────────────────────────────
export function CounselorView() {
  const { d, err } = useDash("counselor");
  if (!d) return <Loading err={err} />;
  const badge = (s: string) => (s === "new" ? <span className="pill2 r">🆕 mới</span> : s === "verifying" ? <span className="pill2 a">🔎 đang xác minh</span> : <span className="pill2 g">✓ đã xử lý</span>);
  return (
    <>
      <div className="banner warn">⚠️ {d.note}</div>
      <div className="statgrid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="statcard"><span className="h-eyebrow">Mới</span><div className="n" style={{ color: "var(--red)" }}>{d.counts.new}</div></div>
        <div className="statcard"><span className="h-eyebrow">Đang xác minh</span><div className="n">{d.counts.verifying}</div></div>
        <div className="statcard"><span className="h-eyebrow">Đã xử lý</span><div className="n">{d.counts.resolved}</div></div>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <span className="h-eyebrow">🔎 Hàng đợi an toàn (ẩn danh)</span>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Cờ</th><th>HS</th><th>Loại</th><th>Thời gian</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {d.queue.map((e: any, i: number) => (<tr key={i}><td>{e.ref}</td><td><span className="pill2 n">{e.who}</span></td><td>{e.type}</td><td>{new Date(e.at).toLocaleString("vi-VN")}</td><td>{badge(e.status)}</td></tr>))}
            {d.queue.length === 0 && <tr><td colSpan={5} className="muted">Không có cờ nào.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ── LEADERSHIP (aggregates) ───────────────────────────────────────────────────
export function LeadershipView() {
  const { d, err } = useDash("leadership");
  if (!d) return <Loading err={err} />;
  const m = d.metrics;
  return (
    <>
      <div className="statgrid">
        <div className="statcard"><span className="h-eyebrow">Học sinh</span><div className="n">{m.students}</div></div>
        <div className="statcard"><span className="h-eyebrow">Phiên học</span><div className="n">{m.sessions}</div></div>
        <div className="statcard"><span className="h-eyebrow">Mastery TB</span><div className="n">{m.masteryRate}%</div></div>
        <div className="statcard"><span className="h-eyebrow">Chi phí AI</span><div className="n">${m.aiCostUsd}</div><small className="muted">{m.aiTokens.toLocaleString()} tokens</small></div>
      </div>
      <div className="banner" style={{ marginTop: 16, background: "#fbfbfd", border: "1px solid var(--border)", color: "var(--slate)" }}>Bảng điều khiển chỉ hiển thị số liệu <b>tổng hợp</b> — không truy cập hội thoại hay dữ liệu thô của học sinh.</div>
    </>
  );
}

// ── DPO (governance) ──────────────────────────────────────────────────────────
export function DpoView() {
  const { d, err } = useDash("dpo");
  if (!d) return <Loading err={err} />;
  return (
    <>
      <div className="statgrid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="statcard"><span className="h-eyebrow">Bản ghi consent</span><div className="n">{d.counts.consentRows}</div></div>
        <div className="statcard"><span className="h-eyebrow">DSAR đang xử lý</span><div className="n">{d.counts.dsarOpen}</div></div>
        <div className="statcard"><span className="h-eyebrow">Mục đích</span><div className="n">{d.consent.length}</div></div>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <span className="h-eyebrow">🔐 Consent matrix</span>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Mục đích</th><th>Đang bật</th><th>Đã rút</th></tr></thead>
          <tbody>{d.consent.map((c: any) => (<tr key={c.purpose}><td>{c.purpose}</td><td><span className="pill2 g">{c.active}</span></td><td>{c.withdrawn ? <span className="pill2 r">{c.withdrawn}</span> : "0"}</td></tr>))}</tbody>
        </table>
      </section>
      <section className="panel">
        <span className="h-eyebrow">📜 Audit log (gần nhất)</span>
        <table className="tbl" style={{ marginTop: 10 }}><tbody>
          {d.audit.map((a: any, i: number) => (<tr key={i}><td>{new Date(a.at).toLocaleString("vi-VN")}</td><td>{a.action}</td></tr>))}
          {d.audit.length === 0 && <tr><td className="muted">Chưa có log.</td></tr>}
        </tbody></table>
      </section>
      <div className="banner" style={{ background: "#fbfbfd", border: "1px solid var(--border)", color: "var(--slate)" }}>DPO chỉ thấy governance — KHÔNG truy cập nội dung học tập của học sinh.</div>
    </>
  );
}

// ── ADMIN (RBAC / gateway / ops) ──────────────────────────────────────────────
export function AdminView() {
  const { d, err } = useDash("admin");
  if (!d) return <Loading err={err} />;
  return (
    <>
      <div className="statgrid">
        <div className="statcard"><span className="h-eyebrow">Vai trò</span><div className="n">{d.roles.length}</div></div>
        <div className="statcard"><span className="h-eyebrow">Provider</span><div className="n" style={{ fontSize: "1rem" }}>{d.gateway.provider}</div><small className="muted">{d.gateway.primary}</small></div>
        <div className="statcard"><span className="h-eyebrow">Token AI</span><div className="n">{d.gateway.tokens.toLocaleString()}</div></div>
        <div className="statcard"><span className="h-eyebrow">Chi phí AI</span><div className="n">${d.gateway.costUsd}<small className="muted"> / ${d.gateway.budgetUsd}</small></div></div>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <span className="h-eyebrow">👥 RBAC &amp; phân vai trò</span>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Vai trò</th><th>Người dùng</th><th>Số quyền</th></tr></thead>
          <tbody>{d.roles.map((r: any) => (<tr key={r.key}><td>{r.label} <span className="muted">({r.key})</span></td><td>{r.users}</td><td>{r.perms}</td></tr>))}</tbody>
        </table>
      </section>
      <section className="panel">
        <span className="h-eyebrow">🚩 Feature flags</span>
        <div style={{ marginTop: 8 }}>{d.flags.map((f: any) => (<div className="lead-row" key={f.key}><span className="lbl">{f.key}</span><span className={`pill2 ${f.on ? "g" : "n"}`}>{f.on ? "on" : "off"}</span></div>))}</div>
      </section>
    </>
  );
}
