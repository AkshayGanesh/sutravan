# Project Research Summary

**Project:** Earthen Luxury Sutravan — v1.1 Delivery Estimator
**Domain:** Indian pincode-based delivery cost + ETA + COD estimator, static SPA + Supabase Edge Function, no cart/checkout
**Researched:** 2026-06-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone adds a pre-checkout delivery estimator to an existing React/Vite static SPA (GitHub Pages) backed by Supabase. The pattern is well-established across Indian D2C: a pincode input on the product detail page returns estimated shipping cost, a delivery day range, and COD availability, with the chosen pincode persisted site-wide in a navbar "Deliver to" widget. Because there is no cart or checkout in this version, the estimate is the entire customer-facing artifact — accuracy framing and "estimated" labeling are mandatory, not optional polish.

The recommended baseline is a **zone-weight estimate table** seeded with admin-configurable rate slabs, with pincode validation from the data.gov.in All-India Pincode Directory. This approach ships with zero courier onboarding, no external API keys, no rate limits, and is fully admin-tunable. An optional **Shiprocket live-API branch** can be slotted behind the same Edge Function interface later without any frontend change. Delhivery-direct is enterprise-gated and lacks a clean ETA API — not a viable primary source for a low-volume brand.

The most important cross-cutting risk is the **critical data gap**: there is no numeric weight column in the database. `product_variants.label` is free text ("70gm") and must never be regex-parsed. The MVP posture is to use a `delivery_default_weight_g` site_content key as the universal fallback weight. The second critical risk is **courier onboarding as a hidden critical path** if the live API branch is chosen — KYC takes 24–48 business hours; start it day one, build against mocks in parallel.

## Key Findings

### Recommended Stack

Lead with the **zone-weight table + data.gov.in pincode validation** as the zero-dependency baseline. The live courier branch (Shiprocket recommended for self-serve fit) is an optional accuracy upgrade behind the same normalized Edge Function contract.

**Core technologies:**
- **Supabase Edge Function (`delivery-estimate`):** Server-side broker for all rate logic; holds courier credentials via `Deno.env`; cloned from the v1.0 `verify-and-submit` CORS + secret pattern. Non-negotiable — the static SPA cannot call courier APIs directly.
- **Zone-weight estimate table (Postgres):** Admin-configurable shipping zones, weight slabs, cost, ETA range, and COD flag. Zero external dependencies; deterministic; automatic fallback for all live-API failure modes.
- **data.gov.in All-India Pincode Directory:** Official India Post dataset seeded into a `pincodes` table (~19–20k pincodes). Free, no live dependency required.
- **`site_content` table (+3 keys):** `delivery_origin_pincode`, `delivery_default_weight_g`, `delivery_free_ship_threshold`. Rides existing admin pattern; inherits existing RLS.
- **`delivery_estimate_cache` table (new):** TTL'd cache keyed by (origin, dest, weight bucket); deny-direct RLS; service-role writes from the Edge Function only.
- **`DeliveryProvider` + `useDelivery` (new context):** Site-wide pincode state in localStorage, mirrors AuthProvider; mounted once in App.tsx.
- **Shiprocket live API (optional):** Single GET returns rate + estimated delivery days + COD flag per courier. Free self-serve signup, no volume minimum; token expires ~240h and must be cached server-side.

### Expected Features

**Must have (v1.1):**
- 6-digit pincode input on product detail page with inline client-side validation
- Serviceability + estimated cost (INR) + ETA day range + COD yes/no
- All 5 error/loading states: invalid format, not serviceable, fetch failed with retry, loading skeleton, COD-not-available-but-prepaid-is
- Global navbar "Deliver to [pincode]" widget persisted via localStorage, shared with product widget
- Admin config: origin pincode, default weight fallback (g), dispatch lead time, COD on/off + value cap
- Prominent "Estimate only" disclaimer inline on the product detail block

**Should have (v1.x):**
- ETA as concrete date range ("Delivery by Mon–Wed")
- City/state echo from pincode ("560001 · Bengaluru")
- Save pincode to logged-in customer profile (cross-device)
- Free-shipping-over-₹X messaging (static, no cart progress bar)
- COD fee shown explicitly

**Defer (v2+ / e-commerce milestone):**
- Cart-level aggregated shipping, real shipment creation, tracking, multi-courier selection, free-shipping progress bar

### Architecture Approach

Purely integration work on v1.0 patterns — no new paradigms. `DeliveryProvider` (mirrors `AuthProvider`) holds pincode in localStorage; `useDeliveryEstimate` (mirrors `catalog.ts` hooks) invokes the Edge Function; the Edge Function returns a normalized `{serviceable, cost, etaDays, codAvailable}` shape the vendor response never leaks past. Two UI surfaces (navbar widget, product detail block) read from the same context. Build order: migrations → Edge Function → hook/provider → UI → admin form.

