---
phase: quick-260602-co6
plan: 01
subsystem: admin-notifications
tags: [supabase, rls, edge-function, email, tanstack-query, admin-portal]
requires:
  - customization_submissions table (0001)
  - customization_submissions_admin_or_owner_read SELECT (0002)
  - customization_submissions_anon_or_owner_insert INSERT (0007)
  - verify-and-submit Edge Function (Phase 5 P02)
provides:
  - customization_submissions.status column (new|read)
  - customization_submissions_admin_update RLS policy (admin-only)
  - useUnreadSubmissionsCount + useMarkSubmissionRead hooks
  - isUnread predicate
  - admin unread badge + mark-on-open
  - best-effort admin notification email
affects:
  - client/src/lib/submissions.ts
  - client/src/pages/admin/Submissions.tsx
  - client/src/pages/admin/AdminLayout.tsx
  - supabase/functions/verify-and-submit/index.ts
tech-stack:
  added: []
  patterns:
    - text+check column (mirrors profiles.role idiom; no Postgres enum)
    - admin-only UPDATE RLS gated on private.is_admin() (using + with check)
    - best-effort try/catch email send that never regresses { ok: true }
    - secrets in Deno.env only, never VITE_/bundled (T-05-09 pattern)
key-files:
  created:
    - supabase/migrations/0009_submissions_status.sql
  modified:
    - client/src/lib/submissions.ts
    - client/src/lib/submissions.test.ts
    - client/src/pages/admin/Submissions.tsx
    - client/src/pages/admin/AdminLayout.tsx
    - supabase/functions/verify-and-submit/index.ts
decisions:
  - "status column is text+check (new|read), default 'new' — every pre-existing and future row starts unread, no backfill"
  - "admin-only UPDATE RLS (using + with check on private.is_admin()) is the ONLY new write path; SELECT/INSERT untouched, no exposure widened"
  - "isUnread is the single shared new-row predicate (highlight + mark-on-open + count test)"
  - "useMarkSubmissionRead invalidates both ['submissions'] and ['submissions','unread-count'] (staleTime:Infinity invariant)"
  - "email send is best-effort try/catch in the Edge Function — any failure logs server-side and the { ok: true } contract is preserved"
  - "RESEND_API_KEY + ADMIN_NOTIFY_EMAIL live only in Deno.env; no secret name appears under client/"
metrics:
  duration: ~10min
  completed: 2026-06-02
requirements: [QUICK-CO6-01]
---

# Quick Task 260602-co6: Notify admins on new questionnaire submission Summary

Notify admins on every new customization ("skin care guide") submission across two surfaces — an in-app unread badge driven by a new `status` column on `customization_submissions`, and one best-effort admin email per submission sent server-side from the existing `verify-and-submit` Edge Function — with the live `db push` and Resend secrets/deploy deferred to explicit human steps.

## What Was Built

**Task 1 — Migration 0009 (`feat 1b4c3d1`):**
- `status text not null default 'new' check (status in ('new','read'))` added to `public.customization_submissions`. Default `'new'` means all 28+ existing rows AND every future insert start unread — no backfill.
- New `customization_submissions_admin_update` policy: `for update to authenticated using (private.is_admin()) with check (private.is_admin())`. This is the ONLY new write path. The existing SELECT (0002) and INSERT (0007) policies are untouched — no read/insert widening. No DELETE policy.

**Task 2 — Frontend badge + mark-read (TDD: `test e42ef2d` -> `feat aecbdcf`):**
- `submissions.ts`: `status` added to `SUBMISSION_SELECT` + `SubmissionRow` (literal union, not nullable); exported pure `isUnread(row)` predicate; `useUnreadSubmissionsCount()` (count of `status='new'` via head:true/count:exact); `useMarkSubmissionRead()` mutation writing `status='read'` by id, invalidating both `['submissions']` and `['submissions','unread-count']` on success.
- `AdminLayout.tsx`: `SidebarMenuBadge` showing the unread count on the Submissions nav link only (`count > 0`).
- `Submissions.tsx`: `openSubmission` marks an unread row read on open (guarded by `isUnread`), plus a `font-semibold` name + "New" badge highlight on unread rows (desktop table and mobile cards).
- Tests: 8 existing `submissionSnippet` cases kept; added `isUnread` describe block (new->true, read->false). 50/50 tests pass; `npm run check` (TS strict) passes.

**Task 3 — Best-effort admin email (`feat b8cd5b0`):**
- In `verify-and-submit/index.ts`, after the insert success (before the `{ ok: true }` return), a step-3 block sends one Resend email (`POST https://api.resend.com/emails`) to `ADMIN_NOTIFY_EMAIL`.
- Both secrets read only from `Deno.env` (same pattern as `TURNSTILE_SECRET_KEY`); never `VITE_`/bundled. The no-secret-bundled grep gate (scoped to `client/`) passes.
- Entire send wrapped in its own try/catch: missing secret -> graceful `console.warn` + skip; non-2xx from Resend -> `console.error` + continue; network error -> `console.error` + continue. The function ALWAYS returns the existing `{ ok: true }` 200 — the submission never fails because email failed (T-CO6-03).
- Header comment flow list updated with step 3.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1–3 (all code) completed and verified; Task 4 is the blocking-human checkpoint, surfaced below per the orchestrator instruction (no mid-run dead-stop).

## ⚠ Outstanding human actions (BLOCKING — live credentials required)

All code is complete and green (`npm run check` + `npm test` pass; all grep gates pass). The agent has no live Supabase/Resend credentials, so the two live-credential steps below remain. See the `supabase-live-ops` memory; live project ref is **`wfbnrcnmpcqzeyjlfflv`**.

**1. Push migrations to the live Supabase project**
```
supabase db push
```
- Applies the pending `0008_products_in_stock.sql` (from prior quick task 260602-c2y) THEN `0009_submissions_status.sql`, in order. That is expected.
- Until 0009 lands, the badge/mark-read errors at runtime (the `status` column does not exist live yet).
- Verify after push: submit the questionnaire once -> the new row appears in `/admin/submissions` with the unread badge counting it; open it -> the badge decrements (status -> 'read').

**2. Create the Resend account, set secrets, deploy the function**
- Create a Resend account (https://resend.com), get an API key, choose a recipient address. (The function currently sends `from: onboarding@resend.dev` — switch to a verified-domain sender once a domain is set up.)
```
supabase secrets set RESEND_API_KEY=<key> ADMIN_NOTIFY_EMAIL=<owner@address>
supabase functions deploy verify-and-submit
```
- Do NOT pass `--linked` — the CLI rejects it and deploys to the linked project by default (Phase 5 P02 deviation note).
- Until secrets+deploy are done, emails do not send; submissions keep working in the meantime (best-effort: the function `console.warn`s and skips when secrets are unset).
- Verify after deploy: submit the questionnaire once -> the owner inbox receives one "New skin care guide submission" email. Sanity: a submission still succeeds even if email fails (insert + `{ok:true}` are independent of email).

## Known Stubs

None. The `from: onboarding@resend.dev` sender is the deliberate Resend onboarding sender for the first email (documented inline), not a stub — it is swappable to a verified-domain sender by the owner.

## Self-Check: PASSED

- Files: all 6 plan files FOUND on disk.
- Commits: 1b4c3d1, e42ef2d, aecbdcf, b8cd5b0 all FOUND.
- `npm run check`: PASS. `npm test`: 50/50 PASS.
- Task 1/2/3 grep gates: all PASS, including `! grep -rqiE "RESEND_API_KEY|ADMIN_NOTIFY_EMAIL|VITE_RESEND|VITE_ADMIN_NOTIFY" client/`.
