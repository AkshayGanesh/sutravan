-- 0004_auth_profiles.sql
-- Phase 3 / Plan 01 / Task 1 — Auth profile wiring: the DB security boundary for the whole phase.
--
-- This migration is the foundational auth slice. Three changes, each closing an AUTH-01/AUTH-04
-- requirement (D-04/D-05/D-06):
--
--   (1) profiles.name (D-06) — a nullable text column so the metadata-supplied display name has a
--       home. Named `name` (NOT `full_name`) to match `customization_submissions.name` (0001).
--
--   (2) handle_new_user + on_auth_user_created (D-05 / AUTH-01) — a SECURITY DEFINER trigger that
--       runs inside the GoTrue signup transaction and inserts the canonical public.profiles row.
--       `role` is HARD-CODED to 'customer'; it is NEVER read from raw_user_meta_data (that would be
--       a privilege-escalation vector — T-3-03). This is also why profiles still has NO public
--       INSERT policy (0002 deliberately omits it): rows are created ONLY by this trusted trigger,
--       so a client cannot forge a row with someone else's id or role=admin (T-3-02 / D-05).
--
--   (3) enforce_profile_role_lock + profiles_role_lock (D-04 / AUTH-04) — a BEFORE UPDATE trigger
--       that raises when a non-admin client tries to change its own `role`. PRIMARY THREAT of this
--       phase (T-3-01): a customer running `update public.profiles set role='admin'` under their
--       own JWT. The `(select auth.uid()) is not null` carve-out lets the service-role bootstrap
--       script (no JWT) still promote an admin (Pitfall 4); a customer self-update of name/email
--       remains allowed because the lock is column-scoped to `role` only.
--
-- Conventions are lifted verbatim from 0001 (private.is_admin: SECURITY DEFINER, set search_path='',
-- (select auth.uid()) initPlan form, fully-qualified object references) and 0002 (no profiles INSERT
-- policy; profiles_self_update untouched). Sorts after 0001/0002/0003 so profiles and
-- private.is_admin() already exist.

-- ──────────────────────────────────────────────────────────────────────────
-- (1) profiles.name (D-06) — nullable display name from signup metadata
-- ──────────────────────────────────────────────────────────────────────────
alter table public.profiles add column name text;

-- ──────────────────────────────────────────────────────────────────────────
-- (2) handle_new_user (D-05 / AUTH-01) — trusted server-side profile-row creation
-- ──────────────────────────────────────────────────────────────────────────
-- Runs inside the auth.users INSERT (signup) transaction. SECURITY DEFINER so it can write
-- public.profiles despite RLS; the locked empty search_path forces every reference to be
-- fully-qualified (search_path-hijack safe, matches is_admin). role is the literal 'customer' —
-- never sourced from metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql            -- triggers need plpgsql (is_admin uses sql)
security definer            -- runs as creator → may write public.profiles under RLS
set search_path = ''        -- locked: fully-qualify every object, prevents search_path hijack
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',   -- display name only; NOT role (T-3-03)
    'customer'                           -- hard-coded; never read role from metadata
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────────
-- (3) enforce_profile_role_lock (D-04 / AUTH-04) — block role self-escalation
-- ──────────────────────────────────────────────────────────────────────────
-- BEFORE UPDATE on profiles. Raises only when the `role` column actually changes AND the caller
-- is an authenticated (JWT-bearing) non-admin. The `(select auth.uid()) is not null` carve-out
-- means the service-role bootstrap (no JWT) is NOT blocked when promoting the first admin
-- (Pitfall 4). Reuses private.is_admin() — does not reimplement the role lookup.
create or replace function public.enforce_profile_role_lock()
returns trigger
language plpgsql
security definer            -- runs as creator → may call private.is_admin() under RLS
set search_path = ''        -- locked: fully-qualify every object
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null   -- null uid = service-role bootstrap → allowed
     and not private.is_admin() then
    raise exception 'role change not permitted';
  end if;
  return new;
end;
$$;

create trigger profiles_role_lock
  before update on public.profiles
  for each row
  execute procedure public.enforce_profile_role_lock();