**Major components:**
1. `delivery-estimate` Edge Function (new) — CORS + secret + pincode validation + cache + courier adapter + normalization
2. `delivery_estimate_cache` table (new) — TTL'd Postgres cache, deny-direct RLS
3. `site_content` +3 keys (modify) — origin pincode, default weight, free-ship threshold
4. `DeliveryProvider` + `useDelivery` (new) — localStorage-backed site-wide pincode state
5. `useDeliveryEstimate` hook (new) — TanStack Query wrapper with weight bucketing
6. `DeliveryWidget.tsx` (new) — navbar pill + popover input
7. `DeliveryEstimate.tsx` (new) — product-detail estimate block with all UX states
8. Admin settings UI (modify) — 3 new fields in the existing site-content form

### Critical Pitfalls

1. **Courier onboarding/KYC blocks milestone if started late** — Start KYC day one if live API is chosen; build against mocks in parallel. The zone-weight baseline eliminates this risk entirely.
2. **No numeric weight column — never regex `product_variants.label`** — Use `delivery_default_weight_g` site_content key as the universal fallback. Adding per-variant `weight_g int` is a post-launch accuracy upgrade.
3. **Estimate-as-promise risk (no checkout to reconcile)** — Label everything "Estimated" prominently and inline, show a day range, apply a round-up buffer. Decide the rounding policy with the owner before implementation.
4. **Courier token leak via client-direct shortcut** — Token lives exclusively in Edge Function secrets. Add a CI grep guard: no courier hostname or credential anywhere under `client/`.
5. **Unauthenticated endpoint abuse** — Reuse hosted-CDN Turnstile pattern (no npm wrapper), Postgres TTL cache, server-side format validation before any upstream call, explicit CORS allowlist (`corsHeadersFor()` from `verify-and-submit`).

## Implications for Roadmap

### Suggested Phase Structure (continues numbering from v1.0 — starts at Phase 6)

**Schema and Admin Settings**
Edge Function reads `site_content` keys and the cache table on every request — they must exist before deployment. Delivers: 3 `site_content` keys + `delivery_estimate_cache` table (deny-direct RLS) + zone-weight tables + `pincodes` dataset + optional `profiles.default_pincode`. Avoids origin-misconfiguration + missing-weight crash.

**Edge Function — `delivery-estimate`**
The normalized contract must be fixed before any UI; stub the courier adapter so UI is not blocked on KYC. Delivers: Edge Function with CORS allowlist, Turnstile/rate-limit, settings read, Postgres cache, zone-weight lookup + adapter stub, normalized output. Avoids token leak, anon abuse, no-timeout, no-cache, vendor lock-in.

**Client Library — Hook and Provider**
Both UI surfaces depend on the same context/hook. Delivers: `DeliveryProvider`, `useDelivery`, `useDeliveryEstimate`, `weightBucket()` helper.

**Product Detail Estimator UI**
Primary user value, most complex UX state. Delivers: `DeliveryEstimate.tsx` with all UX states, "Estimated" disclaimer, INR integer formatting, working-days ETA range in IST, COD badge.

**Navbar Widget + Admin UI**
Low-complexity additions riding built infrastructure. Delivers: `DeliveryWidget.tsx` (navbar pill + popover), admin form with 3 new fields + live preview validation on origin pincode.

**(Optional) Live Courier API Integration**
Wire Shiprocket behind the existing adapter once KYC approved and a prod smoke test passes; zone-weight remains the automatic fallback. No frontend changes required.

### Research Flags

Needs research: the optional live-courier phase — Shiprocket `serviceability/` response shape for edge-case pincodes (NE states, J&K, islands), COD fee model, token refresh mechanics.
Standard patterns (skip research): all baseline phases map directly to v1.0 patterns (idempotent seed migrations, `verify-and-submit` clone, AuthProvider mirror, catalog hook mirror, Navbar modification, admin site-content form).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Shiprocket/Delhivery endpoints + auth verified against official docs; exact 2026 plan fees negotiation-dependent |
| Features | MEDIUM | UX patterns verified across Indian D2C; no first-party live endpoint testing |
| Architecture | HIGH | Grounded in the project's own shipped v1.0 source code |
| Pitfalls | HIGH | Supabase Edge Function security + courier auth verified from official docs; legal framing is judgement-based |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address (owner decisions)

- Zone-weight rate slab values — brand decision; owner must populate before the UI shows real numbers.
- COD fee model — fixed admin charge vs courier's %-or-flat model — decide in the schema phase.
- `delivery_default_weight_g` seed value — owner confirms fallback (~100–150g soap, 200–300g jars).
- Rounding/buffer policy — raw rates exclude GST + fuel surcharge; decide round-up before the UI phase.
- Live API vs estimate-only — does the owner open a Shiprocket account, or ship estimate-only first? Determines whether the optional live-courier phase is in scope.

---
*Research completed: 2026-06-27*
*Ready for roadmap: yes*
