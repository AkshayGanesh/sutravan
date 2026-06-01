---
status: partial
phase: 05-customer-experience-wishlist-profile-native-questionnaire
source: [05-VERIFICATION.md]
started: 2026-06-01T00:00:00Z
updated: 2026-06-01T00:00:00Z
---

## Current Test

[awaiting human testing of remaining wishlist-surface items]

## Tests

### 1. Wishlist save/remove stays in sync across card, modal, /wishlist page, and navbar badge
expected: Navbar badge count updates immediately; heart fills/empties on both card and modal (shared cache); /wishlist page reflects changes without page reload
result: [pending]
note: 05-01 was an autonomous plan (no blocking-human checkpoint) — this cross-surface optimistic-sync walk was not performed live during execution.

### 2. Logged-out heart tap routes to /login?next=<current> with sign-in toast
expected: Toast "Sign in to save your favourites." fires; redirect to /login?next=<encoded-current-path>; after login the user returns to the original page
result: [pending]

### 3. Questionnaire wizard validates per step before advancing
expected: Empty name / invalid email blocks Continue on step 0; unselected skin type blocks Continue on step 1; step 2 optional but validation errors gate advance
result: passed
note: Confirmed during the 05-03 blocking-human browser walk (approved this session) — invalid-email message shown, Continue gated per step.

### 4. Questionnaire submission with Cloudflare Turnstile lands in admin inbox (anon and logged-in)
expected: Anon submission → row with user_id=null + correct payload; logged-in submission → row with caller's user_id; both visible in /admin/submissions with correct skin_type/message/payload
result: passed
note: Approved during 05-03 blocking-human checkpoint (anon + logged-in rows landed with correct user_id + payload). D-01 RLS proofs A/B/C/D and Turnstile-fail (400 captcha_failed, no row) also proven live during 05-02.

### 5. Profile page: name and password changes apply immediately; email change shows pending notice
expected: "Name updated." persists on refresh; "Password updated." works on next login; email change shows "Check your inbox to confirm..." (NOT completion) and current email unchanged until link clicked
result: passed
note: Approved during 05-04 blocking-human checkpoint (name/password immediate; email PENDING confirmed — Secure email change ON).

### 6. Profile submission history is owner-scoped: a different customer sees only their own requests
expected: Customer A sees their submissions; Customer B sees only theirs; neither sees the other's rows
result: passed
note: Approved during 05-04 blocking-human checkpoint (second customer saw only their own rows). Reinforced by the live D-01 RLS proofs in 05-02.

### 7. Logged-out /profile and /wishlist redirect to /login?next=<path>
expected: Unauthenticated /profile → /login?next=%2Fprofile; same for /wishlist; AuthGuard's safeReturnTo returns the user post-login
result: passed
note: Logged-out /profile → /login?next=/profile confirmed during 05-04 checkpoint. /wishlist redirect shares the identical AuthGuard path (code-verified, truth #3).

## Summary

total: 7
passed: 4
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
