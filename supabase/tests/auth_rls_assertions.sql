-- auth_rls_assertions.sql
-- Phase 3 / Plan 01 / Task 2 — Auth (0004) DB-invariant assertions.
--
-- Structural mirror of rls_assertions.sql: a single `do $$ ... end $$;` block where each invariant
-- raises an exception on violation (so a non-zero psql exit signals a broken posture) and a final
-- `raise notice '... PASSED'` confirms green. Runs GREEN against the live project AFTER
-- `supabase db push` of 0004. Run with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/auth_rls_assertions.sql
--
-- Invariants asserted (STRUCTURE only):
--   1. public.profiles has a `name` column (D-06).
--   2. public.handle_new_user exists with prosecdef = true and a locked search_path in proconfig;
--      and trigger on_auth_user_created exists on auth.users (D-05 / AUTH-01).
--   3. public.enforce_profile_role_lock exists with prosecdef = true and a locked search_path;
--      and trigger profiles_role_lock exists on public.profiles (D-04 / AUTH-04).
--   4. profiles has NO anon/public INSERT policy (carried over from rls_assertions.sql INVARIANT 3;
--      the trigger, not a policy, creates rows — D-05 invariant).
--
-- NOTE — the FUNCTIONAL role-escalation rejection (a real customer JWT running
-- `update public.profiles set role='admin'` and being REJECTED, AUTH-04 / T-3-01) is a MANUAL-only
-- check performed in the register slice (Plan 03) per 03-VALIDATION.md. Simulating a customer JWT
-- in psql is impractical, so this harness asserts the STRUCTURE (the triggers/functions/column
-- exist with the right security properties); the manual check asserts the BEHAVIOR.

do $$
declare
  v_count       int;
  v_proconfig   text[];
begin
  -- ── 1. public.profiles has a `name` column (D-06) ───────────────────────
  select count(*)
    into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'profiles'
     and column_name  = 'name';
  if v_count < 1 then
    raise exception 'INVARIANT 1 FAILED: public.profiles has no `name` column (D-06)';
  end if;

  -- ── 2. handle_new_user: SECURITY DEFINER + locked search_path; trigger on auth.users ──
  select count(*)
    into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'handle_new_user'
     and p.prosecdef = true;
  if v_count < 1 then
    raise exception 'INVARIANT 2 FAILED: public.handle_new_user() missing or not SECURITY DEFINER (prosecdef)';
  end if;

  select p.proconfig
    into v_proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'handle_new_user'
   limit 1;
  if v_proconfig is null
     or not exists (select 1 from unnest(v_proconfig) as cfg where cfg like 'search_path=%') then
    raise exception 'INVARIANT 2 FAILED: public.handle_new_user() has no locked search_path in proconfig (got: %)',
      coalesce(array_to_string(v_proconfig, ','), '(null)');
  end if;

  select count(*)
    into v_count
    from pg_trigger tg
    join pg_class c     on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth'
     and c.relname = 'users'
     and tg.tgname = 'on_auth_user_created'
     and not tg.tgisinternal;
  if v_count < 1 then
    raise exception 'INVARIANT 2 FAILED: trigger on_auth_user_created missing on auth.users (signup-row creation)';
  end if;

  -- ── 3. enforce_profile_role_lock: SECURITY DEFINER + locked search_path; BEFORE UPDATE trigger ──
  select count(*)
    into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'enforce_profile_role_lock'
     and p.prosecdef = true;
  if v_count < 1 then
    raise exception 'INVARIANT 3 FAILED: public.enforce_profile_role_lock() missing or not SECURITY DEFINER (prosecdef)';
  end if;

  select p.proconfig
    into v_proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'enforce_profile_role_lock'
   limit 1;
  if v_proconfig is null
     or not exists (select 1 from unnest(v_proconfig) as cfg where cfg like 'search_path=%') then
    raise exception 'INVARIANT 3 FAILED: public.enforce_profile_role_lock() has no locked search_path in proconfig (got: %)',
      coalesce(array_to_string(v_proconfig, ','), '(null)');
  end if;

  select count(*)
    into v_count
    from pg_trigger tg
    join pg_class c     on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'profiles'
     and tg.tgname = 'profiles_role_lock'
     and not tg.tgisinternal
     and (tg.tgtype & 2) <> 0;   -- TRIGGER_TYPE_BEFORE bit (BEFORE, not AFTER)
  if v_count < 1 then
    raise exception 'INVARIANT 3 FAILED: BEFORE UPDATE trigger profiles_role_lock missing on public.profiles';
  end if;

  -- ── 4. profiles has NO anon/public INSERT policy (carried from rls_assertions INVARIANT 3) ──
  select count(*)
    into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'profiles'
     and cmd        = 'INSERT'
     and (roles @> array['anon']::name[] or roles @> array['public']::name[]);
  if v_count <> 0 then
    raise exception 'INVARIANT 4 FAILED: profiles has an anon/public INSERT policy (% found); rows must be created only by the handle_new_user trigger (D-05)', v_count;
  end if;

  raise notice 'ALL AUTH (0004) INVARIANTS PASSED (1: profiles.name, 2: handle_new_user DEFINER+search_path + on_auth_user_created, 3: enforce_profile_role_lock DEFINER+search_path + profiles_role_lock BEFORE UPDATE, 4: no profiles anon-insert)';
end;
$$;
