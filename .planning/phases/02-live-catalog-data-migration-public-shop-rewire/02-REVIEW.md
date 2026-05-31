---
phase: 02-live-catalog-data-migration-public-shop-rewire
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - client/src/components/ProductCard.tsx
  - client/src/components/ProductDetail.tsx
  - client/src/components/ProductGrid.tsx
  - client/src/data/catalog-data.ts
  - client/src/data/products.ts
  - client/src/lib/catalog.ts
  - client/src/lib/format.ts
  - client/src/pages/Home.tsx
  - client/src/pages/Shop.tsx
  - scripts/seed.ts
  - scripts/verify-seed.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase migrates from static product data to a live Supabase backend with a read
layer (`catalog.ts`), seeds the 28-product catalog (`scripts/seed.ts`), and rewires
the public shop components. The overall architecture is sound — the `catalog.ts`
read layer is clean, the supabase client is correctly scoped to env vars, and RLS is
enabled on all tables.

Two blockers were found:

1. The `is_active` draft/published filter is NOT enforced in the RLS policy — it is
   enforced only in the client query in `catalog.ts`. Any actor who can call the
   Supabase API directly (PostgREST, curl, a custom client) gets all products,
   including drafts. The policy says `using (true)`.

2. In `Shop.tsx` the initial category state is computed before categories have loaded
   from Supabase, so URL-driven deep links (e.g. `/shop/soap`) always resolve to
   `null` on first render and the filter silently breaks.

---

## Critical Issues

### CR-01: RLS does not enforce `is_active` — draft products are publicly accessible via direct API calls

**File:** `supabase/migrations/0002_rls_policies.sql:28-31`
**Issue:** The `products_public_read` policy uses `using (true)`, which allows anon
and authenticated users to SELECT every row regardless of `is_active`. The
`is_active=true` filter only exists in `catalog.ts` line 77 as a PostgREST query
parameter. Any direct HTTP call to the PostgREST endpoint that omits that filter
(e.g. `GET /rest/v1/products`) returns draft products. The CLAUDE.md security
constraint states: "Admin-only actions must be enforced server-side via Supabase
RLS, not just hidden in the UI." The draft/published gate is exactly such an
admin-controlled action.

`verify-seed.ts` lines 80-84 appear to test this, but the test relies on the anon
client adding `.eq('is_active', true)` in the assertion query — it proves that
filter works, not that RLS enforces it independently.

**Fix:** Change the RLS `using` expression to include the `is_active` check so the
filter is server-enforced:
```sql
-- In 0002_rls_policies.sql, replace:
create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (true);

-- With:
create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (is_active = true);
```
The `catalog.ts` `.eq('is_active', true)` can be kept as a belt-and-suspenders
redundancy, but the policy is the authoritative enforcement point.

---

### CR-02: `initialCategory` in Shop.tsx is computed before `categories` has loaded — URL deep links are silently broken

**File:** `client/src/pages/Shop.tsx:29-36`
**Issue:** `initialCategory` is evaluated inline during the very first render, at
which point `categories` is still `undefined` (the query is loading). The
`categories?.some(...)` call returns `false` (no match against undefined), so
`initialCategory` is always `null` on first render. `useState(initialCategory)`
captures that `null` as the permanent initial state — subsequent renders where
`categories` becomes populated never re-run `useState`. The result: visiting
`/shop/soap` directly renders with `activeCategory === null` (All Products tab
active), silently ignoring the URL segment. This is an incorrect behavior bug, not
a style issue.

```tsx
// Current — always null on first render because categories is undefined:
const initialCategory =
  params.category && categories?.some((c) => c.id === params.category)
    ? (params.category as Category)
    : null;

const [activeCategory, setActiveCategory] = useState<Category | null>(
  initialCategory   // always null; useState ignores later changes
);
```

**Fix:** Derive the active category from the URL param directly and validate it once
categories have loaded using a `useEffect`:
```tsx
// Simpler: trust the URL param directly; validate post-load via effect
const [activeCategory, setActiveCategory] = useState<Category | null>(
  params.category ? (params.category as Category) : null
);

// When categories finish loading, drop the active filter if it is no longer valid
useEffect(() => {
  if (categories && activeCategory && !categories.some((c) => c.id === activeCategory)) {
    setActiveCategory(null);
  }
}, [categories]); // eslint-disable-line react-hooks/exhaustive-deps
```

---

## Warnings

### WR-01: `ProductCard` renders `product.images[0]` without guarding against an empty `images` array — throws on missing images

**File:** `client/src/components/ProductCard.tsx:22`
**Issue:** `product.images[0]` is evaluated without a length check. `catalog.ts`
`productImageUrls` guarantees at least one element (falling back to a placeholder
for empty paths), but `products.ts` static fallback data also has `images: [soapImg]`
everywhere. However the `Product` type at `products.ts:32` declares `images:
string[]` — an empty array is type-valid. If any future code path produces a product
with `images: []`, the `<img src={undefined}>` renders a broken image silently.
`ProductDetail` has the same exposure at line 44 (`images[activeIndex]`).

