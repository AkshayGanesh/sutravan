---
phase: 03-authentication-roles
plan: 04
subsystem: auth
tags: [supabase, auth, admin-guard, route-guard, wouter, rls, open-redirect]

requires:
  - phase: 03-authentication-roles
    provides: "useAuth() { session, user, role, loading } with a resolved loading gate (03-02); safeReturnTo + /login + /register routes (03-03)"
provides:
  - "AdminGuard (default-export) — loading gate (D-12) + D-11 redirect matrix; reusable wrapper for any /admin/* route"
  - "Admin — empty protected /admin shell page (portal content is Phase 4)"
  - "Route /admin and /admin/:rest* guarded by <AdminGuard><Admin /></AdminGuard> in App.tsx"
affects: [03-06 admin-promotion]

tech-stack:
  added: []
  patterns:
    - "Route guard = useAuth loading gate first (defer all decisions while loading), then session->role redirect matrix, then render children"
    - "Logged-out handoff = <Redirect to=`/login?next=<encodeURIComponent(internal-path)>`>; Login's safeReturnTo sanitizes the value (no open redirect)"
    - "No 403 page for non-admins — silent redirect to / so the admin area is never advertised (D-11)"

key-files:
  created:
    - client/src/pages/Admin.tsx
    - client/src/auth/AdminGuard.tsx
  modified:
    - client/src/App.tsx

key-decisions:
  - "Guard redirects logged-out users to /login?next=<location> using wouter useLocation() (base-stripped, leading-slash) encoded into the ?next= param Login's safeReturnTo reads (D-10)"
  - "Loading gate renders a centered Spinner and decides nothing until loading is false — relies on 03-02's loading folding sessionResolved + roleResolved (D-12)"
  - "Two explicit routes (/admin and /admin/:rest*) wrap the same <AdminGuard><Admin /></AdminGuard> so both the bare path and any sub-path are guarded; placed above the catch-all"
  - "Redirects use internal leading-slash paths only; Wouter base prop handles the GitHub Pages sub-path (no absolute URLs)"

requirements-completed: [AUTH-05]

duration: 5min
completed: 2026-06-01
---

# Phase 3 Plan 04: Admin Guard + Return-To Handoff Summary

**An AdminGuard route guard that defers all decisions behind useAuth's resolved loading gate (no admin-UI flash, no F5 bounce), redirects logged-out visitors to /login while remembering /admin via the safeReturnTo ?next= contract, silently sends logged-in non-admins to / with no 403 page, and renders an empty protected /admin shell for admins — wired into App.tsx above the catch-all.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files:** 3 (2 created, 1 modified)

## Accomplishments

- **Admin shell** (`client/src/pages/Admin.tsx`) — default-export `Admin` wrapping `<Layout>` with the Contact/Questionnaire header chrome (font-serif heading, `bg-secondary` divider) and a short placeholder body. No data fetching, no portal controls — it exists only to prove the guard renders for an admin (D-11). The real catalog portal is Phase 4.
- **AdminGuard** (`client/src/auth/AdminGuard.tsx`) — default-export component accepting `children`, reading `{ loading, session, role }` from `useAuth()`. Implements the D-11 redirect matrix in strict order.
- **Route wiring** (`client/src/App.tsx`) — imports `AdminGuard` (`@/auth/AdminGuard`) and `Admin` (`@/pages/Admin`); adds `/admin/:rest*` and `/admin` routes (both wrapping `<AdminGuard><Admin /></AdminGuard>`) above the catch-all `NotFound`. `base` prop and path-based router untouched; `/login` + `/register` intact; no `/reset-password` (Plan 05).

## Guard redirect matrix (the contract)

| State | Condition | Behavior |
|-------|-----------|----------|
| Loading | `loading === true` | Centered `<Spinner />`; decide NOTHING (D-12 — defers until session AND role resolve; no flash, no refresh bounce, T-3-08) |
| Logged out | `!session` | `<Redirect to="/login?next=<encodeURIComponent(location)>" />` (D-10 / T-3-10) |
| Non-admin | `session && role !== 'admin'` | `<Redirect to="/" />` — no 403 page (D-11 / T-3-12) |
| Admin | `session && role === 'admin'` | render `children` (AUTH-05) |

