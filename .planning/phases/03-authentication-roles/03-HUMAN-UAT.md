---
status: partial
phase: 03-authentication-roles
source: [03-VERIFICATION.md]
started: 2026-06-01T00:00:00Z
updated: 2026-06-01T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Register a new email at /register and confirm the profiles row
expected: After successful registration, `select id,email,role,name from public.profiles where email='<test>'` returns exactly one row with role='customer' and the name supplied in the form (AUTH-01).
result: [pending]

### 2. Log in, then verify session persists across hard refresh and browser restart
expected: After login, hard-refreshing and reopening the browser tab both leave the user logged in; AuthProvider's loading gate shows the Spinner briefly and the user is NOT bounced to /login during the role-resolve window (AUTH-02).
result: [pending]

### 3. Log out from any page via the Navbar account menu (desktop and mobile)
expected: Clicking 'Log out' (desktop DropdownMenu or mobile Sheet) fires useAuth().signOut(), toasts 'Signed out', navigates to /, and the Navbar reverts to the logged-out state — from every route (AUTH-03).
result: [pending]

### 4. Customer JWT role self-escalation is REJECTED (AUTH-04 primary gate)
expected: As a logged-in customer, `update public.profiles set role='admin' where id=auth.uid()` is REJECTED by enforce_profile_role_lock ('role change not permitted'); `update ... set name='X' where id=auth.uid()` SUCCEEDS (column-scoped); a catalog write (products insert/update) is REJECTED by RLS (AUTH-04).
result: [pending]

### 5. Admin portal route guard — logged-out, customer, admin
expected: (a) Logged-out → /admin redirects to /login?next=%2Fadmin, then back to /admin after admin login (D-10). (b) Customer → /admin silently redirects to / with no 403 page (D-11). (c) Admin → sees the protected shell; hard refresh shows Spinner briefly and does NOT bounce to /login (D-12) (AUTH-05).
result: [pending]

### 6. First admin bootstrapped via promote-admin.ts out-of-band only
expected: `node --env-file=.env.promote.local scripts/promote-admin.ts <email>` → OK + exit 0; `select role from public.profiles where email='<email>'` returns 'admin'; second run is idempotent (role unchanged); promoted user reaches /admin and can write catalog; NO UI/code path grants admin (AUTH-04/AUTH-05). NOTE: review finding CR-01 — confirm the script reports failure (not false "OK") for an unregistered/typo'd email.
result: [pending]

### 7. Password reset round-trip on the production sub-path (D-02)
expected: /login → 'Forgot password?' → request reset → receive email → click link → lands on /reset-password → page switches to 'Set new password' (PASSWORD_RECOVERY) → set password → token stripped from URL → log in with new password succeeds (AUTH-02). NOTE: review finding WR-01 — verify the cold-load (email-link) path actually shows the set-password form, not the request form.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
