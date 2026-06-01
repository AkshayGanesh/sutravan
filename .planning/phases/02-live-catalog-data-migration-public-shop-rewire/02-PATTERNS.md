# Phase 2: Live Catalog — Data Migration & Public Shop Rewire - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 10 (3 new, 7 modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `scripts/seed.ts` | NEW | script (service-role migration) | batch / file-I/O + DB write | `scripts/verify-skeleton.ts` | role-match (read→write) |
| `scripts/verify-seed.ts` | NEW | script (verification) | request-response (count assert) | `scripts/verify-skeleton.ts` | exact |
| `client/src/data/catalog-data.ts` | NEW | data module (glob-free metadata) | static data | `client/src/data/products.ts` | exact (refactor source) |
| `client/src/data/products.ts` | MOD | data module | static data → split | self (remove glob image loading) | self |
| `client/src/lib/catalog.ts` | NEW | service / read layer + hooks | request-response (CRUD-read) | `client/src/lib/supabase.ts` + `queryClient.ts` | role-match |
| `client/src/lib/format.ts` (or co-located) | NEW | utility | transform (pure) | `client/src/lib/utils.ts` (`cn`) | role-match |
| `client/src/pages/Shop.tsx` | MOD | page | request-response (consume query) | self + (no existing useQuery yet) | self |
| `client/src/pages/Home.tsx` | MOD | page | request-response | self | self |
| `client/src/components/ProductGrid.tsx` | MOD | component | request-response | self | self |
| `client/src/components/ProductCard.tsx` | MOD | component (presentational) | props-render | self | self |
| `client/src/components/ProductDetail.tsx` | MOD | component (presentational) | props-render | self | self |

**Note:** No `useQuery`-consuming component exists yet in the codebase (`QueryClientProvider` is wired in `App.tsx` but unused). This phase introduces the first read-layer consumer; the analog for query mechanics is the RESEARCH.md patterns + the retained `queryClient.ts` defaults.

## Pattern Assignments

### `scripts/seed.ts` (NEW — service-role migration script, batch + file-I/O)

**Analog:** `scripts/verify-skeleton.ts` (the only existing `scripts/*.ts`; same runner, same client-construction idiom).

**Imports + env-guard + client pattern** — copy structure from `scripts/verify-skeleton.ts:16-26`, swap anon→service-role:
```typescript
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;                       // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;   // non-VITE_, never committed
if (!url || !serviceKey) {
  console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
```

**main()/catch wrapper** — copy the exit-code idiom verbatim from `verify-skeleton.ts:28-46` (`process.exit(0)` on success, `process.exit(1)` + message on error, `main().catch(...)` at bottom). Run with `node --env-file=.env.seed.local scripts/seed.ts` (no tsx, no dotenv — native Node 22).

**Metadata source** — import from the NEW glob-free `client/src/data/catalog-data.ts` (do NOT import `products.ts`; its `import.meta.glob` at line 5 crashes outside Vite — see RESEARCH Pitfall 2).

**Image walk + upload** — `node:fs`/`node:path` over `client/src/assets/images/products/Soap/<Folder>/` (verified folders: `AloeVera`, `Charcoal`, `Coffee`, `Fuller_s Earth`, `Lemon`, `Milk`, `Neem`, `Oats`, `Orange`, `Rice`, ...). Map slug→folder via the `SLUG_TO_SOAP_FOLDER` table (RESEARCH Pattern 1). Upload with `{ contentType: 'image/jpeg', upsert: true }` (RESEARCH Pattern 3 — contentType is mandatory, see Pitfall 4).

**Upsert** — categories first then products, `.upsert(rows, { onConflict: 'slug' })`, `price: null`, scrub/cream `images: []` (RESEARCH Pattern 4). Derive `slug` from existing `id` verbatim (`soap-neem`, `scrub-neem` — globally unique).

---

### `scripts/verify-seed.ts` (NEW — verification script, request-response)

**Analog:** `scripts/verify-skeleton.ts` — EXACT match. Copy the entire file structure (anon client construction, `main()`/`process.exit` idiom, `.catch` tail).

**Difference:** assert counts instead of presence. Use anon key (proves public read), select `products` and `categories`, assert 28 products / 3 categories. Optionally flip one row `is_active=false` (service-role) and assert it's absent from an anon select (covers PUB-02). Pattern: same `if (error) { ...exit(1) }`; add `if (data.length !== 28) { ...exit(1) }`.

---

### `client/src/data/catalog-data.ts` (NEW — glob-free metadata)

