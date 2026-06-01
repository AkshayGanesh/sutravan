---
phase: 04-admin-portal-catalog-content-management
plan: 08
subsystem: ui
tags: [react, react-query, supabase, postgrest, rls, admin-portal]

# Dependency graph
requires:
  - phase: 04-admin-portal-catalog-content-management
    provides: "Plan 04-04 admin shell + AdminLayout route mount; Phase 1 admin-read RLS on customization_submissions (D-12)"
provides:
  - "useSubmissions read hook over customization_submissions (newest-first)"
  - "Read-only admin submissions inbox: list (name/date/snippet) + detail Dialog + empty state"
  - "Read surface ready for the Phase 5 native questionnaire writer (CUST-03)"
affects: [phase-05, questionnaire, customer-customization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch-fn split from useQuery hook (mirrors lib/catalog.ts) — errors thrown -> isError -> Retry"
    - "snake_case row shape owned by component (SubmissionRow), no client-side rename"
    - "Empty result treated as the normal path (data ?? []) with explicit empty-state UI"

key-files:
  created:
    - client/src/lib/submissions.ts
    - client/src/pages/admin/Submissions.tsx
  modified: []

key-decisions:
  - "D-17: read-only inbox this phase — no status / mark-handled / edit / delete (status column needs a schema change, deferred to a later phase)"
  - "D-12: submissions read rides the existing Phase-1 admin-read RLS (customization_submissions_admin_or_owner_read, migration 0002) — no new auth code"
  - "Empty state is the production-normal path until Phase 5 ships the questionnaire writer; messaged so it is not mistaken for a bug"

patterns-established:
  - "Read-hook pattern: plain async fetch (throws on error) + thin useQuery wrapper keyed by resource"
  - "Newest-first ordering pushed to PostgREST (.order created_at ascending:false), not client-side sort"

requirements-completed: [ADMIN-07]

# Metrics
duration: ~15min
completed: 2026-06-01
---

# Phase 04 Plan 08: Submissions Inbox Summary

**Read-only admin submissions inbox — useSubmissions hook over customization_submissions (newest-first) feeding a list + detail Dialog + empty state, riding the Phase-1 admin-read RLS.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-01
- **Tasks:** 2 (1 implementation + 1 verification checkpoint)
- **Files modified:** 2 (both created)

## Accomplishments
- `useSubmissions` read hook: fetches `customization_submissions` ordered `created_at` descending (newest-first), errors thrown to surface as React Query `isError` -> Retry, empty result handled as the normal path.
- Real `Submissions.tsx` inbox replacing the Plan-04 stub: newest-first list (name / date / message snippet), detail Dialog showing the full message + fields, and a clear empty state for the pre-Phase-5 no-data condition.
- Read-only by design (D-17): no edit / delete / status / CTA controls — this is purely the read surface for what Phase 5's native questionnaire (CUST-03) will write.

## Task Commits

1. **Task 1: useSubmissions read hook + Submissions inbox (list + detail + empty state)** - `9e11c24` (feat)
2. **Task 2: Verify submissions inbox** - blocking human-verify checkpoint, APPROVED by user (manual browser walk). STATE checkpoint-pause recorded in `8f073cb` during execution.

**Plan metadata:** docs commit (this summary + tracking)

## Files Created/Modified
- `client/src/lib/submissions.ts` - `useSubmissions` read hook + `SubmissionRow` interface; PostgREST select on `customization_submissions` ordered newest-first; mirrors `lib/catalog.ts` fetch/hook split.
- `client/src/pages/admin/Submissions.tsx` - Read-only inbox: list of submissions (name, date, snippet), detail Dialog (full message + fields), empty state, loading/error handling.

## Decisions Made
- **D-17 (read-only inbox):** No status / mark-handled / edit / delete this phase — a status column requires a schema change, deferred. The view is intentionally read-only.
- **D-12 (RLS reuse):** Submissions read goes through the existing Phase-1 admin-read RLS (`customization_submissions_admin_or_owner_read`, migration 0002); a non-admin cannot read submissions server-side, no new auth code added.
- **Empty state as normal path:** The table is empty until Phase 5 ships the questionnaire writer (CUST-03); the inbox ships ready with a messaged empty state so the no-data condition is not mistaken for a bug.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification

**Automated (all PASS):**
- `npm run check` exits 0 (tsc clean).
- `npm run build` succeeds.
- Greps confirm `useSubmissions`, `customization_submissions`, `created_at` ordering, and the `"No submissions yet"` empty-state string are all present.

**Manual browser walk (Task 2 checkpoint — APPROVED by user):**
- The orchestrator seeded two test rows via the service role. The admin `/admin/submissions` view rendered them NEWEST-FIRST (GSD Test Newer above GSD Test Older) with name / date / snippet.
- The detail Dialog showed the full message + fields.
- The view is read-only — no edit / delete / status controls, no CTA (D-17 confirmed).
- The orchestrator then deleted both test rows; the table is empty again and the production `"No submissions yet"` empty state is restored.
- Submissions read confirmed riding the Phase-1 admin-read RLS on `customization_submissions` (D-12).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ADMIN-07 complete: admin submissions inbox is live and read-only.
- Read surface is ready for Phase 5's native questionnaire writer (CUST-03), which will populate `customization_submissions`.
- No blockers.

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*

## Self-Check: PASSED
