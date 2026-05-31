# Phase 2: Live Catalog — Data Migration & Public Shop Rewire - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Two coupled deliverables, no authentication anywhere this phase:

1. **One-time seed (DATA-03):** A local script (run with the **service-role key**, never shipped) that inserts all 28 existing products (13 soap + 10 scrub + 5 cream — the "68" in earlier drafts was the soap *image* count; see RESEARCH) + their three categories into Supabase, uploads the existing soap images to the `product-images` bucket, and records the Storage paths on the rows. Idempotent — **upsert on `slug`** so re-running yields 28 rows, not duplicates. Scrub/cream rows seed with **empty `images[]`** (owner uploads via the portal in Phase 4). RLS stays enabled throughout.

2. **Public read-path rewire (PUB-01, PUB-02):** The public **Shop**, **Home/ProductGrid**, **ProductCard**, and **ProductDetail** read live products/categories from Supabase via **TanStack Query** (replacing the static `client/src/data/products.ts` read path), with working loading / empty / error states and no UX regression. Detail view renders entirely from Supabase and only published (`is_active = true`) products are shown publicly. The static `products.ts` runtime dependency is removed once parity is verified.

**Out of scope (later phases):** any login/registration (Phase 3), the admin portal that lets the owner edit/upload (Phase 4), wishlist/native questionnaire (Phase 5). This phase delivers value to **anonymous** visitors only.

Covers requirements **DATA-03** (idempotent seed, 28 products / 3 categories), **PUB-01** (Shop reads live data), **PUB-02** (detail renders from Supabase, published-only).

</domain>

<decisions>
## Implementation Decisions

### Missing-Price Display (all 68 products are unpriced)
- **D-01:** When `products.price` is **null**, the public site shows **"Price on request"** (not a blank line, dash, or hidden field). Rationale: pricing "will be updated soon"; this keeps layout stable and nudges toward the Instagram enquiry CTA, matching the made-to-order/customization brand. Applies everywhere price renders — `ProductCard` (`client/src/components/ProductCard.tsx:42`) and `ProductDetail` (`client/src/components/ProductDetail.tsx:96-98`).
- **D-02:** When a price **is** set (later, by the admin), format as **INR symbol, no decimals** — e.g. `₹250` (drop trailing `.00`). Price is stored as `numeric(10,2)` rupees; formatting is a display concern. A small shared formatter (e.g. `formatPrice(price): "₹250" | "Price on request"`) should be the single source of truth used by every component.

