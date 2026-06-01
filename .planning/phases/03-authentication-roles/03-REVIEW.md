---
phase: 03-authentication-roles
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - client/src/App.tsx
  - client/src/auth/AdminGuard.tsx
  - client/src/auth/AuthProvider.tsx
  - client/src/auth/useAuth.ts
  - client/src/components/Navbar.tsx
  - client/src/lib/authErrors.ts
  - client/src/pages/Admin.tsx
  - client/src/pages/Login.tsx
  - client/src/pages/Register.tsx
  - client/src/pages/ResetPassword.tsx
  - scripts/promote-admin.ts
  - supabase/migrations/0004_auth_profiles.sql
  - supabase/tests/auth_rls_assertions.sql
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the authentication & roles slice: client auth provider/guard, login/register/reset flows, anti-enumeration error mapping, the SQL profile-provisioning + role-lock triggers, the structural test harness, and the out-of-band admin-promotion script.

The DB security boundary is the strongest part of the submission: `handle_new_user` hard-codes `role='customer'`, the `enforce_profile_role_lock` carve-out is correctly scoped (anon/authenticated cannot UPDATE profiles except their own row, and the lock blocks `role` changes for JWT-bearing non-admins), and the open-redirect mitigation in `safeReturnTo` is sound. The structural assertions verify SECURITY DEFINER + locked search_path on both triggers.

Two BLOCKER-class issues were found: the `promote-admin` script reports false success when the target email does not exist or matches multiple rows (no rows-affected check, and `profiles.email` has no uniqueness constraint), and the role-fetch path in `AuthProvider` silently discards query errors which can mis-classify an admin as non-admin and trigger an incorrect redirect. Several WARNING-level robustness gaps follow, plus the register flow's deliberate-but-undocumented email-enumeration surface.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `promote-admin` reports success on zero or multiple matched rows

**File:** `scripts/promote-admin.ts:45-52`
**Issue:** The promotion update is `update('profiles').set(role:'admin').eq('email', email)` with no check of how many rows were affected. Supabase returns no `error` when an `UPDATE ... WHERE` matches **zero** rows, so a typo'd or not-yet-registered email prints `OK: <email> is now admin (idempotent).` while promoting nobody. Worse: `public.profiles.email` has **no unique constraint** (`0001_init_schema.sql:68` declares `email text` only), so if two rows share an email this silently promotes **both** to admin. For the single most security-sensitive operation in the system (the only path to admin), silent false-success and accidental multi-promotion are unacceptable.
**Fix:** Request the affected rows and assert exactly one, e.g.:
```ts
const { data, error } = await admin
  .from('profiles')
  .update({ role: 'admin' })
  .eq('email', email)
  .select('id');

if (error) throw new Error(`promote failed for ${email}: ${error.message}`);
if (!data || data.length === 0) {
  console.error(`FAIL: no profile found for ${email}`);
  process.exit(1);
}
if (data.length > 1) {
  console.error(`FAIL: ${data.length} profiles match ${email}; refusing ambiguous promotion`);
  process.exit(1);
}
console.log(`OK: ${email} is now admin (idempotent).`);
```
Additionally consider adding a unique constraint on `public.profiles.email` in a follow-up migration to make the ambiguity structurally impossible.

### CR-02: Role-fetch errors are silently swallowed, can demote an admin and trigger a wrong redirect

**File:** `client/src/auth/AuthProvider.tsx:84-93`
**Issue:** The role query destructures only `{ data }` and ignores `error`. If the `profiles` select fails transiently (network blip, a momentary RLS/JWT timing issue during token refresh, PostgREST 5xx), `data` is `null`, so `setRole(null)` runs and `setRoleResolved(true)` flips `loading` to false. `AdminGuard` (`AdminGuard.tsx:52`) then sees `role !== "admin"` for a logged-in user and **silently redirects a real admin away from `/admin` to `/`** with no error surfaced. The user has no signal that anything failed; they simply cannot reach the admin area until a full reload happens to succeed. This is incorrect behavior driven by an unhandled error path, not a styling nit.
**Fix:** Capture and handle the error explicitly. At minimum surface it; ideally distinguish "no profile row" (legitimately null role) from "query failed" (unknown — do not assert non-admin):
```ts
.single()
.then(({ data, error }) => {
  if (!active) return;
  if (error) {
    console.error("Failed to load role:", error);
    // Do not treat a fetch failure as "not admin".
    setRole(null);            // or keep prior role / set an `roleError` flag
    setRoleResolved(true);    // still resolve so UI is not stuck loading
    return;
  }
  setRole((data?.role as Role) ?? null);
  setRoleResolved(true);
});
```
Consider an explicit `roleError` state the guard can render as a retry instead of a silent home redirect.

