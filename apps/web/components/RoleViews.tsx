"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Info, Lock, ShieldCheck } from "lucide-react";
import { dashboard, teacherStats, type DashAction } from "../lib/api";
import Lion from "./Lion";

/* eslint-disable @typescript-eslint/no-explicit-any */
function useDash(action: DashAction) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    dashboard<any>(action)
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [action]);
  return { d, err };
}

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

function Loading({ err }: { err: string | null }) {
  if (err) {
    return (
      <div className="banner err">
        <AlertTriangle aria-hidden strokeWidth={2} />
        <span>{err === "forbidden" ? "Bạn không có quyền xem mục này." : "Lỗi: " + err}</span>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="skel" style={{ height: 88 }} />
      <div className="skel" style={{ height: 180 }} />
    </div>
  );
}

/** Ghi chú về ranh giới quyền riêng tư — thứ mỗi vai trò KHÔNG được thấy. */
function Boundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="banner info">
      <Lock aria-hidden strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "warn" | "err" }) {
  return (
    <div className="kpi">
      <span className="muted">{label}</span>
      <b className="num" data-tone={tone}>
        {value}
      </b>
      {sub && <small className="muted">{sub}</small>}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── COACH (GVCN) ─────────────────────────────────────────────────────────────
export function CoachView() {
  const { d, err } = useDash("coach");
  if (!d) return <Loading err={err} />;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Coachee" value={d.counts.total} />
        <Kpi label="Cần chú ý" value={d.counts.attention} tone={d.counts.attention ? "err" : undefined} />
      </div>
      <section className="panel">
        <h2 className="h3">Danh sách coachee</h2>
        <p className="muted">Họp 4 tuần một lần.</p>
        <Table head={["Học sinh", "WIG Kiến thức", "Họp gần nhất", "Trạng thái"]}>
          {d.coachees.map((c: any) => (
            <tr key={c.studentId}>
              <td>{c.name}</td>
              <td>
                <b className="who-name num">{c.knowledge}%</b>
              </td>
              <td>{date(c.lastMeetingAt)}</td>
              <td>
                {c.needsAttention ? (
                  <span className="pill r">{c.overdue ? "Quá hạn họp" : "Cần hỗ trợ"}</span>
                ) : (
                  <span className="pill g">Ổn định</span>
                )}
              </td>
            </tr>
          ))}
          {d.coachees.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Chưa có coachee.
              </td>
            </tr>
          )}
        </Table>
      </section>
    </div>
  );
}

