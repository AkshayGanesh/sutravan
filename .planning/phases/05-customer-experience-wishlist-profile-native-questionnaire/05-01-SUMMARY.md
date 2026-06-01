---
phase: 05-customer-experience-wishlist-profile-native-questionnaire
plan: 01
subsystem: ui
tags: [react, tanstack-query, supabase, wishlist, optimistic-ui, rls, wouter]

# Dependency graph
requires:
  - phase: 03-authentication-roles
    provides: "useAuth() session/role context + safeReturnTo() open-redirect sanitizer (Login.tsx)"
  - phase: 04-admin-portal-catalog-content-management
    provides: "catalog.ts read split + productImageUrls; admin.ts mutation/invalidate idiom; mapWriteError; Submissions.tsx state trio; formatPrice; ConfirmDialog/Sonner conventions"
provides:
  - "AuthGuard.tsx — generic customer route guard (shared with Plan 04 Profile)"
  - "lib/wishlist.ts — useWishlist/useWishlistCount/useToggleWishlist + toWishlistItem mapper on a single ['wishlist'] cache"
  - "WishlistButton.tsx — heart toggle reused by ProductCard + ProductDetail"
  - "/wishlist auth-gated saved-products page with optimistic remove"
  - "Navbar heart + live count badge + Wishlist dropdown/mobile entry"
