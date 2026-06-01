---
phase: 05-customer-experience-wishlist-profile-native-questionnaire
plan: 04
subsystem: ui
tags: [react, react-hook-form, zod, supabase-auth, rls, profile, account-management]

# Dependency graph
requires:
  - phase: 05-customer-experience-wishlist-profile-native-questionnaire
    provides: "Plan 01 — AuthGuard (safeReturnTo ?next=) + Navbar account dropdown (already carrying the Wishlist entry)"
  - phase: 05-customer-experience-wishlist-profile-native-questionnaire
    provides: "Plan 02/03 — customization_submissions rows written under the caller's JWT (the history this page reads back); admin Submissions.tsx list+detail shape reused"
  - phase: 03-authentication-roles
    provides: "useAuth() ({ session, user, role }) for the current email/user id; migration 0004 enforce_profile_role_lock trigger that gates profiles self-update; hosted Auth 'Secure email change' for the pending email flow"
  - phase: 04-admin-portal-catalog-content-management
    provides: "Submissions.tsx list + read-only detail Dialog (displayName/formatDate/Field helpers + payload pre + skin-type Badge) reused verbatim minus admin chrome"
provides:
  - "Auth-gated /profile page: self-service account management (display name -> profiles.name, email pending-confirmation, password immediate) + the customer's OWN submission history inline (list -> read-only detail dialog)"
  - "lib/profile.ts — useUpdateName / useUpdateEmail (pending) / useUpdatePassword (immediate) mutation hooks with the D-14 copy"
  - "lib/submissions.ts EXTENDED — useMySubmissions() owner-scoped read on the existing admin-or-owner SELECT RLS + a lifted, exported, unit-tested submissionSnippet() helper"
  - "submissions.test.ts — 8 passing Vitest cases pinning submissionSnippet (null/empty -> em-dash, whitespace collapse, ~80-char truncation + ellipsis)"
affects: [customer-account, phase-05-close, milestone-v1.0]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-scoped read by RLS, not by client filter: useMySubmissions() reuses the SAME select as the admin useSubmissions() and relies on customization_submissions_admin_or_owner_read to return only the caller's rows (no .eq('user_id', ...) client filter) — distinct ['my-submissions'] cache key keeps it separate from the admin ['submissions'] cache"
    - "Account mutations mirror admin.ts (mutationFn + onSuccess toast / onError mapped toast), but the email path deliberately surfaces a PENDING toast ('Check your inbox to confirm your new email.') rather than a completion claim (D-14 / Secure email change)"
    - "Pure presentational helper (submissionSnippet) lifted from a page into lib so both the admin page and the customer page share one tested implementation"

key-files:
  created:
    - client/src/lib/profile.ts
    - client/src/lib/submissions.test.ts
    - client/src/pages/Profile.tsx
  modified:
    - client/src/lib/submissions.ts
    - client/src/pages/admin/Submissions.tsx
    - client/src/components/Navbar.tsx
    - client/src/App.tsx

key-decisions:
  - "D-14 email change is pending-confirmation: useUpdateEmail() shows 'Check your inbox to confirm your new email.' (NOT 'email changed'); the login email does not change until the emailed link is clicked (Secure email change ON). Password and name apply immediately."
  - "T-05-15 owner-scoping by RLS: useMySubmissions() carries no client-side user filter — the existing customization_submissions_admin_or_owner_read SELECT policy scopes rows to the caller. Proven live: a different customer sees only their own rows."
  - "T-05-16 name self-update only sends { name }; the Phase-3 enforce_profile_role_lock BEFORE UPDATE trigger blocks any role change regardless of payload, and the form has no role field."
  - "D-15 admin chrome stripped: the Submissions list + read-only detail Dialog (and its displayName/formatDate/Field helpers + the lifted submissionSnippet) are reused on /profile minus all admin-only controls; the dialog is strictly read-only."
  - "D-16 route shape: /profile holds account info + inline submission history while /wishlist stays a separate page; both are linked from the Navbar account dropdown (desktop + mobile sheet) and /profile is wrapped in AuthGuard so logged-out -> /login?next=/profile."

patterns-established:
  - "RLS-scoped customer read: reuse the admin query verbatim under a distinct cache key and let the admin-or-owner SELECT policy do the per-caller scoping — no parallel client filter to drift out of sync with the policy"
  - "Pending-vs-immediate account mutations: GoTrue updateUser email = pending (inbox-confirm toast), password = immediate; profiles.name = immediate self-update behind the role-lock trigger"

requirements-completed: [CUST-04]

# Metrics
duration: ~15min
completed: 2026-06-01
---

# Phase 05 Plan 04: Customer Profile Slice Summary

