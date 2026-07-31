---
phase: quick-260731-grz
plan: 01
subsystem: catalog-merchandising
tags: [badges, discount, admin, rls-neutral, migration]
requires:
  - products / product_variants tables (0001, 0011)
  - products_admin_write / product_variants_admin_write RLS (0002, 0011)
  - formatPrice single render path (D-01/D-02)
provides:
  - products.original_price / show_discount / is_new / is_best_seller (migration 0019)
  - product_variants.original_price (migration 0019)
  - client/src/lib/badges.ts — activePricePoint, productBadge, BadgeKind, discountPercent
  - client/src/lib/variants.ts — lowestPricedVariant, discountPercent, displayPricePair
affects:
  - ProductCard (Shop + Home via ProductGrid), ProductDetail, admin ProductForm
tech-stack:
  added: []
  patterns:
    - per-product DISPLAY flag recipe (mirrors in_stock 0008, show_patch_test_note 0010)
    - snake->camel mapping once at the catalog.ts / admin.ts boundaries
key-files:
  created:
    - supabase/migrations/0019_products_badges.sql
    - client/src/lib/badges.ts
    - client/src/lib/badges.test.ts
  modified:
    - client/src/data/products.ts
    - client/src/lib/variants.ts
    - client/src/lib/catalog.ts
    - client/src/lib/admin.ts
    - client/src/components/ProductCard.tsx
    - client/src/components/ProductDetail.tsx
    - client/src/pages/admin/ProductForm.tsx
    - client/src/lib/admin.test.ts
    - client/src/lib/variants.test.ts
decisions:
  - discountPercent implemented in variants.ts and re-exported from badges.ts to avoid a variants<->badges import cycle
  - card badge/discount uses the LOWEST-PRICED variant; the detail modal uses the SELECTED variant
  - variant MRP>price issues report at the variants ARRAY root (one FormMessage for the whole array)
metrics:
  duration: ~20min
  tasks: 6
  files: 12
  tests: 163 -> 201
  completed: 2026-07-31
---

# Quick Task 260731-grz: Product Badges (Discount, New, Most Sold) Summary

Owner-controlled per-product merchandising badges with a real discount price
mechanic — stored MRP, struck-through price, and an always-computed "% OFF" —
managed entirely from the admin product form, no code change and no redeploy.

## What Was Built

Three owner-flipped switches (**Show discount**, **New product**, **Most sold**)
plus an MRP on both the product and each weight option. The Shop card renders at
most **one** chip by the fixed ladder `Out of stock > Discount > Most sold > New`,
and the detail modal's price line and "% OFF" chip track the **selected** weight.

| Task | What | Commit |
|------|------|--------|
| 1 | Migration 0019 — 5 additive columns, zero RLS policy statements | `f26d750` |
| 2 | Data layer — types, read mapper, write mappers, variant diff | `459455f` |
| 3 | Pricing primitives + pure `badges.ts` | `b65cf5d` |
| 4 | Public UI — badge chip + struck MRP on card and detail | `9326e0e` |
| 5 | Admin form — 3 Switches, 2 MRP inputs, MRP>price validation | `cdde1da` |
| 6 | Tests — admin mapper regressions + badges coverage | `97775a7` |

### The highest-risk regression, closed

`diffVariants` compared only `label`/`price`/`sort_order`. Adding a per-variant
MRP without extending that check would have made an **MRP-only edit a silent
no-op** — the owner types a new MRP, hits Save, gets a success toast, and nothing
is written. `prev.original_price !== s.originalPrice` is now part of the change
check, pinned by two tests (setting a first MRP, and clearing an existing one).

### Security posture

