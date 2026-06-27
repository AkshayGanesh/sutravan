# Stack Research — Pincode Delivery Cost + ETA + COD Estimator

**Domain:** Indian D2C shipping-rate / serviceability integration for a low-volume handmade-skincare brand (sutravan.in)
**Researched:** 2026-06-27
**Confidence:** MEDIUM-HIGH (endpoints + auth models verified against official/vendor docs; exact 2026 plan fees vary by negotiation and were not all independently verifiable)

---

## TL;DR Recommendation

For a **pre-checkout estimate** on a **static SPA + Supabase Edge Function**, lead with a **zone-weight estimate table** (zero onboarding, instant, admin-tunable) as the **baseline**, and offer a **live courier API as an optional accuracy upgrade**.

- **Primary (live API, if a courier account is wanted): Shiprocket Courier Serviceability API** — one GET call returns, per courier, the shipping **cost + estimated delivery days (ETD) + COD availability**. Free signup, no minimum volume, plain REST, callable from a Deno Edge Function. Best small-business fit of all aggregators.
- **Fallback / default-shippable approach: an admin-configured zone-weight rate+ETA table** seeded from the dispatch pincode, with pincode validation/city-state resolution from the **data.gov.in All-India Pincode Directory** dataset. Requires **no courier account at all** — the feature can ship before the brand commits to any logistics contract.
- **Delhivery (user-named): viable but a weaker fit.** It exposes serviceability (prepaid/COD flags) and an approximate shipping-charge API, but **no clean ETA-by-pincode API**, and onboarding requires a **GST business account + KYC + a prepaid wallet (₹500 min)**. Recommend it only as a secondary source — best if the brand already dispatches via Delhivery and wants its own contracted rates.
- **Avoid for this milestone:** ClickPost (enterprise/contract), direct Blue Dart / DTDC APIs (corporate onboarding, volume minimums), and Pickrr (absorbed into Shiprocket — not a standalone product).

---

## Recommended Stack

### Core Technologies

| Technology | Version / Endpoint | Purpose | Why Recommended |
|------------|--------------------|---------|-----------------|
| **Zone-weight estimate table** (in Postgres) | n/a (own schema) | Deterministic cost + ETA + COD per (origin→dest, weight slab) | Zero third-party onboarding, no API keys, no rate limits, instant, admin-tunable, works offline. The customer cannot act on a "live" rate (no checkout yet), so an estimate is sufficient and removes a hard external dependency. |
| **Supabase Edge Function (Deno)** | existing runtime | Server-side broker for any courier API call; holds the API token as a secret | Already proven in v1.0 (`verify-and-submit`). The only place a courier secret can live without leaking into the public GitHub Pages bundle. `fetch`-based, perfect for REST courier APIs. |
| **data.gov.in — All-India Pincode Directory** | resource on data.gov.in (free API key) | Validate the 6-digit pincode and resolve it to district/state/city for zone classification + "Deliver to X" labels | Official Govt of India dataset (India Post source). ~19–20k serviceable pincodes. Distributable as a seeded Postgres table (no live dependency) or via its data.gov.in REST API. |
| **Shiprocket Courier Serviceability API** *(optional live upgrade)* | `GET https://apiv2.shiprocket.in/v1/external/courier/serviceability/` | One call → list of couriers each with `rate`, `etd`/`estimated_delivery_days`, `cod` flag | Single endpoint covers all three required outputs (cost + ETA + COD). Free account, **no minimum volume**, REST + Bearer token — the cleanest small-business live option. |

### Supporting Libraries / Schema additions

