# Feature Research

**Domain:** Pincode-based delivery cost & ETA estimator for an Indian D2C skincare storefront (no cart / no checkout)
**Researched:** 2026-06-27
**Confidence:** MEDIUM (UX patterns + Delhivery API mechanics verified across multiple Indian logistics sources; no Context7 coverage for this domain — confidence is MEDIUM not HIGH because exact courier response shapes and small-brand norms come from vendor docs + WebSearch, not first-party testing)

## Scope Anchor (read first)

This milestone (v1.1) ships an **estimator**, not shipping. There is no cart, no order, no
shipment creation, no payment. The output is informational: for a **single product**,
given a destination pincode, show **estimated cost + ETA + COD availability**. Every
recommendation below is filtered through "small handmade brand, per-product, no
checkout." Anything that only makes sense once a cart/checkout exists is an anti-feature
here.

## How Indian D2C pincode estimators actually behave (the pattern)

Across Amazon, Flipkart, Nykaa, and small Shopify stores the widget is consistent:

1. A compact input labeled **"Check delivery" / "Enter pincode"** sits on the product
   detail page, usually right under price/variant. A **6-digit** numeric field + a
   "Check" button.
2. On submit the site validates the pincode (6 digits, valid Indian prefix), then runs
   a **serviceability check** against the courier for that destination.
3. It returns a small result block: **ETA** (either "3-5 days" or an explicit date
   range like "Delivery by Mon, 30 Jun"), **COD: Yes/No**, and on stores that charge
   shipping, the **shipping cost** (or "Free delivery"). Big marketplaces hide cost
   until checkout; **small D2C stores show it up front** — which is exactly this
   milestone's value.
4. ETA is computed from **distance between origin and destination pincode** (zone),
   plus a dispatch/handling lead time, adjusted for holidays/bottlenecks.
5. The chosen pincode is treated as a **site-wide "Deliver to" context** (navbar shows
   "Deliver to 560001 — Bengaluru") that persists and pre-fills the product widget.

Error/empty states seen in the wild (each is a distinct, testable UX state):
- **Invalid format** -> inline "Enter a valid 6-digit pincode" (no network call).
- **Not serviceable** -> "Sorry, we don't deliver to 737101 yet" (hide COD/cost/ETA).
- **COD not available, prepaid is** -> still show ETA + cost, mark "COD not available
  for this area."
- **Estimate temporarily unavailable** (API/timeout) -> "Couldn't fetch an estimate —
  please try again" with a retry; never a blank or a fabricated number.
- **Loading** -> spinner/skeleton on the result block while the check runs.

## What an estimate needs (inputs) + sensible defaults for one soap/scrub/cream

| Input | Source | Default / fallback for this brand |
|-------|--------|-----------------------------------|
| Destination pincode | Customer (widget) | none — required input |
| Origin (dispatch) pincode | **Admin config (new)** | required; single value, the brand's one dispatch location |
| Weight (actual) | `product_variants.weight` (exists) | **Admin "default weight fallback"** when a variant has no weight; bar soap ~100-150 g, jar scrub/cream ~200-300 g |
| Dimensions (LxBxH) | usually not tracked per product | a **single default parcel size** in admin (e.g. 12x9x5 cm); needed only if billing on volumetric weight |
| Volumetric weight | derived | `LxBxH / 5000` (cm); courier bills the **higher** of actual vs volumetric. A single soap is well under volumetric, so actual weight dominates — dimensions barely matter here |
| Payment mode | shown for both | show **both** prepaid + COD outcomes; no cart so no real selection |
| Order value (COD cap / COD fee) | product price (exists) | used only to (a) gate COD against an admin COD cap and (b) estimate the COD fee (Rs 40-50 or 2% of value, whichever higher) |

**Key simplification for a no-cart, single-product estimator:** because it's one low-weight
item, the estimate collapses to essentially **(origin pincode, destination pincode,
weight)**. Dimensions and volumetric weight are second-order and can be a fixed admin
default. Do not build per-product dimension capture this milestone.

