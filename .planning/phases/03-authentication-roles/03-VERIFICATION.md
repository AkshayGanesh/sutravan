---
phase: 03-authentication-roles
verified: 2026-06-01T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code mechanism); live DB + browser checks deferred
overrides_applied: 0
gaps: []
human_verification:
  - test: "Register a new email at /register and confirm the profiles row"
    expected: "After successful registration: `select id,email,role,name from public.profiles where email='<test>'` returns exactly one row with role='customer' and the name supplied in the form"
    why_human: "DB trigger on auth.users INSERT — no test harness; requires a live Supabase project and a browser session"
  - test: "Log in, then verify session persists across hard refresh and browser restart"
    expected: "After login, hard-refreshing the page and reopening the browser tab both leave the user logged in (supabase-js persistSession/autoRefreshToken defaults). AuthProvider's loading gate ensures the Spinner shows briefly and the user is NOT bounced to /login during the role-resolve window."
    why_human: "Browser localStorage + supabase-js session behavior — cannot be verified by grep or tsc"
  - test: "Log out from any page via the Navbar account menu (desktop and mobile)"
    expected: "Clicking 'Log out' in the desktop DropdownMenu (or tapping it in the mobile Sheet) fires useAuth().signOut(), toasts 'Signed out', navigates to /, and the Navbar reverts to the logged-out User icon linking to /login — from every route (/shop, /our-story, etc.)"
    why_human: "UI interaction + real Supabase signOut — cannot be verified statically"
  - test: "Customer JWT role self-escalation is REJECTED (AUTH-04 primary gate)"
    expected: "As a logged-in customer (anon key + their JWT), execute `update public.profiles set role='admin' where id=auth.uid()` via supabase-js or PostgREST — the request is REJECTED by the enforce_profile_role_lock BEFORE UPDATE trigger with 'role change not permitted'. Then `update public.profiles set name='X' where id=auth.uid()` SUCCEEDS (lockdown is column-scoped). Then an attempted catalog write (`insert/update` on products table) is REJECTED by existing RLS."
    why_human: "Requires a live customer JWT and a real Supabase project; simulating a customer JWT in psql is impractical per VALIDATION.md"
  - test: "Admin portal route guard — all three cases (logged-out, customer, admin)"
    expected: "(a) Logged-out visitor hits /admin -> redirected to /login with ?next=%2Fadmin; after logging in as admin -> lands back on /admin (D-10). (b) Logged-in customer hits /admin -> silently redirected to / with NO 403 page (D-11). (c) Logged-in admin hits /admin -> sees the protected shell; on hard refresh the Spinner shows briefly and the admin is NOT bounced to /login (D-12 loading gate)."
    why_human: "UI navigation + role resolution timing — requires a live browser session with both a customer and an admin account; the admin account requires the bootstrap script to have been run"
  - test: "First admin bootstrapped via promote-admin.ts out-of-band only — and admin account reaches /admin + can write catalog"
    expected: "Run `node --env-file=.env.promote.local scripts/promote-admin.ts <email>` -> OK message + exit 0; `select role from public.profiles where email='<email>'` returns 'admin'. Run the script a second time -> still OK/exit 0, role unchanged (idempotent). Promoted user can reach /admin and can write catalog data (RLS allows). NO UI or code path anywhere grants admin."
    why_human: "Requires a registered user, a live hosted DB, and SUPABASE_SERVICE_ROLE_KEY available locally; confirmation of no UI admin-grant path requires app-wide inspection"
  - test: "Password reset round-trip on GitHub Pages sub-path (D-02)"
    expected: "From /login click 'Forgot password?' -> request reset for the owner email -> receive the reset email -> click the link -> lands on /reset-password (via 404.html SPA fallback if needed) -> page switches to 'Set new password' form (PASSWORD_RECOVERY event fired) -> set new password -> URL no longer shows the token (history.replaceState executed) -> log in with new password succeeds"
    why_human: "End-to-end email delivery + browser navigation + Supabase recovery token handling; requires live Supabase hosted Auth (confirm-email OFF, exact /reset-password allowlisted). Note WR-01 (REVIEW): on a cold load from the email link, the PASSWORD_RECOVERY event may fire before onAuthStateChange is subscribed — the page may show the request form instead of the set-password form. This race should be confirmed or fixed before relying on this flow."
