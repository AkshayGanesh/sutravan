import type { ReactNode } from "react";
import { Redirect, useLocation } from "wouter";

import { useAuth } from "@/auth/useAuth";
import { safeReturnTo } from "@/pages/Login";
import { Spinner } from "@/components/ui/spinner";

/**
 * Generic customer route guard for the auth-gated customer routes
 * (`/wishlist`, and `/profile` in Plan 04). It mirrors AdminGuard's
 * decision order MINUS the admin role check (D-16):
 *
 *   1. While `loading` — render a centered Spinner and decide NOTHING. The
 *      `useAuth` loading gate stays true until the session resolves (03-02 /
 *      D-12), so this prevents a content flash and avoids wrongly bouncing a
 *      real customer to /login on a hard refresh.
 *   2. Logged out (no session) — redirect to `/login`, remembering the
 *      intended internal destination via the `?next=` param that Login's
 *      `safeReturnTo` consumes (D-10/D-16). The remembered value is an
 *      internal leading-slash path only.
 *   3. Logged in — render `children`. Unlike AdminGuard there is no role
 *      branch: any authenticated customer is allowed.
 *
 * This guard is UX-only; the real boundary is the owner-scoped RLS on the
 * customer tables (e.g. `wishlists_owner_*`), which a guard bypass cannot
 * defeat. Redirects use internal leading-slash paths; Wouter's `base` prop in
 * App.tsx handles the GitHub Pages sub-path.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const [location] = useLocation();

  // 1. Defer every decision until the session has resolved (D-12).
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-secondary" />
      </div>
    );
  }

  // 2. Logged out — remember the intended internal path and send to /login.
  //    Use the audited `safeReturnTo` sanitizer (the same one Login and
  //    WishlistButton use) so protocol-relative paths like `//evil.com` are
  //    rejected consistently here, not only re-checked downstream (WR-02).
  if (!session) {
    const next = safeReturnTo(location);
    return <Redirect to={`/login?next=${encodeURIComponent(next)}`} />;
  }

  // 3. Logged in — render the protected children (no role gate, D-16).
  return <>{children}</>;
}
