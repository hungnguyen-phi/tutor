"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Download,
  EyeOff,
  Home,
  Inbox,
  Info,
  LayoutGrid,
  LogOut,
  Printer,
  ScanSearch,
  ShieldAlert,
  Undo2,
  UploadCloud,
  Users, Gift,} from "lucide-react";
import { MathText } from "../lib/mathrender";
import "katex/dist/katex.min.css";
import {
  teacherStats,
  teacherReview,
  gradingList,
  gradingFile,
  gradingGrade,
  type GradingItem,
  recomputeQuestionStats,
  createOverride,
  type TeacherStats,
  type RosterStudent,
} from "../lib/api";
import { toCsv, downloadText, dateStamp, printReport } from "../lib/export";
import { useAuth, signOut, isAllowed, roleHome } from "../lib/auth";
import RedirectToLogin from "./RedirectToLogin";
import StudioIntake from "./StudioIntake";
import QuestionIntake from "./QuestionIntake";
import HocLieuTab from "./HocLieuTab";

/** Top bar hi-fi 4f: crest 34 + wordmark + tên GV thật từ profile + avatar chữ cái. */
function TopBar({ name, initial }: { name: string; initial: string }) {
  return (
    <header className="tdb-top">
      <div className="tdb-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-crest-80.webp" alt="" width={34} />
        <div>
          <b>AI Tutor · Giáo viên</b>
          <span>Trường Việt Anh</span>
        </div>
      </div>
      <div className="tdb-user">
        <span className="tdb-user-name">{name}</span>
        <span className="tdb-avatar" aria-hidden>
          {initial}
        </span>
        <a className="btn btn-quiet role-home" href="/app">
          <Home aria-hidden strokeWidth={2} />
          Trang chính
        </a>
        <button
          className="btn btn-quiet"
          onClick={() => signOut().then(() => (window.location.href = "/"))}
        >
          <LogOut aria-hidden strokeWidth={2} />
          Thoát
        </button>
      </div>
    </header>
  );
}

// ── Tiện ích trình bày (thuần hiển thị, không suy diễn số) ────────────────────
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Thời gian tương đối tiếng Việt cho cột "hoạt động gần nhất". */
function relTime(iso: string | null): string {
  if (!iso) return "chưa học";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const diff = Date.now() - ms;
  const d = Math.floor(diff / 86_400_000);
  if (d <= 0) return "hôm nay";
  if (d === 1) return "hôm qua";
  if (d < 7) return `${d} ngày trước`;
  if (d < 30) return `${Math.floor(d / 7)} tuần trước`;
  return `${Math.floor(d / 30)} tháng trước`;
}

/** Cờ → nhóm màu (đi kèm CHỮ, không chỉ dựa vào màu — a11y). */
const flagKind: Record<string, string> = {
  "cần kèm": "warn",
  "đến hạn ôn": "sky",
  "chưa bắt đầu": "mute",
  "lâu chưa học": "mane",
};
function FlagChips({ flags }: { flags: string[] }) {
  if (flags.length === 0) {
    return (
      <span className="tdb-chip" data-kind="ok">
        <Check aria-hidden strokeWidth={2.5} />
        ổn
      </span>
    );
  }
  return (
    <span className="tdb-chips">
      {flags.map((f) => (
        <span className="tdb-chip" data-kind={flagKind[f] ?? "mute"} key={f}>
          {f}
        </span>
      ))}
    </span>
  );
}

const initialOf = (name: string) => (name.split(/\s+/).pop() ?? "?").charAt(0).toUpperCase();

type Tab = "overview" | "students" | "topics" | "hoclieu" | "grading" | "content";

