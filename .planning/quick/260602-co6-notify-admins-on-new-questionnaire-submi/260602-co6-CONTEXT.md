# Quick Task 260602-co6: Notify admins on new questionnaire submission - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Task Boundary

The owner wants to be notified every time a customer submits the customization
("skin care guide") questionnaire. "Skin care guide submission" maps to a row in
the `customization_submissions` table (Phase 5 native questionnaire). Two notification
surfaces are wanted.
</domain>

<decisions>
## Implementation Decisions

### Notification channel
- BOTH: an in-app unread badge in the admin portal AND an email per submission.

### In-app unread model
- Add a `status` column to `customization_submissions` (`new` → `read`).
- The admin nav / Submissions inbox shows a badge counting `status = 'new'`.
- Opening a submission (or the inbox) marks it `read`.
- Server-shared across all admins/devices (not client-local).

### Email channel
- Send one email to the owner/admin per new submission, from the existing
  `verify-and-submit` Edge Function (the function already runs server-side after a
  successful insert), via an email API (Resend recommended — simple HTTP API).
- Requires an email-provider account + API key held ONLY as a Supabase Edge Function
  secret (never `VITE_`/bundled), plus an admin recipient address. These are
  BLOCKING-HUMAN setup steps (the agent has no provider credentials).

### Claude's Discretion
- Exact `status` column type/constraint (text + check vs enum) — pick the simplest that
  matches existing migration style.
- Email provider choice (Resend vs alternative) and email body/subject copy.
- Whether the email send is best-effort (failure must NOT fail the submission insert —
  the customer's submission must still succeed even if email errors).
- Badge placement/styling — match the existing admin nav + draft/publish badge conventions.
</decisions>

<specifics>
## Specific Ideas

- Mirror existing patterns: the draft/publish + out-of-stock toggles for admin mutations
  (`admin.ts` hooks + TanStack Query invalidation), and the existing admin Submissions
  inbox (`client/src/pages/admin/Submissions.tsx`, `client/src/lib/submissions.ts`).
- RLS: `customization_submissions` currently has only an admin-or-owner SELECT (0002) and
  an anon/owner INSERT (0007) policy — there is NO UPDATE policy, so marking a row `read`
  will be default-denied. The migration MUST add an admin-only UPDATE policy (via
  `private.is_admin()`), scoped so customers cannot change status.
- Email must be sent AFTER the insert succeeds and must be best-effort (try/catch; never
  block or fail the submission on email error).
</specifics>

<canonical_refs>
## Canonical References

- supabase-live-ops memory — live migration push (`supabase db push`) + secrets flow
  (`supabase secrets set`), project ref `wfbnrcnmpcqzeyjlfflv`.
- Phase 5 SECURITY.md (T-05-07/09) — Turnstile secret pattern: provider secrets live only
  in the Edge Function env, never bundled. The email API key follows the same rule.
</canonical_refs>
