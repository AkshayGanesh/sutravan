-- 0008_products_in_stock.sql
-- Quick task 260602-c2y / Task 1 — QUICK-OOS-01: per-product stock flag.
--
-- Sorts after 0001 (which created public.products with is_active) and 0005
-- (which tightened products_public_read to `using (is_active = true)`). Adds a
-- single boolean stock column, mirroring the existing `is_active boolean not null
-- default true` convention exactly: positive polarity, not null, default true —
-- so all 28 existing rows become in_stock = true with NO data backfill.
--
-- LOAD-BEARING INVARIANT — in_stock is NOT a visibility flag:
--   is_active controls VISIBILITY (0005's RLS makes drafts unreachable on the
--   public read path). in_stock is the OPPOSITE intent — an out-of-stock product
--   MUST stay publicly readable and visible, just rendered as "unavailable" on
--   the client. Therefore this migration creates/drops/alters NO RLS policy and
--   references in_stock in NO policy. Out-of-stock products keep is_active = true
--   and are still returned by products_public_read; the "unavailable" state is a
--   client-side render flag only (catalog.ts selects in_stock but applies no
--   .eq('in_stock', ...) filter).
--
-- The write path rides the EXISTING products_admin_write (FOR ALL,
-- private.is_admin()) policy from 0002 — only admins can flip in_stock.

alter table public.products
  add column if not exists in_stock boolean not null default true;
