"use client";

/**
 * Hồ sơ (hi-fi 4d) — VIEW dùng trong trang MỘT TRANG /learn: bạn là ai trong
 * hành trình này.
 *
 * Bản desktop full màn (yêu cầu chủ dự án): nền trắng, hero navy nhấn vàng,
 * lớp bên trong navy + vàng. Thang hạng nỗ lực + huy hiệu chương + thành thạo
 * theo môn + tài khoản, chia cột trên desktop.
 *
 * DATA: mọi con số của CHÍNH học sinh là số thật (localStorage gamify +
 * endpoint scoreboard + guardian_links). Thẻ nào server chưa xác nhận được
 * dữ liệu (môn học, phụ huynh) thì ẨN — không vẽ số mẫu ở màn này.
 */

import { useEffect, useState } from "react";
import { ArrowRight, Award, BadgeCheck, Flame, Lock, LogOut, Medal, Settings, Users, Zap } from "lucide-react";
import Lion from "./Lion";
import { useAuth, signOut } from "../lib/auth";
import { getScoreboard, type Scoreboard } from "../lib/api";
import { supabase } from "../lib/supabase";
import * as G from "../lib/gamify";
import * as Prefs from "../lib/prefs";

/** QUY ƯỚC TẠM: mỗi 5 điểm thành thạo = 1 huy hiệu chương. */
const BADGE_STEP = 5;
const BADGE_MILESTONES = [5, 10, 15, 20] as const;