**`/profile` is now a live, auth-gated customer account page: self-service display-name (writes `profiles.name`), email change (pending-confirmation UX — "check your inbox", login email unchanged until the emailed link is clicked), and immediate password change via `supabase.auth.updateUser`, plus the customer's OWN customization-submission history inline (list → read-only detail dialog, reusing the admin Submissions shape minus admin chrome). The history is owner-scoped purely by the existing admin-or-owner SELECT RLS — proven live that a different customer sees only their own rows and that logged-out `/profile` redirects to `/login?next=/profile`. This delivers CUST-04; with 05-01 (CUST-01/02), 05-02+05-03 (CUST-03), and this plan, every Phase-5 requirement (CUST-01..CUST-04) is now shipped.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3 (2 auto + 1 blocking-human checkpoint, all complete & approved)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- **lib/submissions.ts extended** — `useMySubmissions()` (owner-scoped read using the SAME select as the admin `useSubmissions()`, distinct `['my-submissions']` cache key) riding the existing `customization_submissions_admin_or_owner_read` RLS so no client filter is needed; the pure `submissionSnippet(message)` helper lifted out of `Submissions.tsx` and exported so both the admin page and the customer page share one tested implementation. Existing `useSubmissions`/`SubmissionRow` exports retained.
- **lib/submissions.test.ts** — 8 Vitest cases passing (8/8): `submissionSnippet` returns an em-dash for null/empty, collapses internal whitespace, and truncates long messages to ~80 chars with an ellipsis.
- **lib/profile.ts** — `useUpdateName` (`profiles.update({ name }).eq('id', userId)` → "Name updated."), `useUpdateEmail` (`auth.updateUser({ email })` → PENDING toast "Check your inbox to confirm your new email." — never "changed", D-14), `useUpdatePassword` (`auth.updateUser({ password })` → immediate "Password updated."); all errors collapse to the generic "Couldn't save that change. Please try again." toast.
- **pages/Profile.tsx** — auth-gated account page inside `Layout`: serif "Your account" header; name / email / password RHF+Zod forms (email renders the pending helper line, not a completion claim); "Your requests" history section reusing the admin loading-skeleton / error+Retry / empty-state trio + the table-on-md / stacked-cards list + a read-only detail Dialog (Email, Skin type Badge, Message, payload `pre`), all admin chrome stripped (D-15); empty state "No requests yet" + "Start a request" → /questionnaire.
- **Navbar + App wiring** — "Your account" entry (lucide `User`) added to the desktop account dropdown and the mobile Sheet nav above "Log out" (alongside the Plan-01 Wishlist entry — both coexist); `/profile` route wrapped in `AuthGuard` in App.tsx, before the catch-all NotFound, using its own `Layout` (not AdminLayout).
- **Live verification (Task 3, blocking-human, APPROVED):** name immediate + persists; password immediate + re-login works; email PENDING (login email unchanged until link clicked); own submission appears with correct date/snippet + read-only detail; a different customer sees only their own rows; logged-out /profile → /login?next=/profile.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend submissions.ts with useMySubmissions + profile.ts account mutations (+ unit test)** - `7883608` (feat)
2. **Task 2: Profile.tsx page (account management + inline submission history) + Navbar/App wiring** - `d8a6dcc` (feat)
3. **Task 3: [BLOCKING-HUMAN] Verify account management + owner-scoped history live** - no code commit (live browser walk; outcomes recorded below).

**Plan metadata:** see the `docs(05-04)` commit carrying this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified
- `client/src/lib/profile.ts` - `useUpdateName` / `useUpdateEmail` (pending) / `useUpdatePassword` (immediate) mutation hooks with the D-14 toasts (created).
- `client/src/lib/submissions.test.ts` - 8 Vitest cases pinning the pure `submissionSnippet` helper (created, 8/8 passing).
- `client/src/pages/Profile.tsx` - auth-gated account management + inline owner-scoped submission history with a read-only detail dialog (created).
- `client/src/lib/submissions.ts` - added `useMySubmissions()` (owner-scoped, `['my-submissions']` key) + lifted/exported the pure `submissionSnippet` helper; existing `useSubmissions`/`SubmissionRow` unchanged (modified).
- `client/src/pages/admin/Submissions.tsx` - now imports the lifted `submissionSnippet` from lib instead of a local copy (modified).
- `client/src/components/Navbar.tsx` - "Your account" → /profile entry in the desktop dropdown + mobile sheet, above "Log out" (modified).
- `client/src/App.tsx` - `import Profile` + a guarded `/profile` route (`AuthGuard`) before the catch-all NotFound (modified).

