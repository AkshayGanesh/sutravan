-- 0011_product_variants.sql
-- Quick task 260602-tf6 / Task 1 — QUICK-VAR-01: per-product weight/price variants (SKUs).
--
-- Sorts after 0001 (created public.products + private.is_admin()), 0002 (the RLS
-- baseline + products_admin_write FOR ALL private.is_admin() policy) and 0005
-- (CR-01 tightened products_public_read to `using (is_active = true)`).
--
-- THIS IS A NEW RELATIONAL TABLE WITH POLICIES — unlike the recent display-flag
-- migrations 0008 (in_stock) / 0010 (show_patch_test_note), which added boolean
-- columns to the EXISTING products table and therefore touched NO policy. A NEW
-- table starts with no access at all once RLS is enabled, so this migration MUST
-- legitimately `create policy` (public read + admin write). This is expected.
--
-- Pricing model (LOCKED): variants are OPTIONAL. A product with 0 variants
-- behaves exactly as today (single products.price, incl. null = "Price on
-- request"). When a product has >=1 variant the variants drive display pricing.
-- No data migration of the 28 existing products — they have 0 variants and stay
-- unchanged (fully backwards-compatible).
--
-- Columns mirror the 0001 conventions exactly: gen_random_uuid() pk,
-- timestamptz default now(), and numeric(10,2) for price to match
-- products.price's type/units. on delete cascade removes a product's variants
-- when the product itself is deleted.

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,                 -- e.g. "70gm"
  price numeric(10,2),                 -- SAME type/units as products.price
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index product_variants_product_id_idx on public.product_variants (product_id);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: deny-all baseline, then open the catalog posture mirroring the products
-- policies (0002) with the CR-01 is_active scoping from 0005.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.product_variants enable row level security;

-- Public read is GATED to variants of is_active products via a per-row products
-- subquery — mirroring CR-01 (0005) so DRAFT products' variants stay off the
-- anon/authenticated public read path, consistent with their parent product.
create policy "product_variants_public_read"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.is_active
    )
  );

-- Admin-only write rides private.is_admin(), exactly like products_admin_write
-- (0002). The client-side form editor + saveProductVariants are convenience; THIS
-- policy is the real server-side gate (T-VAR-01).
create policy "product_variants_admin_write"
  on public.product_variants for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
