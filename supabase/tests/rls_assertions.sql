-- rls_assertions.sql
-- Phase 1 / Plan 02 / Task 3 — DATA-02 RLS invariant assertions.
--
-- This is the failing-test-first artifact: it exists now (Plan 02) and runs GREEN against the
-- live project AFTER `supabase db push` in Plan 03. Each invariant raises an exception on
-- failure, so a non-zero psql exit signals a broken posture. Run with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_assertions.sql
--
-- Invariants asserted:
--   1. relrowsecurity = true for all six public tables (RLS enabled).
--   2. The three catalog tables (products, categories, site_content) have a permissive
--      SELECT policy reachable by anon (public read open).
--   3. profiles has NO anon/public INSERT policy (default-deny holds; no signup-row write yet).
--   4. private.is_admin exists with prosecdef = true (SECURITY DEFINER) and a locked search_path
--      in proconfig.
--   5. Both Storage buckets exist with public = true.

do $$
declare
  v_count       int;
  v_missing     text;
  v_expected    text[] := array[
    'products','categories','profiles','site_content','customization_submissions','wishlists'
  ];
  v_catalog     text[] := array['products','categories','site_content'];
  t             text;
  v_proconfig   text[];
begin
  -- ── 1. RLS enabled (relrowsecurity = true) on all six public tables ──────
  select count(*)
    into v_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any(v_expected)
     and c.relrowsecurity = true;
  if v_count <> array_length(v_expected, 1) then
    -- name the offenders for a useful failure message
    select string_agg(name, ', ')
      into v_missing
      from unnest(v_expected) as name
     where not exists (
       select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = name
          and c.relrowsecurity = true
     );
    raise exception 'INVARIANT 1 FAILED: RLS not enabled on all six tables (% of % have RLS; missing/off: %)',
      v_count, array_length(v_expected, 1), coalesce(v_missing, '(table absent)');
  end if;

  -- ── 2. Public-read SELECT policy reachable by anon on the three catalog tables ──
  foreach t in array v_catalog loop
    select count(*)
      into v_count
      from pg_policies
     where schemaname = 'public'
       and tablename  = t
       and cmd        = 'SELECT'
       and (roles @> array['anon']::name[] or roles @> array['public']::name[]);
    if v_count < 1 then
      raise exception 'INVARIANT 2 FAILED: no anon-readable SELECT policy on public.%', t;
    end if;
  end loop;

  -- ── 3. profiles has NO anon/public INSERT policy (default-deny holds) ────
  select count(*)
    into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'profiles'
     and cmd        = 'INSERT'
     and (roles @> array['anon']::name[] or roles @> array['public']::name[]);
  if v_count <> 0 then
    raise exception 'INVARIANT 3 FAILED: profiles has an anon/public INSERT policy (% found); must stay default-deny', v_count;
  end if;

  -- ── 4. private.is_admin exists, SECURITY DEFINER, locked search_path ─────
  select count(*)
    into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname = 'is_admin'
     and p.prosecdef = true;
  if v_count < 1 then
    raise exception 'INVARIANT 4 FAILED: private.is_admin() missing or not SECURITY DEFINER (prosecdef)';
  end if;

  select p.proconfig
    into v_proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname = 'is_admin'
   limit 1;
  if v_proconfig is null
     or not exists (select 1 from unnest(v_proconfig) as cfg where cfg like 'search_path=%') then
    raise exception 'INVARIANT 4 FAILED: private.is_admin() has no locked search_path in proconfig (got: %)',
      coalesce(array_to_string(v_proconfig, ','), '(null)');
  end if;

  -- ── 5. Both Storage buckets exist with public = true ────────────────────
  select count(*)
    into v_count
    from storage.buckets
   where id in ('product-images', 'site-content')
     and public = true;
  if v_count <> 2 then
    raise exception 'INVARIANT 5 FAILED: expected 2 public Storage buckets (product-images, site-content); found % public', v_count;
  end if;

  raise notice 'ALL DATA-02 RLS INVARIANTS PASSED (1: RLS-on x6, 2: public-read x3, 3: no profiles anon-insert, 4: is_admin DEFINER+search_path, 5: 2 public buckets)';
end;
$$;
