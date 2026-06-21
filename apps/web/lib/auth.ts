import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  role: string;
  full_name: string | null;
}

/** undefined = loading, null = signed out, Session = signed in. */
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]); // base profile role ∪ user_roles
  const [isBuddy, setIsBuddy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setRoles([]); setIsBuddy(false); return; }
    const uid = session.user.id;
    supabase.from("profiles").select("role, full_name").eq("id", uid).single()
      .then(({ data }) => {
        const p = (data as Profile) ?? null;
        setProfile(p);
        supabase.from("user_roles").select("role_key").eq("user_id", uid)
          .then(({ data: ur }) => setRoles([...new Set([p?.role, ...((ur ?? []).map((r) => r.role_key))].filter(Boolean) as string[])]));
      });
    supabase.from("coaching_links").select("kind").eq("mentor_id", uid).eq("kind", "buddy").limit(1)
      .then(({ data }) => setIsBuddy((data?.length ?? 0) > 0));
  }, [session]);

  return { session, profile, roles, isBuddy };
}

export const signOut = () => supabase.auth.signOut();
