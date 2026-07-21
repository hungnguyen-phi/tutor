"use client";

/* Trang đứng riêng /profile — cửa deep-link, tự gác cổng đăng nhập. Trải
   nghiệm chính là tab Tôi trong trang MỘT TRANG /learn. */

import AppShell from "../../components/AppShell";
import RedirectToLogin from "../../components/RedirectToLogin";
import ProfileView from "../../components/ProfileView";
import { useAuth } from "../../lib/auth";

export default function ProfilePage() {
  const { session } = useAuth();

  if (session === undefined) {
    return (
      <AppShell current="profile">
        <div className="stack">
          <div className="skel" style={{ height: 96 }} />
          <div className="skel" style={{ height: 140 }} />
        </div>
      </AppShell>
    );
  }
  if (session === null) return <RedirectToLogin />;

  return (
    <AppShell current="profile">
      <ProfileView />
    </AppShell>
  );
}