| Item | Where | Purpose | When to Use |
|------|-------|---------|-------------|
| `shipping_origin` config (single row or `site_content` key) | Postgres | Admin-configurable dispatch pincode (drives every estimate) | Always — required by the milestone. |
| `shipping_zones` + `shipping_rate_slabs` tables | Postgres | Zone definitions (Local / Regional / Metro / Rest-of-India / Special: NE+J&K+islands) and per-zone weight-slab cost + ETA range + COD flag | Always (the fallback/baseline engine). |
| `pincodes` table (seeded from data.gov.in) | Postgres | Pincode → district/state/zone-class lookup, validity check | Always — needed for both validation and zone mapping. |
| `shipping_quote_cache` table | Postgres | Cache `(origin, dest, weight_slab) → quote` with a TTL | Only if the live API is enabled — cuts latency + API calls for the navbar widget that fires on many page views. |
| `courier_tokens` table (or Edge Function secret + DB cache) | Postgres / Vault | Store the Shiprocket Bearer token (valid ~240h) and refresh on 401/expiry | Only if Shiprocket live API is enabled. |
| TanStack Query hook (`useDeliveryEstimate`) | `client/src/lib/` | Client read path → calls Edge Function (live) or reads zone table (baseline) | Always — mirrors existing `catalog.ts` pattern. |
| Persisted pincode (localStorage + context) | `client/src/` | "Deliver to [pincode]" persists site-wide | Always — navbar widget requirement. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `supabase functions deploy` | Ship the estimator Edge Function | Same flow as v1.0 `verify-and-submit`. |
| `supabase secrets set` | Store `SHIPROCKET_EMAIL/PASSWORD` (or Delhivery token) | Never in the client bundle; `check-no-secret.sh` already guards this. |
| Postman (Shiprocket public workspace) | Explore/verify the live serviceability response shape before coding | `apidocs.shiprocket.in` has a "Run in Postman" collection. |

---

## API Comparison (small-volume fit)

| Provider | Rate calc | Serviceability | COD flag | ETA in API | Self-serve signup | Min volume / contract | API access cost | Auth model | Edge-Function callable |
|----------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|:--:|
| **Shiprocket** (aggregator) | ✅ | ✅ | ✅ | ✅ (`etd`/days) | ✅ free | **None** (free Lite plan) | Free to call; pay per shipment only when you ship | POST email+pwd → Bearer token (~240h, refresh) | ✅ |
| **NimbusPost** (aggregator) | ✅ | ✅ | ✅ | ✅ (EDD) | ✅ self-serve creds from dashboard | None advertised | Free to call; pay per shipment | key + email + password → token | ✅ |
| **Delhivery** (direct carrier) | ✅ (approx Invoice API) | ✅ (prepaid+COD flags) | ✅ | ⚠️ Not in serviceability/invoice API (TAT only in UI) | ⚠️ account + **GST + KYC + ₹500 wallet** | No volume min, but business KYC required | Free to call once onboarded | `Authorization: Token <api_token>` | ✅ |
| **iThink Logistics** (aggregator) | ✅ | ✅ | ✅ | ✅ | partial (service-first, account manager) | None hard, but premium positioning | Per-shipment | token | ✅ |
| **Shipway** (aggregator, NDR/tracking-led) | ✅ | ✅ | ✅ | ✅ | ✅ | None | Per-shipment | token | ✅ |
| **ClickPost** (enterprise SaaS) | ✅ | ✅ | ✅ | ✅ | ❌ sales-led | **Volume/contract** | Platform SaaS fee | key | ✅ (but overkill) |
| **Blue Dart / DTDC** (direct) | ✅ | ✅ | ✅ | partial | ❌ corporate onboarding | Account + volume | Contract | key/credentials | ✅ |
| **India Post** | ❌ no usable live rate API | dataset only | ❌ | ❌ | n/a | n/a | Free dataset | data.gov.in API key | ✅ (dataset only) |

Notes verified from docs:
- **Shiprocket serviceability**: `GET /v1/external/courier/serviceability/?pickup_postcode=&delivery_postcode=&weight=&cod=0|1` returns an array of `available_courier_companies`, each with `rate`, `estimated_delivery_days`/`etd`, and COD support. Token via `POST /v1/external/auth/login` (`{email, password}`) → Bearer valid ~240h. (`apidocs.shiprocket.in`)
- **Delhivery serviceability**: `GET https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=<pin>` → prepaid/COD serviceability flags; `NSZ` = not serviceable. (`delhivery-express-api-doc.readme.io`)
- **Delhivery charges**: `GET https://track.delhivery.com/api/kinko/v1/invoice/charges/.json?md=E|S&cgm=<grams>&o_pin=&d_pin=&ss=Delivered` → `gross_amount`, tax, `total_amount` (explicitly "approximate"), rate-limited ~40 req/min. `md=E` prepaid, `md=S` COD. No ETA field. Auth = `Authorization: Token <token>` from Delhivery One developer portal.
- **Onboarding friction (Delhivery)**: Delhivery One requires GST number + GST document upload to activate a business account, ~3-min KYC, and a prepaid wallet recharge (min ₹500) to operate.

