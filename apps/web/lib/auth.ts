import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  role: string;
  full_name: string | null;
  tenant_id: string | null;
  grade: string | null;
}

/**
 * Trạng thái đăng nhập + hồ sơ + vai.
 * - `session`: undefined = đang tải, null = đã đăng xuất, Session = đã đăng nhập.
 * - `ready`: đã biết CHẮC hồ sơ + vai (hoặc chắc chắn chưa đăng nhập). Cổng phân
 *   quyền PHẢI đợi `ready` để không nhầm "đang tải" thành "không có quyền".
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]); // base profile role ∪ user_roles
  const [isBuddy, setIsBuddy] = useState(false);
  const [ready, setReady] = useState(false);
  // uid đã nạp hồ sơ — chặn nạp lại (và chớp skeleton) khi Supabase phát lại
  // sự kiện cho CÙNG người dùng (TOKEN_REFRESHED ~mỗi giờ, SIGNED_IN khi focus tab).
  // KHAI BÁO cùng nhóm state, TRƯỚC mọi useEffect (giữ thứ tự hook cố định).
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) { setReady(false); return; }
    if (!session) { loadedUidRef.current = null; setProfile(null); setRoles([]); setIsBuddy(false); setReady(true); return; }
    const uid = session.user.id;
    if (loadedUidRef.current === uid) return; // cùng người ĐÃ nạp → giữ nguyên, không chớp skeleton
    setReady(false);
    let alive = true;
    (async () => {
      try {
        const [{ data: p }, { data: ur }, { data: bud }] = await Promise.all([
          supabase.from("profiles").select("role, full_name, tenant_id, grade").eq("id", uid).maybeSingle(),
          supabase.from("user_roles").select("role_key").eq("user_id", uid),
          supabase.from("coaching_links").select("kind").eq("mentor_id", uid).eq("kind", "buddy").limit(1),
        ]);
        if (!alive) return;
        const prof = (p as Profile) ?? null;
        setProfile(prof);
        setRoles([...new Set([prof?.role, ...((ur ?? []).map((r) => r.role_key))].filter(Boolean) as string[])]);
        setIsBuddy((bud?.length ?? 0) > 0);
        // Đánh dấu ĐÃ nạp CHỈ khi hoàn tất: lần chạy bị ngắt giữa chừng (token
        // refresh cùng uid) không "chiếm" ref → lần sau vẫn nạp lại, không kẹt skeleton.
        loadedUidRef.current = uid;
      } finally {
        // Backstop: dù lỗi bất ngờ cũng thoát skeleton (roles rỗng → "không có
        // quyền", KHÔNG kẹt màn tải mãi).
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [session]);

  return { session, profile, roles, isBuddy, ready };
}

export const signOut = () => supabase.auth.signOut();

/** Vai nào về nhà nấy — nguồn chân lý DUY NHẤT cho điều hướng sau đăng nhập
 *  (quyết định chủ dự án: học sinh vào THẲNG /learn, không qua hub). */
export function roleHome(role?: string | null): string {
  switch (role) {
    case "teacher":
      return "/teacher/";
    case "parent":
      return "/parent/";
    case "student":
      return "/learn/";
    default:
      // admin/staff/vai chưa rõ → hub chọn vai
      return "/app/";
  }
}

/**
 * Kiểm quyền vào một KHU VỰC theo vai. `admin` là superuser (vào mọi nơi).
 * `allow` = danh sách role_key được phép; rỗng/không truyền = mọi tài khoản đã
 * đăng nhập (chỉ dùng cho khu vực không phân vai). Phòng-thủ-chiều-sâu: server
 * (edge functions + RLS) vẫn là hàng rào chính; cổng này chặn UI sai vai + UX.
 */
export function isAllowed(roles: string[], allow?: string[]): boolean {
  if (!allow || allow.length === 0) return true;
  const set = new Set(roles);
  if (set.has("admin")) return true;
  return allow.some((r) => set.has(r));
}
