---
phase: 02-live-catalog-data-migration-public-shop-rewire
verified: 2026-05-31T00:00:00Z
status: human_needed
score: 8/10 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Run `npm run dev`, open http://localhost:3200 — confirm Home Category Showcase shows 3 categories with images and Curated Essentials shows exactly 3 featured cards (one per category), stable across reloads"
    expected: "3 category tiles (Soaps/Scrubs/Creams) rendered live; 3 featured product cards, deterministically ordered, without a blank/shift on first load"
    why_human: "Requires a running Supabase connection with seeded data; visual confirmation of images from Storage vs placeholders cannot be grep-verified"
  - test: "Run `npm run dev`, open /shop — verify tabs read 'All Products (28)', 'Soaps (13)', 'Scrubs (10)', 'Creams (5)'; switch tabs; every card price reads 'Price on request'"
    expected: "Tab counts match live DB counts; filtering works; all prices show 'Price on request' (seed set price=null)"
    why_human: "Count correctness depends on the live Supabase project having exactly 28 seeded products; cannot be verified without a live connection"
  - test: "Click a soap product in Shop — verify detail modal shows multiple images with prev/next arrows and dots; click a scrub or cream product — verify single placeholder image with NO arrows/dots; both prices read 'Price on request'"
    expected: "Soap carousel: hasMany=true (multiple Storage URLs), arrows/dots visible. Scrub/cream: hasMany=false (single placeholder), no arrows/dots. Price via formatPrice."
    why_human: "Image carousel behavior (arrows shown/hidden) depends on runtime data returned by Supabase Storage; requires visual inspection"
  - test: "In Shop, use devtools to throttle network to Offline and reload — confirm skeleton cards appear (no layout shift); then inline error message + Retry button appear; restore network, click Retry — products load"
    expected: "Loading state shows 8 skeleton cards matching grid layout; error state shows inline message and Retry button; retry reloads data successfully"
    why_human: "Loading/error/retry is a runtime UX behavior; skeleton visual parity cannot be confirmed without running the app"
  - test: "Deep-link to /shop/soap — verify Soaps tab is active on page load. Deep-link to /shop/unknowncategory — verify All Products tab is active (not broken/blank)"
    expected: "Valid category slug in URL activates correct tab; invalid slug gracefully falls back to All Products"
    why_human: "CR-02 FIXED in commit f368082 — activeCategory now seeds directly from the URL param, and a useEffect drops it only if the param isn't a real category once categories load. Human should confirm the runtime behavior. CR-01 (RLS query-side-only is_active gate) deferred to Phase 4 alongside the draft/visibility toggle (recorded in ROADMAP Phase 4)."
---

# Phase 02: Live Catalog — Data Migration & Public Shop Rewire — Verification Report