---

# Phase 3: Authentication & Roles Verification Report

**Phase Goal:** Users can create accounts and sign in securely, and the admin-vs-customer distinction is enforced in the database — establishing the trust boundary that gates the admin portal and all customer features.
**Verified:** 2026-06-01
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | A visitor can register with email and password, and a `profiles` row (defaulting to the `customer` role) is auto-created for them | ? HUMAN NEEDED (mechanism VERIFIED) | `supabase/migrations/0004_auth_profiles.sql`: `handle_new_user()` SECURITY DEFINER trigger inserts `(id, email, name, role='customer')` hard-coded after INSERT on `auth.users`. `Register.tsx`: calls `supabase.auth.signUp({ email, password, options: { data: { name } } })` — `role` is never passed in metadata. Functional proof (live register -> profiles row) requires a live DB. |
| 2 | A user can log in and remain logged in across browser sessions/refreshes, and can log out from any page | ? HUMAN NEEDED (mechanism VERIFIED) | `AuthProvider.tsx`: seeds session via `getSession()`, subscribes via `onAuthStateChange`, uses supabase-js defaults (`persistSession`/`autoRefreshToken`). `Login.tsx`: calls `signInWithPassword`. `Navbar.tsx`: DropdownMenu (desktop) + button (mobile Sheet) both call `useAuth().signOut()` — reachable from any page via fixed top navbar. Session persistence across refresh/restart requires live browser testing. |
| 3 | Roles are stored server-side in `profiles` (never in user-editable metadata); a non-admin authenticated user holding the anon key is REJECTED by RLS on every catalog/content write attempt | ? HUMAN NEEDED (mechanism VERIFIED) | `0004_auth_profiles.sql`: `enforce_profile_role_lock` BEFORE UPDATE trigger raises `'role change not permitted'` when `new.role is distinct from old.role AND auth.uid() IS NOT NULL AND NOT private.is_admin()`. `AuthProvider.tsx` fetches role from `public.profiles` (never from JWT/metadata). No client code assigns `role=admin`. Existing `0002` RLS uses `private.is_admin()` for catalog write policies. Functional rejection of a live customer JWT requires manual verification. |
| 4 | Admin portal routes redirect non-admins away and are reachable only by an admin (UX guard backing the RLS enforcement) | ? HUMAN NEEDED (mechanism VERIFIED) | `AdminGuard.tsx`: loading gate (Spinner, D-12) -> logged-out -> `/login?next=<encodeURIComponent(location)>` -> non-admin -> `/` (no 403, D-11) -> admin renders children. `App.tsx`: `/admin` and `/admin/:rest*` both wrapped in `<AdminGuard><Admin /></AdminGuard>` above the catch-all. Three-case behavioral check (logged-out/customer/admin with no-flash-on-refresh) requires live browser session. |
| 5 | The first admin is bootstrapped out-of-band (not via any self-serve UI path), and an admin account can reach the protected area | ? HUMAN NEEDED (mechanism VERIFIED) | `scripts/promote-admin.ts`: reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from non-VITE_ `process.env`, takes an email arg, idempotently sets `role='admin'`, mirrors `scripts/seed.ts`. `.gitignore`: `.env*.local` rule covers `.env.promote.local`. No client-side code assigns `role=admin` (grep confirms). `scripts/check-no-secret.sh` PASSES (reported in 03-06-SUMMARY.md). Live promotion + admin reaching /admin requires manual execution. |