## Warnings

### WR-01: PASSWORD_RECOVERY event can fire before the subscription is attached

**File:** `client/src/pages/ResetPassword.tsx:81-90`
**Issue:** `recoveryMode` is only set when the `onAuthStateChange` callback receives `PASSWORD_RECOVERY`. But supabase-js parses the `#access_token...&type=recovery` hash during client initialization (`detectSessionInUrl`, at module load in `lib/supabase.ts`), which can occur **before** this component mounts and subscribes. `onAuthStateChange` replays the current session to a new subscriber but does not necessarily re-emit the one-shot `PASSWORD_RECOVERY` event. On a cold load straight from the email link, the user can land on the request form instead of the set-new-password form.
**Fix:** On mount, also check for an existing recovery session as a fallback, e.g. inspect `supabase.auth.getSession()` and enter recovery mode if a session is present on the `/reset-password` route, or check `window.location.hash` for `type=recovery` before the subscription races. Verify against a real emailed link, not just an in-app navigation.

### WR-02: Register flow leaks account existence (enumeration), contradicting the stated anti-enumeration posture

**File:** `client/src/pages/Register.tsx:54-64`; `client/src/lib/authErrors.ts:45-53`
**Issue:** With email confirmation OFF (per the D-01 comment), `supabase.auth.signUp` for an existing email returns a "user already registered" error, which `mapAuthError` faithfully renders as "An account with this email already exists." This is a textbook account-enumeration oracle on the registration endpoint — directly at odds with the careful anti-enumeration work on login (`authErrors.ts:33-42`) and reset (`ResetPassword.tsx:105-109`). The login/reset hardening is largely undermined if register confirms which emails exist.
**Fix:** This may be an accepted product trade-off, but it is currently undocumented and inconsistent. Either (a) document the decision explicitly and accept the risk, or (b) enable "Confirm email" so signUp returns a non-committal response for existing emails, and show a generic "Check your email to finish signing up" message regardless of whether the email already existed.

### WR-03: `handle_new_user` INSERT has no conflict handling

**File:** `supabase/migrations/0004_auth_profiles.sql:48-54`
**Issue:** The trigger does a bare `insert into public.profiles (...)`. If a profile row for `new.id` already exists (e.g., a manual backfill, a replayed migration, or an admin who re-creates the auth user), the INSERT raises a primary-key violation inside the GoTrue signup transaction, which fails the signup with an opaque 500. The provisioning path has no idempotency guard.
**Fix:** Add `on conflict (id) do nothing` (or `do update set email = excluded.email, name = excluded.name`) so re-provisioning is safe and never aborts signup:
```sql
insert into public.profiles (id, email, name, role)
values (new.id, new.email, new.raw_user_meta_data ->> 'name', 'customer')
on conflict (id) do nothing;
```

### WR-04: Reset request "rate limit" copy and success copy can disagree, weakening anti-enumeration

**File:** `client/src/pages/ResetPassword.tsx:92-111`
**Issue:** On `resetPasswordForEmail` error the user sees a mapped error (e.g., the rate-limit message), but on success they see "If an account exists, a reset link has been sent." A returned error vs. the non-committal success message is itself a weak signal. More concretely, supabase-js `resetPasswordForEmail` generally does NOT error for unknown emails, so this is low-risk, but any error branch that renders a distinct message for some inputs and not others is an enumeration seam to watch.
**Fix:** For the request form, prefer rendering the same non-committal "If an account exists…" outcome on both success and benign errors, reserving visible error copy for genuinely actionable conditions (network, rate-limit) only. Confirm no per-email-existence error reaches the UI.

### WR-05: `signOut` ignores its result and cannot fail visibly