## Decisions Made
- **D-14 email pending vs name/password immediate:** the email change deliberately surfaces "Check your inbox to confirm your new email." and the login email stays unchanged until the emailed link is clicked (Secure email change ON); password and display name apply immediately. The UI never claims the email "changed".
- **T-05-15 owner-scoping by RLS, not client filter:** `useMySubmissions()` reuses the admin select verbatim under the distinct `['my-submissions']` cache key and relies on `customization_submissions_admin_or_owner_read` to return only the caller's rows — no `.eq('user_id', ...)` that could drift from the policy.
- **T-05-16 role-lock holds:** the name form sends only `{ name }`; the Phase-3 `enforce_profile_role_lock` BEFORE UPDATE trigger blocks any role change regardless of payload, and there is no role field on the form.
- **D-15 reuse minus chrome / D-16 route shape:** the admin Submissions list + read-only detail are reused on /profile with all admin controls stripped (read-only dialog); /profile (account + history) and /wishlist stay distinct pages, both linked from the account dropdown, both behind AuthGuard.

## Deviations from Plan

None — plan executed exactly as written. (Tasks 1 & 2 met every acceptance-criteria grep and the `npm test` / `npm run check` / `npm run build` gates on the first pass; Task 3 was a human verification gate, not implementation.)

## Issues Encountered

None. The owner-scoped read rode the existing Phase-1/Phase-2 admin-or-owner SELECT RLS with no migration change, and the account mutations reused the established admin.ts mutation+toast pattern.

## Live Verification Results (Task 3, blocking-human — APPROVED)

- **Display name self-update:** "Save name" → "Name updated." toast; the name persists on refresh. ✓
- **Password change (immediate):** "Update password" → "Password updated."; log out and back in with the new password works. ✓
- **Email change (pending):** "Update email" → the PENDING notice "Check your inbox to confirm your new email." (NOT a completed-change message); the login email is unchanged until the emailed link is clicked (Secure email change confirmed ON). ✓
- **Own submission history:** a questionnaire submission appears under "Your requests" with the correct date/snippet, and the read-only detail dialog shows email / skin type / message / payload. ✓
- **Owner-scoping (T-05-15):** a DIFFERENT customer's /profile shows only THEIR rows (none of the first customer's); logged-out /profile redirects to /login?next=/profile. ✓

## Known Stubs
None. The page is fully wired end-to-end: GoTrue `updateUser` (email/password) + `profiles.update` (name) for account management, and `useMySubmissions()` reading the live `customization_submissions` rows the Plan-02/03 wizard writes, scoped to the caller by RLS.

## Threat Flags
None — no security surface beyond the plan's `<threat_model>` was introduced. The name update sends only `{ name }` (role-lock trigger gates role, T-05-16); the email change is GoTrue's double-confirmation pending flow (T-05-17); the submission history is scoped server-side by the existing admin-or-owner SELECT RLS (T-05-15, no service-role path); the logged-out redirect reuses AuthGuard's `safeReturnTo` (`?next=/profile` is an internal leading-slash path, T-05-18); the password is sent directly to GoTrue over TLS, never stored/logged client-side (T-05-19).

## User Setup Required
None new for this plan. The pending email-change flow relies on the hosted "Secure email change" setting (already ON) and the existing Site URL / redirect allowlist configured in Phase 3 — no additional environment variables or dashboard changes.

## Next Phase Readiness
- **CUST-04 is delivered**, and with it ALL Phase-5 requirements (CUST-01..CUST-04) are now shipped: wishlist (05-01), native questionnaire backend+wizard (05-02/05-03), and profile + owner-scoped history (this plan).
- **Phase 5 is functionally complete (4/4 plans).** Phase verification/close remains the orchestrator's responsibility — this plan only advances plan-level tracking and does NOT mark the phase verified.

## Self-Check: PASSED

- Created files exist on disk: `client/src/lib/profile.ts`, `client/src/lib/submissions.test.ts`, `client/src/pages/Profile.tsx` — all FOUND. Modified files (`client/src/lib/submissions.ts`, `client/src/pages/admin/Submissions.tsx`, `client/src/components/Navbar.tsx`, `client/src/App.tsx`) — all FOUND.
- Commits exist in git log: `7883608` (Task 1, feat — submissions/profile + test, 4 files), `d8a6dcc` (Task 2, feat — Profile.tsx + navbar/route, 3 files) — both FOUND.
- Gates green: `npm run check` + `npm run build` pass; `npm test` submissions suite 8/8.
- Live verification (Task 3, blocking-human): name/password immediate, email pending (login email unchanged until link clicked), own-history correct, cross-user history owner-scoped, logged-out → /login?next=/profile — APPROVED by the human.

---
*Phase: 05-customer-experience-wishlist-profile-native-questionnaire*
*Completed: 2026-06-01*