**Score:** All 5 code mechanisms VERIFIED. 5/5 truths resolve as HUMAN NEEDED due to `human_verify_mode: end-of-phase` — the live functional checks (register->profiles row, customer JWT rejection, guard navigation, promote-admin live run, reset round-trip) are deferred per VALIDATION.md and config.json.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0004_auth_profiles.sql` | name column, handle_new_user + on_auth_user_created, enforce_profile_role_lock + profiles_role_lock | VERIFIED | File exists; 2 SECURITY DEFINER functions (confirmed count=2 outside comments); AFTER INSERT trigger on `auth.users`; BEFORE UPDATE trigger on `public.profiles`; `role='customer'` hard-coded; `set search_path = ''`; no INSERT policy on profiles; all references schema-qualified. |
| `supabase/tests/auth_rls_assertions.sql` | Structural invariant harness for 0004 objects | VERIFIED | File exists, 133 lines; mirrors `rls_assertions.sql` single-block structure; asserts: name column (information_schema.columns), handle_new_user SECURITY DEFINER + locked search_path + on_auth_user_created trigger, enforce_profile_role_lock SECURITY DEFINER + locked search_path + profiles_role_lock BEFORE UPDATE trigger, no anon/public INSERT policy on profiles; header documents manual escalation check. |
| `client/src/auth/AuthProvider.tsx` | React context provider with getSession + onAuthStateChange + role fetch + loading gate | VERIFIED | 114 lines; seeds via `getSession()`, subscribes via `onAuthStateChange` with cleanup; separate `useEffect` fetches role from `public.profiles` keyed on `user.id`; dual-gate loading (`sessionResolved && roleResolved`); exports `AuthContextValue` and `Role` types. CR-02 (REVIEW): role fetch `.then(({ data }) => ...)` ignores `error` — a transient failure silently sets role null, potentially bouncing a real admin. Advisory WARNING. |
| `client/src/auth/useAuth.ts` | useAuth hook returning session/user/role/loading/signOut | VERIFIED | 17 lines; reads `AuthContext`; throws `'useAuth must be used within an AuthProvider'` when used outside provider (mirrors use-toast.ts guard). |
| `client/src/lib/authErrors.ts` | mapAuthError — friendly, non-enumerating error copy mapper | VERIFIED | 87 lines; named export `mapAuthError(error: unknown): string`; pure (no React, no I/O); collapses "invalid login credentials" AND "email not found" / "user not found" into ONE generic message (anti-enumeration); covers weak password, rate-limit, network; GENERIC_FALLBACK for unknowns. |
| `client/src/pages/Register.tsx` | Registration form calling signUp with name metadata | VERIFIED | 199 lines; RHF + Zod (name non-empty, email valid, password >= 6); calls `signUp({ email, password, options: { data: { name } } })` — role never in metadata; `mapAuthError` on error; `useToast()` on success; navigates to `/`; uses `<Layout>` + Card chrome. |
| `client/src/pages/Login.tsx` | Login form with signInWithPassword + safe return-to + forgot-password link | VERIFIED | 190 lines; RHF + Zod; `signInWithPassword`; `mapAuthError`; exports `safeReturnTo(raw)` (rejects non-leading-slash, `://`, `//` values to `/`); reads `?next=` via `useSearch()` -> `URLSearchParams` -> `safeReturnTo`; `/reset-password` and `/register` links present; `useToast()` on success. |
| `client/src/auth/AdminGuard.tsx` | Route guard: loading gate + logged-out->/login(+remember) + non-admin->/ + admin->children | VERIFIED | 58 lines; reads `{ loading, session, role }` from `useAuth()`; (1) loading -> Spinner (full-screen centered); (2) !session -> `<Redirect to="/login?next=${encodeURIComponent(next)}">` where `next` is the base-stripped in-router path; (3) role !== 'admin' -> `<Redirect to="/" />`; (4) admin -> renders children. Redirects use Wouter `<Redirect>` (base-aware). |
| `client/src/pages/Admin.tsx` | Empty protected /admin shell (portal content is Phase 4) | VERIFIED | 35 lines; default-export `Admin`; wraps `<Layout>` with Contact/Questionnaire-style header chrome; no data fetching, no portal controls; placeholder copy noting Phase 4 builds the portal. |
| `client/src/pages/ResetPassword.tsx` | Two-step reset: resetPasswordForEmail request + PASSWORD_RECOVERY update (updateUser) | VERIFIED | 301 lines; `buildResetRedirect()` builds base-aware URL matching hosted allowlist (`new URL(BASE_URL.replace(/\/$/, '') + '/reset-password', window.location.origin)`); `useEffect` subscribes to `onAuthStateChange` -> sets `recoveryMode` on `PASSWORD_RECOVERY`; `updateUser({ password })`; `history.replaceState` strips token; `mapAuthError` on errors; non-enumerating request success toast. WR-01 (REVIEW): cold-load race — if PASSWORD_RECOVERY fires before the subscription attaches, recovery mode is missed. Advisory WARNING. |
| `scripts/promote-admin.ts` | Out-of-band first-admin bootstrap (service-role, mirrors seed.ts) | VERIFIED (with CR-01 advisory) | 58 lines; reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from non-`VITE_` `process.env`; fail-fast if missing; takes `process.argv[2]` email, fail-fast if absent; `createClient(url, serviceKey, { auth: { persistSession: false } })`; `admin.from('profiles').update({ role: 'admin' }).eq('email', email)`; mirrors seed.ts structure. CR-01 (REVIEW): no `.select('id')` + `data.length` check — if email matches 0 rows, logs false-success "OK: ... is now admin" while promoting nobody. Advisory WARNING for the single most security-sensitive operation. |
| `client/src/App.tsx` | AuthProvider mounted; /login, /register, /reset-password, /admin/* routes | VERIFIED | `QueryClientProvider > TooltipProvider > AuthProvider > (Toaster + Router)`; WouterRouter `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` unchanged; routes for `/login`, `/register`, `/reset-password`, `/admin`, `/admin/:rest*` (both admin routes wrapped in `<AdminGuard><Admin /></AdminGuard>`) above catch-all `NotFound`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.users` INSERT (signup) | `public.profiles` row with role='customer' | `on_auth_user_created` trigger -> `public.handle_new_user()` | VERIFIED | `0004_auth_profiles.sql`: `create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user()`. Function inserts `role='customer'` hard-coded, name from `raw_user_meta_data ->> 'name'`. |
| `Register.tsx` | `supabase.auth.signUp` | `options: { data: { name } }` (name flows to trigger) | VERIFIED | `Register.tsx:57`: `options: { data: { name } }` — role is never in options.data. |
| `public.profiles` UPDATE (role change) | `raise exception 'role change not permitted'` | `profiles_role_lock` BEFORE UPDATE trigger | VERIFIED (structure) | `0004_auth_profiles.sql`: `create trigger profiles_role_lock before update on public.profiles for each row execute procedure public.enforce_profile_role_lock()`. Functional rejection requires live JWT test (manual). |
| `Navbar.tsx` | `useAuth().signOut` | DropdownMenuItem + mobile Sheet button | VERIFIED | `Navbar.tsx:29`: `const { session, signOut } = useAuth()`. `Navbar.tsx:156`: `DropdownMenuItem onSelect={() => void handleSignOut()}`. `Navbar.tsx:224-226`: mobile Sheet `button` calls `void handleSignOut()`. |
| `AdminGuard.tsx` | `useAuth` | reads `loading/session/role` to decide | VERIFIED | `AdminGuard.tsx:31`: `const { loading, session, role } = useAuth()`. Loading, redirect matrix, and admin render all confirmed present. |
| `App.tsx` | `AdminGuard.tsx` | `/admin` and `/admin/:rest*` routes | VERIFIED | `App.tsx:32-45`: both `/admin/:rest*` and `/admin` routes render `<AdminGuard><Admin /></AdminGuard>`. |
| `ResetPassword.tsx` | `supabase.auth.resetPasswordForEmail` | base-aware `redirectTo` | VERIFIED | `ResetPassword.tsx:94-96`: `resetPasswordForEmail(values.email, { redirectTo: buildResetRedirect() })`. `buildResetRedirect()` returns `new URL(BASE_URL.replace(/\/$/, '') + '/reset-password', window.location.origin).toString()`. In production resolves to `https://sutravan.in/reset-password` (matches Plan 01 hosted allowlist). |
| `ResetPassword.tsx` | `supabase.auth.updateUser` | `PASSWORD_RECOVERY` event -> recovery mode | VERIFIED | `ResetPassword.tsx:81-90`: `useEffect` subscribes via `onAuthStateChange`; on `PASSWORD_RECOVERY` sets `recoveryMode(true)`. `ResetPassword.tsx:113-133`: `updateUser({ password })` + `history.replaceState` token cleanup. WR-01 race advisory applies. |
| `scripts/promote-admin.ts` | `public.profiles` | service-role UPDATE role='admin' where email=arg | VERIFIED (structure) | `promote-admin.ts:45`: `admin.from('profiles').update({ role: 'admin' }).eq('email', email)`. Non-VITE_ env guard, email arg guard, main().catch wrapper all present. CR-01: no rows-affected check (advisory WARNING). |
| `client/src/App.tsx` | `AuthProvider.tsx` | `<AuthProvider>` wraps `<Router />` | VERIFIED | `App.tsx:56-59`: `<AuthProvider><Toaster /><Router /></AuthProvider>` inside `<TooltipProvider>`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `AdminGuard.tsx` | `role` | `useAuth()` -> `AuthProvider` -> `public.profiles` Supabase query | Yes — real Supabase query on `profiles` table keyed on `user.id` | FLOWING (mechanism); live correctness requires human verification |
| `AuthProvider.tsx` | `session` | `supabase.auth.getSession()` + `onAuthStateChange` | Yes — real Supabase Auth session | FLOWING |
| `AuthProvider.tsx` | `role` | `supabase.from('profiles').select('role').eq('id', userId).single()` | Yes — real DB query | FLOWING, but error branch discarded (CR-02) |

---

### Behavioral Spot-Checks

Skipped: The auth flows require a live Supabase project, real JWT tokens, and browser interaction — none of which can be simulated without starting a server or making external service calls. Per Step 7b constraints, these are routed to human verification.

TypeScript compile check: `npm run check` exits 0 (verified — no output means clean).

---

### Probe Execution

No conventional probe scripts found in `scripts/*/tests/probe-*.sh` for this phase. The auth DB assertions (`supabase/tests/auth_rls_assertions.sql` and `supabase/tests/rls_assertions.sql`) require a live `SUPABASE_DB_URL` and were reported as PASS by the owner at the 03-01 blocking human-action checkpoint (documented in 03-01-SUMMARY.md). The verifier cannot re-run these without the live DB credential; their structural correctness is confirmed by code review above.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AUTH-01 | 03-01 (DB trigger), 03-03 (Register UI) | Customer can register with email and password | SATISFIED (mechanism) / HUMAN NEEDED (live) | `handle_new_user` trigger (0004 migration) auto-creates `role='customer'` profile; `Register.tsx` calls `signUp` with name metadata. Functional check: human. |
| AUTH-02 | 03-02 (AuthProvider), 03-03 (Login), 03-05 (Reset) | User can log in and stay logged in across browser sessions | SATISFIED (mechanism) / HUMAN NEEDED (live) | `AuthProvider` uses supabase-js `persistSession`/`autoRefreshToken` defaults; `Login.tsx` calls `signInWithPassword`; `ResetPassword.tsx` completes the reset round-trip. Browser persistence test: human. |
| AUTH-03 | 03-03 (Navbar) | User can log out from any page | SATISFIED (mechanism) / HUMAN NEEDED (live) | `Navbar.tsx` mounts `useAuth().signOut` in both desktop DropdownMenu and mobile Sheet — reachable from every page via the fixed top navbar. Live UX test: human. |
| AUTH-04 | 03-01 (role-lock trigger), 03-06 (promote-admin) | Admin vs customer roles stored server-side and enforced via RLS | SATISFIED (mechanism) / HUMAN NEEDED (live) | `enforce_profile_role_lock` trigger blocks role self-escalation; `handle_new_user` hard-codes `role='customer'`; no client code assigns admin; `promote-admin.ts` is the only admin path. Functional JWT rejection proof: human. |
| AUTH-05 | 03-02 (AuthProvider/role), 03-04 (AdminGuard), 03-06 (bootstrap) | Admin portal routes protected — non-admins cannot reach them | SATISFIED (mechanism) / HUMAN NEEDED (live) | `AdminGuard.tsx` implements full D-11 matrix (loading gate + logged-out redirect + non-admin redirect + admin render); `/admin` and `/admin/:rest*` both guarded in App.tsx. Live guard behavior (all three cases): human. |

No orphaned requirements: all five AUTH-01..AUTH-05 are covered by the six plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `client/src/auth/AuthProvider.tsx` | 84-93 | Role fetch `.then(({ data }) => ...)` ignores `error` branch | WARNING (CR-02) | A transient role-query failure (network blip, momentary PostgREST error during token refresh) silently sets `role=null` and resolves loading, causing `AdminGuard` to redirect a real admin to `/` with no user-visible error. Not a security hole (RLS is unaffected) but causes incorrect UX. Fix: destructure `{ data, error }` and distinguish query failure from legitimately null role. |
| `scripts/promote-admin.ts` | 45 | `update().eq('email', email)` with no rows-affected check | WARNING (CR-01) | Supabase returns no error when UPDATE matches 0 rows — a typo'd email prints "OK: ... is now admin" while promoting nobody. Also: `profiles.email` has no unique constraint, so two rows with the same email silently both become admin. For the single most security-sensitive operation, silent false-success is unacceptable. Fix: add `.select('id')` and assert `data.length === 1` before logging success. |
| `client/src/pages/ResetPassword.tsx` | 81-90 | `onAuthStateChange` subscription only listens for `PASSWORD_RECOVERY` but misses the event if it fires before the component mounts | WARNING (WR-01) | On a cold load from the reset email link, supabase-js parses the `#access_token=...&type=recovery` hash at module initialization — before this component mounts and subscribes. If `PASSWORD_RECOVERY` fires before the subscription is attached, the page shows the request form instead of the set-new-password form. Fix: also check `supabase.auth.getSession()` on mount and enter recovery mode if a session is present on the `/reset-password` route. |
| `client/src/pages/Register.tsx` | 54-64 | With confirm-email OFF, signUp for an existing email returns a "user already registered" error which `mapAuthError` renders verbatim | INFO (WR-02) | This is an account-enumeration oracle on the registration endpoint, inconsistent with the anti-enumeration work on login/reset. Advisory only — may be an accepted product trade-off. Document the decision or enable confirm-email to suppress the distinguishing error. |

