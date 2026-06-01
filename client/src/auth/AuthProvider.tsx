import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** A user's server-side role, read from `public.profiles.role`. */
export type Role = "admin" | "customer" | null;

/**
 * The shape every auth consumer reads via `useAuth()`.
 *
 * `role` is UX-only (T-3-07): the real access boundary is server-side RLS
 * (`private.is_admin()`). A forged client role grants no DB access.
 *
 * `loading` stays true until the initial session AND (when a user exists) the
 * role have resolved, so guards never decide early (D-12, RESEARCH Pitfall 2).
 */
export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Default undefined so useAuth can detect out-of-provider usage.
export const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [role, setRole] = React.useState<Role>(null);
  // Two independent gates folded into one `loading` boolean.
  const [sessionResolved, setSessionResolved] = React.useState(false);
  const [roleResolved, setRoleResolved] = React.useState(false);

  const user = session?.user ?? null;

  // Seed the session + subscribe to auth changes (mirror use-mobile.tsx
  // subscribe-in-useEffect -> setState -> cleanup-unsubscribe).
  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setSessionResolved(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch the role separately, keyed on user.id (server-side role, never the JWT).
  React.useEffect(() => {
    let active = true;
    const userId = user?.id ?? null;

    if (!userId) {
      // Logged out: role is null and there is nothing to resolve.
      setRole(null);
      setRoleResolved(true);
      return () => {
        active = false;
      };
    }

    // A user exists — the role is in flight until this query returns.
    setRoleResolved(false);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setRole((data?.role as Role) ?? null);
        setRoleResolved(true);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // loading is true until the session resolves AND, when a user exists,
  // the role resolves too.
  const loading = !sessionResolved || !roleResolved;

  const value = React.useMemo<AuthContextValue>(
    () => ({ session, user, role, loading, signOut }),
    [session, user, role, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