## Return-to handoff mechanism (matches Login)

- The guard reads the current in-router path via wouter `useLocation()` — this is base-stripped and leading-slash (e.g. `/admin`).
- It builds `/login?next=${encodeURIComponent(next)}` where `next` is that internal path (falls back to `/admin` if the path is somehow not leading-slash).
- **Login** (03-03) reads `?next=` via `useSearch()` -> `URLSearchParams` and runs it through the exported **`safeReturnTo(raw)`** sanitizer before navigating: only an internal leading-slash path survives; `//` or `://` falls back to `/`. The guard never emits a scheme/protocol-relative value, so the handoff is open-redirect-safe end to end (Pitfall 6 / T-3-10).
- No re-implementation of redirect sanitization — the guard aligns to the existing `safeReturnTo` contract exactly.

## Task Commits

1. **Task 1: Admin.tsx empty protected shell** - `531b5d9` (feat)
2. **Task 2: AdminGuard loading gate + D-11 redirects + D-10 return-to** - `b423666` (feat)
3. **Task 3: Wire guarded /admin route in App.tsx** - `c656b35` (feat)

## Files Created/Modified

- `client/src/pages/Admin.tsx` (created) - default-export `Admin`; empty protected shell.
- `client/src/auth/AdminGuard.tsx` (created) - default-export `AdminGuard`; loading gate + D-11 matrix + D-10 handoff.
- `client/src/App.tsx` (modified) - `/admin` + `/admin/:rest*` routes guarded by `AdminGuard`.

## Threat mitigations applied

- **T-3-08 (flash/bounce)** — loading gate renders a Spinner and defers all decisions until `loading` is false (D-12).
- **T-3-10 (open redirect)** — guard emits only internal `encodeURIComponent`'d leading-slash `?next=` values; Login's `safeReturnTo` is the final sanitizer.
- **T-3-12 (admin-area disclosure)** — non-admins get a silent `/` redirect, no 403 page.
- **T-3-13 (EoP via raw PostgREST)** — accepted by design; the guard is UX-only, RLS `private.is_admin()` is the real boundary (documented in the guard's doc comment).
- **T-3-SC (npm installs)** — none; all deps pre-existing.

## Decisions Made

- Two explicit routes (`/admin`, `/admin/:rest*`) share one guarded element so both the bare path and sub-paths are protected, keeping the guard reusable for future `/admin/*` routes.
- The `?next=` value is `encodeURIComponent`'d to survive special characters; Login decodes via `URLSearchParams.get` and sanitizes via `safeReturnTo`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run check` exited 0 after each task; `npm run build` exited 0 after Task 3 (only the pre-existing >500 kB chunk-size advisory, unrelated to this plan).

## Manual Verification (AUTH-05) — deferred to wave merge

Per `config.json` `human_verify_mode: end-of-phase` and VALIDATION.md, the live guard checks run at wave merge. They require an admin user, which is promoted via Plan 06 (admin promotion). Pending checks:
1. **Logged-out** -> visit `/admin` -> redirected to `/login`; after logging in as an admin -> lands back on `/admin` (D-10).
2. **Logged-in customer** -> visit `/admin` -> redirected to `/` with NO 403 page (D-11).
3. **Logged-in admin** -> visit `/admin` -> sees the empty shell; on hard refresh the Spinner shows briefly and the admin is NOT bounced to `/login` (D-12 — no flash, no wrongful bounce).

## Next Phase Readiness

- The `/admin/*` namespace is now guarded; Phase 4 can mount real portal content inside `Admin.tsx` (or additional `/admin/*` routes wrapped by the same `AdminGuard`) without re-deriving the guard logic.
- Plan 06 (admin promotion) supplies the admin user needed to exercise the admin-path manual checks above.

## Self-Check: PASSED

All created/modified files exist; all task commits (531b5d9, b423666, c656b35) present in git history.

---
*Phase: 03-authentication-roles*
*Completed: 2026-06-01*