No `TBD`, `FIXME`, or `XXX` markers found in any file modified by this phase.

`placeholder` hits in Login.tsx, Register.tsx, and ResetPassword.tsx are HTML `<Input placeholder="...">` attributes — not stub indicators. These are UI affordances, not code stubs.

---

### Human Verification Required

#### 1. Customer Registration -> profiles Row

**Test:** Register a new email at `/register` with name "Test User", email `test+<timestamp>@example.com`, password of 6+ chars.
**Expected:** (a) User is immediately logged in (confirm-email OFF). (b) In the Supabase SQL editor: `select id, email, role, name from public.profiles where email='test+<timestamp>@example.com'` returns exactly one row with `role='customer'` and `name='Test User'`.
**Why human:** DB trigger behavior (auth.users INSERT -> profiles INSERT) requires a live Supabase hosted project. Cannot be verified by static analysis.

#### 2. Session Persistence Across Refresh and Browser Restart

**Test:** Log in at `/login`. Hard-refresh the page (`Cmd+Shift+R`). Close the browser and reopen it, navigating back to the app.
**Expected:** Each time the app loads, the user is still logged in — the loading Spinner appears briefly during the role-resolve window, then the logged-in Navbar state is restored. The user is never bounced to `/login`.
**Why human:** `supabase-js` localStorage session persistence requires a real browser environment. The role-resolve loading gate behavior can only be observed live.