**Analog:** `client/src/data/products.ts` — this is a refactor-extraction of it.

Extract the 28 product objects from `products.ts:64-696` MINUS the `images: getSoapImages(...)`/`images: [scrubImg]` field, plus the `SLUG_TO_SOAP_FOLDER` mapping and `BATCH_NOTE` constant (`products.ts:62`). Keep `Category` type (`products.ts:18`). Must contain NO `import.meta.*` so both Node (seed) and Vite can import it. The categories array (`products.ts:41-60`) metadata (slug/label/description/sort_order) also belongs here for the seed.

---

### `client/src/data/products.ts` (MODIFIED — remove glob)

**Self-refactor.** Remove `import.meta.glob` block (lines 5-16) and the runtime image bundling. Re-export types/metadata from `catalog-data.ts`. Per RESEARCH Runtime State Inventory: keep type exports until migration verified, then the static array becomes dead code (success criterion #5). The `price: string` field in the `Product` interface (`products.ts:25`) must change to `price: number | null` (Pitfall 5).

---

### `client/src/lib/catalog.ts` (NEW — read layer + hooks)

**Analog:** `client/src/lib/supabase.ts` (the singleton it imports) + `client/src/lib/queryClient.ts` (the retained defaults: `retry:false`, `staleTime:Infinity` — so `refetch()` powers the Retry button).

**Imports** (mirror supabase.ts style — relative `./supabase`):
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
```

**Query + server-side published filter** (RESEARCH Pattern 5):
```typescript
async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('slug, name, subtitle, price, benefits, ingredients, tips, shelf_life, batch_note, images, categories(slug, label, sort_order)')
    .eq('is_active', true)                 // PUB-02 — never client-side hide
    .order('slug', { ascending: true });   // D-08 deterministic featured
  if (error) throw error;                  // surfaces to useQuery isError
  return (data ?? []).map(toProduct);
}
export function useProducts() {
  return useQuery({ queryKey: ['catalog', 'products'], queryFn: fetchProducts });
}
```
- Error-handling convention matches the existing `queryClient.ts` model (each query supplies its own `queryFn`; throw-on-error surfaces via `isError`). This mirrors the throw-on-non-2xx idiom CLAUDE.md documents for `apiRequest`.

**snake_case → camelCase mapper** (RESEARCH Pattern 6) — maps to the existing component-facing `Product` shape (`products.ts:20-32`): `shelf_life`→`shelfLife`, `batch_note`→`batchNote`, embedded `categories.slug`→`category`, `id: row.slug`. Route `images` through `productImageUrls`.

---

### `client/src/lib/format.ts` + image helper (NEW — utilities)

**Analog:** `client/src/lib/utils.ts` (`cn` — the established place for tiny pure helpers; named export, camelCase).

**`formatPrice` (D-01/D-02), single source of truth:**
```typescript
export function formatPrice(price: number | null): string {
  if (price == null) return 'Price on request';
  return `₹${Math.round(price)}`;   // INR symbol, no decimals
}
```

**`productImageUrls` path→URL + placeholder (D-03/D-04)** — uses `getPublicUrl` (synchronous), falls back to the bundled category placeholders already imported in `products.ts:1-3`:
```typescript
import soapImg from '@/assets/images/product-soap.png';
import scrubImg from '@/assets/images/product-scrub.png';
import creamImg from '@/assets/images/product-cream.png';
const placeholder: Record<string,string> = { soap: soapImg, scrub: scrubImg, cream: creamImg };
export function productImageUrls(paths: string[], category: string): string[] {
  if (!paths.length) return [placeholder[category] ?? soapImg];        // D-03 — exactly one → hasMany stays false
  return paths.map(p => supabase.storage.from('product-images').getPublicUrl(p).data.publicUrl);
}
```
(Image helper imports `supabase` so likely co-located in `catalog.ts`, not `format.ts` — planner discretion. `formatPrice` stays import-free in `format.ts`.)

---

### `client/src/pages/Shop.tsx` (MODIFIED — page)

**Self-rewire.** Replace static imports (`products.ts:6-11`) with `useProducts()`/`useCategories()` from `catalog.ts`.

- **Filter** (line 29-31) — filter the live `products` array client-side by `activeCategory` (data already published-filtered server-side).
- **Counts** (lines 42-43, 70, 82) — derive from live data.
- **Empty state** (lines 98-102) — KEEP this exact pattern: `<p className="text-center text-foreground/50 py-16">No products found in this category.</p>` (D-07 reuse). Add a globally-empty variant.
- **Loading** — insert skeleton grid mirroring the grid at line 88 (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8`) — D-05 no layout shift.
- **Error** — inline message + Retry calling `refetch()` (D-06).