## Cost source decision (FLAG — belongs in STACK, gates behavior)

There are two ways to produce the cost number, and this choice changes the feature's
honesty and ops cost:

- **A. Live courier rate API (Delhivery / aggregator)** via a Supabase **Edge Function**
  (key stays server-side). Pros: real serviceability + COD flags + accurate cost/TAT.
  Cons: needs a courier account, API quota, latency, failure handling. Delhivery's rate
  calc takes origin, destination, weight, dims, payment mode, COD amount; its
  serviceability API returns prepaid/COD flags + an ODA flag.
- **B. Static zone table** the admin maintains (origin->zone bands with a flat rate + day
  range, plus a serviceable-region list). Pros: zero external dependency, fully
  owner-controlled, instant. Cons: manual upkeep, less precise, no live COD-by-pincode.

For a **small pre-checkout brand**, B (or a hybrid: free pincode->city/state validation
for serviceability + a zone table for cost/ETA) is the pragmatic, low-ops default; A is
the "do it properly" path the milestone's research requirement points at. **This FEATURES
doc treats the cost source as a dependency** — the UX/behavior below is identical either
way. Recommend STACK make the call.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 6-digit pincode input on product detail page | This is the feature; users look for it under price | LOW | Numeric, maxlength 6; "Check" button + Enter-to-submit |
| Client-side pincode validation | Avoid wasted calls / clear errors | LOW | 6 digits, first digit 1-9 (Indian pincodes never start with 0); inline error before any network call |
| Serviceability result (serviceable / not) | Core question "will it reach me?" | MEDIUM | Drives whether cost/ETA/COD are shown at all |
| Estimated shipping cost in INR (or "Free delivery") | Headline value of this milestone | MEDIUM | Depends on cost source (above); always show "estimate" framing |
| Delivery ETA as a day range | "When will it arrive?" — universal | MEDIUM | "3-5 days" is the floor; concrete dates are the upgrade (differentiator) |
| COD availability (Yes / No) | COD is a top purchase factor in India | LOW-MEDIUM | From courier flag (A) or admin region rule (B); gate by admin COD toggle + value cap |
| Loading state during check | Perceived responsiveness | LOW | Spinner/skeleton on the result block |
| Error / unavailable states | Trust — never show a fake/blank number | MEDIUM | Distinct copy for invalid format vs not-serviceable vs fetch-failed (with retry) |
| Global navbar "Deliver to [pincode]" widget | Site-wide context users set once | MEDIUM | Shows current pincode (+ city if available); click to change |
| Persist chosen pincode site-wide (localStorage) | Don't re-ask on every product | LOW | Survives reloads/navigation; pre-fills the product widget |
| Product widget reflects the persisted pincode | One source of truth, set once | LOW | Navbar and product widget read/write the same stored value |
| "Estimate only" disclaimer | Manage expectations pre-checkout | LOW | Small note: actuals confirmed at order; protects the brand on accuracy |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ETA as concrete dates ("Delivery by Mon 30 Jun - Wed 2 Jul") | Premium, concrete vs "3-5 days" | MEDIUM | Add dispatch lead-time + courier TAT to "today," skip Sundays/holidays |
| City/state echo from pincode ("560001 · Bengaluru") | Confirms the right area; premium feel | LOW-MEDIUM | Free India Post API (`api.postalpincode.in`) or a bundled pincode->city table; doubles as a serviceability sanity check |
| Save pincode to logged-in customer profile | Persists across devices; uses existing accounts | LOW | Auth + profile already exist (v1.0); store on profile, fall back to localStorage for guests |
| Explicit COD fee shown ("COD available, +Rs 40 fee") | Transparency on the most-used payment mode | LOW | Rs 40-50 or 2% of value, whichever higher; only if cost source supports it |
| Free-shipping-over-Rs X messaging | Nudge to higher value; common D2C tactic | LOW | Compare product price to admin threshold; show "Free delivery" or "Free over Rs X" — see anti-features for the no-cart caveat |
| Estimate caching (per origin+dest+weight bucket) | Cuts courier API calls; instant repeat checks | LOW-MEDIUM | Cache in a Supabase table or client memory with TTL; only valuable with live API (A) |
| Surface vs Express ETA/cost split | Shows speed/price tradeoff | MEDIUM | Only if cost source returns both; otherwise skip |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Cart-level / multi-item aggregated shipping | "Show total shipping" | **No cart exists this milestone**; aggregation is checkout work | Strict per-product estimate; revisit in e-commerce milestone |
| Real order / shipment creation, payment, COD collection | "Connect it to ordering" | Out of scope per PROJECT.md; estimator only | Estimate is read-only; ordering is the next milestone |
| Multi-courier comparison matrix (Delhivery vs BlueDart vs ...) | "Let buyers pick a courier" | Buyers don't choose couriers on D2C; huge integration surface for a small brand | One configured courier / one zone table; brand decides logistics |
| Live shipment tracking | "Where's my order" | Nothing is ordered yet; no tracking ID exists | Defer to e-commerce milestone |
| Full address book / address capture | "Get the full address" | Pincode is all an estimate needs; address belongs to checkout | Pincode only; collect address at checkout later |
| Per-pincode inventory / stock-by-location | "Is it in stock for me" | Single dispatch origin, handmade small-batch; no regional warehouses | Use the existing out-of-stock flag, not pincode-scoped |
| Same-day / quick-commerce promises | "Match Blinkit speed" | Impossible for handmade dispatch; sets false expectations | Honest day-range ETA with dispatch lead time |
| Penny-accurate pricing | "Exact rupee cost" | Estimates drift from actuals (fuel/zone/dim changes); erodes trust when wrong | "Estimated" framing + disclaimer; round sensibly |
| Per-pincode COD fraud/risk scoring | "Block risky COD areas" | Needs order history this brand doesn't have; over-engineering | Simple admin COD on/off + value cap |
| Auto-detect location via IP/geolocation | "Skip typing" | Permission friction, often wrong city, privacy noise for low payoff | Manual entry + persistence; optional later |
| Free-shipping progress bar ("add Rs X more") | Upsell nudge | Implies a cart to add to — there is none | Static "Free delivery over Rs X" message only, no progress logic |