#### 3. Logout from Any Page (AUTH-03)

**Test:** Log in, navigate to `/shop`, open the desktop Navbar account menu (User icon), click "Log out". Repeat from the mobile Sheet on a mobile viewport.
**Expected:** Both paths call `useAuth().signOut()`, toast "Signed out", navigate to `/`, and the Navbar account icon reverts to a link to `/login`.
**Why human:** Live Supabase signOut + React state update + toast + navigation requires a running app.

#### 4. Customer JWT Role Self-Escalation is REJECTED (AUTH-04 primary gate)

**Test:** As a logged-in customer (using the anon key + their JWT via supabase-js or the Supabase client directly), run: `supabase.from('profiles').update({ role: 'admin' }).eq('id', userId)`. Then run: `supabase.from('profiles').update({ name: 'X' }).eq('id', userId)`. Then attempt an insert or update on the `products` table.
**Expected:** First call is REJECTED with `'role change not permitted'` (enforce_profile_role_lock). Second call SUCCEEDS (name self-update, column-scoped lockdown). Third call is REJECTED by `private.is_admin()` RLS. Re-query confirms `role` is still `'customer'`.
**Why human:** Requires a real customer JWT and live Supabase RLS/trigger enforcement. Simulating a JWT in psql is impractical per VALIDATION.md.

