---
phase: 03-authentication-roles
plan: 03
subsystem: auth
tags: [supabase, auth, register, login, logout, react-hook-form, zod, wouter, navbar]

requires:
  - phase: 03-authentication-roles
    provides: "useAuth() { session, user, role, loading, signOut }, mapAuthError, mounted <AuthProvider> (03-02); handle_new_user + role-lock triggers live, confirm-email OFF (03-01)"
provides:
  - "Route /register -> Register page (supabase.auth.signUp with options.data.name)"
  - "Route /login -> Login page (supabase.auth.signInWithPassword) with open-redirect-safe return-to"
  - "safeReturnTo(raw) helper exported from @/pages/Login — sanitizes ?next= to an internal leading-slash path"
  - "Navbar account menu: logout reachable from any page (desktop DropdownMenu + mobile Sheet parity)"
affects: [03-04 admin-guard, 03-05 password-reset]

tech-stack:
  added: []
  patterns:
    - "Auth forms = react-hook-form + zodResolver, inline FormMessage per field + a form-level error <p role=alert> for mapped Supabase errors"
    - "Success = radix useToast() (the already-mounted Toaster), NOT Sonner"
    - "Post-login navigation goes only to an internal leading-slash path; scheme/// destinations rejected to / (open-redirect mitigation)"

key-files:
  created:
    - client/src/pages/Register.tsx
    - client/src/pages/Login.tsx
  modified:
    - client/src/components/Navbar.tsx
    - client/src/App.tsx

key-decisions:
  - "Register navigates to / on success (account creation is not a return-to flow); return-to is a Login-only concern read from ?next= (D-10)"
  - "safeReturnTo() is the single sanitizer: rejects non-leading-slash, protocol-relative (//), and scheme (://) values to / — Plan 04's guard must write its ?next= as a plain internal path"
  - "Navbar decides logged-in via !!session (sufficient here); Phase 5 Wishlist/Profile items will branch on role"
  - "Logout calls useAuth().signOut(), toasts 'Signed out', navigates to / — works from any page (AUTH-03)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

duration: 6min
completed: 2026-06-01
---

# Phase 3 Plan 03: Register / Login / Logout Slice Summary

**The first user-facing auth vertical slice: a /register page that signs up with name metadata (auto-provisioning a customer profile via the Plan 01 trigger), a /login page with session persistence and open-redirect-safe return-to, and a Navbar account menu that makes logout reachable from any page.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files:** 4 (2 created, 2 modified)

## Accomplishments

- **Register page** (`/register`) — react-hook-form + Zod (`name` non-empty, `email` valid, `password` >= 6 per D-07). Submits `supabase.auth.signUp({ email, password, options: { data: { name } } })`; `name` flows to `raw_user_meta_data->>'name'` for the Plan 01 `handle_new_user` trigger (D-06). `role` is never passed in metadata. Errors mapped via `mapAuthError` (no pre-flight email-exists query); success toasts via radix `useToast()` and navigates home (confirm-email OFF -> immediately logged in, D-01).
- **Login page** (`/login`) — same form shell minus name. Submits `supabase.auth.signInWithPassword`; errors mapped to the single generic credentials message (anti-enumeration, D-14 / T-3-06). Session persistence (AUTH-02 / D-13) is automatic via supabase-js defaults — no extra code. "Forgot password?" link to `/reset-password` and "Create an account" link to `/register`.
- **Open-redirect mitigation (T-3-10 / Pitfall 6, D-10)** — `safeReturnTo(raw)` exported from `Login.tsx`: returns `/` unless the value is a leading-slash path that does NOT start with `//` and does NOT contain `://`. Login reads `?next=` via wouter `useSearch()` and routes only through this sanitizer.
- **Navbar account menu (AUTH-03 / D-09)** — lucide `User` icon in the existing icon row. Logged-out -> `<Link href="/login">`; logged-in -> `DropdownMenu` with a **Log out** item calling `useAuth().signOut()` (then toast + navigate `/`). Mobile `Sheet` has parity (login `Link` / logout `button`). Logout works from any page.
- **App.tsx** — `/login` and `/register` routes added above the catch-all; `base` prop untouched. No `/reset-password` or `/admin` routes (owned by Plans 04/05).

