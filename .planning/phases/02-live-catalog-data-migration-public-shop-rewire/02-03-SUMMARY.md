---
phase: 02-live-catalog-data-migration-public-shop-rewire
plan: 03
subsystem: ui
tags: [react, tanstack-query, supabase, shadcn, vite, public-catalog]

# Dependency graph
requires:
  - phase: 02-live-catalog-data-migration-public-shop-rewire (Plan 01)
    provides: seeded Supabase catalog (28 products / 3 categories, soap Storage paths, null prices)
  - phase: 02-live-catalog-data-migration-public-shop-rewire (Plan 02)
    provides: catalog.ts live read hooks (useProducts/useCategories), format.ts formatPrice, adapted Product type (price number|null), productImageUrls placeholder fallback
provides:
  - Public Shop renders live published products/categories from Supabase with category tabs, counts, and loading/empty/error+retry states
  - Home Category Showcase + Curated Essentials featured grid read live data (deterministic featured = first published per category by sort_order)
  - ProductCard + ProductDetail render every price through formatPrice (no raw {product.price})
  - Static client/src/data/products.ts data array removed from the runtime read path (no value consumers)
affects: [admin-portal, accounts-auth, customization-questionnaire, pricing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public read surfaces consume catalog.ts TanStack Query hooks only (never the static data array)"
    - "Loading state = shadcn Skeleton grid mirroring the real grid classes (no layout shift)"
    - "Error state = inline message + Retry button calling refetch() (never a silent empty grid)"
    - "Deterministic featured derivation: categories (sort_order) x products (slug) -> first per category"

key-files:
  created: []
  modified:
    - client/src/components/ProductCard.tsx
    - client/src/components/ProductDetail.tsx
    - client/src/pages/Shop.tsx
    - client/src/components/ProductGrid.tsx
    - client/src/pages/Home.tsx

key-decisions:
  - "Kept the Product/Category type imports from @/data/products (type-only) since Plan 02 adapted that type to price: number|null; only value imports were removed."
  - "Shop combines both queries' isLoading/isError; refetch() retries both products and categories."
  - "Added a global-empty variant ('No products available yet.') distinct from the per-category empty copy (D-07)."
  - "ProductGrid error path is graceful-silent (Home featured is secondary); Shop owns the prominent error+retry (D-06)."

patterns-established:
  - "Skeleton placeholders reuse the exact grid column classes of the content they replace (D-05 no layout shift)"
  - "Featured = (categories sorted by sort_order).map(first product of category).filter(defined) — always up to 3, stable across reloads (D-08)"

requirements-completed: [PUB-01, PUB-02]

# Metrics
duration: 3min
completed: 2026-05-31
---

# Phase 02 Plan 03: Public Read-Path Rewire Summary

**Shop, Home, ProductGrid, ProductCard, and ProductDetail now render the live Supabase catalog via catalog.ts hooks with skeleton/empty/error+retry states, all prices through formatPrice, and the static products.ts data array fully off the runtime path.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-31T12:47:42Z
- **Completed:** 2026-05-31T12:50:20Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments
- Shop reads live published products/categories: tabs, counts, and the all-tab total derive from Supabase; skeleton loading (8 cards, no layout shift), inline error + working Retry, and both per-category and global empty variants.
- Home Category Showcase and the Curated Essentials featured grid read live data; featured selection is deterministic (first published product per category by sort_order, always up to 3 cards) with loading skeletons.
- Every price across ProductCard and ProductDetail renders through `formatPrice(product.price)` — null renders "Price on request" (the seed wrote null for all prices); no raw `{product.price}` remains.
- The static `products`/`getFeaturedProducts`/`getProductsByCategory` exports in `client/src/data/products.ts` have no remaining runtime consumer (ROADMAP success criterion #5). Only type-only imports from that module remain.
- Production build (`npm run build`) succeeds against the live read path; `dist/` confirmed secret-free.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route price + type through Plan 02 contracts in ProductCard + ProductDetail** - `7a024fc` (feat)
2. **Task 2: Rewire Shop.tsx to live data with loading / empty / error+retry states** - `ea739e5` (feat)
3. **Task 3: Rewire Home.tsx + ProductGrid.tsx to live data; static array off runtime path** - `ffbe971` (feat)
4. **Task 4: End-of-phase parity walkthrough (production build + manual UX gate)** - no code changes (verification-only; automated gate green, manual UX walkthrough is the end-of-phase human-verify gate)

## Files Created/Modified
- `client/src/components/ProductCard.tsx` - imports formatPrice; renders `formatPrice(product.price)` at the price line; image src unchanged (resolved URL from mapper).
- `client/src/components/ProductDetail.tsx` - imports formatPrice; price renders through formatPrice; carousel hasMany logic unchanged (single placeholder for scrub/cream keeps arrows/dots hidden).
- `client/src/pages/Shop.tsx` - useProducts()/useCategories(); live tabs/counts/filter; skeleton loading, inline error+Retry, per-category and global empty variants; detail modal + Instagram CTA unchanged.
- `client/src/components/ProductGrid.tsx` - derives featured from useProducts()/useCategories() (first published per category by sort_order); 3-card loading skeleton; replaced getFeaturedProducts().
- `client/src/pages/Home.tsx` - Category Showcase reads useCategories() with loading skeleton; dropped the static `categories` value import; all other sections unchanged.

## Decisions Made
- Type imports from `@/data/products` were intentionally retained as type-only (the `Product`/`Category` types are the adapted shapes from Plan 02). Only the value imports (`products`, `categories`, `getFeaturedProducts`) were removed — this is what takes the static array off the runtime path while keeping the canonical type definitions.
- Shop's `isLoading`/`isError` combine both queries and `refetch()` retries both, so a failure in either products or categories surfaces the same inline error + Retry rather than a partial/broken render.
- ProductGrid (Home featured) handles error/empty gracefully by rendering nothing prominent — the Shop owns the visible error+retry UX (D-06), avoiding duplicate error chrome on the homepage.

## Deviations from Plan
None - plan executed exactly as written. All four tasks completed against the existing Plan 02 contracts with no bugs, missing functionality, or blocking issues requiring auto-fix.

## Issues Encountered
None. `npm run check` was green after each task; `npm run build` succeeded on the live read path; the secret-scan on `dist/` passed.

## User Setup Required
None - no external service configuration required. The live read path uses the existing Supabase anon key + RLS configured in earlier plans.

## Known Stubs
None. All public read surfaces are wired to live Supabase data. Prices render "Price on request" because the seed (Plan 01) intentionally wrote null for every price — the admin sets real prices in Phase 4. This is documented intended behavior (objective + must_haves), not a stub.

## Manual Verification Gate (end-of-phase)
`workflow.human_verify_mode` is `end-of-phase`, so the manual UX walkthrough in Task 4 is the phase's non-blocking human-verify gate. The owner should run `npm run dev`, open http://localhost:3200, and confirm: Home shows 3 category tiles + exactly 3 featured cards; Shop tabs read All (28)/Soaps (13)/Scrubs (10)/Creams (5); soap cards show Storage photos, scrub/cream show placeholders; every price reads "Price on request"; soap detail shows a multi-image carousel while scrub/cream show a single image with no arrows/dots; offline reload shows skeletons then inline error + Retry; deep-link `/shop/soap` resolves to the Soaps tab and unknown categories fall back to All Products; overall parity with the prior static catalog.

## Next Phase Readiness
- The public catalog is fully live from Supabase end to end — the no-redeploy promise is proven on the read path. PUB-01 and PUB-02 are complete.
- Ready for the admin portal (write path), accounts/auth, and the customization questionnaire. Prices remain null until the admin sets them in Phase 4 (expected).

## Self-Check: PASSED

All 5 modified files exist on disk; all 3 task commits (7a024fc, ea739e5, ffbe971) are present in git history.

---
*Phase: 02-live-catalog-data-migration-public-shop-rewire*
*Completed: 2026-05-31*
