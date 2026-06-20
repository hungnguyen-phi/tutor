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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile((data as Profile) ?? null));
  }, [session]);

  return { session, profile };
}

export const signOut = () => supabase.auth.signOut();
