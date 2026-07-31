-- 0019_products_badges.sql
-- Quick task 260731-grz / Task 1 — QUICK-260731-grz: owner-controlled product
-- badges (Discount, New, Most sold) + a real discount price mechanic.
--
-- Sorts after 0001 (which created public.products), 0005 (which tightened
-- products_public_read to `using (is_active = true)`), 0008 (in_stock), 0010
-- (show_patch_test_note) and 0011 (which created public.product_variants).
-- Additive only: four DISPLAY columns on products and one MRP column on
-- product_variants. No data backfill, no drops, no type changes.
--
-- original_price is the MRP. It is NULLABLE and its type matches products.price
-- EXACTLY (numeric(10,2)) so the existing snake->camel readers keep returning
-- `number | null` with no new coercion. It lives on BOTH tables because a
-- variant product needs a correct MRP per weight — the percentage is ALWAYS
-- computed client-side from (price, original_price) and is NEVER typed or
-- stored, so a missing or <= price MRP simply yields no badge.
--
-- The three booleans default FALSE (the 0010 polarity, NOT 0008's `default
-- true`): every existing row becomes show_discount/is_new/is_best_seller =
-- false, so the entire catalogue renders EXACTLY as it does today until the
-- owner opts a product in from the admin form.
--
-- LOAD-BEARING INVARIANT — these are DISPLAY columns, NOT visibility flags:
--   is_active controls VISIBILITY (0005's RLS makes drafts unreachable on the
--   public read path). show_discount / is_new / is_best_seller / original_price
--   control only which merchandising chip and which price string render on an
--   ALREADY-VISIBLE product. A discounted, new or best-selling product's public
--   readability is COMPLETELY unchanged. Therefore this migration creates,
--   drops or alters NO RLS policy and references these columns in NO policy;
--   catalog.ts selects them but applies NO .eq(...) filter on any of them. They
--   are client-side render inputs only.
--
-- The write path rides the EXISTING products_admin_write and
-- product_variants_admin_write (FOR ALL, private.is_admin()) policies from 0002
-- and 0011 — only admins can flip a flag or set an MRP.

alter table public.products
  add column if not exists original_price  numeric(10,2),
  add column if not exists show_discount   boolean not null default false,
  add column if not exists is_new          boolean not null default false,
  add column if not exists is_best_seller  boolean not null default false;

alter table public.product_variants
  add column if not exists original_price numeric(10,2);
