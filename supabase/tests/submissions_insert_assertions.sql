-- submissions_insert_assertions.sql
-- Phase 5 / Plan 02 / Task 1 — D-01 / CUST-03 / CUST-04 INSERT-policy structural assertions.
--
-- Extends the existing SQL assertion harness (rls_assertions.sql, auth_rls_assertions.sql).
-- Each invariant raises an exception on violation, so a non-zero psql exit signals a broken
-- posture. Runs GREEN against the live project AFTER `supabase db push` applies 0007. Run with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/submissions_insert_assertions.sql
--
-- These are STRUCTURAL assertions (the policy's shape). The FUNCTIONAL behavior
-- (anon-with-null-uid allowed; anon-with-non-null-uid rejected; forged cross-user uid
-- rejected; own-uid allowed) is verified manual-live in Plan 02 / Task 3 — simulating a
-- customer JWT in psql is impractical (same convention as auth_rls_assertions.sql, which
-- defers the trigger/RLS runtime behavior to the live anon-key proofs).
--
-- Invariants asserted (all against public.customization_submissions):
--   1. An INSERT policy named customization_submissions_anon_or_owner_insert exists.
--   2. That policy is reachable by BOTH anon and authenticated roles.
--   3. The policy has a non-null with_check expression (ownership invariant enforced,
--      not a blanket allow).
--   4. The with_check text is NOT literally `true` (a real predicate, not a blanket allow).

do $$
declare
  v_count       int;
  v_with_check  text;
begin
  -- ── 1. The named INSERT policy exists on public.customization_submissions ──
  select count(*)
    into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'customization_submissions'
     and cmd        = 'INSERT'
     and policyname = 'customization_submissions_anon_or_owner_insert';
  if v_count <> 1 then
    raise exception 'INVARIANT 1 FAILED: INSERT policy customization_submissions_anon_or_owner_insert missing on public.customization_submissions (% found)', v_count;
  end if;

  -- ── 2. Reachable by BOTH anon AND authenticated ─────────────────────────
  select count(*)
    into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'customization_submissions'
     and cmd        = 'INSERT'
     and policyname = 'customization_submissions_anon_or_owner_insert'
     and roles @> array['anon']::name[]
     and roles @> array['authenticated']::name[];
  if v_count <> 1 then
    raise exception 'INVARIANT 2 FAILED: INSERT policy is not reachable by BOTH anon and authenticated';
  end if;

  -- ── 3. with_check is non-null (the ownership invariant is enforced) ──────
  select with_check
    into v_with_check
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'customization_submissions'
     and cmd        = 'INSERT'
     and policyname = 'customization_submissions_anon_or_owner_insert'
   limit 1;
  if v_with_check is null then
    raise exception 'INVARIANT 3 FAILED: INSERT policy has a NULL with_check (no ownership invariant — would allow blanket insert)';
  end if;

  -- ── 4. with_check is NOT literally `true` (a real predicate) ─────────────
  if btrim(lower(v_with_check)) = 'true' then
    raise exception 'INVARIANT 4 FAILED: INSERT policy with_check is literally `true` (blanket allow — ownership invariant absent); got: %', v_with_check;
  end if;

  raise notice 'ALL D-01 SUBMISSIONS-INSERT INVARIANTS PASSED (1: policy exists, 2: anon+authenticated, 3: with_check non-null, 4: with_check is a real predicate not `true`)';
end;
$$;
