# Phase 2: Live Catalog — Data Migration & Public Shop Rewire - Research

**Researched:** 2026-05-31
**Domain:** Supabase-direct data seeding (Storage + Postgres) + React/TanStack Query read-path rewire
**Confidence:** HIGH

## Summary

This phase has two coupled, thin vertical slices: a one-time local **seed** that pushes the existing catalog into Supabase (Postgres rows + soap images in Storage), and a **public read-path rewire** so Shop / Home / ProductDetail render live Supabase data instead of the static `client/src/data/products.ts`. The Phase 1 foundation is fully in place and verified live: the `products`/`categories` tables, public-read RLS, and the public-read `product-images` bucket all exist and match the shapes this phase needs. The only external dependency, `@supabase/supabase-js@2.106.2`, is already installed and passes slopcheck `[OK]`.

The single most important correction to the inherited brief: the static file contains **28 products (13 soap + 10 scrub + 5 cream)**, not 68. Every CONTEXT/ROADMAP mention of "68 products" is wrong — `[VERIFIED: grep client/src/data/products.ts]`. The seed and parity checks must target 28. Idempotency means re-running yields **28 rows**, not 68.

The second most important finding: the seed **cannot import `client/src/data/products.ts` directly** in a plain Node/tsx context, because that file uses Vite's `import.meta.glob` (line 5) to load soap images — a transform that only exists inside Vite's build. The seed must instead (a) read product metadata from the array and (b) walk the soap image directory itself with `fs`/`node:fs`. The cleanest path is to **split the product metadata out of the glob** so both Vite and Node can import it — see Pattern 1. Good news on the runner: **Node 22.22.3 strips TypeScript types natively (unflagged since 22.18) and supports `--env-file`** — so the seed runs as `node --env-file=.env.seed.local scripts/seed.ts` with **no `tsx` and no `dotenv` install** `[VERIFIED: node scripts/verify-skeleton.ts ran natively, exit 0]`.