## Feature Dependencies

```
Pincode estimate (cost + ETA + COD)
    |--requires--> Origin pincode (NEW admin config)
    |--requires--> Product weight (product_variants.weight — EXISTS, with admin fallback)
    |--requires--> Cost source: live courier API (Edge Function) OR admin zone table  [STACK decision]

Global "Deliver to" navbar widget
    |--requires--> Persistence layer (localStorage)
                       |--enhanced by--> Save-to-profile (requires Auth — EXISTS)

Product-page widget --shares state with--> Navbar widget  (single stored pincode)

ETA-as-dates --enhances--> ETA-as-days   (needs dispatch lead time + holiday calendar from admin)

City/state echo --enhances--> Serviceability  (free postal pincode lookup)

COD fee display --requires--> Cost source that returns COD economics (option A) OR admin COD-fee rule (option B)
```

### Dependency Notes

- **Estimate requires origin pincode:** ETA/zone is meaningless without a from-pincode;
  this is the one genuinely new admin field that gates everything.
- **Estimate requires product weight:** `product_variants.weight` exists from v1.0; the
  estimator must handle variants with missing weight via an **admin default-weight
  fallback** (do not crash or guess silently).
- **Cost source gates COD/express/fee features:** if STACK picks a static zone table (B),
  COD fee and surface/express split become admin rules, not API outputs — design those
  as differentiators, not table stakes.
- **Save-to-profile is additive over localStorage:** localStorage is the base; profile
  storage is a logged-in-only enhancement, not a replacement (guests must still work).
