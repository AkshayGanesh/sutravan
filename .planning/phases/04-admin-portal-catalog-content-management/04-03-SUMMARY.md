---
phase: 04-admin-portal-catalog-content-management
plan: 03
subsystem: api
tags: [supabase, tanstack-query, storage, react-hooks, crud, cache-invalidation]

# Dependency graph
requires:
  - phase: 04-02
    provides: "lib/slug.ts (slugify), lib/adminErrors.ts (mapWriteError), lib/sanitizeHtml.ts, lib/imagePipeline.ts — the pure write-helper modules"
  - phase: 02-live-catalog-data-migration-public-shop-rewire
    provides: "lib/catalog.ts (toProduct snake->camel boundary, productImageUrls/getPublicUrl), lib/supabase.ts singleton, lib/queryClient.ts (staleTime: Infinity)"
provides:
  - "lib/admin.ts — the single admin WRITE data-layer: product/category/site-content CRUD, Storage image upload/remove, slug-collision handling, TanStack mutation hooks with mandatory ['catalog']/['siteContent'] invalidation"
  - "fromProductForm — symmetric camelCase->snake_case mapper (reverse of catalog.ts toProduct)"
  - "lib/siteContent.ts — public useSiteContent read hook + SITE_CONTENT_DEFAULTS code-default fallbacks (D-20)"
  - "Stable function-signature contract for Wave-3 feature plans (05/06/07/08/09)"
affects: [04-05, 04-06, 04-07, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Symmetric write boundary: fromProductForm mirrors catalog.ts toProduct, mapping camelCase->snake_case ONCE at the data layer"
    - "Mutation + mandatory cache invalidation: every write invalidates ['catalog'] (or ['siteContent']) in onSuccess because staleTime: Infinity disables auto-refetch"
    - "Slug-collision insert: derive slugify(name), retry -2/-3/... on PostgREST 23505 (DB unique constraint is the real guard)"
    - "Distinct admin read path: admin list queries omit .eq('is_active', true) so drafts are visible (RLS is the security gate)"
    - "Public read hook with mandatory code-default fallbacks so chrome never renders empty"

key-files:
  created:
    - "client/src/lib/admin.ts"
    - "client/src/lib/admin.test.ts"
    - "client/src/lib/siteContent.ts"
  modified: []

key-decisions:
  - "fromProductForm coerces blank subtitle/shelfLife/batchNote to null via `|| null` (round-trips through catalog.ts toProduct's `?? ''`)"
  - "Slug-collision handled by an insertProductWithUniqueSlug helper that retries on 23505 with numeric suffixes (cap 50 attempts)"
  - "useDeleteCategory fills the {N} product count by querying products with a HEAD count:exact before throwing the friendly D-15 message"
  - "useSaveSiteContent uses a single .upsert(rows, { onConflict: 'key' }) batch rather than per-key writes"
  - "Round-trip test inlines a minimal toProductCore reader instead of importing catalog.ts (avoids image-asset module side effects under Vitest)"

patterns-established:
  - "Pattern 1: camelCase->snake_case write mapping mirrors the read boundary symmetrically, once"
  - "Pattern 2: every mutation hook invalidates the public cache key in onSuccess + emits a UI-SPEC verbatim toast"
  - "Pattern 5: useSiteContent + SITE_CONTENT_DEFAULTS fallback contract (D-20)"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-08]

# Metrics
duration: 3min
completed: 2026-06-01
---

# Phase 4 Plan 03: Admin Write Data-Layer Summary

**The complete admin write contract (lib/admin.ts): product/category/site-content CRUD, Storage image upload/remove, slug-collision handling, and TanStack mutation hooks that invalidate the public catalog cache so admin edits appear live; plus lib/siteContent.ts with mandatory code-default fallbacks.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-01T05:06:27Z
- **Completed:** 2026-06-01T05:09:xxZ
- **Tasks:** 3
- **Files modified:** 3 (created)

## Accomplishments
- `fromProductForm` symmetric camelCase->snake_case mapper that round-trips through catalog.ts `toProduct` (blank optionals -> null, price preserved as number | null), with a 8-case Vitest suite (TDD).
- Storage helpers `uploadProductImage` (upsert:true replace mechanic, D-08 path convention) and `removeProductImages` (orphan cleanup, Pitfall 2), plus `insertProductWithUniqueSlug` 23505-retry collision handling (D-07/Pitfall 6).
- Eight CRUD hooks (`useAdminProducts`, `useUpsertProduct`, `useDeleteProduct`, `useToggleProductActive`, `useAdminCategories`, `useUpsertCategory`, `useDeleteCategory`, `useSaveSiteContent`) — 7 `invalidateQueries` calls in total; admin list query omits the `is_active` filter so drafts are visible; in-use category delete (23503) surfaces the friendly D-15 message with the live product count; success toasts are verbatim from the UI-SPEC.
- `lib/siteContent.ts` public `useSiteContent` hook + `SITE_CONTENT_DEFAULTS` with all seven keys' current literal values (D-20 mandatory fallback).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing round-trip + path tests** - `4bf3ac8` (test)
2. **Task 1 (GREEN): mapping + Storage core of lib/admin.ts** - `a1e52e3` (feat)
3. **Task 2: admin CRUD query + mutation hooks** - `0a5487a` (feat)
4. **Task 3: public site_content read hook with fallbacks** - `f945d5b` (feat)

_TDD task 1 produced a RED test commit followed by a GREEN implementation commit._

## Files Created/Modified
- `client/src/lib/admin.ts` - Single admin WRITE data-layer: `fromProductForm`, Storage upload/remove, slug-collision insert, and 8 TanStack CRUD hooks with mandatory cache invalidation.
- `client/src/lib/admin.test.ts` - Vitest round-trip + path-builder suite (8 cases) for the pure mapping logic.
- `client/src/lib/siteContent.ts` - Public `useSiteContent` read hook + `SITE_CONTENT_DEFAULTS` seven-key fallbacks.

## Decisions Made
- **Round-trip test isolation:** inlined a minimal `toProductCore` reader in the test instead of importing `catalog.ts`, because `catalog.ts` imports PNG assets that complicate the Vitest module graph; the inlined reader is the exact subset under test.
- **Re-export productImageUrls:** admin thumbnails resolve Storage paths via the same `productImageUrls` from `catalog.ts` (re-exported) rather than reimplementing — never hand-build URLs (Pitfall 3).
- **Edit path drops the slug column:** `useUpsertProduct` strips `slug` from the update payload on edit so a rename never moves the slug (D-07).
- **Batch site_content upsert:** `useSaveSiteContent` writes all key/value pairs in one `.upsert(..., { onConflict: 'key' })` call.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All three tasks passed verification on the first run (`npx vitest run` 24/24 green across the repo; `npm run check` exits 0).

## User Setup Required
None - no external service configuration required. (RLS policies + Storage bucket were provisioned in earlier phases; this plan is client data-layer code only.)

## Next Phase Readiness
- Wave-3 feature plans (04-05 product management, 04-06 categories, 04-07 site content, 04-08 submissions, 04-09 image dropzone) can now import the stable function signatures without exploring the codebase.
- `useSiteContent` + `SITE_CONTENT_DEFAULTS` ready for the D-20 hardcoded-string rewire across Navbar/Footer/Contact/Hero/Our Story.
- No blockers.

## Self-Check: PASSED

- All 3 created files exist on disk.
- All 4 task commits (4bf3ac8, a1e52e3, 0a5487a, f945d5b) present in git history.

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*