**Primary recommendation:** Seed = a `node --env-file` TypeScript script under `scripts/` using a service-role client; refactor `products.ts` to export a Vite-independent metadata array the seed imports, walk soap images from disk, upload with explicit `contentType` + `upsert:true`, upsert rows on `slug`. Read path = a small `client/src/lib/catalog.ts` data layer + `useQuery` hooks that map snake_case→camelCase, filter `is_active`, and resolve Storage paths to public URLs via `getPublicUrl`. Keep the component-facing `Product` shape compatible to avoid any UX regression.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Missing-Price Display):** When `products.price` is **null**, the public site shows **"Price on request"** (not blank/dash/hidden). Applies everywhere price renders — `ProductCard` (line 42) and `ProductDetail` (lines 96-98).
- **D-02 (Set-price formatting):** When a price is set, format as **INR symbol, no decimals** — e.g. `₹250` (drop trailing `.00`). Price stored as `numeric(10,2)` rupees; formatting is display-only. A single shared formatter `formatPrice(price): "₹250" | "Price on request"` must be the source of truth for every component.
- **D-03 (Imageless products):** Products with empty `images[]` render the **existing generic category placeholder asset** (`client/src/assets/images/product-scrub.png`, `product-cream.png`, `product-soap.png`) rather than being hidden / "coming soon". Products stay **visible**. Applies to `ProductCard` (`images[0]`, line 21) and `ProductDetail` (carousel lines 30-34 — with one placeholder image `hasMany` is false so arrows/dots correctly don't render).
- **D-04 (Soap images are Storage paths):** Soap products have images stored as **Storage paths** (not URLs). Components resolve path→public URL via the Supabase Storage public-URL API (`product-images` is public-read per Phase 1 D-09). A shared helper (e.g. `productImageUrls(images, category)`) maps stored paths→public URLs and substitutes the category placeholder when empty. Exact helper shape is planner discretion.
- **D-05 (Loading):** Loading → **skeleton product cards** in the same grid layout (no layout shift). Reuse shadcn `Skeleton` (`client/src/components/ui/skeleton.tsx` — VERIFIED present).
- **D-06 (Error):** Supabase fetch fails → **inline friendly message + Retry button** that refetches (TanStack Query `refetch`). Keep user on-page; do not silently show an empty grid.
- **D-07 (Empty):** Reuse/extend Shop's existing "No products found in this category." pattern (`Shop.tsx:98-102`) for the per-category empty case, plus a friendly equivalent for a globally-empty catalog. Wording is planner discretion.
- **D-08 (Featured logic):** Home `ProductGrid` shows the **first published product per category** (soap/scrub/cream), chosen deterministically by `categories.sort_order` then a stable product order. Preserves today's `getFeaturedProducts()` behavior, always renders 3 cards, no schema change. Admin "featured" flag is deferred.
- **D-09 (Seed price):** The seed writes **null** for every product price (blank, not a placeholder/zero). Null is valid (Phase 1 D-02) and renders as "Price on request" (D-01).

### Claude's Discretion
- **Seed mechanics:** language/runner (e.g. a `tsx` script under `scripts/` or `supabase/`), how it reads the products (**strongly prefer importing the existing `client/src/data/products.ts` array** over hand-transcribing), how it walks the soap image glob and uploads to `products/{slug}/{filename}` (Phase 1 D-08), how it loads the service-role key (local env, never `VITE_`-prefixed, never committed).
- **Query wiring:** TanStack Query key design, whether reads go through a small `lib/catalog.ts` data layer, snake_case→camelCase mapping (`shelf_life`, `batch_note`, `category_id`, `is_active`), where the `is_active = true` filter lives.
- **Type strategy:** keep+adapt existing `Product`/`Category` TS interfaces vs generate Supabase types — as long as the component-facing shape stays compatible.
- Storage public-URL helper shape, skeleton card count, exact empty/error copy.

### Deferred Ideas (OUT OF SCOPE)
- Admin-controlled "featured" flag (needs schema change + admin UI) — future v2/ADME.
- Image reordering / primary-image selection — v2 (ADME-01); `images[]` order is display order.
- Scrub/cream real imagery — uploaded by owner via admin portal in **Phase 4** (placeholders until then, D-03).
- Admin editing of products/prices/content — **Phase 4**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-03 | The 28 existing hardcoded products, categories, and soap images migrated into Supabase via a one-time idempotent seed (service-role key, local, never shipped) | Pattern 1 (Vite-independent metadata + fs image walk), Pattern 2 (service-role client + `--env-file`), Pattern 3 (Storage upload upsert), Pattern 4 (row upsert on slug). Note: 28, not 68. |
| PUB-01 | Public Shop reads live products and categories from Supabase instead of the static data file | Pattern 5 (`catalog.ts` + `useQuery`), Pattern 6 (snake_case→camelCase mapping + embedded category select), Pattern 7 (path→public URL), Pattern 9 (loading/empty/error states) |
| PUB-02 | Product detail view renders from Supabase data; only published (`is_active = true`) products shown | Pattern 5/6 (`.eq('is_active', true)` server-side filter), ProductDetail already reads from a `Product` object — keep the shape compatible |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Seed insert of catalog rows | Local one-off script (service-role) | Database (RLS bypassed by service-role) | Privileged write must never run in the browser; service-role bypasses admin-only write RLS |
| Soap image upload | Local one-off script (service-role) → Storage | — | Same privilege boundary; admin-only Storage write (Phase 1 D-09) |
| `is_active = true` published filter | Database / API (Supabase query) | — | Filter at the source — never fetch drafts to the client then hide them (PUB-02 + avoids leaking unpublished data) |
| snake_case → camelCase mapping | Frontend data layer (`lib/catalog.ts`) | — | DB columns are snake_case; components expect camelCase `Product`. Map once at the boundary, not in every component |
| Storage path → public URL resolution | Browser / Client (`getPublicUrl`) | — | `getPublicUrl` is a pure synchronous string-builder; cheapest at render/mapping time on the client |
| Loading / empty / error UI | Browser / Client (TanStack Query state) | — | `isLoading`/`isError`/`refetch` are client-side query state |
| Placeholder substitution for empty images | Browser / Client (image helper) | — | Pure display concern using bundled static assets |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.106.2 (already installed, latest) | DB query + Storage upload/getPublicUrl, for both seed and client | Project's chosen client; Supabase-direct architecture `[VERIFIED: npm view + package.json]` |
| `@tanstack/react-query` | 5.60.5 (already installed) | Read-path data fetching/caching, loading/error/retry state | Retained from Phase 1 D-14; `QueryClientProvider` already wired in `App.tsx:31` `[VERIFIED]` |
| Node 22.22.3 runtime | (system) | Runs the seed `.ts` natively (`--experimental-strip-types` is default ≥22.18) + `--env-file` for the service-role key | No `tsx`/`dotenv` install needed — fewer deps, less attack surface `[VERIFIED: ran node scripts/verify-skeleton.ts, exit 0]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` / `node:path` (built-in) | — | Walk `client/src/assets/images/products/Soap/<Folder>/*.jpg` and read bytes for upload | In the seed only — replaces the unavailable Vite `import.meta.glob` |
| shadcn `Skeleton` | present | Loading-state skeleton cards (D-05) | `client/src/components/ui/skeleton.tsx` exists — reuse, do not re-add `[VERIFIED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node --env-file ... script.ts` (native) | `tsx` + `dotenv` | Adds two dev deps Phase 1 deliberately removed; native path is simpler and already proven to work. Use only if a build target older than Node 22.18 must run the seed. |
| Hand-mapping snake_case→camelCase | `supabase gen types typescript` generated types | Generated types are stricter and future-proof but add a CLI generation step + a file to keep in sync; for a 2-table read this phase, a hand-written mapper in `catalog.ts` is lighter. Either is acceptable (CONTEXT type strategy = discretion). |
| Resolving public URLs in the mapper | Storing full URLs on rows | Phase 1 D-03/D-08 locks **paths** on rows; resolving at read time is required, not optional. |

**Installation:**
```bash
# Nothing to install — @supabase/supabase-js@2.106.2 and @tanstack/react-query@5.60.5 are already present.
# The seed runner is the system Node 22 runtime (no tsx, no dotenv).
```

**Version verification:** `npm view @supabase/supabase-js version` → `2.106.2` (matches installed) `[VERIFIED: npm registry 2026-05-31]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/supabase-js` | npm | mature (8+ yrs org) | multi-M/wk | github.com/supabase/supabase-js | [OK] | Approved (already installed) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No new packages are introduced this phase. slopcheck ran `slopcheck install -e npm @supabase/supabase-js` → `[OK]` `[VERIFIED: slopcheck 2026-05-31]`. (Note: `npm audit` reports 5 pre-existing vulnerabilities in the tree, unrelated to this phase's scope — flag for a future maintenance pass, not a blocker here.)

## Architecture Patterns

### System Architecture Diagram

```
SEED SLICE (one-time, local, service-role) ─────────────────────────────────
  scripts/seed.ts
    │  reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (node --env-file=.env.seed.local)
    │
    ├─ import product metadata (Vite-independent module, NOT the glob file)
    ├─ node:fs walk  client/src/assets/images/products/Soap/<Folder>/*.jpg
    │
    ▼
  createClient(url, SERVICE_ROLE_KEY)   ──► bypasses admin-only RLS
    │
    ├─(1) upsert categories  (on slug)  ──────────────► public.categories
    ├─(2) for each soap product:
    │       storage.from('product-images')
    │         .upload('products/<slug>/<filename>.jpg', buffer,
    │                 { contentType:'image/jpeg', upsert:true })  ──► Storage bucket
    │       collect returned data.path[]  ───────────┐
    └─(3) upsert products (on slug):                 │
            { slug, name, ..., category_id, price:null, images:[paths] or [] } ──► public.products

READ SLICE (public, anon, runtime) ─────────────────────────────────────────
  Browser ─► useQuery(['catalog','products'])
              │
              ▼
            client/src/lib/catalog.ts
              │  supabase.from('products')
              │    .select('*, categories(slug,label,sort_order)')
              │    .eq('is_active', true)            ◄── PUB-02 published-only filter (server-side)
              │    .order(...)                       ◄── deterministic order (D-08)
              │
              ├─ map snake_case → camelCase Product
              └─ productImageUrls(images, category):
                   images.length ? images.map(p => getPublicUrl(p)) : [categoryPlaceholder]
              │
              ▼
   Shop.tsx / ProductGrid.tsx ─► ProductCard (images[0], formatPrice(price))
                              └─► ProductDetail (carousel over images, formatPrice(price))
              │
   isLoading → Skeleton cards    isError → inline msg + Retry(refetch)    empty → friendly copy
```

### Recommended Project Structure
```
scripts/
├── seed.ts                # NEW: one-time idempotent seed (service-role)
├── verify-skeleton.ts     # existing (Phase 1)
└── check-no-secret.sh     # existing (Phase 1)

client/src/
├── data/
│   ├── products.ts        # KEEP types + metadata; REMOVE the import.meta.glob image loading
│   └── catalog-data.ts    # OPTIONAL: Vite-independent product/category metadata the seed imports
└── lib/
    ├── catalog.ts         # NEW: supabase read layer + mapping + useProducts/useCategories hooks
    ├── format.ts          # NEW: formatPrice() single source of truth (D-02/D-01) — or co-locate
    └── supabase.ts        # existing client singleton (anon)
```

### Pattern 1: Make product metadata Vite-independent so the seed can import it
**What:** `client/src/data/products.ts` loads soap images with `import.meta.glob` (line 5) — a Vite-only transform. A plain `node`/tsx import of this file will fail or hang. Separate the **metadata** (names, subtitles, benefits, slugs, category) from the **image loading**.
**When to use:** Required for DATA-03 — the seed should import metadata, not hand-transcribe it (CONTEXT preference).
**Example:**
```typescript
// client/src/data/catalog-data.ts  — pure data, no import.meta.*, importable by Node AND Vite
// Source: refactor of client/src/data/products.ts (28 products verified)
export const SLUG_TO_SOAP_FOLDER: Record<string,string> = {
  neem: 'Neem', turmeric: 'Turmeric', 'aloe-vera': 'AloeVera',
  'multani-mitti': 'Fuller_s Earth', 'orange-peel': 'Orange', sandalwood: 'Sandalwood',
  charcoal: 'Charcoal', rose: 'Rose', 'lemon-peel': 'Lemon', rice: 'Rice',
  milk: 'Milk', oats: 'Oats', coffee: 'Coffee',
};
// products array WITHOUT the images field (images come from Storage at read time / from fs at seed time)
export const productMeta = [ /* 28 entries: slug, name, subtitle, category, benefits, ingredients, tips?, shelfLife, batchNote */ ];
```
**Note on slugs:** today's `id` is `'soap-neem'` / `'scrub-neem'` etc. The DB **`slug` is unique across the whole `products` table** (Phase 1 D-01), so the per-product slug must stay globally unique — `soap-neem`, `scrub-neem`, `cream-rice` all coexist. Safest: derive `slug` from the existing `id` (strip nothing — `id` is already unique and slug-shaped) OR keep `id` as the slug verbatim. Do NOT collapse to bare `neem` (collides between soap/scrub). The Storage path uses this same slug: `products/soap-neem/<file>.jpg`.

### Pattern 2: Service-role client in a non-shipped script (never VITE_-prefixed)
**What:** The seed must write through RLS-bypassing privileges. Use the **service_role** key, read from a plain (non-`VITE_`) env var supplied at runtime, exactly as `.env.example` already documents (`SUPABASE_SERVICE_ROLE_KEY`).
**When to use:** Seed only. This file is never imported by the client bundle.
**Example:**
```typescript
// scripts/seed.ts  — run: node --env-file=.env.seed.local scripts/seed.ts
// Source: mirrors scripts/verify-skeleton.ts (Phase 1) + .env.example service-role note
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;                       // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;   // non-VITE_, never committed
if (!url || !serviceKey) { console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
```
- Put the key in a gitignored file (e.g. `.env.seed.local` — `.env*.local` is already gitignored, line 11 of `.gitignore`) `[VERIFIED: .gitignore]`.
- `check-no-secret.sh` (Phase 1) already guards that no `service_role` string lands in `dist/`; the seed never being imported by client code keeps that guarantee intact.

### Pattern 3: Storage upload — explicit contentType + upsert for idempotency
**What:** Upload each soap image to `products/{slug}/{filename}` with `upsert:true` (re-run overwrites, not errors) and an **explicit `contentType`** (a documented gotcha: Buffer uploads without explicit contentType can be stored as `application/json`).
**When to use:** Seed soap images. Scrub/cream have no files → skip upload, seed `images: []`.
**Example:**
```typescript
// Source: supabase.com/docs/reference/javascript/storage-from-upload + GH discussion #34982 (contentType gotcha)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join('client/src/assets/images/products/Soap', folder);
const files = readdirSync(dir).filter(f => f.endsWith('.jpg')).sort(); // stable order = array/display order (D-03)
const paths: string[] = [];
for (const file of files) {
  const path = `products/${slug}/${file}`;
  const { data, error } = await admin.storage
    .from('product-images')
    .upload(path, readFileSync(join(dir, file)), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  paths.push(data.path);            // record the returned storage path on the row
}
```
- `data.path` is the storage-relative path string to store in `products.images[]` `[CITED: supabase docs storage-from-upload]`.
- Default per-file size limit is generous (5GB standard upload); the largest soap image is ~2.5MB — well within limits `[CITED: supabase standard-uploads guide]`.

### Pattern 4: Idempotent row upsert on slug
**What:** Insert categories then products via `upsert(..., { onConflict: 'slug' })` so re-running yields the same row count (28 products, 3 categories), not duplicates.
**When to use:** Seed rows. Requires the `slug` unique constraint that Phase 1 D-01 created `[VERIFIED: 0001_init_schema.sql products.slug unique not null]`.
**Example:**
```typescript
// Source: supabase-js upsert with onConflict on a unique column
// 1) categories first (products FK category_id → categories.id)
const { data: cats, error: cErr } = await admin.from('categories')
  .upsert([
    { slug: 'soap',  label: 'Soaps',  description: '...', sort_order: 0 },
    { slug: 'scrub', label: 'Scrubs', description: '...', sort_order: 1 },
    { slug: 'cream', label: 'Creams', description: '...', sort_order: 2 },
  ], { onConflict: 'slug' })
  .select('id, slug');
const catId = Object.fromEntries(cats!.map(c => [c.slug, c.id]));

// 2) products (resolve category_id from the slug map; price null per D-09)
await admin.from('products').upsert(
  productMeta.map(p => ({
    slug: p.slug, name: p.name, subtitle: p.subtitle,
    category_id: catId[p.category], price: null,
    benefits: p.benefits, ingredients: p.ingredients, tips: p.tips ?? [],
    shelf_life: p.shelfLife, batch_note: p.batchNote,
    images: imagePathsBySlug[p.slug] ?? [],   // [] for scrub/cream
  })),
  { onConflict: 'slug' }
);
```

### Pattern 5: Read layer — `catalog.ts` with TanStack Query + published-only filter
**What:** Centralize all Supabase reads. Filter `is_active = true` **server-side** (PUB-02), embed the category, order deterministically.
**Example:**
```typescript
// client/src/lib/catalog.ts
// Source: supabase.com/docs/reference/javascript/select (embedded select, .eq, .order)
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('slug, name, subtitle, price, benefits, ingredients, tips, shelf_life, batch_note, images, categories(slug, label, sort_order)')
    .eq('is_active', true)                                  // PUB-02 published-only
    .order('slug', { ascending: true });                    // stable order for D-08 determinism
  if (error) throw error;                                    // surfaces to useQuery isError → Retry
  return (data ?? []).map(toProduct);                        // map snake→camel (Pattern 6)
}

export function useProducts() {
  return useQuery({ queryKey: ['catalog', 'products'], queryFn: fetchProducts });
}
```
- Query keys: `['catalog','products']`, `['catalog','categories']`. The retained `queryClient` defaults already disable refetch-on-focus and set `retry:false` (`queryClient.ts`) — `refetch()` from `useQuery` powers the Retry button (D-06).

### Pattern 6: snake_case → camelCase mapping at the boundary
**What:** Map DB columns to the existing component-facing `Product` shape so components need minimal change (no UX regression).
**Example:**
```typescript
// the component-facing Product (existing) expects: category, shelfLife, batchNote, images, price
function toProduct(row: any): Product {
  return {
    id: row.slug,                       // slug is the stable public id now
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle ?? '',
    category: row.categories?.slug as Category,   // embedded category
    price: row.price,                   // numeric|null → formatPrice handles null
    benefits: row.benefits ?? [],
    ingredients: row.ingredients ?? [],
    tips: row.tips ?? [],
    shelfLife: row.shelf_life ?? '',    // snake → camel
    batchNote: row.batch_note ?? '',    // snake → camel
    images: productImageUrls(row.images ?? [], row.categories?.slug),  // path→URL + placeholder
  };
}
```
**Type-strategy note:** the existing `Product.price` is `string`; live price is `number | null`. Adapt the interface to `price: number | null` and route ALL rendering through `formatPrice` (D-01/D-02). This is the one breaking type change — handle it in one place.

### Pattern 7: Storage path → public URL + placeholder substitution (D-03/D-04)
**What:** `getPublicUrl` is **synchronous** and returns `{ data: { publicUrl } }`. Empty arrays fall back to the bundled category placeholder.
**Example:**
```typescript
// Source: supabase.com/docs/reference/javascript/storage-from-getpublicurl ({ data: { publicUrl } }, sync)
import soapImg from '@/assets/images/product-soap.png';
import scrubImg from '@/assets/images/product-scrub.png';
import creamImg from '@/assets/images/product-cream.png';
const placeholder: Record<string,string> = { soap: soapImg, scrub: scrubImg, cream: creamImg };

export function productImageUrls(paths: string[], category: string): string[] {
  if (!paths.length) return [placeholder[category] ?? soapImg];   // D-03
  return paths.map(p => supabase.storage.from('product-images').getPublicUrl(p).data.publicUrl);  // D-04
}
```
- Because empty → exactly one placeholder, `ProductDetail`'s `hasMany = images.length > 1` stays false for scrub/cream → carousel arrows/dots correctly hidden (matches D-03 expectation, no component change needed).

### Pattern 8: Deterministic featured selection (D-08)
**What:** Home shows the first published product per category, ordered by `categories.sort_order`.
**Example:**
```typescript
// derive from the same useProducts() data — no extra query
function featured(products: Product[], categories: Category[]): Product[] {
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)        // sort_order deterministic
    .map(c => products.find(p => p.category === c.slug))
    .filter(Boolean) as Product[];
}
```
Products are already `.order('slug')` from the query, so "first per category" is stable across reloads.

### Pattern 9: Loading / Empty / Error states (D-05/06/07)
**Example:**
```tsx
const { data: products, isLoading, isError, refetch } = useProducts();
if (isLoading) return <div className="grid ...">{Array.from({length: 8}).map((_, i) =>
  <div key={i}><Skeleton className="aspect-square mb-5" /><Skeleton className="h-4 w-2/3 mx-auto" /></div>)}</div>;
if (isError) return <div className="text-center py-16">
  <p className="text-foreground/60 mb-4">We couldn't load the collection. Please try again.</p>
  <button onClick={() => refetch()} className="...">Retry</button></div>;
if (!products?.length) return <p className="text-center text-foreground/50 py-16">No products available yet.</p>;
```
Skeleton must mirror the grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` on Shop; `lg:grid-cols-3` on Home) to avoid layout shift (D-05).

### Anti-Patterns to Avoid
- **Importing the glob file into the seed:** `import.meta.glob` is undefined in Node → silent failure or crash. Refactor first (Pattern 1).
- **Fetching drafts then hiding in UI:** Always `.eq('is_active', true)` server-side (PUB-02) — never ship unpublished rows to the client.
- **Storing full URLs on rows:** Phase 1 locked **paths**; resolve at read time (D-04). Storing URLs breaks if the project ref/bucket changes.
- **Uploading buffers without `contentType`:** Stored as `application/json`, breaks `<img>` rendering (GH discussion #34982).
- **Re-adding the shadcn Skeleton:** It already exists — re-adding risks clobbering.
- **Collapsing slugs to the bare ingredient:** `neem` collides across soap/scrub. Keep category-prefixed unique slugs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Public URL construction | String-concatenate `${url}/storage/v1/object/public/...` | `supabase.storage.from(b).getPublicUrl(path)` | Encodes special chars (soap filenames have spaces + parens), survives URL-format changes |
| Loading/error/retry state machine | `useState` + `useEffect` + try/catch | TanStack Query `isLoading`/`isError`/`refetch` | Already wired (`QueryClientProvider`), handles caching/dedup, less buggy |
| `.env` parsing in the seed | `dotenv` install | `node --env-file=.env.seed.local` | Native in Node 22; one fewer dep |
| TS execution for the seed | `tsx`/`ts-node` install | `node script.ts` (native type-strip ≥22.18) | Native; Phase 1 deliberately removed tsx |
| Idempotent insert | Select-then-insert-else-update | `.upsert(rows, { onConflict: 'slug' })` | Atomic, race-free, one round-trip |

**Key insight:** Everything this phase needs is already in the stack (supabase-js, React Query, native Node). The temptation is to re-add tooling Phase 1 removed — resist it.

## Runtime State Inventory

> This phase WRITES new runtime state (seed) and removes a build-time data source (static products.ts). Inventory of what exists / changes:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Supabase `products`/`categories` tables are currently **empty** (Phase 1 created schema only; verified by `verify-skeleton.ts` expecting 0+ rows). After seed: 28 products + 3 categories keyed by `slug`. | Seed populates; idempotent re-run must stay at 28/3 (upsert on slug) |
| Live service config | `product-images` Storage bucket exists, public-read, currently **empty of catalog images**. Seed uploads soap images to `products/{slug}/{filename}`. | Seed uploads ~84 soap jpgs across 13 folders |
| OS-registered state | None — no OS-level registrations involved. | None — verified by scope (local script + browser reads only) |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY` (non-VITE_) consumed by the seed at runtime; `.env*.local` already gitignored. Client uses only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`.env.local` present). | Add service-role key to a gitignored seed env file; never commit; never VITE_-prefix |
| Build artifacts | `client/src/data/products.ts` is imported at build time by Shop/Home/ProductGrid (verified by grep). Its `import.meta.glob` also bundles soap images into `dist/`. Once the read path is rewired, those imports are removed. | Remove static-data imports from components; decide whether the glob image bundling is still needed (it is NOT, once images live in Storage) — pruning it reduces bundle size. Keep type exports until migrated. |

**The canonical question — after the repo is updated, what still has the old data?** Nothing problematic: the static array becomes dead code (success criterion #5 removes the runtime import). The only persistent new state is the seeded Supabase rows + Storage objects, both keyed by slug so a re-seed is safe.

## Common Pitfalls

### Pitfall 1: The "68 products" figure is wrong — it's 28
**What goes wrong:** Plans/verification assert 68 rows; the seed produces 28; verification "fails" against a phantom target.
**Why it happens:** CONTEXT.md and ROADMAP.md both say "68" (likely an early estimate or image-count confusion — there are ~84 soap *images*).
**How to avoid:** Hard-code the parity target as **28 products (13 soap, 10 scrub, 5 cream) + 3 categories** in every plan/verification step.
**Warning signs:** Any task or check that references 68. `[VERIFIED: grep -c "id: '" = 31 minus 3 category entries = 28]`

### Pitfall 2: Seed can't import products.ts (Vite glob)
**What goes wrong:** `node scripts/seed.ts` importing `client/src/data/products.ts` errors on `import.meta.glob` (undefined outside Vite).
**Why it happens:** Line 5 of products.ts is a Vite-only macro.
**How to avoid:** Refactor metadata into a glob-free module (Pattern 1) and have the seed walk images via `node:fs`. Test the import in isolation before wiring the full seed.
**Warning signs:** `import.meta.glob is not a function`, or the seed hanging/erroring on import.

### Pitfall 3: Soap filenames contain spaces and parentheses
**What goes wrong:** Paths like `products/soap-aloe-vera/IMG_3246517891375796981 (1).jpg` break naive URL building.
**Why it happens:** Real source filenames (e.g. `IMG_... (1).jpg`, folder `Fuller_s Earth`) have spaces/parens.
**How to avoid:** Use `getPublicUrl` (encodes correctly); never hand-build URLs. For Storage keys, the supabase-js client accepts these characters in the path. Consider normalizing filenames during seed (e.g. `1.jpg`, `2.jpg`) for cleaner Storage keys — optional but tidier; if you do, keep stable sort order (D-03).
**Warning signs:** 404s on some images, broken `<img>` for products with parenthesized filenames.

### Pitfall 4: contentType defaults to application/json for buffers
**What goes wrong:** Uploaded soap images render broken; browser receives `application/json`.
**Why it happens:** Documented supabase-js behavior — Buffer upload without explicit `contentType` (GH discussion #34982).
**How to avoid:** Always pass `{ contentType: 'image/jpeg' }` (all source images are `.jpg`, verified — only extension present).
**Warning signs:** Images broken in Storage dashboard preview; `Content-Type: application/json` on the object.

### Pitfall 5: price type change (string → number|null) ripples through components
**What goes wrong:** `Product.price` was `string`; live is `number | null`. `ProductCard`/`ProductDetail` render `{product.price}` directly today.
**Why it happens:** Schema price is `numeric(10,2)` nullable.
**How to avoid:** Change the interface to `price: number | null`, introduce `formatPrice()` (D-01/D-02), and replace every raw `{product.price}` with `{formatPrice(product.price)}` (ProductCard:42, ProductDetail:96-98). One formatter, used everywhere.
**Warning signs:** TS errors at the render sites; "Price on request" not appearing.

### Pitfall 6: featured ordering drifts
**What goes wrong:** Home's 3 featured cards change between reloads or differ from the old static order.
**Why it happens:** No explicit ORDER BY → Postgres returns rows in arbitrary order.
**How to avoid:** Always `.order('slug')` (or another stable key) in the query and sort categories by `sort_order` (Pattern 8). Seed categories with explicit `sort_order` 0/1/2 (soap/scrub/cream) to match today's array order.
**Warning signs:** Different featured products on refresh.

## Code Examples

(See Patterns 1–9 above — all carry inline source attributions to Supabase official docs.)

### Running the seed
```bash
# .env.seed.local (gitignored): SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...
node --env-file=.env.seed.local scripts/seed.ts
# Re-run to verify idempotency → still 28 products, 3 categories.
```

### Parity self-check (anon, post-seed)
```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-skeleton.ts   # existing Phase 1 script, proves anon read works
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tsx`/`ts-node` to run TS scripts | `node script.ts` native type-stripping | Node 22.18 (unflagged) | No dev-dep needed for the seed |
| `dotenv` package | `node --env-file=` | Node 20.6+ (stable 22) | No dev-dep for env loading |
| `import.meta.glob` for bundling product images | Images live in Supabase Storage, resolved via `getPublicUrl` | This phase | Static glob image bundling becomes dead; smaller `dist/` |

**Deprecated/outdated:**
- Static `client/src/data/products.ts` as the runtime catalog source — replaced by live Supabase reads (removed from runtime path per success criterion #5; type exports may linger until fully migrated).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getPublicUrl` returns `{ data: { publicUrl } }` and is synchronous | Pattern 7 | LOW — well-documented; if shape differs, mapper adjusts in one place. WebFetch couldn't quote the exact example (page truncated); cross-confirmed by WebSearch result. `[CITED: supabase docs + community]` |
| A2 | Slug should be the category-prefixed existing `id` (e.g. `soap-neem`) to stay globally unique | Pattern 1 | MEDIUM — if planner chooses bare slugs, soap/scrub collisions break the unique constraint. Recommend prefixed; confirm during planning. |
| A3 | Seeding soap-image filenames as-is (with spaces/parens) is acceptable vs. normalizing to `1.jpg`... | Pitfall 3 | LOW — both work; normalization is cosmetic. Planner discretion. |
| A4 | The `product-images` bucket and tables are currently empty (only schema exists) | Runtime State Inventory | LOW — Phase 1 created schema only; if data exists, upsert-on-slug still converges safely. |
| A5 | The 5 `npm audit` vulnerabilities are pre-existing and out of this phase's scope | Package Legitimacy Audit | LOW — unrelated to seed/read work; flagged for maintenance. |

## Open Questions

1. **Slug scheme for products**
   - What we know: DB `slug` is globally unique (Phase 1 D-01); today's `id` is already unique and slug-shaped (`soap-neem`).
   - What's unclear: Use `id` verbatim as slug, or a different scheme?
   - Recommendation: Use the existing `id` as `slug` verbatim — already unique, already in URLs nowhere yet, zero transcription risk.

2. **Normalize soap image filenames on upload?**
   - What we know: Source filenames are messy (`IMG_... (1).jpg`).
   - What's unclear: Keep as-is (simplest, `getPublicUrl` handles encoding) or rename to `1.jpg`…`n.jpg` (cleaner Storage keys, easier Phase 4 management).
   - Recommendation: Rename to ordinal `1.jpg`… preserving sort order — cleaner for the owner in Phase 4. Low effort. Planner decides.

3. **Keep `products.ts` types vs generate Supabase types?**
   - What we know: CONTEXT marks this discretion; a 2-table read is small.
   - Recommendation: Hand-written mapper + adapted `Product` interface in `catalog.ts`. Defer codegen until the admin write phase (Phase 4) where more tables/types matter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (native TS strip + `--env-file`) | Seed runner | ✓ | 22.22.3 | `tsx`+`dotenv` (only if <22.18 target) |
| `@supabase/supabase-js` | Seed + read layer | ✓ | 2.106.2 | — |
| `@tanstack/react-query` | Read layer | ✓ | 5.60.5 | — |
| shadcn `Skeleton` | Loading state | ✓ | present | add component if removed |
| Live Supabase project (schema + RLS + bucket) | Both slices | ✓ | Phase 1 pushed live | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed | ✗ (must be supplied locally) | — | none — required; owner provides from Supabase dashboard into gitignored env |

**Missing dependencies with no fallback:** `SUPABASE_SERVICE_ROLE_KEY` — the owner must place it in a gitignored `.env.seed.local` before running the seed (a `checkpoint:human` step). This is the only blocking external input.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config. No test framework exists (no jest/vitest/pytest, confirmed). This is a Wave 0 gap.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — see Wave 0 |
| Config file | none |
| Quick run command | `npm run check` (tsc type-check — the only automated gate today) |
| Full suite command | `npm run check && bash scripts/check-no-secret.sh` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-03 | Seed inserts 28 products + 3 categories, idempotent | integration (live) | `node --env-file=.env.seed.local scripts/seed.ts` then a count assertion script | ❌ Wave 0 (add `scripts/verify-seed.ts` asserting count=28/3) |
| DATA-03 | No service_role in bundle | smoke | `bash scripts/check-no-secret.sh` | ✅ (Phase 1) |
| DATA-03 | Anon can read seeded products | integration (live) | `SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-skeleton.ts` | ✅ (Phase 1) |
| PUB-01 | Shop/Home read live data, types compile | unit (type) | `npm run check` | ✅ (tsc) |
| PUB-01 | Loading/empty/error render | manual | visual check in browser (`npm run dev`) | manual-only (no component test harness) |
| PUB-02 | Only `is_active=true` shown | integration (live) | `verify-seed.ts` can flip one row to false and assert it's absent from an anon select | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check && bash scripts/check-no-secret.sh`
- **Phase gate:** seed run idempotent (28/3 twice), anon read passes, `tsc` green, manual UX parity walk-through before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-seed.ts` — asserts post-seed counts (28 products / 3 categories) and an `is_active=false` row is hidden from anon select (covers DATA-03, PUB-02 automatically)
- [ ] No unit-test framework — component loading/empty/error states are **manual-only** this phase (acceptable; "No tests exist" per CONTEXT). Do NOT scope adding vitest here unless the planner chooses to.

*(Manual-only justification: no test harness exists project-wide; CONTEXT explicitly says verify parity manually against the static catalog. Live integration is covered by the two node scripts above.)*

## Security Domain

> `security_enforcement: true`, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth this phase (anonymous public reads only) |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | RLS: anon read-only on `products`/`categories` (Phase 1); seed writes use service-role locally, never in client. PUB-02 `is_active` filter prevents leaking drafts. |
| V5 Input Validation | partial | Read path only renders trusted DB data; no user input persisted this phase. Image filenames sanitized via `getPublicUrl` encoding. |
| V6 Cryptography | yes (key handling) | service_role key kept out of any `VITE_` var and `dist/` (enforced by `check-no-secret.sh`); supplied via gitignored `--env-file`. |

### Known Threat Patterns for Supabase-direct + static SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| service_role key leaks into client bundle | Information Disclosure / Elevation | Non-`VITE_` env var, gitignored, `check-no-secret.sh` build scan (Phase 1, reuse) |
| Unpublished/draft products leak to public | Information Disclosure | Server-side `.eq('is_active', true)` in `catalog.ts` (PUB-02) — never client-side hide |
| Anon write attempt | Tampering | Phase 1 RLS: catalog tables are admin-write-only; anon writes denied. No change needed. |
| Committed secrets | Information Disclosure | `.env*.local` gitignored (verified); seed key never committed |

## Sources

### Primary (HIGH confidence)
- Local codebase (grep/read): `client/src/data/products.ts` (28 products, glob usage), `supabase/migrations/0001-0003` (schema/RLS/bucket), `client/src/lib/{supabase,queryClient}.ts`, components, `.env.example`, `.gitignore`, `tsconfig.json`, `scripts/verify-skeleton.ts`, `package.json` `[VERIFIED]`
- `node scripts/verify-skeleton.ts` ran natively (exit 0) — confirms Node 22 TS execution `[VERIFIED]`
- `slopcheck install -e npm @supabase/supabase-js` → `[OK]` `[VERIFIED]`
- `npm view @supabase/supabase-js version` → 2.106.2 `[VERIFIED]`
- supabase.com/docs/reference/javascript/select — `.eq`, `.order`, embedded `select('*, categories(...)')` `[CITED]`

### Secondary (MEDIUM confidence)
- supabase.com/docs/reference/javascript/storage-from-upload — `upload(path, body, { contentType, upsert })`, returns `data.path` `[CITED]`
- supabase.com/docs/reference/javascript/storage-from-getpublicurl — `{ data: { publicUrl } }`, synchronous (page truncated; cross-confirmed via WebSearch) `[CITED]`
- supabase.com/docs/guides/storage/uploads/standard-uploads — 5GB standard upload limit, contentType-from-extension default `[CITED]`
- github.com/orgs/supabase/discussions/34982 — Buffer upload without explicit contentType stored as application/json `[CITED]`

### Tertiary (LOW confidence)
- General WebSearch confirmation of upload/getPublicUrl example shape (used only to corroborate the truncated official pages)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed and version-verified; runner proven to execute
- Architecture: HIGH — schema/RLS/bucket read directly from migrations; component shapes read directly
- Pitfalls: HIGH — the glob, the 68-vs-28 count, the contentType gotcha, and the price-type change are all grounded in the actual files / official sources
- Storage API exact return shapes: MEDIUM — official pages partially truncated by the fetch; cross-confirmed

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable stack; Supabase storage API is mature)