affects: [profile, questionnaire, customer-account, plan-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic TanStack Query mutation: cancel -> snapshot -> setQueryData -> rollback onError -> invalidate onSettled on a single cache key"
    - "slug<->UUID duality: component Product.id is the slug; the wishlists FK is the products UUID, resolved server-side by slug when the cache lacks it"
    - "Derived count selector (useWishlistCount = useWishlist().data?.length) — no separate count query"
    - "Generic AuthGuard mirroring AdminGuard minus the role branch"

key-files:
  created:
    - client/src/auth/AuthGuard.tsx
    - client/src/lib/wishlist.ts
    - client/src/lib/wishlist.test.ts
    - client/src/components/WishlistButton.tsx
    - client/src/pages/Wishlist.tsx
  modified:
    - client/src/components/ProductCard.tsx
    - client/src/components/ProductDetail.tsx
    - client/src/components/Navbar.tsx
    - client/src/App.tsx

key-decisions:
  - "Single ['wishlist'] cache shared by card, modal, /wishlist page and navbar badge keeps every surface in sync (D-13)"
  - "Card only knows the slug; useToggleWishlist resolves the products UUID server-side via products.select('id').eq('slug') for insert and for un-cached delete"
  - "Navbar count derived from the shared cache (no separate count query, D-12)"

patterns-established:
  - "Optimistic toggle: onMutate cancel/snapshot/setQueryData, onError rollback+toast(mapWriteError), onSettled invalidate (the reconciliation point under staleTime: Infinity)"
  - "WishlistButton stopPropagation()+preventDefault() FIRST so a card heart never opens the detail modal (D-09/Pitfall 7)"

requirements-completed: [CUST-01, CUST-02]

# Metrics
duration: ~18min
completed: 2026-06-01
---

# Phase 05 Plan 01: Wishlist Vertical Slice Summary

**End-to-end wishlist: save/remove from card, detail modal, /wishlist page and a live navbar badge — all kept in sync through one optimistic `['wishlist']` TanStack Query cache, with a logged-out tap routed to sign-in via the audited `safeReturnTo`.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments
- `AuthGuard` — generic customer route guard (loading spinner → logged-out `/login?next=` → children), reusable by Plan 04's `/profile`.
- `lib/wishlist.ts` — read hook, derived count selector, and an optimistic save/remove mutation on a single `['wishlist']` key (cancel → snapshot → rollback → invalidate), plus a pure unit-tested `toWishlistItem` mapper.
- `WishlistButton` wired onto both `ProductCard` (never opens the modal) and `ProductDetail` (shares the same cache).
- `/wishlist` auth-gated saved-products grid with loading/error/empty/populated states and instant optimistic remove (no confirm dialog).
- Navbar heart + live count badge (hidden at 0) + Wishlist dropdown and mobile-sheet entries.

## Task Commits

Each task was committed atomically:

1. **Task 1: AuthGuard + wishlist data layer (+ unit tests)** - `108a789` (feat)
2. **Task 2: WishlistButton + heart wiring on ProductCard/ProductDetail** - `5f9a9cd` (feat)
3. **Task 3: /wishlist page + Navbar heart/badge/dropdown + route** - `24c0041` (feat)

_TDD note: Task 1 (`tdd="true"`) used a single feat commit containing both the unit test and the implementation — the test was authored and run green within the same task; no separate red commit was created._

## Files Created/Modified
- `client/src/auth/AuthGuard.tsx` - Customer route guard (spinner/redirect/children, no role gate).
- `client/src/lib/wishlist.ts` - useWishlist/useWishlistCount/useToggleWishlist + toWishlistItem; optimistic toggle + slug→UUID resolution.
- `client/src/lib/wishlist.test.ts` - Vitest tests for the snake→camel mapping (productId/slug/subtitle/price/placeholder cases).
- `client/src/components/WishlistButton.tsx` - Shared heart toggle (44px hit area, stopPropagation, logged-out sign-in path).
- `client/src/pages/Wishlist.tsx` - Auth-gated saved-products grid with the state trio + instant remove.
- `client/src/components/ProductCard.tsx` - Heart absolutely positioned over the image.
- `client/src/components/ProductDetail.tsx` - Heart by the name/price block.
- `client/src/components/Navbar.tsx` - Heart link + count badge + Wishlist dropdown/mobile entries.
- `client/src/App.tsx` - `/wishlist` route wrapped in AuthGuard (own Layout).

## Decisions Made
- Optimistic append uses a minimal stub (`{ productId, slug }` + empty fields) reconciled by the `onSettled` invalidate — the navbar reads `.length` and the card derives `saved` by slug, so the stub never renders incomplete product data. This is the RESEARCH Pattern 3 idiom, not a placeholder.
- The card passes only `productSlug` (it has no UUID); the mutation resolves the UUID server-side. Documented in the `wishlist.ts` header.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None that affect rendering. The optimistic-append stub in `useToggleWishlist.onMutate` (empty `name`/`images`/`price`) is an intentional, transient value reconciled by the `onSettled` `invalidateQueries` (RESEARCH Pattern 3); no UI surface renders those fields from the stub (navbar reads `.length`; card/modal derive `saved` from `slug`). Not a data stub.

## Issues Encountered
- Concern that the vitest `node` environment might fail on the transitive `.png` import (`wishlist.ts` → `catalog.ts` → bundled product images). Verified Vite's transform resolves asset imports to URL strings under vitest, so the mapping test passes without inlining — no workaround needed.

## User Setup Required
None - no external service configuration required. The slice runs against the existing `wishlists` table and its owner-scoped RLS (`wishlists_owner_{read,insert,delete}`, migration 0002); no schema change this slice.

## Next Phase Readiness
- `AuthGuard` is ready for Plan 04's `/profile` route (same import path, no role gate).
- The `['wishlist']` cache + `useWishlistCount` are the shared contract for any future wishlist surface.
- Manual live verification (two customers, RLS owner-scoping, logged-out redirect) is deferred to the phase gate per the plan's verification section.

## Self-Check: PASSED

- Created files exist: AuthGuard.tsx, wishlist.ts, wishlist.test.ts, WishlistButton.tsx, Wishlist.tsx — all FOUND.
- Commits exist: 108a789, 5f9a9cd, 24c0041 — all FOUND in git log.
- `npm run check` (tsc strict) exits 0; `npm run build` succeeds; full vitest suite green (29 passing).

---
*Phase: 05-customer-experience-wishlist-profile-native-questionnaire*
*Completed: 2026-06-01*