- **Navbar and product widgets must share one value:** they read/write the same stored
  pincode so setting it anywhere reflects everywhere — this is the "persisted site-wide"
  requirement made concrete.

## Persistence model (recommendation)

- **Base:** store the chosen pincode (and cached city/state) in **localStorage** under a
  single key; read on app load to hydrate both navbar and product widgets. Works for
  guests, survives reloads/navigation, zero backend.
- **Logged-in upgrade:** persist the pincode on the **customer profile** (auth + profile
  exist from v1.0). On login, if the profile has a pincode and localStorage is empty (or
  differs), prefer the profile value; keep localStorage in sync for fast reads.
  Cross-device persistence is the payoff. **Yes, logged-in customers should get it saved
  to their profile** — but as an enhancement layered over localStorage, not instead of it.
- **Estimates themselves:** do **not** persist long-term per user; they're a function of
  (origin, dest, weight) and change. With the live API (A), cache by origin+dest+weight
  bucket with a short TTL (server table or in-memory) to cut calls.
- **Reset/empty:** first-time visitor sees "Deliver to —" prompting entry; clearing the
  pincode returns to that state.

## Admin configuration (owner must set)

| Setting | Required? | Why | Default |
|---------|-----------|-----|---------|
| Origin / dispatch pincode | **Yes** | Drives every zone/ETA/cost calc | none — must be set before feature works |
| Default weight fallback (g) | Yes | For variants missing weight | e.g. 150 g (single soap) |
| Default parcel dimensions (cm) | Optional | Only if billing on volumetric weight | e.g. 12x9x5; can hardcode if always negligible |
| Dispatch / handling lead time (days) | Yes | Added to courier TAT for honest ETA | e.g. 1-2 days (handmade) |
| COD enabled (on/off) | Yes | Brand may not offer COD at all | off until owner opts in |
| COD order-value cap (Rs) | If COD on | Hide COD above a risk threshold | e.g. Rs 5,000 |
| Free-shipping threshold (Rs) | Optional | Enables "Free delivery over Rs X" copy | unset = always show cost |
| Courier API credentials | If cost source = live API | Must stay **server-side (Edge Function)** | n/a |
| Estimate disclaimer copy | Optional | Manage accuracy expectations | sensible default string |

All admin-write paths must follow the existing RLS / `is_admin()` pattern; any courier
API key lives in the Edge Function environment, never in the client.

## MVP Definition

### Launch With (v1.1)

- [ ] 6-digit pincode input + validation on product detail page — the core feature
- [ ] Serviceability + estimated cost + ETA (day range) + COD Yes/No for that product
- [ ] All error/unavailable states (invalid, not serviceable, fetch failed + retry, loading)
- [ ] Global navbar "Deliver to [pincode]" widget, persisted via localStorage, shared with the product widget
- [ ] Admin config: origin pincode, default weight fallback, dispatch lead time, COD on/off (+ cap)
- [ ] Cost source wired per STACK decision (live Edge Function API or zone table), secrets server-side
- [ ] "Estimate only" disclaimer

### Add After Validation (v1.x)

- [ ] ETA as concrete dates (skip Sundays/holidays) — once buyers ask "when exactly"
- [ ] City/state echo from pincode — once a free pincode lookup is wired
- [ ] Save pincode to logged-in profile (cross-device) — when repeat logged-in usage shows up
- [ ] Free-shipping-over-Rs X messaging — when the brand sets a threshold
- [ ] Estimate caching with TTL — when live-API call volume/latency becomes a concern

### Future Consideration (v2+ / e-commerce milestone)

