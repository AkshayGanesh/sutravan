-- 0009_submissions_status.sql
-- Quick task 260602-co6 / Task 1 — QUICK-CO6-01: unread-status for the admin
-- submissions inbox (notify admins on every new questionnaire submission).
--
-- Sorts after 0001 (which created public.customization_submissions), 0002 (the
-- admin-or-owner SELECT policy) and 0007 (the anon/owner INSERT policy). Adds the
-- in-app unread model the CONTEXT decision asks for: a single `status` column
-- (new -> read) plus the ONE missing write path — an admin-only UPDATE policy so
-- an admin can mark a row read while customers cannot.
--
-- STATUS COLUMN — text + check, mirroring the established idiom:
--   0001 models profiles.role as `text ... check (... in (...))`, so text+check
--   is the project's convention for a small closed value set. We deliberately do
--   NOT introduce a Postgres enum (heavier, migration-unfriendly). `default 'new'`
--   is intentional: every PRE-EXISTING row AND every future insert starts unread,
--   so NO backfill UPDATE is required.
--
-- ADMIN-ONLY UPDATE — the single new write path:
--   There is currently NO UPDATE policy on customization_submissions (0002/0007
--   add only SELECT and INSERT), so the table is default-deny for UPDATE and an
--   admin's mark-as-read would otherwise fail. This policy mirrors the 0002
--   products_admin_write idiom: FOR UPDATE, gated on private.is_admin() in BOTH
--   `using` (which rows may be targeted) AND `with check` (what value may be
--   written), so a non-admin customer can neither select a row for update nor
--   write a new status value — customers MUST NOT be able to change status
--   (T-CO6-01, Elevation of Privilege).
--
-- NO SELECT/INSERT CHANGE — this migration does NOT alter or drop the existing
--   customization_submissions_admin_or_owner_read SELECT (0002) or the
--   customization_submissions_anon_or_owner_insert INSERT (0007). It adds only an
--   UPDATE path; it does NOT widen read or insert exposure. No DELETE policy is
--   added (out of scope).

alter table public.customization_submissions
  add column if not exists status text not null default 'new'
    check (status in ('new', 'read'));

create policy "customization_submissions_admin_update"
  on public.customization_submissions for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