**Phase Goal:** The existing catalog lives in Supabase and the public site renders it live — proving the no-redeploy promise and delivering value before any authentication exists.
**Verified:** 2026-05-31
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the seed inserts exactly 28 products (13 soap + 10 scrub + 5 cream) and 3 categories into Supabase | VERIFIED | `catalog-data.ts`: 13 entries with `category: 'soap'`, 10 `'scrub'`, 5 `'cream'` (grep-counted); seed.ts maps all 28 via `productMeta`; SUMMARY 02-01 records "3 categories + 28 products" exit 0 |
| 2 | Re-running the seed yields 28/3 (idempotent upsert on slug, no duplicates) | VERIFIED | `scripts/seed.ts` lines 47+108: two `onConflict: 'slug'` upserts (categories then products); SUMMARY 02-01 records "second consecutive seed + verify still reports 28/3" |
| 3 | Soap images uploaded to product-images bucket; Storage paths recorded on soap rows; scrub/cream seeded with empty images[] | VERIFIED | `seed.ts` uploads via `admin.storage.from('product-images').upload(storagePath, ..., { contentType: 'image/jpeg', upsert: true })` for each .jpg in SLUG_TO_SOAP_FOLDER; `imagePathsBySlug[p.slug] ?? []` handles scrub/cream; SUMMARY 02-01 records "84 soap images" and "all 15 scrub+cream rows carry empty images[]" |
| 4 | Every product price is seeded as null (no placeholder/zero) | VERIFIED | `seed.ts` line 100: `price: null` explicit for every upserted product; grep confirms single match for `price: null` |
| 5 | useProducts() and useCategories() hooks read live Supabase data with loading/error/refetch state | VERIFIED | `client/src/lib/catalog.ts` exports `useProducts` and `useCategories` using `useQuery` with queryKeys `['catalog','products']` and `['catalog','categories']`; `Shop.tsx` destructures `isLoading`, `isError`, `refetch` from both hooks |
| 6 | Products are fetched with a server-side .eq('is_active', true) filter so drafts never reach the client via the application's query path | VERIFIED (partial — see CR-01 analysis) | `catalog.ts` line 77: `.eq('is_active', true)` on the `fetchProducts` query; confirmed by grep. The query-layer filter is present and substantive. However, the RLS policy `products_public_read` uses `using (true)` — any direct PostgREST API call that omits the filter returns all rows including drafts. See CR-01 analysis below. |
| 7 | DB snake_case columns mapped to camelCase Product shape; Storage paths resolve to public URLs; empty images[] yields one placeholder | VERIFIED | `catalog.ts` `toProduct` mapper: `shelf_life` -> `shelfLife`, `batch_note` -> `batchNote`, `category_id` resolved via embedded `categories(slug)` join; `productImageUrls`: empty paths return `[placeholderByCategory[category] ?? soapImg]` (exactly 1 element); non-empty paths use `getPublicUrl(p).data.publicUrl` |
| 8 | formatPrice(null) returns 'Price on request'; formatPrice(250) returns '₹250' | VERIFIED | `format.ts`: `if (price == null) return 'Price on request'; return \`₹${Math.round(price)}\`` — uses `== null` (not falsy) so `formatPrice(0)` correctly returns '₹0' |
| 9 | products.ts no longer uses import.meta.glob; Product.price is number\|null | VERIFIED | `grep -c "import.meta" products.ts` returns 0; `Product` interface declares `price: number \| null`; static products array retained as dead-code scaffold (price: null, placeholder images) for build-green handoff — no runtime consumer |
| 10 | Static products.ts data array removed from runtime read path (no value-imports of products/categories/getFeaturedProducts/getProductsByCategory in components/pages) | VERIFIED | `grep -rn "getFeaturedProducts\|getProductsByCategory"` in `client/src/components` and `client/src/pages` returns NO_RUNTIME_CONSUMERS; `Shop.tsx`, `ProductGrid.tsx`, `Home.tsx` import only type-only constructs from `@/data/products` |

