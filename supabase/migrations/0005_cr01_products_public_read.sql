-- 0005_cr01_products_public_read.sql
-- Phase 4 / Plan 01 / Task 1 — CR-01 RLS tightening (D-14).
--
-- Sorts after 0002, so public.products and the products_public_read policy already exist.
-- 0002 created products_public_read with `using (true)`, which (once ADMIN-08 introduces a
-- draft toggle) would leak draft rows to any raw PostgREST select that omits .eq('is_active',
-- true). This migration drops and recreates the policy to filter on is_active = true at the
-- object level, so draft (is_active=false) products are unreachable via the anon/authenticated
-- public-read path — not merely filtered query-side in catalog.ts.
--
-- products_admin_write (the FOR ALL, private.is_admin() policy from 0002) is left UNTOUCHED:
-- admins still read drafts through that policy regardless of is_active. This migration makes
-- NO DELETE/UPDATE changes.
--
-- Net invariant: draft (is_active=false) products are unreachable via the anon/authenticated
-- public-read path; admins still read drafts via products_admin_write FOR ALL.
-- Source: 02-REVIEW.md CR-01 finding; 04-RESEARCH.md "CR-01 migration (0005)".

drop policy "products_public_read" on public.products;

create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (is_active = true);