export default function TeacherDashboard() {
  const { session, profile, roles, ready } = useAuth();
  const [data, setData] = useState<TeacherStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

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

  async function setStatus(kind: "question" | "ladder", id: string, status: string) {
    setBusy(id);
    try {
      await teacherReview(kind, id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // H5 — GV ẨN một câu kém (không phục vụ HS nữa), kèm LÝ DO (bắt buộc, lưu nhật
  // ký). Nội dung gốc không đổi; gỡ ẩn thì câu trở lại. Reason qua prompt gọn.
  async function hideQuestion(id: string) {
    const reason = window.prompt("Lý do ẩn câu này (bắt buộc — lưu vào nhật ký):");
    if (!reason || !reason.trim()) return;
    setBusy(id);
    try {
      await createOverride(id, reason.trim(), "hide");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // Quét câu kém (question-stats): tính p_value/discrimination toàn ngân hàng,
  // câu quá dễ/khó/không phân biệt tự về hàng chờ duyệt. Đêm có pg_cron chạy
  // hộ — nút này để giáo viên chủ động sau một buổi lớp làm bài.
  const [scanNote, setScanNote] = useState<string | null>(null);
  async function scanQuestions() {
    setBusy("scan");
    setScanNote(null);
    try {
      const r = await recomputeQuestionStats();
      setScanNote(
        r.flagged > 0
          ? `Đã tính lại ${r.updated} câu — ${r.flagged} câu kém vừa được đưa vào hàng chờ duyệt.`
          : `Đã tính lại ${r.updated} câu — chưa câu nào chạm ngưỡng cần thay.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // Cổng đăng nhập — TeacherDashboard tự dựng top bar theo hi-fi 4f nên không
  // dùng RoleShell nữa, nhưng giữ nguyên 3 trạng thái phiên của nó.
  if (session === undefined || (session && !ready)) {
    return (
      <div className="tdb">
        <main className="tdb-main">
          <div className="skel" style={{ height: 88 }} />
          <div className="skel" style={{ height: 240 }} />
        </main>
      </div>
    );
  }
  if (session === null) return <RedirectToLogin />;

  const name = profile?.full_name?.trim() || "Giáo viên";
  const initial = initialOf(name);

  // Cổng phân quyền: chỉ giáo viên/admin vào console giáo viên (phòng-thủ-chiều-sâu;
  // teacher-stats phía server cũng đã chặn dữ liệu sai vai).
  if (!isAllowed(roles, ["teacher"])) {
    return (
      <div className="tdb">
        <TopBar name={name} initial={initial} />
        <main className="tdb-main">
          <div className="access-denied">
            <ShieldAlert aria-hidden strokeWidth={2} />
            <h1>Console giáo viên không dành cho tài khoản của bạn</h1>
            <p>
              Bạn đang đăng nhập với vai <b>{profile?.role ?? "chưa rõ"}</b>. Nếu đây là nhầm lẫn,
              hãy báo quản trị viên.
            </p>
            <a className="btn" href={roleHome(profile?.role)}>
              Về trang của bạn
            </a>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tdb">
        <TopBar name={name} initial={initial} />
        <main className="tdb-main">
          <div className="banner err">
            <AlertTriangle aria-hidden strokeWidth={2} />
            <span>
              {/forbidden/i.test(error)
                ? "Tài khoản này không đủ quyền xem bảng điều khiển giáo viên."
                : error}
            </span>
          </div>
          <div className="row">
            <a className="btn btn-ghost" href="/learn">
              Về phần học sinh
            </a>
            <button className="btn btn-ghost" onClick={() => signOut()}>
              Đăng xuất
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tdb">
        <TopBar name={name} initial={initial} />
        <main className="tdb-main">
          <div className="skel" style={{ height: 88 }} />
          <div className="skel" style={{ height: 240 }} />
        </main>
      </div>
    );
  }

  return (
    <div className="tdb">
      <TopBar name={name} initial={initial} />
      <main className="tdb-main">
        <Console
          data={data}
          tab={tab}
          setTab={setTab}
          busy={busy}
          setStatus={setStatus}
          onHide={hideQuestion}
          onScan={scanQuestions}
          scanNote={scanNote}
        />
      </main>
    </div>
  );
}

// ── Thân bảng điều khiển — tách riêng để `data` đã chắc chắn không null ────────
function Console({
  data,
  tab,
  setTab,
  busy,
  setStatus,
  onHide,
  onScan,
  scanNote,
}: {
  data: TeacherStats;
  tab: Tab;
  setTab: (t: Tab) => void;
  busy: string | null;
  setStatus: (kind: "question" | "ladder", id: string, status: string) => void;
  onHide: (id: string) => void;
  onScan: () => void;
  scanNote: string | null;
}) {
  const [gradingCount, setGradingCount] = useState(0); // huy hiệu "còn bao nhiêu bài chờ chấm"
  const m = data.metrics;
  const roster = data.roster;
  const topics = data.topics ?? [];
  const activity = data.activity;
  const masteryPct = Math.round(m.mastery.rate * 100);

  const pendingReview =
    data.review.questions.filter((q) => q.status !== "active").length +
    data.review.ladders.filter((l) => l.status !== "active").length;

  const needAttention = roster?.needAttention ?? 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "overview", label: "Tổng quan", icon: <LayoutGrid aria-hidden strokeWidth={2} /> },
    { id: "students", label: "Học sinh", icon: <Users aria-hidden strokeWidth={2} />, badge: roster?.total },
    { id: "topics", label: "Chủ đề", icon: <BookOpen aria-hidden strokeWidth={2} />, badge: topics.length || undefined },
    { id: "hoclieu", label: "Học liệu", icon: <Gift aria-hidden strokeWidth={2} /> },
    { id: "grading", label: "Chấm bài", icon: <ClipboardCheck aria-hidden strokeWidth={2} />, badge: gradingCount || undefined },
    { id: "content", label: "Duyệt & nội dung", icon: <Inbox aria-hidden strokeWidth={2} />, badge: pendingReview || undefined },
  ];

  return (
    <>
      {/* KPI lớp — chỉ số nỗ lực THẬT (không phải hero-metric trang trí) */}
      <div className="tdb-kpis">
        <div className="tdb-kpi">
          <span>Nỗ lực trung bình</span>
          <b className="num">
            {m.effort.avgAttemptsToCorrect} <small>lượt thử tới khi đúng</small>
          </b>
        </div>
        <div className="tdb-kpi">
          <span>Độ chính xác</span>
          <b className="num">
            {pct(m.effort.accuracy)} <small>{m.effort.totalAttempts} lượt</small>
          </b>
        </div>
        <div className="tdb-kpi">
          <span>Thành thạo</span>
          <b className="num">
            {masteryPct}%{" "}
            <small>
              {m.mastery.mastered}/{m.mastery.tracked} điểm
            </small>
          </b>
        </div>
        <div className="tdb-kpi" data-tone={needAttention > 0 ? "mane" : undefined}>
          <span>Học sinh cần chú ý</span>
          <b className="num">
            {needAttention} <small>trên {roster?.total ?? 0} em</small>
          </b>
        </div>
      </div>

      {/* Thanh tab điều hướng bảng điều khiển */}
      <div className="tdb-tabs" role="tablist" aria-label="Khu vực quản trị">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className="tdb-tab"
            onClick={() => setTab(tb.id)}
          >
            {tb.icon}
            {tb.label}
            {typeof tb.badge === "number" && tb.badge > 0 && (
              <span className="tdb-tab-badge num">{tb.badge}</span>
            )}
          </button>
        ))}
        {/* In / lưu PDF bản báo cáo đang xem — ẩn khỏi bản in bằng @media print */}
        <button className="tdb-tab tdb-print-btn" onClick={printReport} title="In hoặc lưu trang này thành PDF">
          <Printer aria-hidden strokeWidth={2} />
          Lưu PDF
        </button>
      </div>

      {tab === "overview" && (
        <OverviewTab m={m} activity={activity} masteryPct={masteryPct} />
      )}
      {tab === "students" && <StudentsTab roster={roster} studentNodes={data.studentNodes} />}
      {tab === "topics" && <TopicsTab topics={topics} />}
      {tab === "hoclieu" && <HocLieuTab />}
      {tab === "grading" && <GradingTab onCount={setGradingCount} />}
      {tab === "content" && (
        <ContentTab
          data={data}
          busy={busy}
          setStatus={setStatus}
          onHide={onHide}
          pending={pendingReview}
          onScan={onScan}
          scanNote={scanNote}
        />
      )}
    </>
  );
}

// ── Tab: Tổng quan ────────────────────────────────────────────────────────────
function OverviewTab({
  m,
  activity,
  masteryPct,
}: {
  m: TeacherStats["metrics"];
  activity: TeacherStats["activity"];
  masteryPct: number;
}) {
  const signals = activity
    ? [
        { label: "Đang học lúc này", value: activity.activeSessions, sub: "phiên", tone: "ok" },
        { label: "Hoạt động 7 ngày", value: activity.activeStudents7d, sub: "em", tone: "sky" },
        { label: "Đến hạn ôn", value: activity.dueReviewsTotal, sub: "lượt", tone: "mane" },
        { label: "Bài chờ chấm", value: activity.pendingSubmissions, sub: "bài", tone: "navy" },
      ]
    : [];

  return (
    <div className="tdb-grid">
      <div className="tdb-col">
        {signals.length > 0 && (
          <section className="tdb-card">
            <span className="tdb-card-title">Nhịp lớp hôm nay</span>
            <div className="tdb-signals">
              {signals.map((s) => (
                <div className="tdb-signal" data-tone={s.tone} key={s.label}>
                  <b className="num">{s.value}</b>
                  <span>
                    {s.label}
                    <small> · {s.sub}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quan niệm sai cần chú ý — dữ liệu thật, mục nóng nhất nền hổ phách */}
        <section className="tdb-card">
          <div className="tdb-card-head">
            <span className="tdb-card-title">Quan niệm sai cần chú ý</span>
          </div>
          {m.misconceptions.length === 0 && <p className="muted">Chưa có dữ liệu.</p>}
          {m.misconceptions.slice(0, 6).map((x, i) => (
            <div className="tdb-flag" key={x.label} data-hot={i === 0 || undefined}>
              <span className="tdb-flag-rank num" aria-hidden>
                {i + 1}
              </span>
              <div className="tdb-flag-label">
                <b title={x.label}>{x.label}</b>
                <span>{x.count} lượt ghi nhận trong lớp</span>
              </div>
            </div>
          ))}
          <div className="tdb-note">
            <Info aria-hidden strokeWidth={2} />
            <span>
              Cờ an toàn luôn qua giáo viên xác minh — không bao giờ tự động gửi phụ huynh.
            </span>
          </div>
        </section>
      </div>

      <div className="tdb-col">
        {/* Thành thạo lớp — 1 đoạn gold trên track, không bịa phân đoạn */}
        <section className="tdb-card">
          <span className="tdb-card-title">Thành thạo lớp</span>
          <div
            className="tdb-bar"
            role="img"
            aria-label={`Thành thạo ${masteryPct}% điểm kiến thức được theo dõi`}
          >
            <i className="seg-gold" style={{ width: `${masteryPct}%` }} />
          </div>
          <div className="tdb-legend">
            <span>
              <i style={{ background: "var(--gold)" }} />
              Thành thạo
            </span>
            <span>
              <i style={{ background: "var(--line)" }} />
              Chưa thành thạo
            </span>
          </div>
          <p className="muted">
            {m.mastery.mastered}/{m.mastery.tracked} điểm kiến thức được theo dõi.
          </p>
        </section>
      </div>
    </div>
  );
}

// ── Tab: Học sinh (roster) ────────────────────────────────────────────────────
type SortKey = "attention" | "name" | "mastered" | "accuracy" | "recent";

function StudentsTab({ roster, studentNodes }: { roster: TeacherStats["roster"]; studentNodes?: TeacherStats["studentNodes"] }) {
  const [sort, setSort] = useState<SortKey>("attention");
  const students = roster?.students ?? [];

  const sorted = useMemo(() => {
    const arr = [...students];
    switch (sort) {
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name, "vi"));
      case "mastered":
        return arr.sort((a, b) => b.mastered - a.mastered);
      case "accuracy":
        return arr.sort((a, b) => b.accuracy - a.accuracy);
      case "recent":
        return arr.sort(
          (a, b) => (Date.parse(b.lastActiveAt ?? "") || 0) - (Date.parse(a.lastActiveAt ?? "") || 0),
        );
      default: // attention — giữ thứ tự server (nhiều cờ trước)
        return arr;
    }
  }, [students, sort]);

  if (students.length === 0) {
    return (
      <section className="tdb-card">
        <div className="empty">
          <Users aria-hidden strokeWidth={1.75} />
          <p className="muted">Chưa có học sinh nào trong lớp này.</p>
        </div>
      </section>
    );
  }

  const sorts: { key: SortKey; label: string }[] = [
    { key: "attention", label: "Cần chú ý" },
    { key: "recent", label: "Gần đây" },
    { key: "mastered", label: "Thành thạo" },
    { key: "accuracy", label: "Chính xác" },
    { key: "name", label: "Tên A–Z" },
  ];

  // Xuất CSV danh sách theo đúng thứ tự đang xem — GV mở bằng Excel để lọc/lưu.
  const exportCsv = () => {
    const rows = sorted.map((s) => [
      s.name,
      s.grade ? `Khối ${s.grade}` : "",
      s.mastered,
      s.tracked,
      s.attempts > 0 ? `${Math.round(s.accuracy * 100)}%` : "",
      s.avgEffort ? s.avgEffort.toFixed(1) : "",
      s.attempts,
      s.dueReviews,
      s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString("vi-VN") : "",
      s.flags.join("; "),
    ]);
    downloadText(
      `hoc-sinh-${dateStamp()}.csv`,
      toCsv(
        ["Học sinh", "Khối", "Thành thạo", "Theo dõi", "Chính xác", "Nỗ lực TB", "Lượt trả lời", "Đến hạn ôn", "Hoạt động gần nhất", "Cờ chú ý"],
        rows,
      ),
    );
  };

  return (
    <section className="tdb-card">
      <div className="tdb-card-head">
        <span className="tdb-card-title">Danh sách học sinh</span>
        <div className="tdb-sort" role="group" aria-label="Sắp xếp">
          {sorts.map((s) => (
            <button
              key={s.key}
              className="tdb-sort-btn"
              aria-pressed={sort === s.key}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
          <button className="tdb-sort-btn tdb-export" onClick={exportCsv} title="Tải danh sách ra file CSV (mở bằng Excel)">
            <Download aria-hidden strokeWidth={2} width={14} height={14} /> CSV
          </button>
        </div>
      </div>

      <div className="tdb-tablewrap">
        <table className="tdb-table">
          <thead>
            <tr>
              <th scope="col">Học sinh</th>
              <th scope="col">Thành thạo</th>
              <th scope="col" className="tdb-num-col">Chính xác</th>
              <th scope="col" className="tdb-num-col">Nỗ lực</th>
              <th scope="col">Gần nhất</th>
              <th scope="col">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <StudentRow key={s.id} s={s} nodes={studentNodes?.[s.id] ?? []} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="tdb-note">
        <Info aria-hidden strokeWidth={2} />
        <span>
          Độ chính xác &amp; nỗ lực suy từ mẫu lượt trả lời gần nhất. Cờ là gợi ý để thầy/cô xem kỹ
          — không phải kết luận về em.
        </span>
      </div>
    </section>
  );
}

function StudentRow({ s, nodes }: { s: RosterStudent; nodes: NonNullable<TeacherStats["studentNodes"]>[string] }) {
  const [open, setOpen] = useState(false);
  const masteredPct = s.tracked ? Math.round((s.mastered / s.tracked) * 100) : 0;
  const canExpand = nodes.length > 0;
  const first = s.name.trim().split(/\s+/).pop();
  return (
    <>
      <tr data-attention={s.flags.some((f) => f === "cần kèm") || undefined} data-open={open || undefined}>
        <th scope="row" className="tdb-td-name">
          <button
            type="button"
            className="tdb-td-expand"
            onClick={() => canExpand && setOpen((o) => !o)}
            disabled={!canExpand}
            aria-expanded={canExpand ? open : undefined}
            title={canExpand ? "Xem chi tiết theo điểm kiến thức" : "Chưa có dữ liệu chi tiết"}
          >
            <span className="tdb-td-avatar" aria-hidden>{initialOf(s.name)}</span>
            <span className="tdb-td-nametext">
              <b>{s.name}</b>
              {s.grade && <small>Khối {s.grade}</small>}
            </span>
            {canExpand && <ChevronDown className="tdb-td-chev" aria-hidden strokeWidth={2.5} />}
          </button>
        </th>
        <td>
          <div className="tdb-cellbar" title={`${s.mastered}/${s.tracked} điểm`}>
            <div className="tdb-mini-bar" aria-hidden>
              <i style={{ width: `${masteredPct}%` }} />
            </div>
            <span className="num">
              {s.mastered}/{s.tracked || 0}
            </span>
          </div>
        </td>
        <td className="tdb-num-col">
          {s.attempts > 0 ? <span className="num">{pct(s.accuracy)}</span> : <span className="muted">—</span>}
        </td>
        <td className="tdb-num-col">
          {s.avgEffort > 0 ? <span className="num">{s.avgEffort}</span> : <span className="muted">—</span>}
        </td>
        <td>
          <span className="tdb-recent">
            <Clock aria-hidden strokeWidth={2} />
            {relTime(s.lastActiveAt)}
          </span>
        </td>
        <td>
          <FlagChips flags={s.flags} />
        </td>
      </tr>
      {open && (
        <tr className="tdb-drill-row">
          <td colSpan={6}>
            <div className="tdb-drill">
              <span className="tdb-drill-title">Từng điểm kiến thức của {first}</span>
              <div className="tdb-heat" role="img" aria-label={`Bản đồ thành thạo ${nodes.length} điểm kiến thức của ${s.name}`}>
                {nodes.map((n) => (
                  <span
                    key={n.key}
                    className="tdb-heat-cell"
                    data-state={n.mastered ? "m" : n.score >= 0.5 ? "p" : "w"}
                    data-due={n.due || undefined}
                    title={`${n.label} — ${n.mastered ? "thành thạo" : `điểm ${Math.round(n.score * 100)}%`}${n.due ? " · đến hạn ôn" : ""}`}
                  />
                ))}
              </div>
              <div className="tdb-heat-legend" aria-hidden>
                <span><i data-state="m" /> thành thạo</span>
                <span><i data-state="p" /> đang luyện</span>
                <span><i data-state="w" /> còn yếu</span>
                <span><i data-due="true" /> đến hạn ôn</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Tab: Chủ đề ───────────────────────────────────────────────────────────────
/**
 * CHẤM BÀI — hàng đợi bài học sinh làm ngoài rồi tải lên (ảnh chụp / file Word).
 *
 * Học sinh nộp xong là học tiếp ngay, KHÔNG được mastery. Chỗ này mới quyết:
 *  · ĐẠT      → server ghi bằng chứng mastery + thưởng XP;
 *  · LÀM LẠI  → node hiện BÀN CHÂN ĐỎ trên lộ trình của em, kèm lời nhắn.
 * Tệp nằm trong bucket kín; bấm "Xem bài" mới xin link ký hạn 1 giờ.
 */
function GradingTab({ onCount }: { onCount: (n: number) => void }) {
  const [status, setStatus] = useState<"pending" | "passed" | "redo">("pending");
  const [items, setItems] = useState<GradingItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load(s = status) {
    setItems(null);
    setErr(null);
    try {
      const r = await gradingList(s);
      setItems(r.items ?? []);
      if (s === "pending") onCount(r.items?.length ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  }
  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function view(id: string) {
    try {
      const { url } = await gradingFile(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  async function grade(id: string, pass: boolean) {
    setBusyId(id);
    try {
      await gradingGrade(id, pass, notes[id] ?? "");
      await load(status);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="tdb-card">
      <div className="tdb-card-head">
        <b className="tdb-card-title">Chấm bài nộp</b>
        <div className="st-seg" role="tablist" aria-label="Lọc theo trạng thái">
          {([["pending", "Chờ chấm"], ["redo", "Đã trả về"], ["passed", "Đã đạt"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={status === id} onClick={() => setStatus(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {err && <p className="banner err">{err}</p>}
      {items === null && <p className="muted">Đang tải…</p>}
      {items?.length === 0 && (
        <p className="muted">
          {status === "pending" ? "Chưa có bài nào chờ chấm." : "Chưa có bài nào ở mục này."}
        </p>
      )}
      <ul className="grade-list">
        {(items ?? []).map((it) => (
          <li key={it.id} className="grade-card">
            <div className="grade-head">
              <b>{it.studentName}</b>
              <span className="muted">{it.nodeLabel}</span>
              <span className="muted num">{new Date(it.submittedAt).toLocaleDateString("vi-VN")}</span>
            </div>
            {/* Toán 10 nên đề bài ĐẦY công thức — hiện thô $Delta=b^2-4ac$ là bắt cô
                tự dịch LaTeX trong đầu. Render KaTeX y như phía học sinh. */}
            <div className="grade-prompt"><MathText block cap>{it.prompt}</MathText></div>
            {/* Bài GÕ của em — đọc ngay tại chỗ, khỏi mở tệp. */}
            {it.text && (
              <blockquote className="grade-text"><MathText>{it.text}</MathText></blockquote>
            )}
            {/* Sơ khảo của AI: chỉ là THAM KHẢO — giáo viên là người quyết cuối. */}
            {it.aiVerdict && (
              <p className="grade-ai" data-ok={it.aiVerdict.dung || undefined}>
                AI sơ khảo:{" "}
                {it.aiVerdict.dung ? (
                  "đủ ý chính"
                ) : (
                  <>chưa đạt{it.aiVerdict.thieu ? <> — thiếu: <MathText>{it.aiVerdict.thieu}</MathText></> : null}</>
                )}
              </p>
            )}
            <details className="grade-ref">
              <summary>Đáp án mẫu để đối chiếu</summary>
              <div><MathText block>{it.reference}</MathText></div>
            </details>
            <div className="grade-actions">
              {it.hasFile && (
                <button className="btn btn-quiet" onClick={() => view(it.id)}>
                  Xem tệp đính kèm{it.sizeKb ? ` (${it.sizeKb} KB)` : ""}
                </button>
              )}
              {status === "pending" && (
                <>
                  {/* Ô nhắn: cô môn Toán cần gõ công thức. Ô một dòng thì đoạn
                      nhắn dài bị cuộn ngang không đọc được, nên cho nó tự cao
                      dần; và hiện XEM TRƯỚC ngay bên dưới để cô thấy công thức
                      mình gõ ra thành gì trước khi bấm gửi. */}
                  <textarea
                    className="grade-note-input"
                    rows={1}
                    placeholder="Lời nhắn cho em (không bắt buộc) — gõ công thức trong $…$, ví dụ $\Delta = b^2-4ac$"
                    value={notes[it.id] ?? ""}
                    onChange={(e) => {
                      setNotes((n) => ({ ...n, [it.id]: e.target.value }));
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                    }}
                  />
                  {(notes[it.id] ?? "").includes("$") && (
                    <p className="grade-note-preview">
                      Em sẽ thấy: <MathText>{notes[it.id] ?? ""}</MathText>
                    </p>
                  )}
                  <button
                    className="btn"
                    disabled={busyId === it.id}
                    data-loading={busyId === it.id || undefined}
                    onClick={() => grade(it.id, true)}
                  >
                    Đạt
                  </button>
                  <button
                    className="btn btn-quiet grade-redo"
                    disabled={busyId === it.id}
                    onClick={() => grade(it.id, false)}
                  >
                    Cho làm lại
                  </button>
                </>
              )}
              {status !== "pending" && it.note && (
                <span className="muted">Lời nhắn: <MathText>{it.note}</MathText></span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopicsTab({ topics }: { topics: NonNullable<TeacherStats["topics"]> }) {
  if (topics.length === 0) {
    return (
      <section className="tdb-card">
        <div className="empty">
          <BookOpen aria-hidden strokeWidth={1.75} />
          <p className="muted">Chưa có điểm kiến thức nào được theo dõi.</p>
        </div>
      </section>
    );
  }
  const exportCsv = () => {
    const rows = topics.map((t) => [
      t.label,
      t.nodeKey,
      t.mastered,
      t.tracked,
      t.tracked ? `${Math.round((t.mastered / t.tracked) * 100)}%` : "",
      (t.avgScore ?? 0).toFixed(2),
    ]);
    downloadText(
      `chu-de-${dateStamp()}.csv`,
      toCsv(["Điểm kiến thức", "Mã", "Thành thạo", "Theo dõi", "% thành thạo", "Điểm TB"], rows),
    );
  };

  return (
    <section className="tdb-card">
      <div className="tdb-card-head">
        <span className="tdb-card-title">Thành thạo theo điểm kiến thức</span>
        <div className="tdb-sort" role="group">
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Chỗ cả lớp yếu nhất xếp trước
          </span>
          <button className="tdb-sort-btn tdb-export" onClick={exportCsv} title="Tải bảng chủ đề ra file CSV (mở bằng Excel)">
            <Download aria-hidden strokeWidth={2} width={14} height={14} /> CSV
          </button>
        </div>
      </div>
      <ul className="tdb-topics">
        {topics.map((t) => {
          const p = t.tracked ? Math.round((t.mastered / t.tracked) * 100) : 0;
          const hot = p < 50;
          return (
            <li className="tdb-topic" key={t.nodeKey}>
              <div className="tdb-topic-head">
                <b title={t.label}>{t.label}</b>
                <span className="num" data-hot={hot || undefined}>
                  {t.mastered}/{t.tracked}
                </span>
              </div>
              <div className="tdb-mini-bar tdb-mini-bar--lg" aria-label={`${p}% thành thạo`}>
                <i data-hot={hot || undefined} style={{ width: `${p}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Tab: Duyệt & nội dung ─────────────────────────────────────────────────────
function ContentTab({
  data,
  busy,
  setStatus,
  onHide,
  pending,
  onScan,
  scanNote,
}: {
  data: TeacherStats;
  busy: string | null;
  setStatus: (kind: "question" | "ladder", id: string, status: string) => void;
  onHide: (id: string) => void;
  pending: number;
  onScan: () => void;
  scanNote: string | null;
}) {
  return (
    <div className="tdb-col">
      <section className="tdb-card">
        <div className="tdb-card-head">
          <span className="tdb-card-title">Hàng chờ duyệt</span>
          <span className="tdb-queue-count num">{pending}</span>
          {/* Thống kê là trọng tài: quét p_value/độ phân biệt, câu kém tự về hàng chờ */}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            disabled={busy === "scan"}
            data-loading={busy === "scan" || undefined}
            onClick={onScan}
            title="Tính lại tỉ lệ đúng + độ phân biệt từ bài làm thật; câu quá dễ / quá khó / không phân biệt tự vào hàng chờ duyệt"
          >
            <ScanSearch aria-hidden strokeWidth={2} />
            Quét câu kém
          </button>
        </div>
        <p className="muted">
          Chỉ nội dung <b>active</b> mới phục vụ học sinh. Không có bước này thì AI nói thẳng với các
          em.
        </p>
        {scanNote && <p className="muted">{scanNote}</p>}

        <h3 className="tdb-subhead">Câu hỏi</h3>
        {data.review.questions.length === 0 && (
          <div className="empty">
            <Inbox aria-hidden strokeWidth={1.75} />
            <p className="muted">Không có câu hỏi nào chờ duyệt.</p>
          </div>
        )}
        {data.review.questions.map((q) => (
          <div className="tdb-row" key={q.id}>
            <span className="tdb-badge" title={q.node}>
              {q.node}
            </span>
            <p title={q.prompt}>{q.prompt}…</p>
            {/* Thống kê sống từ bài làm thật — chỉ hiện khi câu đã có dữ liệu.
                Đỏ khi chạm ngưỡng đào thải (quá dễ ≥95% / quá khó ≤15% / không
                phân biệt ≤0.05) để giáo viên thấy ngay vì sao câu bị gắn cờ. */}
            {q.statsN != null && q.statsN > 0 && q.pValue != null && (() => {
              // Câu chạm ngưỡng đào thải = CẢNH BÁO nội dung (amber), KHÔNG phải
              // lỗi hệ thống (đỏ dành riêng cho hỏng thật). Kèm icon cảnh báo để
              // không truyền trạng thái CHỈ bằng màu (nhiều em/GV mù màu đỏ-lục).
              const flagged =
                q.pValue >= 0.95 || q.pValue <= 0.15 || (q.discrimination ?? 0) <= 0.05;
              return (
                <span
                  className={`pill num ${flagged ? "a" : "g"}`}
                  title={`${q.statsN} lượt làm lần-đầu · ${Math.round(q.pValue * 100)}% đúng · độ phân biệt ${
                    q.discrimination != null ? q.discrimination.toFixed(2) : "—"
                  }${flagged ? " — nên xem lại" : ""}`}
                >
                  {flagged && <AlertTriangle aria-hidden strokeWidth={2.5} style={{ width: 12, height: 12 }} />}
                  {Math.round(q.pValue * 100)}% · n={q.statsN}
                </span>
              );
            })()}
            <span className={`pill ${q.status === "active" ? "g" : "a"}`}>{q.status}</span>
            {q.status !== "active" ? (
              <button
                className="btn btn-sm"
                disabled={busy === q.id}
                data-loading={busy === q.id || undefined}
                onClick={() => setStatus("question", q.id, "active")}
              >
                <Check aria-hidden strokeWidth={2.5} />
                Duyệt
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy === q.id}
                onClick={() => setStatus("question", q.id, "retired")}
              >
                <Undo2 aria-hidden strokeWidth={2} />
                Thu hồi
              </button>
            )}
            {/* H5: ẩn câu kém khỏi luồng phục vụ (kèm lý do). Nội dung gốc giữ
                nguyên; khác "Thu hồi" (đổi trạng thái) — đây là lớp phủ cục bộ. */}
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy === q.id}
              onClick={() => onHide(q.id)}
              title="Ẩn câu này khỏi học sinh (kèm lý do; gỡ được sau)"
            >
              <EyeOff aria-hidden strokeWidth={2} />
              Ẩn
            </button>
          </div>
        ))}

        <h3 className="tdb-subhead">Thang Socratic</h3>
        {data.review.ladders.length === 0 && (
          <div className="empty">
            <Inbox aria-hidden strokeWidth={1.75} />
            <p className="muted">Không có thang nào chờ duyệt.</p>
          </div>
        )}
        {data.review.ladders.map((l) => (
          <div className="tdb-row" key={l.id}>
            <span className="tdb-badge" title={l.node}>
              {l.node}
            </span>
            <p title={l.misconception}>{l.misconception}</p>
            <span className={`pill ${l.status === "active" ? "g" : "a"}`}>{l.status}</span>
            {l.status !== "active" ? (
              <button
                className="btn btn-sm"
                disabled={busy === l.id}
                data-loading={busy === l.id || undefined}
                onClick={() => setStatus("ladder", l.id, "active")}
              >
                <Check aria-hidden strokeWidth={2.5} />
                Duyệt
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy === l.id}
                onClick={() => setStatus("ladder", l.id, "review")}
              >
                <Undo2 aria-hidden strokeWidth={2} />
                Gỡ duyệt
              </button>
            )}
          </div>
        ))}
      </section>

      {/* Cắm bộ câu hỏi vào bàn cờ — mảnh Đợt 2: giáo viên thả file câu hỏi,
          app ghép vào phiên bản KG đã publish, node đầy dần. Mở sẵn (không thu
          gọn) vì đây là việc chính khi ngân hàng câu hỏi về. */}
      <QuestionIntake />

      {/* Nhập liệu KHUNG Studio — thu gọn: việc duyệt chính nằm ở app sản xuất,
          mục này chỉ để nạp bundle khung node/cạnh khi cần. */}
      <details className="tdb-collapse">
        <summary className="tdb-collapse-sum">
          <UploadCloud aria-hidden strokeWidth={2} />
          <span className="tdb-collapse-text">
            <b>Nhập liệu KHUNG tri thức từ Studio</b>
            <small>Nạp node/cạnh (bàn cờ) — câu hỏi dùng ô "Cắm bộ câu hỏi" ở trên</small>
          </span>
          <ChevronDown className="tdb-collapse-caret" aria-hidden strokeWidth={2} />
        </summary>
        <div className="tdb-collapse-body">
          <StudioIntake />
        </div>
      </details>
    </div>
  );
}