---

## Architecture fit: static SPA + Edge Function

**The read path is synchronous request/response — nothing here requires a persistent server or inbound webhook.**

```
Browser (GitHub Pages SPA)
  → useDeliveryEstimate(productWeight, destPin)
  → supabase.functions.invoke('delivery-estimate', { destPin, weightGrams })
      Edge Function (Deno):
        1. validate destPin (pincodes table)
        2. read shipping_origin (dispatch pin)
        3. IF live API enabled:
             - get/refresh cached courier token
             - fetch courier serviceability (origin, dest, weight, cod)
             - pick cheapest serviceable courier → {cost, etaDays, cod}
             - cache in shipping_quote_cache (TTL)
           ELSE / on failure / not serviceable:
             - classify zone (origin vs dest state) → slab → {cost, etaRange, cod}
  → render cost + "Delivery in N–M days" + COD badge / "Not serviceable"
```

- **Secrets**: courier token/credentials live in Edge Function env (`supabase secrets`), never in the bundle — identical to the v1.0 Turnstile pattern.
- **No webhooks needed**: courier webhooks are for *shipment lifecycle* (tracking, NDR), which this estimate-only feature does not use. So the static-SPA constraint is fully satisfied.
- **Token lifecycle**: Shiprocket's 10-day Bearer token must be cached server-side (a `courier_tokens` row) and re-minted on 401 — do NOT log in per request (avoids rate limits + latency). Delhivery's token is long-lived and stored as a plain secret.
- **Caching matters**: the navbar "Deliver to [pincode]" widget can fire on many navigations. Cache quotes by `(origin, dest, weight_slab)` in Postgres with a TTL (e.g. 24h) to cut API calls and keep the widget snappy. The zone table needs no cache (it's a local read).

---

## Is a pure pincode/serviceability dataset approach viable?

**Yes — and it is the recommended baseline.** A live rate API gives precision the customer can't act on (no checkout), while adding KYC/contract, tokens, rate limits, latency, and a runtime dependency on a third party.

- **Serviceability + validation + geo**: the **data.gov.in All-India Pincode Directory** (official, India Post sourced) resolves any pincode to office/district/state and confirms it's a real deliverable pincode. Seed it into a `pincodes` table (one-time import; ~19–20k unique pincodes). Free `data.gov.in` API key for refreshes.
- **Cost + ETA**: dataset alone has no price/ETA, so layer a **zone-weight slab table**:
  - Classify each quote by dispatch-state vs destination-state into zones: **Local**, **Regional (same/adjacent state)**, **Metro**, **Rest-of-India**, **Special (NE states, J&K/Ladakh, A&N + Lakshadweep islands)**.
  - Per zone × weight-slab: an admin-set **cost**, **ETA range (min–max days)**, and **COD allowed** flag.
  - Origin pincode is admin-configurable (milestone requirement) and selects the zone reference.
- **Why this is the pragmatic primary**: it ships today with no external account, is fully admin-tunable in the existing portal, is deterministic and testable, and degrades gracefully ("estimate unavailable" only on an invalid pincode). The live API can be slotted in later behind the same Edge Function interface without a frontend change.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Zone-weight table (baseline) | Shiprocket live API | When the brand opens a Shiprocket account and wants real per-courier rates/ETAs reflected to customers. Same Edge Function, swap the data source. |
| Shiprocket (live primary) | NimbusPost | Equivalent small-biz fit; choose NimbusPost if the brand already uses it or prefers its self-serve dashboard credentials and COD remittance terms. Functionally interchangeable for this feature. |
| Shiprocket | Delhivery direct | When the brand **already dispatches via Delhivery** and wants its own contracted rates + accurate serviceability. Accept the ETA gap (layer the zone ETA table on top) and the GST/KYC/wallet onboarding. |
| Shiprocket | iThink Logistics / Shipway | If the brand already has an account there. No advantage for a tiny brand starting fresh; onboarding is heavier/service-led. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **ClickPost** | Enterprise multi-carrier SaaS — sales-led onboarding, platform fee, volume/contract expectation. Massive overkill for per-product estimates on a tiny brand. | Shiprocket / NimbusPost free tier, or the zone table. |
| **Pickrr** | Acquired by Shiprocket (2022) and folded into the Shiprocket platform — not a standalone product to integrate against. | Shiprocket directly. |
| **Direct Blue Dart / DTDC APIs** | Corporate onboarding, account managers, volume minimums; no self-serve free tier. | Aggregator (Shiprocket/NimbusPost) which fans out to these carriers anyway. |
| **India Post live rate API** | No usable public real-time rate/serviceability API; only static datasets and a manual postage calculator. | data.gov.in pincode dataset for validation + zone table for cost/ETA. |
| **Calling any courier API directly from the React client** | Leaks the API token into the public GitHub Pages bundle; CORS will also block it. | Always proxy through the Supabase Edge Function (server-side secret), as in v1.0. |
| **Logging in to Shiprocket per request** | 10-day token + login rate limits; adds latency. | Cache the Bearer token server-side, refresh on 401. |
| **Treating Delhivery Invoice `total_amount` as exact** | Docs state it is approximate. | Present as an estimate; round/buffer for display. |

---

## Stack Patterns by Variant

**If the brand will not open a courier account this milestone (most likely):**
- Ship the **zone-weight table + data.gov.in pincode validation** only.
- Edge Function still used (keeps origin config + zone logic server-side and consistent), but no external calls.
- Fastest, zero-dependency, fully admin-controlled.

**If the brand opens a Shiprocket (or NimbusPost) account:**
- Enable the live branch in the Edge Function; cache token + quotes in Postgres.
- Keep the zone table as the automatic fallback (API down / pincode not serviceable / non-account weight edge cases).

**If the brand already ships via Delhivery:**
- Use Delhivery serviceability (prepaid/COD flags) + Invoice charges for cost.
- Source **ETA from the zone table** (Delhivery's API doesn't return per-pincode TAT cleanly).
- Requires GST + KYC + ₹500 wallet onboarding before the token works.

---

## Version Compatibility / Integration notes

| Component | Integrates with | Notes |
|-----------|-----------------|-------|
| Supabase Edge Functions (Deno) | Shiprocket/NimbusPost/Delhivery REST | Native `fetch`; no SDK needed. Avoid Node-only courier npm wrappers (Deno + bundle-size). |
| Product weight | `product_variants.weight` (existing) | Already present from v1.0 SKUs — feed grams to the rate call/slab lookup. Handle products with no variant weight (default/min weight). |
| Pincode persistence | localStorage + React context | Mirror existing patterns; hydrate the navbar widget + product page from one source. |
| RLS | `pincodes`, `shipping_zones`, `shipping_rate_slabs` = public read; `shipping_origin` + slabs admin-write | Same default-deny + `is_admin()` model as v1.0. |

---

## Sources

- Delhivery Express API docs — `https://delhivery-express-api-doc.readme.io/` (Pincode Serviceability API; Invoice/Shipping Charge API params `md/cgm/o_pin/d_pin/ss`, ~40 req/min, "approximate" charge) — HIGH (official)
- Delhivery One help center — `https://help.delhivery.com/docs/` (Serviceability & Rate Calculator shows TAT in UI; API token generation; GST/KYC onboarding; ₹500 wallet) — HIGH (official)
- Shiprocket API docs — `https://apidocs.shiprocket.in/` + Postman public workspace (courier serviceability endpoint returns rate + estimated delivery days + COD; auth login → Bearer token ~240h) — HIGH (official/vendor)
- Shiprocket support — token validity 240h, API-user email/password generation — MEDIUM (vendor support articles)
- NimbusPost — `nimbuspost.com` + Postman (self-serve API credentials, serviceability + EDD, 29k+ pincodes) — MEDIUM (vendor)
- data.gov.in All-India Pincode Directory + Kaggle "All India Pincode Directory (2025)" / data.opencity.in India Pincode Maps 2025 (~19–20k pincodes, official India Post source) — HIGH (govt dataset)
- ClickPost blog "Best 10 Shipping/Courier Aggregators in India [2026]" + comparisons (iThink/Shipway/Pickrr positioning) — MEDIUM (vendor comparison)
- Business Insider / Sacra / Tracxn — Shiprocket acquired Pickrr (2022), integrated as a brand under Shiprocket Ltd — HIGH (multiple sources agree)

---
*Stack research for: Indian pincode delivery cost + ETA + COD estimator (small-volume D2C, static SPA + Supabase Edge Function)*
*Researched: 2026-06-27*