- [ ] Cart-level aggregated shipping — only once a cart exists
- [ ] Real shipment creation + tracking — belongs to ordering/checkout
- [ ] Surface vs Express choice at checkout — once payment exists
- [ ] Multi-courier selection — only if logistics strategy ever needs it (likely never for this brand)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pincode input + validation (product page) | HIGH | LOW | P1 |
| Serviceability + cost + ETA + COD result | HIGH | MEDIUM | P1 |
| Error/unavailable/loading states | HIGH | MEDIUM | P1 |
| Navbar "Deliver to" widget + localStorage persist | HIGH | MEDIUM | P1 |
| Admin: origin pincode + weight fallback + lead time + COD | HIGH | MEDIUM | P1 |
| Cost source integration (API or zone table) | HIGH | MEDIUM-HIGH | P1 |
| ETA as concrete dates | MEDIUM | MEDIUM | P2 |
| City/state echo | MEDIUM | LOW | P2 |
| Save pincode to profile | MEDIUM | LOW | P2 |
| Free-shipping-over-Rs X message | MEDIUM | LOW | P2 |
| COD fee display | MEDIUM | LOW | P2 |
| Estimate caching | LOW-MEDIUM | MEDIUM | P3 |
| Surface/express split | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have; add after core validates
- P3: Defer until demand or the e-commerce milestone

## Competitor Feature Analysis

| Feature | Amazon/Flipkart (marketplace) | Small Shopify D2C store | Our Approach |
|---------|-------------------------------|-------------------------|--------------|
| Pincode widget placement | Under buy box, persisted site-wide | Under price/variant on product page | Both: navbar context + product-page check |
| Cost shown pre-checkout | Hidden until checkout | Often shown ("Free over Rs X" or flat) | **Show cost up front** — the milestone's value |
| ETA format | Concrete date ("Delivery by Tue") | Day range ("4-6 days") | Day range at launch; concrete dates as P2 |
| COD | Per-pincode flag + risk gating | Flat on/off + value cap | Admin on/off + value cap (no risk scoring) |
| Serviceability | Live courier network | Zone list or courier API | Live API or admin zone table (STACK decides) |
| Persistence | Account + cookie | Cookie/localStorage | localStorage base + profile for logged-in |
| Multi-courier | Internal, hidden | Single courier | Single configured courier / zone table |

## Sources

- [How PIN Codes Help in E-commerce Delivery in India — Pin Code World](https://pincodeworld.in/pin-codes-help-in-e-commerce/) [MEDIUM]
- [Pincode Serviceability Checker — Shopify App Store](https://apps.shopify.com/pincode-zipcode-serviceability-check) [MEDIUM]
- [Check Pincode Serviceability for Ecommerce — Shipyaari](https://www.shipyaari.com/ecommerce-shipping/wide-pincode-serviceability/) [MEDIUM]
- [Pin Code Serviceability Check: Multi-Carrier Tool — CourierBook.in](https://www.courierbook.in/blog/pin-code-serviceability-lookup-tool/) [MEDIUM]
- [Delhivery Rate Calculator — Delhivery One Help Center](https://help.delhivery.com/docs/rate-calculator) [HIGH — vendor docs]
- [Delhivery API Documentation — Developer Portal](https://one.delhivery.com/developer-portal/documents) [HIGH — vendor docs]
- [Pin-code Serviceability API — Delhivery Express API Docs](https://delhivery-express-api-doc.readme.io/reference/1-pincode-servicability-api) [HIGH — vendor docs]
- [Invoice / Shipping Charge API — Delhivery Express API Docs](https://delhivery-express-api-doc.readme.io/reference/invoice-shipping-charge-api) [HIGH — vendor docs]
- [Delhivery Courier Charges: Domestic & International 2026 — ClickPost](https://www.clickpost.ai/blog/delhivery-courier-charges) [MEDIUM]
- [Delivery-estimate factors — Amazon Help (X)](https://x.com/AmazonHelp/status/1827407228426506628) [LOW — single social post]
- `.planning/PROJECT.md` — v1.1 milestone scope, existing data (product_variants weight, auth/profile, Edge Functions) [HIGH]

---
*Feature research for: pincode delivery cost & ETA estimator (Indian D2C, no-checkout)*
*Researched: 2026-06-27*
