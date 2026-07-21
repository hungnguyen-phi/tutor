"use client";

/* Trang đứng riêng /review — cửa deep-link, tự gác cổng (mọi ngả chưa đăng
   nhập đều đổ về /login). Trải nghiệm chính là tab Ôn tập trong /learn. */

import AppShell from "../../components/AppShell";
import RedirectToLogin from "../../components/RedirectToLogin";
import ReviewView from "../../components/ReviewView";
import { useAuth } from "../../lib/auth";

export default function ReviewPage() {
  const { session } = useAuth();
  if (session === null) return <RedirectToLogin />;
  if (session === undefined) {
    return (
      <AppShell current="review">
        <div className="stack">
          <div className="skel" style={{ height: 72 }} />
          <div className="skel" style={{ height: 72 }} />
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell current="review">
      <ReviewView />
    </AppShell>
  );
}
