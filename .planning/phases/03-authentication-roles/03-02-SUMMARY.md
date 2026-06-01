---
phase: 03-authentication-roles
plan: 02
subsystem: auth
tags: [supabase, react-context, auth, useAuth, session, rls, vite]

requires:
  - phase: 02-live-catalog-data-migration-public-shop-rewire
    provides: "supabase singleton client (@/lib/supabase), public.profiles table with role column"
provides:
  - "AuthProvider React context exposing { session, user, role, loading, signOut }"
  - "useAuth() hook (throws outside provider) — the consumption contract for Plans 03/04/05"
  - "mapAuthError(error) — friendly, non-enumerating Supabase auth error copy"
  - "AuthProvider mounted in App.tsx inside TooltipProvider, wrapping Router"
affects: [03-03 register-login-logout, 03-04 admin-guard, 03-05 password-reset]

tech-stack:
  added: []
  patterns:
    - "Auth context = getSession seed + onAuthStateChange subscription + separate profiles role fetch, folded into one loading gate (D-12)"
    - "Role read client-side for UX only; real boundary is server-side RLS (T-3-07)"
    - "Auth errors mapped via pure string->string mapper, anti-enumeration (D-14)"

key-files:
  created:
    - client/src/lib/authErrors.ts
    - client/src/auth/AuthProvider.tsx
    - client/src/auth/useAuth.ts
  modified:
    - client/src/App.tsx

key-decisions:
  - "loading folds two gates (sessionResolved + roleResolved) so it stays true until session AND role resolve; logged-out resolves role to null immediately (D-12)"
  - "role typed as 'admin' | 'customer' | null, read from public.profiles keyed on user.id — never from JWT/metadata (D-11)"
  - "Relied on supabase-js persistSession/autoRefreshToken defaults; no manual localStorage handling (D-13)"
  - "mapAuthError collapses invalid-credentials and email-not-found into one generic message (D-14 anti-enumeration)"

patterns-established:
  - "useAuth return shape: { session: Session|null, user: User|null, role: 'admin'|'customer'|null, loading: boolean, signOut: () => Promise<void> }"
  - "mapAuthError(error: unknown): string — call this in catch blocks for any supabase.auth error"

requirements-completed: [AUTH-02, AUTH-05]

duration: 4min
completed: 2026-06-01
---

# Phase 3 Plan 02: Auth-State Layer Summary

**AuthProvider context (getSession + onAuthStateChange + profiles role fetch with a single loading gate), a useAuth hook, and a non-enumerating mapAuthError mapper — mounted in App.tsx as the single source of truth for "who is logged in and are they an admin."**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `mapAuthError(error: unknown): string` — pure mapper turning raw Supabase auth strings into friendly copy; invalid-credentials and email-not-found return the SAME generic message (anti-enumeration, D-14).
- `AuthProvider` — seeds session via `getSession()`, subscribes via `onAuthStateChange` (cleanup unsubscribes, mirrors use-mobile.tsx), fetches `role` from `public.profiles` keyed on `user.id`, and folds both into a single `loading` gate that stays true until session AND (when a user exists) role resolve (D-12).
- `useAuth()` — reads the context, throws `useAuth must be used within an AuthProvider` when misused (mirrors use-toast.ts guard).
- `<AuthProvider>` mounted in `App.tsx` inside `<TooltipProvider>`, wrapping `<Toaster />` + `<Router />`; Wouter `base` prop and path-based routing preserved; no routes added.

## Task Commits

1. **Task 1: authErrors.ts mapper** - `a85131c` (feat)
2. **Task 2: AuthProvider + useAuth** - `5888f7f` (feat)
3. **Task 3: Mount AuthProvider in App.tsx** - `dde739b` (feat)

## Files Created/Modified

- `client/src/lib/authErrors.ts` - `mapAuthError` pure error-string mapper (anti-enumeration).
- `client/src/auth/AuthProvider.tsx` - default-export `AuthProvider`; exports `AuthContextValue` type and `Role` type; context value `{ session, user, role, loading, signOut }`.
- `client/src/auth/useAuth.ts` - named-export `useAuth()` hook with out-of-provider guard.
- `client/src/App.tsx` - mounts `<AuthProvider>` inside `<TooltipProvider>`, wrapping Router.

## Contracts for downstream slices (Plans 03/04/05)

- `useAuth()` returns `AuthContextValue`:
  `{ session: Session | null, user: User | null, role: 'admin' | 'customer' | null, loading: boolean, signOut: () => Promise<void> }`
  (import the `AuthContextValue` type from `@/auth/AuthProvider`).
- `mapAuthError(error: unknown): string` from `@/lib/authErrors` — use in auth catch blocks.
- `<AuthProvider>` is already mounted in `App.tsx`; consumers must respect `loading` before deciding (guards must not decide while `loading` is true — Pitfall 2 / T-3-08).

## Decisions Made

- `loading` derived from two boolean gates (`sessionResolved`, `roleResolved`) instead of one, so a logged-out user resolves role immediately while a logged-in user waits for the profiles query.
- `Role` type exported as `'admin' | 'customer' | null` so the admin guard (Plan 04) types its check directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run check` exited 0 after each task; `npm run build` exited 0 after Task 3 (only the pre-existing chunk-size advisory, unrelated to this plan).

## User Setup Required

None - no external service configuration required. (Manual end-to-end session/refresh verification is deferred to Plan 03 once login UI exists, per VALIDATION.md.)

## Next Phase Readiness

- Auth context, hook, and error mapper contracts are stable and mounted. Plans 03 (register/login/logout), 04 (admin guard), and 05 (reset) can implement against `useAuth`, `mapAuthError`, and the live `<AuthProvider>` without re-deriving anything.
- No routes/pages added by this plan (interface-first slice as designed).

## Self-Check: PASSED

All created/modified files exist; all task commits (a85131c, 5888f7f, dde739b) present in git history.

---
*Phase: 03-authentication-roles*
*Completed: 2026-06-01*