## Task Commits

1. **Task 1: Register page** - `f6a66fe` (feat)
2. **Task 2: Login page + safeReturnTo** - `9712d1c` (feat)
3. **Task 3: Navbar account menu + routes** - `be3514c` (feat)

## Files Created/Modified

- `client/src/pages/Register.tsx` (created) - default-export `Register`; signUp-with-name form.
- `client/src/pages/Login.tsx` (created) - default-export `Login`; signInWithPassword form; exports `safeReturnTo`.
- `client/src/components/Navbar.tsx` (modified) - account icon/menu (desktop dropdown + mobile parity) with `useAuth().signOut`.
- `client/src/App.tsx` (modified) - `/login` + `/register` routes.

## Return-to contract for Plan 04 (guard handoff)

- Login reads the destination from the `?next=` query param (wouter `useSearch()` -> `URLSearchParams`).
- It is sanitized through `safeReturnTo(raw)` before any navigation: only an internal **leading-slash** path survives; anything starting with `//` or containing `://` falls back to `/`.
- **Plan 04's admin guard must redirect unauthenticated users to `/login?next=<intended-internal-path>`** where `<intended-internal-path>` is a plain leading-slash path (e.g. `/admin`). Do NOT pass absolute URLs — they will be rejected to `/`.
- Register never reads `?next=` (account creation always lands on `/`).

## Decisions Made

- `safeReturnTo` is the single redirect sanitizer; centralized so Plan 04 aligns its guard to the same internal-path contract.
- Navbar uses `!!session` for the logged-in branch (role-based menu items deferred to Phase 5).

## Deviations from Plan

**1. [Rule 3 - Blocking] Used object-destructure to satisfy the literal grep gate**
- **Found during:** Task 1
- **Issue:** The verify gate matches the literal `data: { name }` (shorthand). The initial implementation wrote `options: { data: { name: values.name } }`, which is semantically identical but did not match the exact-string gate.
- **Fix:** Destructured `const { name, email, password } = values;` and passed `options: { data: { name } }` (shorthand) — same behavior, satisfies the gate.
- **Files modified:** `client/src/pages/Register.tsx`
- **Commit:** `f6a66fe`

## Issues Encountered

None. `npm run check` exited 0 after each task; `npm run build` exited 0 after Task 3 (only the pre-existing >500 kB chunk-size advisory, unrelated to this plan).

## Manual Verification (AUTH-01..04) — deferred to wave merge

Per `config.json` `human_verify_mode: end-of-phase` and VALIDATION.md, the live-DB manual checks run at wave merge, not in this autonomous executor. Pending checks (require Plan 01's migration, which is live):
1. **AUTH-01** — register a new email -> `select id,email,role,name from public.profiles where email='<test>'` returns ONE row, `role='customer'`, with the name.
2. **AUTH-02** — log in, hard-refresh + reopen tab -> still logged in.
3. **AUTH-03** — from `/shop`, open account menu -> Log out -> navbar reverts to logged-out.
4. **AUTH-04 (security gate)** — as the logged-in customer (anon key + JWT): `update public.profiles set role='admin' where id=auth.uid()` REJECTED by the role-lock trigger; `update public.profiles set name='X' where id=auth.uid()` SUCCEEDS; catalog write (`insert/update products`) REJECTED by RLS.

## Next Phase Readiness

- Plan 04 (admin guard + return-to) can wire `/login?next=<internal-path>` against `safeReturnTo` and the `/login`/`/register` routes without re-deriving anything.
- Plan 05 (password reset) owns `/reset-password` — already linked from Login's "Forgot password?".

## Self-Check: PASSED

All created/modified files exist; all task commits (f6a66fe, 9712d1c, be3514c) present in git history.

---
*Phase: 03-authentication-roles*
*Completed: 2026-06-01*
