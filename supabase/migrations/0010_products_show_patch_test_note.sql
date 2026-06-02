-- 0010_products_show_patch_test_note.sql
-- Quick task 260602-t02 / Task 1 — QUICK-PTN-01: per-product patch-test note flag.
--
-- Sorts after 0001 (which created public.products), 0005 (which tightened
-- products_public_read to `using (is_active = true)`) and 0008 (in_stock). Adds a
-- single boolean DISPLAY column controlling whether the fixed safety note
-- "Always patch test first." renders on the public product detail.
--
-- POLARITY IS THE OPPOSITE OF 0008: default FALSE, not true. The note is OPT-IN,
-- so all existing rows become show_patch_test_note = false with NO data backfill —
-- the previously-always-shown note disappears until the owner enables it per
-- product. (0008's in_stock used `default true`; do NOT copy that here.)
--
-- LOAD-BEARING INVARIANT — show_patch_test_note is NOT a visibility flag:
--   is_active controls VISIBILITY (0005's RLS makes drafts unreachable on the
--   public read path). show_patch_test_note controls only whether a fixed,
--   non-sensitive safety string renders on an already-visible product. The
--   product's public readability is COMPLETELY unchanged. Therefore this
--   migration creates/drops/alters NO RLS policy and references the column in NO
--   policy; catalog.ts selects the column but applies NO .eq('show_patch_test_note',
--   ...) filter. It is a client-side render flag only.
--
-- The write path rides the EXISTING products_admin_write (FOR ALL,
-- private.is_admin()) policy from 0002 — only admins can flip the flag.

alter table public.products
  add column if not exists show_patch_test_note boolean not null default false;
