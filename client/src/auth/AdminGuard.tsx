import type { ReactNode } from "react";
import { Redirect, useLocation } from "wouter";

import { useAuth } from "@/auth/useAuth";
import { Spinner } from "@/components/ui/spinner";

/**
 * Route guard for the `/admin/*` namespace (AUTH-05).
 *
 * Decision order (the D-11 redirect matrix):
 *   1. While `loading` — render a centered Spinner and decide NOTHING. The
 *      `useAuth` loading gate stays true until BOTH session and role resolve
 *      (03-02 / D-12), so this prevents an admin-UI flash and avoids wrongly
 *      bouncing a real admin to /login on a hard refresh (Pitfall 2 / T-3-08).
 *   2. Logged out (no session) — redirect to `/login`, remembering the
 *      intended internal destination via the `?next=` param that Login's
 *      `safeReturnTo` consumes (D-10). The remembered value is an internal
 *      leading-slash path only; the guard never forwards a scheme/`//`
 *      destination (open-redirect mitigation, Pitfall 6 / T-3-10).
 *   3. Logged in but not an admin — redirect to `/` with NO 403 page, so the
 *      admin area's existence is never advertised (D-11 / T-3-12).
 *   4. Admin — render `children`.
 *
 * This guard is UX-only; the real boundary is server-side RLS
 * (`private.is_admin()`), which a guard bypass cannot defeat (T-3-13).
 *
 * Redirects use internal leading-slash paths; Wouter's `base` prop in App.tsx
 * handles the GitHub Pages sub-path, so we never build absolute URLs.
 */
export default function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, session, role } = useAuth();
  const [location] = useLocation();

  // 1. Defer every decision until session AND role have resolved (D-12).
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-secondary" />
      </div>
    );
  }

  // 2. Logged out — remember the intended internal path and send to /login.
  if (!session) {
    // `location` is the in-router path (base-stripped, leading slash); pass it
    // verbatim as the internal `?next=` value Login's safeReturnTo sanitizes.
    const next = location.startsWith("/") ? location : "/admin";
    return <Redirect to={`/login?next=${encodeURIComponent(next)}`} />;
  }

  // 3. Logged in but not an admin — silent redirect home, no 403 (D-11).
  if (role !== "admin") {
    return <Redirect to="/" />;
  }

  // 4. Admin — render the protected children.
  return <>{children}</>;
}
