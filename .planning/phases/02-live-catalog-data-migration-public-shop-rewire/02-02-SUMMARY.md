---
phase: 02-live-catalog-data-migration-public-shop-rewire
plan: 02
subsystem: ui
tags: [supabase, tanstack-query, react, typescript, storage, vite]

requires:
  - phase: 02-live-catalog-data-migration-public-shop-rewire (plan 01)
    provides: glob-free catalog-data.ts metadata + seeded Supabase (28 products / 3 categories, soap images in Storage, scrub/cream images [], prices null, is_active filter proven)
provides:
  - formatPrice(price) single source of truth for price rendering (D-01/D-02)
  - catalog.ts live read layer — useProducts/useCategories hooks with server-side is_active filter, snake->camel mappers, getPublicUrl image resolution
  - products.ts refactored glob-free with Product.price as number | null and metadata re-exported from catalog-data.ts
affects: [02-03 (public Shop/Home/ProductGrid/ProductCard/ProductDetail rewire), admin-portal-catalog-management]

tech-stack:
  added: []
  patterns:
    - "Map snake_case->camelCase ONCE at the data-layer boundary, never per component"
    - "Published-only filter is server-side in the query (.eq('is_active', true)), never client-side hide"
    - "Storage paths -> public URLs only via getPublicUrl (encodes spaces/parens), never string concatenation"
    - "Single formatPrice() render path for all prices; null -> 'Price on request'"

key-files:
  created:
    - client/src/lib/format.ts
    - client/src/lib/catalog.ts
  modified:
    - client/src/data/products.ts

key-decisions:
  - "formatPrice uses == null so 0 renders as ₹0 (a set price), not 'Price on request'"
  - "Empty images[] yields exactly ONE bundled category placeholder so ProductDetail hasMany stays false for scrub/cream (D-03)"
  - "Category showcase tiles use bundled placeholder PNGs (live categories table has no image asset) — planner discretion to keep Home banners"
  - "Static products array RETAINED as temporary dead-code scaffold (null prices, placeholder images) to keep build green through Wave 2 -> Wave 3 handoff"

patterns-established:
  - "Data-layer boundary mapping: toProduct/toCategory in catalog.ts produce the component-facing shape"
  - "Server-side published filter: .eq('is_active', true) lives in fetchProducts(), drafts never reach the client"
  - "getPublicUrl image resolution with single-placeholder fallback for empty image sets"

requirements-completed: [PUB-01, PUB-02]

duration: 12min
completed: 2026-05-31
---

# Phase 2 Plan 02: Live Read-Layer Foundation Summary

**TanStack Query catalog read layer with server-side published filter, snake->camel mapping, getPublicUrl image resolution, and a single formatPrice() render path — products.ts now glob-free with price as number | null.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `formatPrice()` single source of truth: null -> "Price on request" (D-01), set price -> "₹250" whole rupees no decimals (D-02), 0 -> "₹0"
- `catalog.ts` live read layer: `useProducts`/`useCategories` TanStack Query hooks (loading/error/refetch), mandatory server-side `.eq('is_active', true)` published filter (PUB-02), snake->camel `toProduct`/`toCategory` mappers, `productImageUrls` via `getPublicUrl` with single-placeholder fallback
- `products.ts` refactored: `import.meta.glob` + `getSoapImages` removed, `Product.price` changed `string` -> `number | null` (Pitfall 5 contained), metadata re-exported from `catalog-data.ts`
- Build stays green for the Wave 2 -> Wave 3 handoff: static array kept as temporary dead-code scaffold; full Vite build + secret-leak guard PASS

## Task Commits

Each task was committed atomically:

1. **Task 1: formatPrice() single source of truth** - `b715fd7` (feat)
2. **Task 2: catalog.ts read layer (hooks, is_active filter, mappers, image helper)** - `2f8423a` (feat)
3. **Task 3: refactor products.ts glob-free, price number|null** - `efc4baa` (refactor)

## Files Created/Modified
- `client/src/lib/format.ts` - `formatPrice(price: number | null): string`, the sole price-string producer (D-01/D-02)
- `client/src/lib/catalog.ts` - live Supabase read layer: hooks, server-side published filter, boundary mappers, getPublicUrl image resolution
- `client/src/data/products.ts` - glob-free; `Product.price` now `number | null`; metadata re-exported from `catalog-data.ts`; static array retained as build-green scaffold

## Decisions Made
- `formatPrice` uses `== null` (not a falsy check) so `0` is treated as a real set price (`₹0`).
- `productImageUrls([], category)` returns exactly one element so `ProductDetail.hasMany` stays false for image-less scrub/cream products.
- Category tiles map slug -> bundled placeholder PNG since the live `categories` table carries no image asset.
- The static `products` array (and `getProductsByCategory`/`getProductById`/`getFeaturedProducts`) are intentionally kept as dead-code scaffold until Plan 03 removes the runtime consumers.

## Deviations from Plan

None - plan executed exactly as written. (The only adjustment was wording a code comment to avoid the literal strings `import.meta`/`getSoapImages` so the glob-removal grep assertions return 0 — this is an acceptance-criteria conformance detail, not a behavioral deviation.)

## Issues Encountered
None. All verifications passed: `npm run check` green after each task, formatPrice node contract OK, catalog.ts grep (is_active + getPublicUrl + 2 query keys) OK, products.ts grep (no glob, price number|null) OK, `scripts/check-no-secret.sh` PASS (full Vite build succeeds without the glob, no service_role in dist/).

## User Setup Required
None - no external service configuration required (reuses the existing anon `supabase` singleton and already-installed `@tanstack/react-query`).

## Next Phase Readiness
- Contracts locked for Plan 03: `useProducts`, `useCategories`, `productImageUrls`, `formatPrice`, and the adapted `Product` type (`price: number | null`).
- Plan 03 wires these into Shop/Home/ProductGrid (hooks) and ProductCard/ProductDetail (adapted type + formatPrice), then removes the static-array consumers — after which the scaffold becomes dead code and can be deleted.

---
*Phase: 02-live-catalog-data-migration-public-shop-rewire*
*Completed: 2026-05-31*

## Self-Check: PASSED

- FOUND: client/src/lib/format.ts
- FOUND: client/src/lib/catalog.ts
- FOUND: client/src/data/products.ts
- FOUND: .planning/phases/02-live-catalog-data-migration-public-shop-rewire/02-02-SUMMARY.md
- FOUND commit: b715fd7 (Task 1)
- FOUND commit: 2f8423a (Task 2)
- FOUND commit: efc4baa (Task 3)
