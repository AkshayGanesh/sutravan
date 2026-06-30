# Roadmap: Earthen Luxury Sutravan

## Milestones

- ✅ **v1.0 Admin CMS + Supabase Backend** — Phases 1–5 (shipped 2026-06-27) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Delivery Estimator** — Phases 6–10 (in progress) — pincode-based shipping cost + ETA + COD estimator powered by an admin-tunable zone-weight table (live courier API deferred to DLVR-F1)
- 📋 **Next: E-commerce** — cart / checkout / payments (not yet planned — run `/gsd-new-milestone`)

## Phases

<details>
<summary>✅ v1.0 Admin CMS + Supabase Backend (Phases 1–5) — SHIPPED 2026-06-27</summary>

- [x] Phase 1: Supabase Foundation — Schema, RLS & Storage (3/3 plans) — completed 2026-05-31
- [x] Phase 2: Live Catalog — Data Migration & Public Shop Rewire (3/3 plans) — completed 2026-05-31
- [x] Phase 3: Authentication & Roles (6/6 plans) — completed 2026-06-01
- [x] Phase 4: Admin Portal — Catalog & Content Management (9/9 plans) — completed 2026-06-01
- [x] Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire (4/4 plans) — completed 2026-06-01

Full phase details, success criteria, and plan breakdowns: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Delivery Estimator (Phases 6–10)

- [x] **Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function** - Server-side engine computes a normalized serviceability / cost / ETA / COD estimate from an admin-tunable zone-weight table, with all delivery data structures, RLS, and seeded defaults in place (completed 2026-06-30)
- [ ] **Phase 7: Product Detail Delivery Estimator** - The product detail page shows a per-product estimator (using product weight, falling back to the admin default) with every UX state handled and the result prominently framed as an estimate
- [ ] **Phase 8: Site-Wide Pincode — Navbar Widget & Profile Persistence** - A global "Deliver to [pincode]" navbar widget persists the chosen pincode site-wide (localStorage) and syncs to a logged-in customer's profile across devices
- [ ] **Phase 9: Admin Delivery Settings & COD Rules** - The owner configures origin pincode (validated, with live preview), default weight, dispatch lead time, COD rules, and the free-shipping threshold — no redeploy
- [ ] **Phase 10: Admin Zone-Weight Rate Slab Editor** - The owner manages the zone-weight rate slab table (cost + ETA range per zone × weight band) that drives every estimate, behind a contract a live courier API could later replace

## Phase Details

> **Numbering:** v1.1 continues from v1.0's last phase (Phase 5). Integer phases (6, 7, …) are planned milestone work; decimal phases (e.g. 6.1) would be urgent insertions.
>
> **Milestone scope guardrail:** The only rate source built in v1.1 is the admin-configurable **zone-weight estimate table**. A live courier API (Shiprocket, DLVR-F1) and per-variant numeric weight (DLVR-F2) are explicitly **deferred** — the estimate computation stays behind a normalized contract so a live API can swap in later with no frontend change.

### Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function

**Goal**: A server-side rate engine computes a normalized, vendor-agnostic delivery estimate (serviceability, estimated cost in INR, ETA day range, COD availability) from an admin-tunable zone-weight table behind a swappable adapter — with all delivery data structures, RLS, and seeded defaults in place so estimates return real numbers before any UI exists.
**Mode:** mvp
**Depends on**: Nothing new (first v1.1 phase; builds on the shipped v1.0 Supabase foundation and the `verify-and-submit` Edge Function pattern)
**Requirements**: DLVR-05
**Success Criteria** (what must be TRUE):

  1. Invoking the `delivery-estimate` Edge Function with an origin + 6-digit destination pincode + weight returns a normalized `{ serviceable, cost, etaDays (range), codAvailable }` computed from the seeded zone-weight slab table — the courier-specific shape never leaks past the function (swappable `callCourierAdapter()` boundary)
  2. Serviceability is checked before rating: a non-serviceable destination returns a clean `serviceable:false` result and a non-6-digit / non-numeric pincode is rejected server-side before any compute — never a crash or unhandled 500
  3. The function carries no client secret, echoes only the allow-listed `sutravan.in` origin (no wildcard CORS), is abuse-protected (Turnstile / rate-limit reuse from `verify-and-submit`), and bounds upstream work with a timeout
  4. Repeat lookups for the same `(origin, dest, weight-bucket)` are served from the `delivery_estimate_cache` table within its TTL; the cache is deny-direct RLS with the function as the sole service-role writer
  5. All delivery data exists via idempotent migrations with seeded defaults — `site_content` keys (origin pincode, default weight, dispatch lead time, COD rules, free-ship threshold), the zone-weight slab table, the `pincodes` serviceability dataset, the cache table, and a `profiles.default_pincode` column — so a real estimate returns with no admin UI yet

**Plans**: TBD

### Phase 7: Product Detail Delivery Estimator

