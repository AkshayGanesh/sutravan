---
status: complete
phase: 03-authentication-roles
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md]
started: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Start the app fresh (kill any running dev server, then `npm run dev:client` or open https://sutravan.in). App boots without errors, homepage renders with live products, and the auth layer loads silently (no spinner stuck, no console auth errors).
result: pass

### 2. Register a New Account (AUTH-01)
expected: Go to /register. Enter a name, a fresh email, and a password (6+ chars). Submit → you are immediately signed in (no email-confirmation step), a "success" toast shows, and you land on the home page. Behind the scenes a profile row is auto-created with role='customer' and your name.
result: pass

### 3. Session Persistence (AUTH-02)
expected: While logged in, hard-refresh the page and close/reopen the tab. You stay logged in — the account menu still shows the logged-in state; you are not bounced back to /login.
result: pass

### 4. Logout From Any Page (AUTH-03)
expected: Navigate to any page (e.g. /shop). Open the account menu (User icon in navbar, desktop dropdown or mobile sheet). Click "Log out" → a "Signed out" toast shows, the navbar reverts to the logged-out state, and you land on home.
result: pass

### 5. Password Reset Round-Trip (AUTH-02 / D-02)
expected: From /login click "Forgot password?" → enter the owner email → see a non-committal "if an account exists…" confirmation. Receive the reset email, click the link → lands on /reset-password and switches to a set-new-password form. Set a new password → the recovery token disappears from the URL, and you can log in with the new password. (Built-in limit: 2 reset emails/hour — space out attempts.)
result: pass

### 6. Admin Guard — Logged-Out Redirect & Return-To (AUTH-05 / D-10)
expected: While logged OUT, visit /admin directly → you are redirected to /login (the intended /admin path is remembered in the ?next= param). After logging in as an admin, you land back on /admin — not on the home page.
result: pass

### 7. Admin Guard — Customer Silently Blocked (D-11)
expected: While logged in as a normal customer (non-admin), visit /admin → you are silently redirected to the home page. No admin shell, no 403 error page — the admin area is never advertised.
result: pass

### 8. Admin Promotion + Admin Reaches /admin (AUTH-05 / D-03)
expected: Run `node --env-file=.env.promote.local scripts/promote-admin.ts <registered-email>` → prints "OK: <email> is now admin (idempotent)." and exits 0. Running it a second time still succeeds (no-op). That user, after re-login, can reach /admin and see the protected admin shell. There is NO UI/self-serve path that grants admin.
result: pass

### 9. Role Self-Escalation Blocked (AUTH-04 security gate) [technical]
expected: As a logged-in customer (anon key + your JWT), attempt `update public.profiles set role='admin' where id=auth.uid()` → REJECTED with "role change not permitted". A benign self-update like `update public.profiles set name='X' where id=auth.uid()` SUCCEEDS. A catalog write (insert/update products) is REJECTED by RLS.
result: pass

### 10. Anti-Enumeration Login Errors (D-14) [technical]
expected: On /login, a wrong password for a real email and a login attempt for a non-existent email both return the SAME generic credentials message — the UI never reveals whether an email is registered.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