---

### `client/src/pages/Home.tsx` (MODIFIED — page)

**Self-rewire.** Replace `import { categories } from "@/data/products"` (line 5) with `useCategories()`. The Category Showcase maps `categories` (lines 54-61) — needs `label`, `description`, `image`. NOTE: live categories have no bundled `image`; map category slug → the bundled placeholder (`product-{soap,scrub,cream}.png`) for the showcase tiles, OR keep showcase imagery from a small static map (planner discretion — these are decorative category banners, not product photos).

---

### `client/src/components/ProductGrid.tsx` (MODIFIED — component)

**Self-rewire.** Replace `getFeaturedProducts()` (line 8) with featured-derivation (RESEARCH Pattern 8) over `useProducts()` data: first published product per category sorted by `sort_order` (D-08), always 3 cards. Grid at line 24 (`md:grid-cols-2 lg:grid-cols-3`) is the skeleton template for loading state here.

---

### `client/src/components/ProductCard.tsx` (MODIFIED — presentational)

**Self-edit, minimal.** Change type import from `@/data/products` to the adapted `Product` type. Line 21 `product.images[0]` stays (helper already resolved to URLs). **Line 42** — replace raw `{product.price}` with `{formatPrice(product.price)}` (Pitfall 5).

---

### `client/src/components/ProductDetail.tsx` (MODIFIED — presentational)

**Self-edit, minimal.** Carousel reads `product.images` (line 30); `hasMany = images.length > 1` (line 31) — empty→one placeholder keeps `hasMany` false so arrows/dots correctly hide (D-03, no logic change). **Lines 96-98** — replace `{product.price}` with `{formatPrice(product.price)}`.

## Shared Patterns

### Service-role / anon Supabase client construction
**Source:** `scripts/verify-skeleton.ts:16-26` (env-or-exit guard); `client/src/lib/supabase.ts:1-13` (env-or-throw singleton)
**Apply to:** `scripts/seed.ts`, `scripts/verify-seed.ts` (non-VITE_ `process.env`, `process.exit` on missing); `catalog.ts` reuses the existing `supabase` singleton (do NOT re-create a client in the browser).

### TanStack Query defaults (retry / refetch for the Retry button)
**Source:** `client/src/lib/queryClient.ts:4-16` — `retry:false`, `refetchOnWindowFocus:false`, `staleTime:Infinity`
**Apply to:** All `useQuery` hooks in `catalog.ts`. `refetch()` from each hook powers the D-06 Retry button. Do not override these defaults.

### Price formatting (single source of truth)
**Source:** NEW `formatPrice()` in `client/src/lib/format.ts`
**Apply to:** Every price render — `ProductCard.tsx:42`, `ProductDetail.tsx:96-98`. Never render `{product.price}` raw.

### Pure utility convention
**Source:** `client/src/lib/utils.ts` — named export, camelCase, tiny, import-light
**Apply to:** `format.ts`, image-URL helper.

### shadcn Skeleton (loading state)
**Source:** `client/src/components/ui/skeleton.tsx` (VERIFIED present — `<Skeleton className="..." />`, accepts className via `cn`)
**Apply to:** Loading states in `Shop.tsx`, `ProductGrid.tsx`. Mirror each surface's grid columns to avoid layout shift (D-05). Do NOT re-add the component.

### Empty-state copy pattern
**Source:** `client/src/pages/Shop.tsx:98-102`
**Apply to:** per-category and global empty states (D-07).

## No Analog Found

None. Every file maps to an existing analog or is a self-rewire of an existing file. The closest gap: no existing component consumes `useQuery` yet, so the loading/error/retry component patterns come from RESEARCH.md Pattern 9 (grounded in the retained `queryClient.ts` defaults) rather than a live in-repo example.

## Metadata

**Analog search scope:** `scripts/`, `client/src/lib/`, `client/src/data/`, `client/src/pages/`, `client/src/components/`, `client/src/components/ui/`
**Files scanned:** verify-skeleton.ts, products.ts, supabase.ts, queryClient.ts, utils.ts, skeleton.tsx, ProductCard.tsx, ProductDetail.tsx, ProductGrid.tsx, Shop.tsx, Home.tsx
**Pattern extraction date:** 2026-05-31
</content>
</invoke>
