---
phase: quick-260602-c2y
plan: 01
subsystem: admin-portal + public-catalog
tags: [products, stock, admin, rls-safe, tdd]
requires:
  - migration 0008 in_stock column applied live (BLOCKING-HUMAN — see below)
provides:
  - per-product in_stock flag, end-to-end (DB column -> admin toggle -> public unavailable UI)
  - useToggleProductInStock mutation (invalidates ['catalog'])
affects:
  - client/src/data/products.ts
  - client/src/lib/catalog.ts
  - client/src/lib/admin.ts
  - client/src/pages/admin/ProductsList.tsx
  - client/src/pages/admin/ProductForm.tsx
  - client/src/components/ProductCard.tsx
  - client/src/components/ProductDetail.tsx
tech-stack:
  added: []
  patterns:
    - "in_stock is NOT a visibility flag: no RLS reference, no public-read filter — out-of-stock stays visible"
    - "stock toggle lives on the list (like draft/publish); carried as a hidden value through ProductForm"
key-files:
  created:
    - supabase/migrations/0008_products_in_stock.sql
  modified:
    - client/src/data/products.ts
    - client/src/lib/catalog.ts
    - client/src/lib/admin.ts
    - client/src/lib/admin.test.ts
    - client/src/pages/admin/ProductsList.tsx
    - client/src/pages/admin/ProductForm.tsx
    - client/src/components/ProductCard.tsx
    - client/src/components/ProductDetail.tsx
decisions:
  - "Polarity in_stock (default true), not is_out_of_stock — mirrors is_active; 28 existing rows auto in-stock, no backfill"
  - "in_stock referenced in NO RLS policy and NO public-read filter — out-of-stock products MUST stay visible (QUICK-OOS-01 inversion of is_active)"
  - "Stock toggle on the products list (not in the form); ProductForm carries inStock as a hidden value so create/edit never resets stock"
  - "Stock switch uses a neutral checked color (bg-secondary) to visually distinguish from the green Published switch"
metrics:
  duration: ~10min
  completed: 2026-06-02
  tasks_completed: 3 of 3 code tasks (Task 1b is human-only, deferred — see below)
  files_changed: 9
---

# Quick Task 260602-c2y: Add Out-of-Stock Toggle to Products Admin — Summary

Owner can flip a per-product "In stock / Out of stock" toggle on the admin products list (desktop + mobile), beside the existing Published toggle; an out-of-stock product STAYS on the public Shop and is clearly marked "Out of stock" (card) / "Currently unavailable" (detail) — never hidden — and the change propagates to the Shop with no redeploy via `['catalog']` invalidation.

## What Was Built

- **Migration 0008** (`supabase/migrations/0008_products_in_stock.sql`): adds `in_stock boolean not null default true` to `public.products`, mirroring the `is_active` convention. The file header states the load-bearing invariant: `in_stock` is NOT a visibility flag — zero policy statements (verified by grep).
- **Data layer** (`catalog.ts`, `admin.ts`, `products.ts`): `Product` gains `inStock`; `catalog.ts fetchProducts` selects `in_stock` and `toProduct` maps `inStock: row.in_stock ?? true` — with NO `.eq('in_stock', ...)` filter, so out-of-stock products are still returned. `ProductFormValues`/`ProductRow` carry the field; `fromProductForm` maps `in_stock`; `ADMIN_PRODUCT_COLUMNS` includes it; new `useToggleProductInStock` mutation updates by slug and invalidates `['catalog']` with stock-specific toasts (NOT the "hidden from the Shop" copy).
- **Admin UI** (`ProductsList.tsx`, `ProductForm.tsx`): an "In stock" `Switch` per row (desktop table column + mobile card), neutral checked color, wired to `useToggleProductInStock`; `COLUMN_COUNT` 5 -> 6 and skeleton updated. `ProductForm` carries `inStock` as a hidden value (zod `z.boolean()`, defaults: edit -> `existing.in_stock ?? true`, new -> `true`) so create/edit never resets stock.
- **Public UI** (`ProductCard.tsx`, `ProductDetail.tsx`): card shows an "Out of stock" badge overlay (still clickable); detail shows a "Currently unavailable" marker near the price and relabels the Instagram CTA to "Currently unavailable — enquire on Instagram". Every new element is gated on `!product.inStock`, so the in-stock path is visually and behaviorally unchanged.

## TDD Gate Compliance

Task 2 followed RED -> GREEN:
- RED: `test(quick-260602-c2y): add failing inStock mapping assertions` (b29ed3d) — 3 failing assertions confirmed (`row.in_stock` undefined).
- GREEN: `feat(quick-260602-c2y): wire inStock through data layer` (16a5132) — 48/48 tests pass, `npm run check` clean.

## Verification

- `npm test`: 8 files, 48 tests pass (includes new `inStock` true/false mapping assertions).
- `npm run check` (tsc): clean.
- Migration grep gate: contains `add column if not exists in_stock boolean not null default true`, zero `create/drop/alter policy`.
- `catalog.ts fetchProducts` selects `in_stock` with NO `.eq('in_stock', ...)` filter (out-of-stock still returned).

## Deviations from Plan

None — plan executed as written. Task 1b (live `supabase db push`) is intentionally deferred to a human action (see below); all code was completed and kept green without blocking on it, per the execution directive.

## BLOCKING-HUMAN — Single Outstanding Action

All code is complete and green. The feature will not work at runtime until migration 0008 is applied to the live Supabase project (the agent has no live service-role credentials).

**Action required (owner):**
1. Push migration 0008 to the live project per the supabase-live-ops memory note — project ref `wfbnrcnmpcqzeyjlfflv`:
   `supabase db push` (or the documented apply path).
2. Confirm the column exists and defaults true on existing rows (Supabase SQL editor):
   `select count(*) as total, count(*) filter (where in_stock) as in_stock_true from public.products;`
   Expect `total = in_stock_true` (all 28 products in stock).
3. Sanity-check the public Shop (https://sutravan.in/shop) still lists the same published products — nothing is hidden.

Until this runs, `catalog.ts`'s `in_stock` select and the admin toggle will error against the live DB (unknown column).

## Known Stubs

None. No placeholder/empty-data stubs introduced; the static `products` array (already off the runtime path per Phase-2 decision) received `inStock: true` on all 28 entries only to satisfy strict types.

## Commits

- 9f0022d feat(quick-260602-c2y): add migration 0008 in_stock column (no RLS change)
- b29ed3d test(quick-260602-c2y): add failing inStock mapping assertions
- 16a5132 feat(quick-260602-c2y): wire inStock through data layer
- bf73ccc feat(quick-260602-c2y): admin stock toggle + public unavailable UI

## Self-Check: PASSED

All 7 created/modified key files exist on disk; all 4 task commits (9f0022d, b29ed3d, 16a5132, bf73ccc) present in git history.