**Goal**: The product detail page shows a per-product delivery estimator — the customer enters a pincode and sees estimated cost, an ETA range, and COD availability for that product (using the product's weight, falling back to the admin default) — with every loading / error / unavailable state handled and the result prominently framed as an estimate.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: DLVR-06, DLVR-07, DLVR-08
**Success Criteria** (what must be TRUE):

  1. The product detail page renders a delivery estimate block that, given a pincode, shows estimated shipping cost (integer ₹), an ETA range in working days, and COD yes/no for that specific product
  2. The estimate uses the product's weight where available and transparently falls back to the admin default weight when none exists — the free-text variant label ("70gm") is never parsed for grams
  3. Every state is handled clearly and distinctly: loading skeleton, invalid pincode format (inline), non-serviceable pincode, and fetch failure with a retry affordance
  4. The result is prominently and inline labeled as an estimate (not a guaranteed charge) — cost shown as a range / with disclaimer where appropriate, ETA framed as working days excluding weekends/holidays, anchored to IST
  5. A shared `DeliveryProvider` + `useDelivery` + `useDeliveryEstimate` client layer (mirroring `AuthProvider` / `catalog.ts`) backs the block, and the entered pincode persists (localStorage) so it survives a reload

**Plans**: TBD
**UI hint**: yes

### Phase 8: Site-Wide Pincode — Navbar Widget & Profile Persistence

**Goal**: A global "Deliver to [pincode]" navbar widget lets the customer set or change their pincode from anywhere; the choice persists site-wide via localStorage and, for a logged-in customer, syncs to their profile so it restores across devices and sessions.
**Mode:** mvp
**Depends on**: Phase 6, Phase 7
**Requirements**: DLVR-09, DLVR-10
**Success Criteria** (what must be TRUE):

  1. A "Deliver to [pincode]" widget in the navbar lets the customer set/change their pincode from any page (pill + popover input)
  2. Setting the pincode in the navbar updates the product detail estimator (and vice versa) through the shared `DeliveryProvider` context — one source of truth, no re-entry between pages
  3. The chosen pincode persists in localStorage and is restored on reload for anonymous and logged-in visitors alike
  4. A logged-in customer's chosen pincode is saved to `profiles.default_pincode` and restored on a fresh login from another device/session; an anonymous visitor falls back to localStorage only

**Plans**: TBD
**UI hint**: yes

### Phase 9: Admin Delivery Settings & COD Rules

**Goal**: The owner configures the estimator's core settings through the admin portal — the origin (dispatch) pincode with validation and a live preview, the default fallback weight, the dispatch lead time, COD rules (toggle, fee, value cap), and the free-shipping threshold — with edits reflected in live estimates and no redeploy.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: DLVR-01, DLVR-02, DLVR-04
**Success Criteria** (what must be TRUE):

  1. An admin can set and edit the origin (dispatch) pincode; the form validates it is a 6-digit serviceable pincode and shows a live preview ("From &lt;origin&gt; to &lt;test pincode&gt;: ₹X, Y working days") on save, rejecting an empty/invalid origin
  2. An admin can set the default fallback product weight (grams) and the dispatch lead time (working days), and both flow into live estimates
  3. An admin can configure COD rules — availability toggle, optional COD fee, optional order-value cap — and the customer estimator reflects them
  4. An admin can set an optional free-shipping threshold, surfaced as static "free over ₹X" messaging on the estimate (no cart progress bar)
  5. All settings ride the existing `site_content` admin pattern (upsert + `['siteContent']` cache invalidation) so edits appear in estimates with no code change or redeploy

**Plans**: TBD
**UI hint**: yes

### Phase 10: Admin Zone-Weight Rate Slab Editor

**Goal**: The owner manages the zone-weight rate slab table — the estimated cost and ETA range for each shipping zone × weight band — that drives every estimate, so rates can be tuned to the brand without touching code, behind the same normalized contract a live courier API could later replace.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: DLVR-03
**Success Criteria** (what must be TRUE):

  1. An admin can view, add, edit, and delete zone-weight rate slabs (shipping zone × weight band → estimated cost + ETA day range) in the admin portal
  2. A saved slab change is reflected in live customer estimates (product detail + navbar) with no redeploy
  3. The editor validates entries (cost/ETA) and surfaces coverage gaps so every serviceable destination + weight resolves to a slab or a clean non-serviceable result — no silent ₹0 or missing-slab crash
  4. Estimates continue to flow through the normalized `{ serviceable, cost, etaDays, codAvailable }` contract sourced from the slab table, keeping a future live courier API (DLVR-F1) a drop-in swap with no frontend change

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 6 → 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Supabase Foundation | v1.0 | 3/3 | Complete | 2026-05-31 |
| 2. Live Catalog & Public Shop | v1.0 | 3/3 | Complete | 2026-05-31 |
| 3. Authentication & Roles | v1.0 | 6/6 | Complete | 2026-06-01 |
| 4. Admin Portal | v1.0 | 9/9 | Complete | 2026-06-01 |
| 5. Customer Experience | v1.0 | 4/4 | Complete | 2026-06-01 |
| 6. Estimate Engine — Schema, Settings & Edge Function | v1.1 | 3/3 | Complete   | 2026-06-30 |
| 7. Product Detail Delivery Estimator | v1.1 | 0/— | Not started | - |
| 8. Site-Wide Pincode — Navbar Widget & Profile Persistence | v1.1 | 0/— | Not started | - |
| 9. Admin Delivery Settings & COD Rules | v1.1 | 0/— | Not started | - |
| 10. Admin Zone-Weight Rate Slab Editor | v1.1 | 0/— | Not started | - |