Migration 0019 creates, drops and alters **no RLS policy** (gate-proven: zero
policy statements in the non-comment body). `is_active` remains the sole
visibility gate, and `catalog.ts` adds **no** equality filter on any badge column,
so a non-badged or discounted product's public readability is unchanged. Writes
ride the existing `private.is_admin()` policies. The percentage is always derived
from stored `(price, original_price)` — never typed, never stored — so no bogus
"% OFF" can be produced by data entry (T-grz-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `variants.test.ts` `toVariant` assertion went stale**
- **Found during:** Task 3 (surfaced by the task's own gate)
- **Issue:** Task 2 added `originalPrice` to `toVariant`'s output, so the exact
  `toEqual({id,label,price,sortOrder})` assertion failed, and the `variant()`
  builder no longer satisfied the widened `Variant` type.
- **Fix:** Added `originalPrice: null` to the builder and to that one expected
  object. The **five `displayPriceLabel` assertions were left untouched** and
  pass byte-for-byte, which is what the task's gate actually proves.
- **Files modified:** `client/src/lib/variants.test.ts`
- **Commit:** `b65cf5d`

**2. [Rule 1 - Bug] Task 2's gate was self-invalidated by my own comment**
- **Found during:** Task 2
- **Issue:** I documented the "no filter" invariant with prose containing the
  literal `.eq('show_discount' ...`. The gate greps for exactly that string in
  `catalog.ts` and cannot tell a comment from real code, so it failed — the same
  trap the plan flagged for the migration's policy grep.
- **Fix:** Reworded the comment to name the columns without the code-shaped
  quoted form. Gate then passed. The invariant is still documented in place.
- **Files modified:** `client/src/lib/catalog.ts`
- **Commit:** `459455f`

**3. [Rule 3 - Blocking] Static `products.ts` array needed the 4 new fields**
- **Found during:** Task 2
- **Issue:** The 28-entry static array (dead code, kept only to keep the build
  green) is still type-checked, so widening `Product` with required fields broke it.
- **Fix:** Added `originalPrice: null` + the three `false` flags to all 28 entries.
- **Files modified:** `client/src/data/products.ts`
- **Commit:** `459455f`

### Documented mechanics deviation (from the plan itself)

`discountPercent` is **implemented in `variants.ts` and re-exported from
`badges.ts`**, because `displayPricePair` (locked to `variants.ts`) needs the same
MRP-validity math; defining it in `badges.ts` would create an import cycle.
`import { discountPercent } from "@/lib/badges"` works exactly as specified.

### TDD Gate Compliance

Tasks 3 and 6 carry `tdd="true"`, but the plan assigns **all** test files to Task
6 and gates Task 3 on the *pre-existing* `variants.test.ts` (a regression gate).
I followed the plan as written, so the commit sequence is
`feat(...)` (Task 3, b65cf5d) → `test(...)` (Task 6, 97775a7) rather than a strict
RED-then-GREEN pair. No behaviour is untested — Task 6 covers every bullet in
Task 3's `<behavior>` block. Flagging the ordering rather than silently claiming
a clean RED/GREEN cycle.

## Verification Results

| Gate | Result |
|------|--------|
| Task 1 grep gate (5 additive columns, 0 policy statements) | `GATE-OK` |
| Task 2 grep gate (MRP diff, variant SELECT, no `.eq` filter) | `GATE-OK` |
| `npx vitest run client/src/lib/variants.test.ts` | 12 passed, 0 failed |
| Task 4 grep gate (badge chip, `displayPricePair`, `% OFF`) | `GATE-OK` |
| `npm test` | **201 passed / 201** (19 files; was 163) |
| `npm run check` | **See caveat below — not clean** |
| No Supabase CLI command executed | Confirmed |

### `npm run check` — honest status

**It exits non-zero.** It reports exactly three errors, all pre-existing and all
in `scripts/transform-pincodes.ts` (TS2802, `Set`/`MapIterator` iteration needs
`downlevelIteration` or a higher `target`):

```
scripts/transform-pincodes.ts(58,6):  error TS2802
scripts/transform-pincodes.ts(224,21): error TS2802
scripts/transform-pincodes.ts(256,25): error TS2802
```

Evidence they are not mine: the identical three errors were captured on the clean
tree **before any edit in this task**, and `git log -1 -- scripts/transform-pincodes.ts`
resolves to `d3676ea feat(06-02)`. None of the 12 files this task touched produces
a type error. So the plan's "npm run check passes with zero errors" is **not**
literally met; what is met is **zero new type errors**. Logged in
`deferred-items.md` with a suggested one-line `tsconfig.json` fix, deliberately
not applied here (it would change the shared client build target).

Separately, `tsconfig.json` excludes `**/*.test.ts`, so `npm run check` never
type-checks test files. I type-checked the three touched test files explicitly
against a temporary config: **zero errors in the test files themselves**.

## Known Stubs

None. Every field is wired end to end: migration → read mapper → write mapper →
UI → admin form → tests.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or trust-boundary
schema change beyond the five non-sensitive merchandising columns already
enumerated in the plan's threat register.

## Follow-up — BLOCKING, human runs it

The migration is on the working tree but **not pushed** (the agent has no Supabase
credentials and ran no Supabase CLI command). Every gate above passed with the new
DB columns absent, because all reads use `?? false` / `?? null`.

```bash
echo y | ./node_modules/.bin/supabase db push --linked
```

Then `npm run dev:client` and walk the approved verification: single-price
discount (₹400/₹500 → gold `20% OFF` + `~~₹500~~ ₹400`); variant product
(`From ~~₹500~~ ₹400`, switching to 100gm re-renders `~~₹700~~ ₹560`); the
priority check (Most sold + New → one badge; out of stock overrides); Show
discount ON with no MRP → no discount badge; and untouched/draft products
unchanged.

## Self-Check: PASSED

All 11 claimed files verified present on disk; all 6 claimed commit hashes
verified present in `git log`.
