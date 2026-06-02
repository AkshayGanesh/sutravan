---
phase: quick-260602-tf6
plan: 01
subsystem: catalog
tags: [variants, skus, pricing, rls, admin, catalog]
requires:
  - public.products (id, is_active, price)
  - private.is_admin()
  - catalog.ts read layer / admin.ts write layer
  - formatPrice helper
provides:
  - public.product_variants table (RLS: public read gated to is_active products, admin-only write)
  - variants.ts (Variant, toVariant, lowestVariantPrice, displayPriceLabel)
  - admin.ts variant write path (VariantFormValues, fromVariantForm, diffVariants, saveProductVariants)
  - per-product variant editor (ProductForm), weight selector (ProductDetail), "From ₹{lowest}" card (ProductCard)
affects:
  - Shop / Home / ProductGrid (card price string)
  - public product detail (price + selector)
  - admin product editing page
tech-stack:
  added: []
  patterns:
    - "Separate relational product_variants table (not a JSON column) with real RLS policies"
    - "Pure derivations + snake->camel mapper in variants.ts (mirrors catalog.ts boundary)"
    - "Client-side insert/update/delete diff under admin RLS (diffVariants -> saveProductVariants)"
    - "products UUID resolved by slug before variant writes (public Product.id is the slug)"
key-files:
  created:
    - supabase/migrations/0011_product_variants.sql
    - client/src/lib/variants.ts
    - client/src/lib/variants.test.ts
  modified:
    - client/src/data/products.ts
    - client/src/lib/catalog.ts
    - client/src/lib/admin.ts
    - client/src/lib/admin.test.ts
    - client/src/pages/admin/ProductForm.tsx
    - client/src/components/ProductDetail.tsx
    - client/src/components/ProductCard.tsx
decisions:
  - "Variants OPTIONAL: 0 variants = exactly today's single-price behaviour (incl. null = 'Price on request'); >=1 variant drives display pricing and products.price is ignored for display"
  - "No data migration of the 28 existing products — all keep 0 variants and are unchanged"
  - "public read gated to is_active products via exists(...) subquery (mirrors CR-01 0005) so draft products' variants stay off the public path"
  - "displayPriceLabel: 'From ' prefix only when a numeric variant price exists; an all-null variant set reads as 'Price on request' with NO 'From '"
  - "ProductDetail selector defaults to lowest-price variant (tie-break lowest sortOrder); shows the SELECTED variant's exact price (not 'From')"
metrics:
  duration: ~12min
  completed: 2026-06-02
---

# Quick Task 260602-tf6: Per-product weight/price variants (SKUs) Summary

Per-product weight/price variants (SKUs) wired end-to-end — a new relational `public.product_variants` table with real RLS (public read gated to active products, admin-only write), a pure variants lib, catalog read + admin write-diff plumbing, a repeatable admin editor, a price-updating weight selector on the public detail, and "From ₹{lowest}" on Shop/Home cards. Fully backwards-compatible: a 0-variant product behaves exactly as today.

## What Was Built

- **Migration 0011** (`supabase/migrations/0011_product_variants.sql`): new `public.product_variants` table (`id`, `product_id` FK on-delete-cascade, `label`, `price numeric(10,2)`, `sort_order`, timestamps) + `product_id` index. RLS enabled with `product_variants_public_read` (gated to `is_active` products via an `exists(...)` subquery) and `product_variants_admin_write` (`private.is_admin()`). This migration legitimately contains `create policy` (it is a NEW relational table, unlike the boolean-flag migrations 0008/0010).
- **variants.ts**: `Variant` type, `toVariant` (snake→camel), `lowestVariantPrice` (ignores null prices; empty/all-null → null), `displayPriceLabel` (reuses `formatPrice`; "From " prefix only when a numeric variant price exists). 12 unit tests pin every branch.
- **Product type** (`data/products.ts`): now carries `variants: Variant[]` (empty = unchanged single-price path); `variants: []` added to all 28 static entries.
- **catalog.ts**: nested `product_variants(id, label, price, sort_order)` select ordered by `sort_order` (supabase-js v2 `referencedTable` embedded order); `toProduct` maps `variants`.
- **admin.ts**: `VariantFormValues`, `fromVariantForm`, pure `diffVariants` (insert new / update changed-by-id / delete removed / no-op unchanged), and `saveProductVariants` applying the diff under admin RLS. `useUpsertProduct` resolves the products UUID by slug after the product upsert, then saves the variant diff; `product_variants` added to `ADMIN_PRODUCT_COLUMNS` so the edit form prefills existing variants. `['catalog']` invalidation unchanged.
- **ProductForm.tsx**: repeatable weight-option editor (label + price + sort, add/remove) wired into the zod schema, both default branches, and the onSubmit payload; each row's `id` is preserved so edits update-by-id.
- **ProductDetail.tsx**: weight-option selector (defaults to the lowest-price variant) that updates the shown price on selection; 0-variant products render exactly as today.
- **ProductCard.tsx**: price line swapped to `displayPriceLabel(product.price, product.variants)` → "From ₹{lowest}" with variants, single price otherwise (covers both Shop and Home via ProductGrid).

## Deviations from Plan

None — plan executed as written. The catalog.ts `variants` mapping was authored during Task 2 (the new required `Product.variants` field forces `toProduct` to provide it to keep `npm run check` green) and the nested select + ordering were completed in Task 3; this is a sequencing detail, not a behavioural deviation.

## Verification

- `npm test`: 9 files, 71 tests passing (includes 12 new variants.ts tests + 7 new diffVariants/fromVariantForm tests).
- `npm run check` (tsc): clean.
- Task 1 migration grep gate: OK. Task 4 component grep gate: OK.

## Outstanding — BLOCKING-HUMAN (Task 5)

All code is complete and green. The single remaining action is the live migration push, which the agent cannot perform (no live service-role credentials):

- **Push migration 0011 to the live Supabase project** (ref `wfbnrcnmpcqzeyjlfflv`), per the `supabase-live-ops` memory note:
  `echo y | ./node_modules/.bin/supabase db push --linked`
- Then verify in the live admin → public flow: add two weight options to a product (e.g. "70gm" ₹120, "200gm" ₹300), confirm the detail selector defaults to ₹120 and switching to "200gm" shows ₹300, the Shop card shows "From ₹120", and a 0-variant product is unchanged. Then remove one variant + edit another's price and confirm the public view reflects the diff with no redeploy.

Until pushed, the variant read/write paths will error at runtime against the live DB (the table does not yet exist). No data migration is expected — `select count(*) from public.product_variants;` should return 0.

## Self-Check: PASSED

- Created files verified on disk: `supabase/migrations/0011_product_variants.sql`, `client/src/lib/variants.ts`, `client/src/lib/variants.test.ts`.
- Commits verified in git log: a1a82c1 (migration), 99d62c4 (variants lib), 02011b8 (data layer), ac0e3ce (UI).
