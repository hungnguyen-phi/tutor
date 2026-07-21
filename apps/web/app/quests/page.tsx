"use client";

/* Trang đứng riêng /quests — cửa deep-link, tự gác cổng (mọi ngả chưa đăng
   nhập đều đổ về /login). Trải nghiệm chính là tab Mục tiêu trong /learn. */

import AppShell from "../../components/AppShell";
import RedirectToLogin from "../../components/RedirectToLogin";
import QuestsView from "../../components/QuestsView";
import { useAuth } from "../../lib/auth";

export default function QuestsPage() {
  const { session } = useAuth();
  if (session === null) return <RedirectToLogin />;
  if (session === undefined) {
    return (
      <AppShell current="quests">
        <div className="stack">
          <div className="skel" style={{ height: 140 }} />
          <div className="skel" style={{ height: 96 }} />
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell current="quests">
      <QuestsView />
    </AppShell>
  );
}
