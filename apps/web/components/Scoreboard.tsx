"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { getScoreboard, commitScoreboard, syncScoreboard, type Scoreboard } from "../lib/api";
import Login from "./Login";

const SCOPE_LABEL: Record<string, string> = { lop: "lớp", khoi: "khối", cap: "cấp", truong: "trường" };

/** School mascot — uses the official lion PNG, falls back to an emoji until the asset lands. */
function Lion() {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="lion">🦁</span>;
  return <img src="/brand/lion-head.png" alt="Sư tử Việt Anh" onError={() => setBroken(true)} />;
}

export default function ScoreboardView() {
  const { session, profile } = useAuth();
  const [sb, setSb] = useState<Scoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitment, setCommitment] = useState("");
  const [savingCommit, setSavingCommit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    getScoreboard()
      .then((d) => { setSb(d); setCommitment(d.commitment ?? ""); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [session]);

  if (session === undefined) return <main className="wrap"><p className="muted">Đang tải…</p></main>;
  if (session === null) return <Login />;

  const firstName = (sb?.student.name ?? profile?.full_name ?? "bạn").trim().split(/\s+/).pop();

  async function saveCommit() {
    setSavingCommit(true);
    try { await commitScoreboard(commitment); } finally { setSavingCommit(false); }
  }
  async function doSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      const r = await syncScoreboard();
      setSyncMsg(r.note ?? "Đã cập nhật.");
      setSb((s) => (s ? { ...s, sync: { syncedAt: r.syncedAt } } : s));
    } catch (e) { setSyncMsg(e instanceof Error ? e.message : String(e)); }
    finally { setSyncing(false); }
  }

  return (
    <>
      <header className="app-header">
        <img src="/logo-vietanh.webp" alt="Việt Anh" />
        <div className="titles"><b>AI Tutor</b><span>Bảng điểm tuần (4DX)</span></div>
        <div className="spacer" />
        <nav className="sb-nav">
          <a href="/">Học</a>
          <a href="/scoreboard" className="active">Bảng điểm</a>
        </nav>
        <button className="btn ghost" style={{ marginLeft: 10, padding: "6px 12px" }} onClick={() => supabase.auth.signOut()}>Thoát</button>
      </header>

      <main className="wrap">
        {error && <div className="banner warn">Lỗi: {error}</div>}
        {!sb && !error && <p className="muted">Đang tải bảng điểm…</p>}

        {sb && (
          <>
            <div className="sb-mascot">
              <Lion />
              <div className="say">Tuần này {firstName} đã nỗ lực rất tốt — cùng nhìn lại Bảng điểm và đặt mục tiêu cho tuần tới nhé!</div>
            </div>

            {/* WIGs */}
            <section className="panel">
              <span className="h-eyebrow">🎯 Mục tiêu lớn của {firstName} (WIG)</span>
              {sb.wigs.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Chưa thiết lập WIG.</p>}
              {sb.wigs.map((w) => (
                <div className="wig" key={w.area}>
                  <div className="head">
                    <b>{w.areaLabel}: {w.title}</b>
                    <span className="pct">{w.progressPct}%</span>
                  </div>
                  {w.targetDesc && <div className="muted">{w.targetDesc}{w.source === "tutor" ? " · do Tutor theo dõi" : ""}</div>}
                  <div className="goal">
                    <div className="line" />
                    <div className="done" style={{ width: `${w.progressPct}%` }} />
                    <div className="token" style={{ left: `${w.progressPct}%` }}>⚽</div>
                    <div className="flag">🥅</div>
                  </div>
                </div>
              ))}
            </section>

            {/* Effort rank */}
            {sb.effort.rank != null && (
              <section className="panel" style={{ padding: 0, border: "none", boxShadow: "none" }}>
                <div className="rank">
                  <span className="medal">🏆</span>
                  <div>
                    <b>Hạng nỗ lực #{sb.effort.rank}</b>
                    <div><small>trong {SCOPE_LABEL[sb.effort.scope]} · tính theo nỗ lực, không theo điểm</small></div>
                  </div>
                </div>
              </section>
            )}

            {/* Lead measures */}
            <section className="panel">
              <span className="h-eyebrow">⚡ Lead measures tuần này</span>
              <div style={{ marginTop: 8 }}>
                {sb.leadMeasures.map((l, i) => (
                  <div className="lead-row" key={i}>
                    <span className={`tl ${l.status}`} />
                    <span className="lbl">{l.label}{l.targetText ? <span className="muted"> · mục tiêu {l.targetText}</span> : null}</span>
                    <span className="val">{l.valueText}</span>
                  </div>
                ))}
                {sb.leadMeasures.length === 0 && <p className="muted">Chưa có lead measure cho tuần này.</p>}
              </div>
            </section>

            {/* Subject progress (tutor-tracked) */}
            {sb.subjectProgress.length > 0 && (
              <section className="panel">
                <span className="h-eyebrow">📚 Tiến độ theo môn (Tutor theo dõi)</span>
                <div style={{ marginTop: 10 }}>
                  {sb.subjectProgress.map((s) => (
                    <div key={s.subject} style={{ marginBottom: 12 }}>
                      <div className="lead-row" style={{ border: "none", padding: "2px 0" }}>
                        <span className="lbl">{s.subject}</span><span className="val">{s.pct}%</span>
                      </div>
                      <div className="level-bar" style={{ width: "100%", height: 10 }}><i style={{ width: `${s.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Coach & buddy */}
            <div className="sb-split">
              {sb.coach && (
                <section className="panel">
                  <span className="h-eyebrow">🗓️ Coach của {firstName}</span>
                  <p style={{ margin: "8px 0 2px", fontWeight: 600, color: "var(--navy)" }}>{sb.coach.name ?? "GVCN"}</p>
                  <div className="muted">Họp {sb.coach.cadenceDays >= 28 ? "4 tuần/lần" : `mỗi ${sb.coach.cadenceDays} ngày`}{sb.coach.lastMeetingAt ? ` · gần nhất ${new Date(sb.coach.lastMeetingAt).toLocaleDateString("vi-VN")}` : ""}</div>
                </section>
              )}
              {sb.buddy && (
                <section className="panel">
                  <span className="h-eyebrow">🤝 Buddy của {firstName}</span>
                  <p style={{ margin: "8px 0 2px", fontWeight: 600, color: "var(--navy)" }}>{sb.buddy.name ?? "Bạn đồng hành"}</p>
                  <div className="muted">Họp hàng tuần{sb.buddy.lastMeetingAt ? ` · gần nhất ${new Date(sb.buddy.lastMeetingAt).toLocaleDateString("vi-VN")}` : ""}</div>
                </section>
              )}
            </div>

            {/* Commitment (student only) */}
            {sb.viewer.self && (
              <section className="panel">
                <span className="h-eyebrow">✍️ Cam kết tuần tới của {firstName}</span>
                <textarea style={{ marginTop: 8 }} rows={2} value={commitment} maxLength={280}
                  onChange={(e) => setCommitment(e.target.value)} placeholder={`Ví dụ: "${firstName} cam kết ôn hết thẻ trước Chủ nhật"`} />
                <div className="row">
                  <button className="btn" onClick={saveCommit} disabled={savingCommit}>{savingCommit ? "Đang lưu…" : "Lưu cam kết"}</button>
                </div>
              </section>
            )}

            {/* 4DX sync */}
            {(sb.viewer.self || sb.viewer.staff) && (
              <section className="panel" style={{ background: "#fffdf0", borderColor: "#f0e3b8" }}>
                <span className="h-eyebrow">🔗 Đồng bộ sang 4DX trường</span>
                <p className="muted" style={{ margin: "6px 0 0" }}>Cập nhật tiến độ Kiến thức &amp; Tiếng Anh vào WIG ở app 4DX của trường.{sb.sync.syncedAt ? ` Lần cuối: ${new Date(sb.sync.syncedAt).toLocaleString("vi-VN")}.` : ""}</p>
                <div className="row">
                  <button className="btn gold" onClick={doSync} disabled={syncing}>{syncing ? "Đang cập nhật…" : "Cập nhật 4DX"}</button>
                </div>
                {syncMsg && <div className="banner ok" style={{ marginTop: 10 }}>{syncMsg}</div>}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