### Imageless Products (scrub/cream seed with empty `images[]`)
- **D-03:** Products with an empty `images[]` render the **existing generic category placeholder asset** (`client/src/assets/images/product-scrub.png`, `product-cream.png`, and `product-soap.png` as the soap fallback) rather than being hidden or showing a "coming soon" tile. Products stay **visible** on the live site and look intentional; real photos replace the placeholder in Phase 4. This fallback applies to `ProductCard` (`images[0]`, line 21) and `ProductDetail` (carousel at lines 30-34 — with one placeholder image, `hasMany` is false so the carousel arrows/dots correctly don't render).
- **D-04:** Soap products **do** have images, stored as **Storage paths** (not URLs). Components must resolve a path to a public URL via the Supabase Storage public-URL API (`product-images` bucket is public-read per Phase 1 D-09). A shared helper (e.g. `productImageUrls(images, category)`) should map stored paths → public URLs and substitute the category placeholder when the array is empty. (Exact helper shape is planner discretion.)

### Loading / Empty / Error States (success criterion #3)
- **D-05:** **Loading** → **skeleton product cards** in the same grid layout (no layout shift). shadcn ships a `Skeleton` component (`client/src/components/ui/skeleton.tsx` if present, else add it) — reuse it.
- **D-06:** **Error** (Supabase fetch fails) → an **inline friendly message + a Retry button** that refetches (TanStack Query `refetch`). Keep the user on-page and in control; do not silently show an empty grid.
- **D-07:** **Empty** → reuse/extend the Shop's existing "No products found in this category." text pattern (`client/src/pages/Shop.tsx:98-102`) for the per-category empty case, and a friendly equivalent for a globally-empty catalog. (Wording is planner discretion.)

### Home "Curated Essentials" / Featured Logic
- **D-08:** The homepage `ProductGrid` shows the **first published product per category** (soap/scrub/cream), chosen **deterministically** by `categories.sort_order` then a stable product order. This preserves today's `getFeaturedProducts()` behavior exactly (`client/src/components/ProductGrid.tsx:8`), always renders 3 cards, and needs **no schema change**. An admin-controlled "featured" flag is explicitly deferred (see Deferred Ideas).

### Seed: Price Handling (roadmap open question)
- **D-09:** The seed writes **null** for every product's price (blank, not a placeholder value) — null is a valid state (Phase 1 D-02) and renders as "Price on request" (D-01). No placeholder/zero prices are inserted.

### Claude's Discretion
- **Seed mechanics:** language/runner (e.g. a `tsx` script under a `scripts/` or `supabase/` dir), how it reads the 68 products — **strongly prefer importing the existing `client/src/data/products.ts` array** rather than hand-transcribing — how it walks the soap image glob and uploads to `products/{slug}/{filename}` (Phase 1 D-08 convention), and how it loads the service-role key (local env, never a `VITE_`-prefixed var, never committed).
- **Query wiring:** TanStack Query key design, whether reads go through a small `lib/catalog.ts` data layer wrapping `supabase`, mapping snake_case DB columns (`shelf_life`, `batch_note`, `category_id`, `is_active`) → the camelCase shape components expect, and where the published (`is_active = true`) filter lives.
- **Type strategy:** whether to keep the existing `Product`/`Category` TS interfaces (adapting them) or generate Supabase types — as long as the component-facing shape stays compatible to avoid a UX regression.
- Storage public-URL helper shape, skeleton card count, and exact empty/error copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 2: Live Catalog — Data Migration & Public Shop Rewire" — goal, 5 success criteria, and the surfaced open question (price seed blank vs placeholder → resolved as **blank/null**, D-09; scrub/cream empty images → category placeholder, D-03).
- `.planning/REQUIREMENTS.md` — DATA-03, PUB-01, PUB-02 (this phase) and the traceability table.
- `.planning/PROJECT.md` §Constraints, §Key Decisions — Supabase-direct, anon key + RLS, compatibility ("Public Shop must keep working without regressing existing UX").

### Phase 1 foundation this phase builds on (LOCKED — read before planning)
- `.planning/phases/01-supabase-foundation-schema-rls-storage/01-CONTEXT.md` — all schema/storage/RLS decisions. Especially **D-01** (UUID pk + unique slug, upsert on slug), **D-02** (nullable INR price), **D-03** (`images text[]` of Storage paths, array order = display order), **D-04** (`category_id` FK), **D-08** (`products/{slug}/{filename}` path convention), **D-09** (buckets public-read / admin-write), **D-14** (keep TanStack Query; Express `apiRequest` path retired).
- `supabase/migrations/0001_init_schema.sql` — the live `products` and `categories` columns the seed writes and the read layer maps (`slug`, `name`, `subtitle`, `category_id`, `price numeric(10,2)`, `benefits[]`, `ingredients[]`, `tips[]`, `shelf_life`, `batch_note`, `images[]`, `is_active`).
- `supabase/migrations/0002_rls_policies.sql` — confirms `products`/`categories` are public-read (anonymous Shop works) and writes are admin-only (the seed must use the service-role key to insert).
- `supabase/migrations/0003_storage_buckets.sql` — `product-images` bucket + public-read policy the seed uploads into and the Shop reads from.

### Existing read path being rewired (defines the component-facing shape to preserve)
- `client/src/data/products.ts` — `Product`/`CategoryInfo` interfaces, `getProductsByCategory`/`getProductById`/`getFeaturedProducts` helpers, and the 68-product array the seed should import. Note `price: ''` everywhere → becomes null; `images` via glob → becomes Storage paths.
- `client/src/pages/Shop.tsx` — category tabs + counts + grid + detail modal; the main rewire target.
- `client/src/components/ProductGrid.tsx` / `ProductCard.tsx` / `ProductDetail.tsx` — featured grid, card (renders `images[0]`, `price`), and detail modal (carousel over `images`, renders `price`).
- `client/src/pages/Home.tsx` — imports `categories` for the category showcase (line 5, 54-61).
- `client/src/lib/supabase.ts` — the client singleton to read through. `client/src/lib/queryClient.ts` — the retained QueryClient.

### Codebase maps
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md` — file layout and naming (PascalCase components, camelCase utils) to match.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **TanStack React Query** (`client/src/lib/queryClient.ts`) — retained from Phase 1 (D-14); the read layer for Shop/Home/Detail. Use `useQuery`/`refetch` for the loading/error/retry behavior (D-05, D-06).
- **Supabase client singleton** (`client/src/lib/supabase.ts`) — env-guarded, ready; all reads go through it.
- **Generic category images** (`client/src/assets/images/product-{soap,scrub,cream}.png`) — already imported in `products.ts`; reuse as the empty-`images[]` placeholder (D-03).
- **shadcn Skeleton** — for D-05 loading cards (add the component if not already present).
- **Existing `Product`/`Category` TS shape** — the contract the live read layer must keep compatible to avoid UX regression.

### Established Patterns
- **Supabase-direct** — frontend talks to Supabase via its client; no API layer. Anonymous reads rely on the public-read RLS policies from Phase 1.
- **Storage paths, not URLs, on rows** (Phase 1 D-03/D-08) — every image render must resolve path → public URL (D-04).
- **Idempotent upsert on `slug`** (Phase 1 D-01) — the seed's re-run safety.
- **No tests exist** — no harness to satisfy; verify parity manually against the static catalog.

### Integration Points
- Seed script: new file (planner-chosen location), imports `products.ts`, uses **service-role** Supabase client + Storage upload; never bundled into the client.
- Read layer: likely a small `client/src/lib/catalog.ts` (or hooks) wrapping `supabase` + query keys, mapping snake_case → component shape, applying `is_active` filter.
- Removal of the static `products.ts` runtime import from Shop/Home/ProductGrid once parity is verified (success criterion #5) — the file/types may be repurposed, but components must no longer read its data array.

</code_context>

<specifics>
## Specific Ideas

- The brand is made-to-order / customization-driven; "Price on request" is the intended, on-brand state for unpriced products (owner: "pricing will be updated soon"), not a stopgap to hide.
- ₹ symbol, whole rupees — India-based brand.
- Keep scrub/cream **visible** on the live site behind category placeholders rather than hiding them — the catalog should look complete to visitors before Phase 4 photo uploads.
- Strong preference (carried from Phase 1) for the clean/correct option over shortcuts: idempotent seed, deterministic featured ordering, no UX regression.

</specifics>

<deferred>
## Deferred Ideas

- **Admin-controlled "featured" flag** — a per-product featured boolean (or curated homepage selection) would need a schema change and an admin UI; deferred. For now Home uses first-published-per-category (D-08). Candidate for a future admin-enhancement (v2 / ADME family).
- **Image reordering / primary-image selection** — already v2 (ADME-01); the `images[]` array order is the display order for now.
- **Scrub/cream real imagery** — uploaded by the owner via the admin portal in **Phase 4** (placeholders shown until then, D-03).
- **Admin editing of products/prices/content** — **Phase 4**; this phase is read-only public + a local seed.

None of the above were folded — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Live Catalog — Data Migration & Public Shop Rewire*
*Context gathered: 2026-05-31*
