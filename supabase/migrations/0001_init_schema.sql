-- 0001_init_schema.sql
-- Phase 1 / Plan 02 / Task 1 — Database foundation: private schema, is_admin() helper,
-- and all six tables with their full real columns (D-11).
--
-- Ordering is dependency-safe (RESEARCH Pitfall 3): the `private` schema and is_admin()
-- are created first, then the tables that policies (in 0002) reference. RLS/policies are
-- NOT enabled here — that is 0002 (kept separate for readability; 0002 sorts after 0001).
--
-- Sources lifted from 01-RESEARCH.md Pattern 2 (non-recursive is_admin, lines 150-179) and
-- §"Schema Column Recommendations" (the six-table SQL, lines 335-407).

-- ──────────────────────────────────────────────────────────────────────────
-- Private schema + non-recursive is_admin() SECURITY DEFINER helper
-- ──────────────────────────────────────────────────────────────────────────
-- The helper lives in `private` (NOT public) so it is never exposed via the
-- auto-generated PostgREST API. SECURITY DEFINER makes it run as its creator,
-- bypassing RLS on profiles → breaks the profiles-recursion cycle. The locked
-- empty search_path forces every object reference to be fully-qualified,
-- preventing search_path hijack.
--
-- The schema is created up-front, but the function itself is defined at the END
-- of this migration: it is a `language sql` function whose body references
-- `public.profiles`, and SQL-language bodies are validated at creation time, so
-- `public.profiles` must already exist before the function is created.
create schema if not exists private;

-- ──────────────────────────────────────────────────────────────────────────
-- categories (D-04): FK target for products; carries the URL/display slug
-- ──────────────────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'soap' | 'scrub' | 'cream' today
  label text not null,                 -- 'Soaps'
  description text,
  image text,                          -- storage path (site-content/category hero)
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- products (D-01/02/03/04): UUID pk + separate unique slug, nullable INR price,
-- ordered images[] of Storage paths, category_id FK for in-use delete protection
-- ──────────────────────────────────────────────────────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                            -- 'neem' (Phase 2 upserts on this) (D-01)
  name text not null,
  subtitle text,
  category_id uuid references public.categories(id),    -- FK = in-use delete protection (D-04)
  price numeric(10,2),                                  -- nullable INR; all 68 unpriced today (D-02)
  benefits text[] default '{}',
  ingredients text[] default '{}',
  tips text[] default '{}',
  shelf_life text,                                      -- products.ts shelfLife → snake_case
  batch_note text,                                      -- products.ts batchNote → snake_case
  images text[] default '{}',                           -- ordered Storage paths (D-03)
  is_active boolean not null default true,              -- ADMIN-08 draft/published (Phase 4 uses it)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- profiles (D-10): role lives here (server-side), never in auth metadata
-- ──────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- site_content (ADMIN-05/06): key/value editable content
-- ──────────────────────────────────────────────────────────────────────────
create table public.site_content (
  key text primary key,                -- 'hero_title', 'our_story_body', 'instagram_url', ...
  value text,
  updated_at timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- customization_submissions (CUST-03): questionnaire capture (replaces Google Form)
-- user_id is nullable / set null so an anon submit is possible if Phase 5 opts in
-- ──────────────────────────────────────────────────────────────────────────
create table public.customization_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  skin_type text,
  message text,
  payload jsonb,                       -- flexible field bag for the evolving questionnaire
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- wishlists (CUST-01/02): owner-scoped saved products; composite pk
-- ──────────────────────────────────────────────────────────────────────────
create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

-- ──────────────────────────────────────────────────────────────────────────
-- private.is_admin() — defined here, after public.profiles exists
-- ──────────────────────────────────────────────────────────────────────────
-- See the header comment: this `language sql` function's body references
-- public.profiles and is validated at creation time, so it must be created
-- after the profiles table above. SECURITY DEFINER + locked empty search_path
-- keep it non-recursive and hijack-safe.
create or replace function private.is_admin()
returns boolean
language sql
security definer            -- runs as creator → bypasses RLS on profiles → no recursion
set search_path = ''        -- locked: fully-qualify every object, prevents search_path hijack
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())   -- (select ...) initPlan form: perf + recursion-safe
      and role = 'admin'
  );
$$;