#### 5. Admin Portal Guard — All Three Cases (AUTH-05)

**Test:** (a) Visit `/admin` while logged out. (b) Visit `/admin` while logged in as a customer. (c) Visit `/admin` while logged in as the promoted admin; then hard-refresh.
**Expected:** (a) Redirected to `/login?next=%2Fadmin`; after admin login -> lands on `/admin`. (b) Silently redirected to `/` with no 403 page. (c) Spinner shows briefly; admin is NOT bounced to `/login`; sees the Admin shell page ("Admin" heading, "catalog management portal will be built in a later milestone").
**Why human:** All three cases require live browser sessions with different auth states; the D-12 no-flash-no-bounce behavior requires observing the loading gate timing.

#### 6. First Admin Bootstrap via promote-admin.ts (Success Criterion #5)

**Test:** Register a throwaway user. Run `node --env-file=.env.promote.local scripts/promote-admin.ts <email>`. Check the role in the Supabase SQL editor. Run the script a second time. Navigate to `/admin` as the promoted user. Confirm no UI or code path grants admin.
**Expected:** First run: `OK: <email> is now admin (idempotent).` + exit 0. SQL: `select role from public.profiles where email='<email>'` returns `'admin'`. Second run: same OK message (idempotent no-op). Promoted user reaches `/admin` shell. No UI path grants admin.
**Why human:** Requires SUPABASE_SERVICE_ROLE_KEY, a live DB, and a registered user. Idempotency + live DB effect cannot be verified statically.
Note: CR-01 (REVIEW) is relevant here — the script will report "OK" even if the email was typo'd and matched 0 rows. Manually confirm the SQL query actually returns `'admin'` for the target email.