**File:** `client/src/auth/AuthProvider.tsx:100-102`; `client/src/components/Navbar.tsx:36-40`
**Issue:** `signOut` calls `supabase.auth.signOut()` and discards the returned `{ error }`. `handleSignOut` then unconditionally toasts "Signed out" and navigates home even if the sign-out call failed (e.g., network error revoking the session server-side). The user is told they are signed out while a session may still be active. The local session is cleared by supabase-js regardless, but the UX asserts success it did not verify.
**Fix:** Return/propagate the error and only toast success when it is absent:
```ts
const signOut = React.useCallback(async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}, []);
```
Then `handleSignOut` can catch and show a failure toast.

### WR-06: Role-lock carve-out hard-depends on `auth.uid()` being null for the service role — no defense if a future trigger runs under a JWT

**File:** `supabase/migrations/0004_auth_profiles.sql:78-84`
**Issue:** `enforce_profile_role_lock` permits a `role` change whenever `(select auth.uid()) is null OR private.is_admin()`. The security of this rests entirely on the assumption that the only null-uid caller able to UPDATE profiles is the trusted service-role bootstrap. That holds today (RLS confines authenticated/anon UPDATE to own-row, and anon cannot reach profiles UPDATE at all). But the carve-out is implicit: any future code path that performs a profiles UPDATE with a null `auth.uid()` (a SECURITY DEFINER function owned by a superuser, a scheduled job, a webhook) would silently inherit the ability to escalate roles. The structural test (`auth_rls_assertions.sql`) only checks the trigger exists, not its behavior, and the functional rejection is documented as MANUAL-only.
**Fix:** Tighten the intent: the carve-out should express "the service role" rather than "no JWT." Consider gating on `current_setting('request.jwt.role', true)` / role membership, or document this invariant prominently and add a regression test that asserts a JWT-bearing non-admin role change is rejected (the manual check should be automated before more code touches profiles).

## Info

### IN-01: `data` from `signUp` is fetched then explicitly discarded

**File:** `client/src/pages/Register.tsx:54, 74`
**Issue:** `const { data, error } = await supabase.auth.signUp(...)` then `void data;`. The destructure-then-void is dead weight; the comment about `data.session` being non-null is never acted on.
**Fix:** Destructure only `{ error }` and drop the `void data;` line, or actually assert `data.session` if you want a guard against an unexpected confirm-email-on state.

### IN-02: `buildResetRedirect` trusts `BASE_URL` shape without normalization edge handling

**File:** `client/src/pages/ResetPassword.tsx:55-58`
**Issue:** `import.meta.env.BASE_URL.replace(/\/$/, "")` strips one trailing slash, then `new URL(\`${base}/reset-password\`, origin)`. If `BASE_URL` is exactly `/` it becomes `""` and yields `${origin}/reset-password` (correct), but the assumption that BASE_URL always begins with `/` is implicit. Low risk given Vite's contract, but the value must exactly match the Supabase Redirect allowlist or the reset link silently fails.
**Fix:** No code change required; add a brief note/test asserting the produced URL equals the allowlisted `https://sutravan.in/reset-password` in production builds.

### IN-03: AdminGuard `next` fallback can desync from actual location

**File:** `client/src/auth/AdminGuard.tsx:47`
**Issue:** `const next = location.startsWith("/") ? location : "/admin";` — Wouter's `useLocation` returns a base-stripped leading-slash path, so the `else` branch is effectively unreachable. Harmless dead-ish branch; the real sanitization correctly lives in `safeReturnTo`.
**Fix:** Optional: drop the ternary or add a comment that the fallback is defensive-only.

### IN-04: `mapAuthError` substring matching is brittle to upstream copy changes

**File:** `client/src/lib/authErrors.ts:33-83`
**Issue:** The mapper relies on lowercase substring matches of Supabase/GoTrue error strings. If GoTrue changes wording (it has historically), invalid-credentials could fall through to `GENERIC_FALLBACK` ("Something went wrong") rather than the intended generic-credentials copy. This degrades UX but, notably, does NOT re-open enumeration (the fallback is still non-committal), so severity is low.
**Fix:** Where available, branch on stable error codes (`error.code` / `error.status`) instead of message text; keep the substring matching as a fallback only.

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