export default function ProfileView({
  onGoBoard,
  onOpenSettings,
}: {
  onGoBoard?: () => void;
  /** Mở Cài đặt tại chỗ (SPA) — không truyền thì bánh răng thành link deep. */
  onOpenSettings?: () => void;
}) {
  const { session, profile } = useAuth();
  const [progress, setProgress] = useState<G.Progress | null>(null);
  const [masteredCount, setMasteredCount] = useState(0);
  const [sb, setSb] = useState<Scoreboard | null>(null);
  const [parentLinked, setParentLinked] = useState(false);

  const uid = session?.user.id;

  useEffect(() => {
    setProgress(G.load()); // cache tức thì; server ghi đè bên dưới khi có
  }, []);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getScoreboard()
      .then((d) => {
        if (!alive) return;
        setSb(d);
        // XP/chuỗi THẬT từ server (student_xp) — không để cache máy làm nguồn hạng.
        if (d.xp) setProgress(G.syncFromServer(d.xp));
      })
      .catch(() => {
        /* chưa deploy / không phải học sinh → ẩn thẻ môn */
      });
    // Số node đã THÀNH THẠO — SERVER-AUTHORITATIVE (student_node_state, RLS đọc của
    // mình), KHÔNG đọc localStorage (tránh huy hiệu từ danh sách máy sửa được).
    supabase
      .from("student_node_state")
      .select("id", { count: "exact", head: true })
      .eq("student_id", uid)
      .eq("mastered", true)
      .then(({ count, error }) => {
        if (alive && !error) setMasteredCount(count ?? 0);
      });
    supabase
      .from("guardian_links")
      .select("id")
      .eq("student_id", uid)
      .limit(1)
      .then(({ data, error }) => {
        if (alive && !error) setParentLinked((data?.length ?? 0) > 0);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  if (!progress) {
    return (
      <div className="ws">
        <div className="skel ws-skel-hero" />
        <div className="ws-skel-stats" aria-hidden>
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
        </div>
        <div className="ws-grid">
          <div className="skel ws-skel-panel" />
          <div className="skel ws-skel-panel" />
        </div>
      </div>
    );
  }

  const league = G.leagueOf(progress.xp);
  const leagueIdx = G.LEAGUES.findIndex((l) => l.name === league.name);
  const cold = G.isCold(progress);
  // Tên hiển thị: override cục bộ (Cài đặt) thắng tên server; avatar theo prefs
  const name = Prefs.displayNameOf(profile?.full_name) ?? "Học sinh Việt Anh";
  const initial = name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "V";
  const ava = Prefs.getAvatar();
  const badgeCount = Math.floor(masteredCount / BADGE_STEP);
  const subjects = sb?.subjectProgress ?? [];

  return (
    <div className="ws">
      {/* HERO navy — danh tính: avatar + tên + hạng, sư tử */}
      <header className="ws-hero pf-hero">
        {/* Bánh răng hi-fi 4d — giờ có trang Cài đặt thật để trỏ tới */}
        {onOpenSettings ? (
          <button type="button" className="pf-gear" onClick={onOpenSettings} aria-label="Mở cài đặt">
            <Settings strokeWidth={2.25} aria-hidden />
          </button>
        ) : (
          <a className="pf-gear" href="/learn/#settings" aria-label="Mở cài đặt">
            <Settings strokeWidth={2.25} aria-hidden />
          </a>
        )}
        <span className="ws-hero-ava" data-tone={ava.tone} aria-hidden>
          {ava.kind === "lion" ? <Lion mood="idle" size={44} decorative /> : initial}
        </span>
        <div className="ws-hero-text">
          <span className="ws-kicker">
            <Medal aria-hidden strokeWidth={2.5} />
            Hạng {league.name}
          </span>
          <h1 className="ws-title">{name}</h1>
          <p className="ws-lead">{roleLabel(profile?.role)} · Trường Liên cấp Việt Anh</p>
        </div>
        <span className="ws-hero-lion" aria-hidden>
          <Lion
            mood={cold ? "sleepy" : league.name === "Vàng" || league.name === "Ngọc" ? "proud" : "idle"}
            size={132}
            variant="full"
            decorative
          />
        </span>
      </header>

      {/* 4 chỉ số THẬT của chính em */}
      <div className="ws-stats" data-cols="4">
        <div
          className="ws-stat"
          data-tone="navy"
          data-zero={progress.streak === 0 || undefined}
          title={cold ? "Chuỗi ngày đã nguội" : `${progress.streak} ngày liên tiếp`}
        >
          <span className="ws-stat-ico" aria-hidden>
            <Flame strokeWidth={2.25} />
          </span>
          <b className="num">{progress.streak}</b>
          <span>ngày liên tiếp</span>
        </div>
        <div className="ws-stat" data-tone="gold" data-zero={progress.xp === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <Zap strokeWidth={2.25} />
          </span>
          <b className="num">{progress.xp.toLocaleString("vi-VN")}</b>
          <span>tổng XP</span>
        </div>
        <div className="ws-stat" data-tone="plain" data-zero={masteredCount === 0 || undefined}>
          <span className="ws-stat-ico" aria-hidden>
            <BadgeCheck strokeWidth={2.25} />
          </span>
          <b className="num">{masteredCount}</b>
          <span>điểm thành thạo</span>
        </div>
        <div
          className="ws-stat"
          data-tone="plain"
          data-zero={badgeCount === 0 || undefined}
          title={`Mỗi ${BADGE_STEP} điểm thành thạo = 1 huy hiệu chương`}
        >
          <span className="ws-stat-ico" aria-hidden>
            <Award strokeWidth={2.25} />
          </span>
          <b className="num">{badgeCount}</b>
          <span>huy hiệu chương</span>
        </div>
      </div>

      {cold && <p className="muted">Chuỗi đã nguội — học một bài hôm nay để nhóm lại nhé.</p>}

      <div className="ws-grid">
        {/* CỘT CHÍNH: thang hạng + huy hiệu chương */}
        <section className="ws-panel">
          <h2 className="ws-panel-title">
            <Medal aria-hidden strokeWidth={2.25} />
            Thang hạng nỗ lực
          </h2>
          <ul className="gl-ladder">
            {G.LEAGUES.map((l, i) => {
              const state = i < leagueIdx ? "past" : i === leagueIdx ? "current" : "future";
              return (
                <li className="gl-rung" key={l.name} data-state={state}>
                  <span className="gl-rung-ico" aria-hidden>
                    <Medal strokeWidth={2.25} />
                  </span>
                  <b className="gl-rung-name">{l.name}</b>
                  <span className="gl-rung-min num">
                    {l.min === 0 ? "khởi đầu" : `${l.min.toLocaleString("vi-VN")} XP`}
                  </span>
                  {state === "current" && <span className="gl-rung-you">bạn ở đây</span>}
                </li>
              );
            })}
          </ul>
          {league.next !== null ? (
            <p className="muted gl-ladder-foot">
              Còn <b>{(league.next - progress.xp).toLocaleString("vi-VN")} XP</b> nữa tới hạng kế tiếp.
              Hạng đo nỗ lực, không đo điểm.
            </p>
          ) : (
            <p className="muted gl-ladder-foot">Hạng cao nhất — cảm ơn bạn đã bền bỉ đến đây.</p>
          )}

          <div className="pf-card-sep" />

          <h2 className="ws-panel-title">
            <Award aria-hidden strokeWidth={2.25} />
            Huy hiệu chương
          </h2>
          <div className="pf-badges">
            {BADGE_MILESTONES.map((m) => {
              const got = masteredCount >= m;
              return (
                <div className="pf-badge" key={m} data-got={got || undefined}>
                  <span className="pf-badge-tile" aria-hidden>
                    {got ? <Award strokeWidth={2} /> : <Lock strokeWidth={2} />}
                  </span>
                  <span className="pf-badge-lbl">
                    {m} điểm
                    <span className="sr-only">{got ? " — đã đạt" : " — chưa đạt"}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* CỘT PHẢI: thành thạo theo môn + tài khoản */}
        <aside className="ws-side">
          {subjects.length > 0 && (
            <section className="ws-panel">
              <h2 className="ws-panel-title">
                <Zap aria-hidden strokeWidth={2.25} />
                Thành thạo theo môn
              </h2>
              <div className="pf-subjects">
                {subjects.map((s) => {
                  const pct = Math.max(0, Math.min(100, Math.round(s.pct)));
                  return (
                    <div key={s.subject} className="pf-subject">
                      <div className="pf-mastery-head">
                        <span>{s.subject}</span>
                        <b className="num">{pct}%</b>
                      </div>
                      <div
                        className="meter"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Thành thạo ${s.subject}`}
                      >
                        <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="ws-panel">
            <h2 className="ws-panel-title">
              <Users aria-hidden strokeWidth={2.25} />
              Tài khoản
            </h2>
            {parentLinked && (
              <div className="pf-acct-row">
                <span>
                  <Users aria-hidden strokeWidth={2} />
                  Phụ huynh đã liên kết
                </span>
                <BadgeCheck className="pf-acct-ok" strokeWidth={2} aria-hidden />
              </div>
            )}
            <a
              className="btn btn-ghost btn-block"
              href="/learn/#scoreboard"
              onClick={(e) => {
                if (!onGoBoard) return;
                e.preventDefault();
                onGoBoard();
              }}
            >
              Xem bảng tuần
              <ArrowRight aria-hidden strokeWidth={2} />
            </a>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => signOut().then(() => (window.location.href = "/"))}
            >
              <LogOut aria-hidden strokeWidth={2} />
              Đăng xuất
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function roleLabel(role?: string | null): string {
  switch (role) {
    case "teacher":
      return "Giáo viên";
    case "parent":
      return "Phụ huynh";
    case "admin":
      return "Quản trị";
    default:
      return "Học sinh";
  }
}
