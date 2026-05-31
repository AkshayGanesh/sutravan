# Phase 2: Live Catalog — Data Migration & Public Shop Rewire - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 2-live-catalog-data-migration-public-shop-rewire
**Areas discussed:** Missing-price display, Imageless products, Loading/empty/error UX, Home featured logic

---

## Missing-Price Display

| Option | Description | Selected |
|--------|-------------|----------|
| 'Price on request' label | Subtle 'Price on request' wherever price would appear; honest, stable layout, nudges to enquiry | ✓ |
| Hide price entirely | Render nothing when price is null | |
| Show a dash '—' | Placeholder dash | |

**User's choice:** "Price on request" — phrased as: "The pricing would be updated soon. Hence, if the field is null, then enable 'Price on request'."
**Notes:** Pricing is coming soon; the null state is intentional and on-brand, not a stopgap.

### Price formatting (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| ₹250 (INR symbol, no decimals) | Rupee symbol, whole rupees, drop .00 | ✓ |
| ₹250.00 (with decimals) | Always two decimals | |
| Rs. 250 | Text prefix instead of glyph | |

**User's choice:** ₹250 (INR symbol, no decimals)
**Notes:** Applies once admin sets prices in a later phase.

---

## Imageless Products (scrub/cream)

| Option | Description | Selected |
|--------|-------------|----------|
| Category placeholder image | Reuse existing product-scrub.png / product-cream.png; products stay visible, swapped in Phase 4 | ✓ |
| Hide until images exist | Don't show imageless products publicly yet | |
| Neutral 'coming soon' placeholder | Branded "image coming soon" tile | |

**User's choice:** Category placeholder image
**Notes:** Catalog should look complete to visitors before Phase 4 photo uploads.

---

## Loading / Empty / Error UX

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton product cards | Grey placeholder cards in grid layout; no layout shift (shadcn Skeleton) | ✓ |
| Centered spinner | Single spinner, page jumps when cards load | |
| Nothing / instant | Render nothing until data arrives | |

**User's choice (Loading):** Skeleton product cards

| Option | Description | Selected |
|--------|-------------|----------|
| Inline message + Retry button | Friendly message with Retry that refetches | ✓ |
| Message only | Apologetic message, no retry control | |
| Error toast | Sonner toast, empty grid behind | |

**User's choice (Error):** Inline message + Retry button
**Notes:** Empty state reuses the existing "No products found" pattern, extended for a globally-empty catalog (Claude discretion).

---

## Home Featured Logic

| Option | Description | Selected |
|--------|-------------|----------|
| First published per category | One per soap/scrub/cream, deterministic by sort_order; preserves today's behavior, no schema change | ✓ |
| First N published products | First N overall regardless of category | |
| Defer to admin-controlled later | Keep first-per-category, note future featured flag | |

**User's choice:** First published per category
**Notes:** Admin-controlled featured flag noted as a deferred idea (needs schema change).

---

## Claude's Discretion

- Seed mechanics (runner/location, importing products.ts, image glob upload, service-role key loading)
- TanStack Query wiring, snake_case → component-shape mapping, where the `is_active` filter lives
- Type strategy (adapt existing interfaces vs generate Supabase types)
- Storage public-URL helper shape, skeleton card count, exact empty/error copy

## Deferred Ideas

- Admin-controlled "featured" flag (schema change — future / v2)
- Image reordering / primary-image selection (v2 / ADME-01)
- Scrub/cream real imagery upload (Phase 4)
- Admin editing of products/prices/content (Phase 4)
