-- 0007_submissions_insert_policy.sql
-- Phase 5 / Plan 02 / Task 1 — the one schema/RLS gap (D-01 / CUST-03 / CUST-04).
--
-- 0002 deliberately OMITTED an INSERT policy on customization_submissions
-- (see 0002_rls_policies.sql lines 106-114: "No insert policy this phase: Phase 5
-- decides anon-vs-auth submit"), leaving it default-deny. Phase 5 now opts in:
-- BOTH anon and authenticated may submit the questionnaire, but the WITH CHECK is
-- the ownership invariant (D-01 / CUST-04 — "no user can insert rows scoped to
-- another user"):
--   authenticated submitter may ONLY set user_id = their own auth.uid()
--   anon submitter MUST carry user_id = null (they have no auth.uid())
--
-- The (select auth.uid()) wrapped form matches the 0002 idiom (perf:
-- initplan-cached per statement; recursion-safe). No SELECT/UPDATE/DELETE policy is
-- added here — reads ride the existing customization_submissions_admin_or_owner_read
-- (0002); no update/delete path exists this phase.
--
-- The submission insert runs under the CALLER'S JWT (verify-and-submit Edge Function
-- uses the caller's Authorization header, NOT the service-role key — Pitfall 4 / T-05-06),
-- so this WITH CHECK actually fires and is the real ownership boundary.

create policy "customization_submissions_anon_or_owner_insert"
  on public.customization_submissions for insert
  to anon, authenticated
  with check (
    -- anon path: no JWT → auth.uid() is null → row must have null user_id
    ((select auth.uid()) is null and user_id is null)
    -- authenticated path: row's user_id must equal the caller's uid
    or ((select auth.uid()) is not null and user_id = (select auth.uid()))
  );