**Fix:** Guard both access points:
```tsx
// ProductCard.tsx line 22
src={product.images[0] ?? ''}
// or a named placeholder constant

// ProductDetail.tsx line 44 — already safe for activeIndex because
// productImageUrls guarantees length >= 1, but defensive guard is cheap:
src={images[activeIndex] ?? images[0] ?? ''}
```

---

### WR-02: `products.ts` re-imports `BATCH_NOTE` and `Category` that it already re-exports — duplicate import causes type confusion risk

**File:** `client/src/data/products.ts:11-19`
**Issue:** Lines 11-16 re-export `BATCH_NOTE`, `categoryMeta`, `productMeta`,
`SLUG_TO_SOAP_FOLDER`, `Category`, `ProductMeta`, and `CategoryMeta` from
`catalog-data`. Then lines 18-19 import `BATCH_NOTE` and `Category` again as a
separate `import` statement. This creates two bindings for the same value. While
JavaScript resolves them to the same module export, the pattern is fragile: if
`catalog-data` ever diverges into two modules, one import will silently bind to a
stale value. TypeScript strict mode does not flag re-exporting then re-importing the
same name.

**Fix:** Remove the redundant second import block (lines 18-19). The values are
already available from the re-export chain:
```ts
// Remove these two lines (products.ts:18-19):
import { BATCH_NOTE } from './catalog-data';
import type { Category } from './catalog-data';

// They are already covered by the re-export block above (lines 10-16).
```

---

### WR-03: `verify-seed.ts` anon product count query does not filter by `is_active=true` — test conflates total count with published count

**File:** `scripts/verify-seed.ts:30-32`
**Issue:** The `productCount` assertion (line 37) checks that there are 28 products
in the table without applying `.eq('is_active', true)`. The seed sets all 28
products to `is_active` defaulting to `true`, so the test passes. But the assertion
documents the wrong invariant: the live read layer (`catalog.ts`) queries
`is_active=true`, not the total row count. If a future admin marks a product as
draft, the catalog shows 27 products but `verify-seed.ts` still passes (28 total
rows). The test should verify the published count, not the total count, to be useful
for regression testing.

**Fix:**
```ts
// verify-seed.ts: add .eq('is_active', true) to the product count query
const { count: productCount, error: prodErr } = await supabase
  .from('products')
  .select('slug', { count: 'exact', head: true })
  .eq('is_active', true);
```

---

## Info

### IN-01: `products.ts` — entire `products` array and `getProductsByCategory` / `getProductById` / `getFeaturedProducts` helpers are dead code after the Supabase rewire

**File:** `client/src/data/products.ts:69-718`
**Issue:** The file comment (lines 63-67) explicitly documents this as a "Temporary
static array — kept ONLY to keep the build green". However the components that would
consume these helpers (`ProductGrid`, `Shop`, `Home`) now all use `useProducts()` /
`useCategories()` from `catalog.ts`. None of the three exported functions
(`getProductsByCategory`, `getProductById`, `getFeaturedProducts`) or the `products`
array are imported anywhere in the client. The `categories` export is also unused.
This is ~650 lines of dead code that will cause confusion in future work and inflates
bundle size (three bundled image imports remain live because `catalog.ts` also
imports them — but the array and functions themselves are dead).

**Fix:** Delete `products`, `categories` (the static array), and the three helper
functions once Plan 03 is confirmed complete. The comment already marks the removal
point; this is a reminder to execute it.

---

### IN-02: `ProductDetail` uses array index as React list key for both benefits and ingredients

**File:** `client/src/components/ProductDetail.tsx:109,140`
**Issue:** `key={i}` (index-based) is used for the benefits list (line 109) and the
ingredients list (line 140). Since these lists are derived from static product data
and are never reordered, this is not a correctness bug today. It is a known React
anti-pattern that will cause subtle rendering bugs if the lists become sortable or
filterable in a future phase.

**Fix:** Use a stable string key derived from the item content:
```tsx
// benefits
key={`benefit-${i}-${b.slice(0, 12)}`}
// ingredients
key={`ingredient-${i}-${ing.slice(0, 12)}`}
```

---

### IN-03: `supabase.ts` throws at module load time if env vars are missing — breaks build preview and CI

**File:** `client/src/lib/supabase.ts:9-11`
**Issue:** The `throw new Error(...)` at module evaluation time will crash the Vite
dev server and any build preview if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`
are missing from the environment (e.g. a CI environment that builds for a different
target, or a developer who hasn't yet created `.env.local`). Module-level throws are
opaque — the error appears as a blank white screen with no actionable message in the
browser.

**Fix:** Return a no-op client or degrade gracefully. For a CI/build scenario, the
throw is acceptable if Vite strips this module via tree-shaking, but it should log a
console warning rather than crashing at import time if the environment might
legitimately be absent:
```ts
if (!url || !anonKey) {
  // Degrade at runtime, not at module load — prevents CI build crashes
  console.warn('Supabase env vars not set. Catalog features will be unavailable.');
}
export const supabase = createClient(url ?? '', anonKey ?? '');
```

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
