# Quick Task 260602-tf6: Per-product weight/price variants (SKUs) - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Task Boundary

A product may sell in multiple weights (e.g. 70gm, 200gm), each with its own price. On the public
product detail view the customer sees the weight options with their prices and can switch between
them. The admin configures these variants per product. No cart/checkout (e-commerce is a later
milestone) — this is catalog display + admin management only.
</domain>

<decisions>
## Implementation Decisions

### Data model
- A separate **`product_variants`** table (NOT a JSON column). Columns at minimum:
  `id`, `product_id` (FK → products, on delete cascade), `label` (text, e.g. "70gm"),
  `price` (numeric/int, same units as products.price), `sort_order` (int for display order),
  timestamps. RLS: public SELECT + admin-only write via `private.is_admin()` (mirror products policies).

### Pricing model (relationship to existing products.price)
- Variants are **optional**. A product with **0 variants** behaves exactly as today (single
  `products.price`, incl. "Price on request" when null). When a product has **≥1 variant**, the
  variants are the source of pricing and the single `products.price` is ignored for display.
- Fully backwards-compatible: all 28 existing products keep working with zero migration of data.

### Shop listing card price (multi-variant products)
- Show **"From ₹{lowest variant price}"** on the Shop/Home cards. The detail view shows the full
  selector with each option's price. Single-price (0-variant) products are unchanged.

### Claude's Discretion
- Exact variant column types/constraints (match existing `products.price` type + migration style).
- Per-variant stock or active flags — NOT in scope now (stock stays product-level via existing
  `in_stock`); keep variants to label + price + sort for this task.
- Detail-view selector UI (pills/segmented control/dropdown) — match existing brand/UI conventions.
- Default selected variant on detail open (suggest: lowest price or lowest sort_order).
- How the variant price formats — reuse the existing `formatPrice` helper.
</decisions>

<specifics>
## Specific Ideas

- Mirror existing patterns: products RLS (0002 / 0005), the catalog read layer (`catalog.ts`
  snake→camel mapper + `useProducts`/`useProduct`), admin product CRUD (`admin.ts` upsert + form
  mappers, `ProductForm.tsx`), public render (`ProductDetail.tsx`), and Shop card price
  (`ProductCard.tsx` + `formatPrice`).
- Admin CRUD for variants lives in `ProductForm.tsx` as an editable repeatable row list
  (add/remove rows: label + price + order). Persisted alongside the product save — diff against
  existing variants (insert new, update changed, delete removed) under the admin RLS.
- Public detail must fetch a product WITH its variants (join or a second query keyed by product id).
- vitest: add mapper/derivation assertions — e.g. "From {lowest}" computation and the snake→camel
  variant mapper — mirroring existing `client/src/lib/*.test.ts`.
</specifics>

<canonical_refs>
## Canonical References

- supabase-live-ops memory — live migration push (`supabase db push`), project ref `wfbnrcnmpcqzeyjlfflv`.
- product-boolean-flag-pattern memory — the column→mapper→admin→render→db-push shape (this task is a
  bigger relational variant of it; next migration number is 0011).
</canonical_refs>
