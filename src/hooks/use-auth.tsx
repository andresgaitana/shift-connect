import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gt" | "gz" | "agente";
export type Business = "productos" | "mbk";

export interface ProfileRow {
  id: string;
  nombre_completo: string | null;
  telefono: string | null;
  negocio: Business | null;
  zona_id: string | null;
  tienda_id: string | null;
  activo: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  profile: ProfileRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  const loadUserData = async (uid: string | null) => {
    if (!uid) { setRoles([]); setProfile(null); return; }
    const [{ data: roleRows }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    setRoles((roleRows ?? []).map((r) => r.role as AppRole));
    setProfile((prof as ProfileRow | null) ?? null);
  };

  useEffect(() => {
    let mounted = true;

    // listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      setSession(sess);
      if (event === "SIGNED_OUT") {
        setRoles([]); setProfile(null);
        queryClient.clear();
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        // defer DB call to avoid deadlock in listener
        setTimeout(() => { void loadUserData(sess?.user.id ?? null); }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadUserData(data.session?.user.id ?? null);
      setLoading(false);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    roles,
    profile,
    loading,
    refresh: async () => { await loadUserData(session?.user.id ?? null); },
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      await router.navigate({ to: "/auth", replace: true });
    },
  }), [session, roles, profile, loading, queryClient, router]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function hasRole(roles: AppRole[], role: AppRole) {
  return roles.includes(role);
}