**Score:** 8/10 truths fully verified (truth #6 is partial — query-layer filter verified, RLS-layer filter is not enforced; truth #10 deferred to human UX walkthrough for behavioral parity confirmation)

---

### Deferred Items

No items deferred to later phases — all of this phase's goals are either verified or pending human UX walkthrough.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/data/catalog-data.ts` | Glob-free metadata (28 productMeta, 3 categoryMeta, 13 SLUG_TO_SOAP_FOLDER, BATCH_NOTE) | VERIFIED | Exists; no `import.meta`; 13 soap + 10 scrub + 5 cream entries; 13 SLUG_TO_SOAP_FOLDER keys; exports Category type |
| `scripts/seed.ts` | Idempotent service-role seed with onConflict slug, price null, contentType image/jpeg | VERIFIED | Exists; 2 `onConflict: 'slug'` upserts; `price: null` explicit; `contentType: 'image/jpeg'` on every upload; imports from `catalog-data.ts` not `products.ts` |
| `scripts/verify-seed.ts` | Anon-key verify: 28/3 counts + is_active published-only check | VERIFIED | Exists; asserts `count === 28` and `count === 3`; flips `is_active=false` via service-role, asserts anon `.eq('is_active', true)` returns 0 rows, restores. NOTE: anon product count does NOT filter by `is_active=true` (WR-03 — counts total rows not published rows, acceptable since all 28 are seeded active) |
| `client/src/lib/format.ts` | `formatPrice(price: number \| null): string` | VERIFIED | Exists; named export; `== null` branch; `₹${Math.round(price)}` for set prices |
| `client/src/lib/catalog.ts` | useProducts/useCategories, is_active filter, getPublicUrl, snake->camel mapper | VERIFIED | Exists; all three exports present; `.eq('is_active', true)` on line 77; `getPublicUrl` used for URL resolution; `toProduct`/`toCategory` mappers present |
| `client/src/pages/Shop.tsx` | Live products/categories, category tabs/counts, loading/empty/error+retry states | VERIFIED | Exists; imports `useProducts`, `useCategories` from `@/lib/catalog`; `isLoading`, `isError`, `refetch` wired; Skeleton grid (8 cards); inline error + Retry; both empty variants present |
| `client/src/components/ProductGrid.tsx` | Featured grid from live data (first per category by sort_order), loading skeleton | VERIFIED | Exists; uses `useProducts()`, `useCategories()`; derives featured as `(categories).map(cat => products.find(p => p.category === cat.id)).filter(defined)`; 3-card skeleton on loading |
| `client/src/components/ProductCard.tsx` | formatPrice(product.price) — no raw {product.price} | VERIFIED | Imports `formatPrice` from `@/lib/format`; line 43 renders `{formatPrice(product.price)}`; grep confirms no raw `product.price` render |
| `client/src/components/ProductDetail.tsx` | formatPrice(product.price); carousel hasMany from images.length | VERIFIED | Imports `formatPrice`; line 98 renders `{formatPrice(product.price)}`; `hasMany = images.length > 1` unchanged |
| `client/src/pages/Home.tsx` | useCategories() for Category Showcase; no static categories value import | VERIFIED | Imports `useCategories` from `@/lib/catalog`; no value import of `categories` from `@/data/products`; skeleton on categoriesLoading |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/seed.ts` | `client/src/data/catalog-data.ts` | Node import of glob-free metadata | WIRED | `import { productMeta, categoryMeta, SLUG_TO_SOAP_FOLDER } from '../client/src/data/catalog-data.ts'` |
| `scripts/seed.ts` | product-images bucket | storage upload with contentType + upsert | WIRED | `admin.storage.from('product-images').upload(storagePath, ..., { contentType: 'image/jpeg', upsert: true })` |
| `scripts/seed.ts` | public.products / public.categories | upsert on slug | WIRED | Two `onConflict: 'slug'` upserts confirmed |
| `client/src/lib/catalog.ts` | public.products (Supabase) | supabase.from('products').select(...).eq('is_active', true) | WIRED | Line 77: `.eq('is_active', true)` confirmed by grep |
| `client/src/lib/catalog.ts` | product-images bucket | getPublicUrl on stored paths | WIRED | `supabase.storage.from('product-images').getPublicUrl(p).data.publicUrl` |
| `client/src/lib/catalog.ts` | @tanstack/react-query | useQuery with ['catalog', ...] keys | WIRED | `useQuery({ queryKey: ['catalog', 'products'], ... })` and `['catalog', 'categories']` |
| `client/src/pages/Shop.tsx` | `client/src/lib/catalog.ts` | useProducts() + useCategories() | WIRED | Both hooks imported and destructured with isLoading/isError/refetch |
| `client/src/components/ProductCard.tsx` | `client/src/lib/format.ts` | formatPrice(product.price) | WIRED | Import and usage both confirmed; no raw price render remaining |
| `client/src/pages/Shop.tsx` | shadcn Skeleton | loading-state skeleton grid | WIRED | `import { Skeleton }` and used in loading branch with 8 placeholder cards |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Shop.tsx` | `products` | `useProducts()` -> `fetchProducts()` -> `supabase.from('products').select(...).eq('is_active', true)` | Yes — DB query with embedded category join | FLOWING |
| `Shop.tsx` | `categories` | `useCategories()` -> `fetchCategories()` -> `supabase.from('categories').select(...)` | Yes — DB query ordered by sort_order | FLOWING |
| `ProductGrid.tsx` | `featured` | derived from `useProducts()` + `useCategories()` — `.find()` per category | Yes — depends on live DB data | FLOWING |
| `Home.tsx` | `categories` | `useCategories()` | Yes | FLOWING |
| `ProductCard.tsx` | `product` | passed as prop from Shop/ProductGrid (which read live data) | Yes — prop chain from Supabase query | FLOWING |
| `ProductDetail.tsx` | `product` | passed as prop (selectedProduct state from Shop/ProductGrid) | Yes | FLOWING |

---

### Behavioral Spot-Checks

The phase produces no runnable API endpoints or CLI tools that can be checked without a live Supabase connection and running dev server. Behavioral verification is handled in Human Verification below.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `catalog-data.ts` importable by Node | `node --input-type=module -e "import('./client/src/data/catalog-data.ts')"` | Cannot run without tsx/Node type-strip in this env | SKIP — file structure confirms no `import.meta` |
| `format.ts` contract | inline node assertion | `formatPrice(null)==='Price on request'`, `formatPrice(250)==='₹250'` — logic verified by reading source | VERIFIED by code inspection |
| Static helpers off runtime path | grep across components/pages | NO_RUNTIME_CONSUMERS | PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` files declared or present for Phase 2. The phase's verification relies on `scripts/verify-seed.ts` (a live-connection Node script, not a static probe). That script was reported as PASS in SUMMARY 02-01 but cannot be re-executed here without live credentials.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/verify-seed.ts` | `node --env-file=.env.seed.local scripts/verify-seed.ts` | Not re-runnable without `.env.seed.local` (gitignored secret) | SKIP — SUMMARY 02-01 records "PASS: 28 products / 3 categories; is_active=false row hidden from anon" with confirmed exit 0 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DATA-03 | 02-01-PLAN.md | 28 products + 3 categories seeded via idempotent service-role seed, soap images uploaded | SATISFIED | `catalog-data.ts` (28/3 data); `scripts/seed.ts` (upsert on slug, price null, contentType); SUMMARY 02-01 records seed exit 0 + idempotency confirmed |
| PUB-01 | 02-02-PLAN.md, 02-03-PLAN.md | Public Shop reads live products and categories from Supabase | SATISFIED (pending human UX walkthrough) | `catalog.ts` hooks wired; `Shop.tsx`, `Home.tsx`, `ProductGrid.tsx` consume live hooks; loading/empty/error states implemented; static array off runtime path |
| PUB-02 | 02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md | Only published (is_active=true) products shown | PARTIALLY SATISFIED — see CR-01 analysis | `catalog.ts` `.eq('is_active', true)` filter is query-side; RLS policy `products_public_read` uses `using(true)` so draft rows ARE reachable via direct PostgREST calls without the filter; CLAUDE.md says "Admin-only actions must be enforced server-side via Supabase RLS, not just hidden in the UI" |

---

### CR-01 Analysis: RLS Enforcement Gap for is_active (PUB-02)

**Finding:** The RLS policy `products_public_read` in `supabase/migrations/0002_rls_policies.sql` (Phase 1 artifact, line 28-31) uses `using (true)`, granting anon/authenticated users SELECT access to ALL rows regardless of `is_active`. The `.eq('is_active', true)` filter exists only in `catalog.ts` `fetchProducts()` — the application's own query layer.

**Impact:** Any HTTP client that calls the Supabase PostgREST endpoint directly (`GET /rest/v1/products` with the anon key, no filter) receives all 28 products including any `is_active=false` drafts. The `verify-seed.ts` test confirms that the `.eq('is_active', true)` *query filter* works when applied — it does not prove that RLS independently enforces it.

**CLAUDE.md constraint:** "Admin-only actions must be enforced server-side via Supabase RLS, not just hidden in the UI." The visibility gate (`is_active`) is an admin-controlled attribute that restricts what the public sees — this is precisely the kind of gate the constraint applies to.

**Scope note:** `0002_rls_policies.sql` was committed in Phase 1 (`0505f70 feat(01-02): add RLS-policies migration`). Phase 2 did not modify this file and was not asked to. However, Phase 2's plan explicitly claims "PUB-02 server-side `is_active` filter behavior proven at the data layer" (02-01-PLAN.md objective) and marks PUB-02 as complete. The claim is overstated: the query-layer filter is proven, but server-side RLS enforcement is absent.

**Classification:** WARNING — PUB-02 is partially satisfied. The application's normal read path correctly hides drafts. The invariant fails for direct API consumers. Since `is_active` toggling is not live yet (ADMIN-08 is Phase 4), there are currently no draft rows in production, so the practical impact is zero today. The fix (`using (is_active = true)` in the RLS policy) belongs in a new migration and can be addressed in Phase 4 when ADMIN-08 lands. This is flagged as a WARNING, not a BLOCKER, because:
1. The RLS file is Phase 1, not a Phase 2 deliverable.
2. There are no draft rows currently in production (all 28 seeded active).
3. The application's read path correctly filters; only a deliberate direct API call bypasses it.
4. Phase 4 (ADMIN-08) must address the visibility toggle and should also fix the RLS at that time.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/data/products.ts` | 18-19 | Duplicate import: `BATCH_NOTE` and `Category` are already re-exported (lines 10-16) then re-imported as a separate `import` statement | Warning (WR-02) | Fragile — if catalog-data ever splits, one import silently binds stale value. Not a behavioral defect today. |
| `scripts/verify-seed.ts` | 30-32 | Anon product count does NOT filter by `is_active=true` — counts total rows (28), not published rows | Warning (WR-03) | The assertion documents the wrong invariant: after admin marks a product draft, verify-seed still passes (28 total) even though catalog shows 27. Not a defect at seed time (all 28 seeded active). |
| `client/src/pages/Shop.tsx` | 29-36 | `initialCategory` computed before `categories` loads; `useState(initialCategory)` always initializes to `null` on first render | Critical (CR-02) | Deep-links to `/shop/soap` never activate the Soaps tab — URL routing is silently broken on first load. `useState` captures `null` as permanent initial state; no `useEffect` present to correct post-load. |

**Debt marker scan:** NO `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file. No blocker from debt markers.

**CR-02 stub classification:** `Shop.tsx` is not a stub — it is a fully-wired live component. CR-02 is a behavioral correctness bug in the URL deep-link flow. It does not prevent the basic Shop use case (loading via /shop, clicking tabs), but it breaks the URL parameter feature claimed in Plan 03's must-haves ("ROADMAP success criterion #3: Shop reads live products with correct per-category tabs") when accessed via a typed/linked URL.

---

### Human Verification Required

The phase uses `workflow.human_verify_mode = end-of-phase`. The following items require a running dev server with live Supabase connection to verify:

#### 1. Home Page Category Showcase and Featured Grid

**Test:** Run `npm run dev`, open http://localhost:3200. Observe the "Shop by Category" section and "Curated Essentials" section.
**Expected:** 3 category tiles (Soaps/Scrubs/Creams) each showing their bundled placeholder image, label, and description. Exactly 3 featured product cards below (one per category), stable across page reloads.
**Why human:** Requires live Supabase connection; visual confirmation of image rendering and card count cannot be grep-verified.

#### 2. Shop Tab Counts and Product Rendering

**Test:** Navigate to /shop. Observe the tab bar and product grid.
**Expected:** Tabs show "All Products (28)", "Soaps (13)", "Scrubs (10)", "Creams (5)". Switching tabs filters correctly. Soap cards show real photos from Supabase Storage. Scrub/cream cards show the category placeholder image. Every card price reads "Price on request".
**Why human:** Tab counts depend on live DB; image source (Storage URL vs placeholder) requires visual inspection.

#### 3. Product Detail Modal — Carousel Behavior

**Test:** In Shop, click a soap product. Then click a scrub or cream product.
**Expected:** Soap modal: multiple images, prev/next arrow buttons visible, dot indicators visible (hasMany=true). Scrub/cream modal: single placeholder image, NO arrow buttons, NO dot indicators (hasMany=false, `productImageUrls([], category)` returns exactly 1 element). Both prices show "Price on request".
**Why human:** Carousel visibility is runtime behavior dependent on actual image array length returned by Storage.

#### 4. Loading/Error/Retry States

**Test:** In Chrome DevTools, set network to Offline. Reload /shop. Then observe loading state, then error state. Restore network, click Retry.
**Expected:** Initial load: skeleton cards (8 cards in 4-column grid, no layout shift). After timeout: inline error message "We couldn't load the collection. Please try again." with Retry button. After Retry: products load successfully.
**Why human:** Time-based network behavior; visual parity of skeleton layout cannot be confirmed statically.

#### 5. URL Deep-Link Behavior (CAUTION — CR-02 known bug)

**Test:** Type http://localhost:3200/shop/soap directly into the browser. Observe which tab is active on load.
**Expected per plan:** Soaps tab should be active.
**Actual likely behavior (CR-02):** All Products tab is active because `initialCategory` is computed while `categories` is still `undefined`, so `categories?.some(...)` returns `false` and `useState(null)` captures `null`. No `useEffect` exists to correct this post-load.
**Decision required:** Is this behavior acceptable for the phase gate, or must CR-02 be fixed before the phase is marked complete? If the URL deep-link is a PUB-01 must-have ("correct per-category tabs"), CR-02 is a blocking regression.

---

### Gaps Summary

No hard gaps block the automated verification — all code artifacts exist, are substantive, and are wired. The phase has two active concerns:

**CR-01 (WARNING):** The `products_public_read` RLS policy uses `using(true)`, leaving the `is_active` draft gate enforced only at the query layer, not at the RLS layer as CLAUDE.md requires for admin-controlled access gates. Practical impact is zero today (no draft rows exist), and the fix belongs in Phase 4 when ADMIN-08 (visibility toggle) lands. Flagged as WARNING rather than BLOCKER because the RLS file is Phase 1 scope, there are no current drafts, and the application's normal read path correctly filters.

**CR-02 (WARNING → potential BLOCKER):** Shop.tsx URL deep-links (`/shop/soap`) silently fall back to All Products because `useState(initialCategory)` always captures `null` on first render (categories not yet loaded). No `useEffect` corrects the state post-load. This contradicts Plan 03's must-have "The Shop renders live products and categories from Supabase with correct per-category tabs" and the human-check acceptance criterion for deep-links. If the human verifier confirms this behavior, a decision is needed on whether to fix before marking the phase passed.

The phase status is `human_needed` because the end-of-phase UX walkthrough (Plan 03 Task 4, `workflow.human_verify_mode = end-of-phase`) has not been completed, and CR-02 surfaces a correctness issue that only human testing can confirm and decide on.

---

_Verified: 2026-05-31_
_Verifier: Claude (gsd-verifier)_