#### 7. Password Reset Round-Trip (D-02)

**Test:** From `/login`, click "Forgot password?". Request a reset for the owner email. Receive the reset email. Click the link. Observe what page loads. Set a new password. Log in with the new password.
**Expected:** The link lands on `/reset-password` (via 404.html SPA fallback). The page switches to "Set a New Password" form (PASSWORD_RECOVERY event fired). Setting the password clears the URL token. Login with the new password succeeds.
**Why human:** End-to-end email delivery + Supabase recovery token parsing requires a live hosted environment. Rate-limited at 2/hr — space out attempts.
Note: WR-01 (REVIEW) warns that on a cold load from the email link, the PASSWORD_RECOVERY event may fire before the `onAuthStateChange` subscription is attached, causing the page to show the request form. Verify this case and fix if needed before relying on this flow.

---

### Advisory Issues Summary (from 03-REVIEW.md)

These do not block phase goal achievement (the code mechanisms are correct) but should be addressed before the admin portal (Phase 4) goes live:

**CR-01 — promote-admin false success on 0 matched rows** (`scripts/promote-admin.ts:45`)
The UPDATE has no rows-affected check. A typo'd email silently reports success while promoting nobody. Additionally, `profiles.email` has no unique constraint — two rows with the same email would both be promoted. Fix before running the bootstrap for real: add `.select('id')` and assert exactly one row was affected.

**CR-02 — Role-fetch error silently demotes an admin** (`client/src/auth/AuthProvider.tsx:84-93`)
The role query destructures only `{ data }` and ignores `error`. A transient query failure sets `role=null` and resolves loading, causing AdminGuard to redirect a real admin to `/`. Fix: capture `error` and distinguish query failure from a legitimately null role (e.g., set a `roleError` state the guard can render as a retry rather than a silent home redirect).

**WR-01 — PASSWORD_RECOVERY event race in ResetPassword.tsx** (`client/src/pages/ResetPassword.tsx:81-90`)
A cold load from the reset email link may miss the PASSWORD_RECOVERY event because supabase-js parses the hash fragment at module initialization, before the component mounts. Fix: on mount, also call `supabase.auth.getSession()` and enter recovery mode if the session type is `recovery`, as a fallback to the event subscription.

---

### Gaps Summary

No code-level gaps found. All five success criteria have correct, substantive implementations in the codebase. The three advisory issues (CR-01, CR-02, WR-01) are robustness/security hardening concerns surfaced by the code review — they do not prevent the phase goal from being met at a functional level, but CR-01 and CR-02 should be fixed before production use of the bootstrap script and admin portal respectively.

Status is `human_needed` because every success criterion requires live-environment verification (Supabase DB + browser) that was deliberately deferred to end-of-phase per `human_verify_mode: end-of-phase` and VALIDATION.md. No automated gaps exist in the `gaps:` frontmatter.

---

_Verified: 2026-06-01_
_Verifier: Claude (gsd-verifier)_