// ── PHỤ HUYNH (báo cáo đã lọc — hi-fi 4g) ────────────────────────────────────
export function ParentView() {
  const { d, err } = useDash("parent");
  if (!d) return <Loading err={err} />;
  if (!d.child) {
    return (
      <div className="banner warn">
        <AlertTriangle aria-hidden strokeWidth={2} />
        <span>Chưa liên kết với học sinh nào.</span>
      </div>
    );
  }
  const c = d.child;
  const first = c.name.trim().split(/\s+/).pop();
  return (
    <div className="stack">
      <div className="pr-head">
        <div>
          <span className="eyebrow">Báo cáo tuần</span>
          <h1 className="pr-name">{c.name}</h1>
        </div>
        {/* Chip tuần tĩnh — chưa có chọn tuần lịch sử nên không vẽ dropdown giả */}
        <span className="pr-week">
          <CalendarDays aria-hidden strokeWidth={2} />
          Tuần này
        </span>
      </div>

      {/* Hi-fi vẽ buổi · phút · chuỗi — dashboard(parent) chưa có 3 trường đó,
          hiển thị 2 chỉ số THẬT đang có thay vì bịa số. */}
      <div className="pr-stats">
        <div className="pr-stat">
          <b className="num">{c.masteredNodes}</b>
          <span>điểm đã thành thạo</span>
        </div>
        <div className="pr-stat">
          <b className="num">{c.practicingNodes}</b>
          <span>điểm đang luyện thêm</span>
        </div>
      </div>

      {/* Hi-fi đặt tên "Tiến bộ trong tuần" kèm delta 62→68% — API chưa có số
          trước/sau nên giữ tên trung thực + bar navy hiện trạng. */}
      <section className="pr-card">
        <span className="pr-card-title">Tiến độ mục tiêu</span>
        {c.wigs.length === 0 && <p className="muted">Chưa có mục tiêu được Tutor theo dõi.</p>}
        {c.wigs.map((w: any) => (
          <div key={w.subject}>
            <div className="pr-wig-head">
              <span>
                {w.subject} · {w.title}
              </span>
              <b className="num">{w.pct}%</b>
            </div>
            <div
              className="pr-meter"
              role="progressbar"
              aria-valuenow={w.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={w.title}
            >
              <i style={{ "--p": `${w.pct}%` } as React.CSSProperties} />
            </div>
          </div>
        ))}
        {/* Copy PDPL bắt buộc giữ nguyên (PRODUCT.md) */}
        <p className="pr-privacy">
          Phụ huynh xem <b>nỗ lực và tiến bộ</b> — không xem nội dung hội thoại của con.
        </p>
      </section>

      <section className="pr-card">
        <span className="pr-card-title">Đồng ý xử lý dữ liệu (PDPL)</span>
        {c.consent.length === 0 && <p className="muted">Chưa có bản ghi đồng ý.</p>}
        {c.consent.map((x: any) => (
          <div className="pr-consent-row" key={x.purpose}>
            <ShieldCheck
              aria-hidden
              strokeWidth={2}
              data-ok={x.status === "active" || undefined}
            />
            <span className="pr-consent-label">{x.purpose}</span>
            <b data-state={x.status === "active" ? "on" : "off"}>
              {x.status === "active" ? "đang hiệu lực" : "đã rút"}
            </b>
          </div>
        ))}
      </section>

      <div className="pr-tip">
        <Lion mood="idle" size={34} decorative />
        <span>
          Khen {first} về <b>nỗ lực tuần này</b> — động lực tốt hơn điểm số!
        </span>
      </div>

      <Boundary>{d.note}</Boundary>
    </div>
  );
}

// ── BUDDY ────────────────────────────────────────────────────────────────────
export function BuddyView() {
  const { d, err } = useDash("buddy");
  if (!d) return <Loading err={err} />;
  return (
    <div className="stack">
      <div className="lion-says">
        <Lion mood="idle" size={80} decorative />
        <p className="lion-bubble">Cùng nhìn lại tiến độ của {d.buddy.name} và động viên bạn nhé!</p>
      </div>

      <section className="panel">
        <h2 className="h3">Mục tiêu của {d.buddy.name}</h2>
        {d.wigs.map((w: any) => (
          <div className="wig" key={w.area}>
            <div className="wig-head">
              <b>{w.title}</b>
              <span className="num">{w.pct}%</span>
            </div>
            <div className="meter" role="progressbar" aria-valuenow={w.pct} aria-valuemin={0} aria-valuemax={100} aria-label={w.title}>
              <i style={{ "--p": `${w.pct}%` } as React.CSSProperties} />
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2 className="h3">Lead measures tuần này</h2>
        {d.leadMeasures.map((l: any, i: number) => (
          <div className="lead-row" key={i}>
            <span className="tl" data-status={l.status} aria-hidden />
            <span className="lead-label">{l.label}</span>
            <span className="num">{l.valueText}</span>
          </div>
        ))}
        {d.commitment && <p className="muted">Cam kết của bạn: “{d.commitment}”</p>}
      </section>

      <Boundary>
        Bạn chỉ thấy tiến độ (WIG &amp; lead measures) — không thấy bài làm hay hội thoại.
      </Boundary>
    </div>
  );
}

// ── TỔ TRƯỞNG CHUYÊN MÔN ─────────────────────────────────────────────────────
export function SubjectLeadView() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    teacherStats()
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (!d) return <Loading err={err} />;
  const m = d.metrics;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Mastery TB" value={`${Math.round(m.mastery.rate * 100)}%`} />
        <Kpi label="Node theo dõi" value={m.mastery.tracked} />
        <Kpi label="Nỗ lực TB" value={m.effort.avgAttemptsToCorrect} sub="lần thử/đúng" />
        <Kpi label="Độ chính xác" value={`${Math.round(m.effort.accuracy * 100)}%`} />
      </div>

      <section className="panel">
        <h2 className="h3">Quan niệm sai phổ biến</h2>
        <Table head={["Quan niệm sai", "Số lần"]}>
          {m.misconceptions.slice(0, 6).map((x: any, i: number) => (
            <tr key={i}>
              <td>{x.label}</td>
              <td>
                <b className="num" data-tone="warn">
                  {x.count}×
                </b>
              </td>
            </tr>
          ))}
          {m.misconceptions.length === 0 && (
            <tr>
              <td colSpan={2} className="muted">
                Chưa có dữ liệu.
              </td>
            </tr>
          )}
        </Table>
      </section>

      <section className="panel">
        <h2 className="h3">Hàng chờ duyệt nội dung</h2>
        <Table head={["Câu", "Node", "Loại", "Trạng thái"]}>
          {d.review.questions.slice(0, 8).map((q: any) => (
            <tr key={q.id}>
              <td>{q.key}</td>
              <td>{q.node}</td>
              <td>{q.kind}</td>
              <td>
                <span className={`pill ${q.status === "active" ? "g" : "a"}`}>{q.status}</span>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}

// ── CỐ VẤN TÂM LÝ ────────────────────────────────────────────────────────────
export function CounselorView() {
  const { d, err } = useDash("counselor");
  if (!d) return <Loading err={err} />;
  const badge = (s: string) =>
    s === "new" ? (
      <span className="pill r">mới</span>
    ) : s === "verifying" ? (
      <span className="pill a">đang xác minh</span>
    ) : (
      <span className="pill g">đã xử lý</span>
    );
  return (
    <div className="stack">
      <div className="banner warn">
        <AlertTriangle aria-hidden strokeWidth={2} />
        <span>{d.note}</span>
      </div>

      <div className="kpis">
        <Kpi label="Mới" value={d.counts.new} tone={d.counts.new ? "err" : undefined} />
        <Kpi label="Đang xác minh" value={d.counts.verifying} />
        <Kpi label="Đã xử lý" value={d.counts.resolved} />
      </div>

      <section className="panel">
        <h2 className="h3">Hàng đợi an toàn</h2>
        <p className="muted">Đã ẩn danh. Người xác minh trước, không tự báo phụ huynh.</p>
        <Table head={["Cờ", "HS", "Loại", "Thời gian", "Trạng thái"]}>
          {d.queue.map((e: any, i: number) => (
            <tr key={i}>
              <td>{e.ref}</td>
              <td>
                <span className="pill">{e.who}</span>
              </td>
              <td>{e.type}</td>
              <td>{new Date(e.at).toLocaleString("vi-VN")}</td>
              <td>{badge(e.status)}</td>
            </tr>
          ))}
          {d.queue.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Không có cờ nào.
              </td>
            </tr>
          )}
        </Table>
      </section>
    </div>
  );
}

// ── BAN GIÁM HIỆU ────────────────────────────────────────────────────────────
export function LeadershipView() {
  const { d, err } = useDash("leadership");
  if (!d) return <Loading err={err} />;
  const m = d.metrics;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Học sinh" value={m.students} />
        <Kpi label="Phiên học" value={m.sessions} />
        <Kpi label="Mastery TB" value={`${m.masteryRate}%`} />
        <Kpi label="Chi phí AI" value={`$${m.aiCostUsd}`} sub={`${m.aiTokens.toLocaleString()} tokens`} />
      </div>
      <Boundary>
        Bảng điều khiển chỉ hiển thị số liệu <b>tổng hợp</b> — không truy cập hội thoại hay dữ liệu
        thô của học sinh.
      </Boundary>
    </div>
  );
}

// ── DPO ──────────────────────────────────────────────────────────────────────
export function DpoView() {
  const { d, err } = useDash("dpo");
  if (!d) return <Loading err={err} />;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Bản ghi consent" value={d.counts.consentRows} />
        <Kpi label="DSAR đang xử lý" value={d.counts.dsarOpen} />
        <Kpi label="Mục đích" value={d.consent.length} />
      </div>

      <section className="panel">
        <h2 className="h3">Consent matrix</h2>
        <Table head={["Mục đích", "Đang bật", "Đã rút"]}>
          {d.consent.map((c: any) => (
            <tr key={c.purpose}>
              <td>{c.purpose}</td>
              <td>
                <span className="pill g">{c.active}</span>
              </td>
              <td>{c.withdrawn ? <span className="pill r">{c.withdrawn}</span> : "0"}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="panel">
        <h2 className="h3">Audit log gần nhất</h2>
        <Table head={["Thời gian", "Hành động"]}>
          {d.audit.map((a: any, i: number) => (
            <tr key={i}>
              <td>{new Date(a.at).toLocaleString("vi-VN")}</td>
              <td>{a.action}</td>
            </tr>
          ))}
          {d.audit.length === 0 && (
            <tr>
              <td colSpan={2} className="muted">
                Chưa có log.
              </td>
            </tr>
          )}
        </Table>
      </section>

      <Boundary>DPO chỉ thấy governance — không truy cập nội dung học tập của học sinh.</Boundary>
    </div>
  );
}

// ── ADMIN ────────────────────────────────────────────────────────────────────
export function AdminView() {
  const { d, err } = useDash("admin");
  if (!d) return <Loading err={err} />;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Vai trò" value={d.roles.length} />
        <Kpi label="Provider" value={<span className="kpi-sm">{d.gateway.provider}</span>} sub={d.gateway.primary} />
        <Kpi label="Token AI" value={d.gateway.tokens.toLocaleString()} />
        <Kpi label="Chi phí AI" value={`$${d.gateway.costUsd}`} sub={`ngân sách $${d.gateway.budgetUsd}`} />
      </div>

      <section className="panel">
        <h2 className="h3">RBAC &amp; phân vai trò</h2>
        <Table head={["Vai trò", "Người dùng", "Số quyền"]}>
          {d.roles.map((r: any) => (
            <tr key={r.key}>
              <td>
                {r.label} <span className="muted">({r.key})</span>
              </td>
              <td>{r.users}</td>
              <td>{r.perms}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="panel">
        <h2 className="h3">Feature flags</h2>
        {d.flags.map((f: any) => (
          <div className="lead-row" key={f.key}>
            <span className="lead-label">{f.key}</span>
            <span className={`pill ${f.on ? "g" : ""}`}>{f.on ? "bật" : "tắt"}</span>
          </div>
        ))}
      </section>

      <div className="banner info">
        <Info aria-hidden strokeWidth={2} />
        <span>Khoá LLM chỉ tồn tại trong function secrets, không bao giờ ở trình duyệt.</span>
      </div>
    </div>
  );
}
