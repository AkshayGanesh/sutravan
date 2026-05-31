-- 0002_rls_policies.sql
-- Phase 1 / Plan 02 / Task 2 — Default-deny RLS with the exact D-12 read/write posture (DATA-02).
--
-- Sorts after 0001, so all six tables and private.is_admin() already exist. Enabling RLS on a
-- table with no policy makes it deny-all; we then open ONLY the D-12 reads/writes. Every policy
-- uses the (select auth.uid()) wrapped form (perf initPlan caching + recursion-safe). The profiles
-- self-read path uses (select auth.uid()) = id and never calls is_admin() (recursion-safe;
-- RESEARCH note lines 178-179).
--
-- Net DATA-02 invariant: every table has RLS enabled; anon can SELECT products/categories/
-- site_content but cannot INSERT/UPDATE/DELETE any table; profiles/wishlists are owner-scoped;
-- customization_submissions is admin+owner read.

-- ──────────────────────────────────────────────────────────────────────────
-- Enable RLS on all six tables (deny-all baseline until a policy opens access)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.categories                enable row level security;
alter table public.products                  enable row level security;
alter table public.profiles                  enable row level security;
alter table public.site_content              enable row level security;
alter table public.customization_submissions enable row level security;
alter table public.wishlists                 enable row level security;

-- ──────────────────────────────────────────────────────────────────────────
-- Catalog tables — public read (anon + authenticated), admin-only write
-- products, categories, site_content
-- ──────────────────────────────────────────────────────────────────────────
create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "products_admin_write"
  on public.products for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "categories_public_read"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "categories_admin_write"
  on public.categories for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "site_content_public_read"
  on public.site_content for select
  to anon, authenticated
  using (true);

create policy "site_content_admin_write"
  on public.site_content for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- profiles — owner self-read + admin-read-all; owner self-update + admin-all write
-- Self-read MUST NOT call is_admin() (recursion-safe): use (select auth.uid()) = id.
-- No public insert policy (Phase 3 wires signup row creation).
-- ──────────────────────────────────────────────────────────────────────────
create policy "profiles_self_read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_admin_read"
  on public.profiles for select
  to authenticated
  using (private.is_admin());

create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_admin_write"
  on public.profiles for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- wishlists — owner-scoped read / insert / delete, all by (select auth.uid()) = user_id
-- ──────────────────────────────────────────────────────────────────────────
create policy "wishlists_owner_read"
  on public.wishlists for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "wishlists_owner_insert"
  on public.wishlists for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "wishlists_owner_delete"
  on public.wishlists for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- customization_submissions — admin + owner read.
-- No insert policy this phase: Phase 5 decides anon-vs-auth submit (RESEARCH A5),
-- so it stays default-deny (a write attempt fails — the correct DATA-02 posture now).
-- ──────────────────────────────────────────────────────────────────────────
create policy "customization_submissions_admin_or_owner_read"
  on public.customization_submissions for select
  to authenticated
  using (private.is_admin() or (select auth.uid()) = user_id);
