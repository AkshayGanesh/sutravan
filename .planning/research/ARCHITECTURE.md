# Architecture Research

**Domain:** Pincode delivery estimator integrated into an existing Supabase + static-SPA skincare app (v1.1)
**Researched:** 2026-06-27
**Confidence:** HIGH (grounded in the project's own shipped v1.0 patterns, read directly from source)

> This is an **integration** research doc, not a greenfield design. Every recommendation below maps to a pattern v1.0 already ships and runs in production. "New" vs "modify existing" is called out explicitly. Courier *selection* (Delhivery vs alternatives) is deferred to STACK.md — this doc is courier-agnostic and treats the rate provider behind a normalizing adapter so the choice stays swappable.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     STATIC SPA (GitHub Pages · sutravan.in)           │
│                     React 19 + Vite + Wouter + TanStack Query        │
├──────────────────────────────────────────────────────────────────────┤
│  DeliveryProvider (NEW ctx, mirrors AuthProvider)                    │
│   ├─ pincode state  ← localStorage + optional profiles.default_pincode│
│   └─ exposes { pincode, setPincode }                                 │
│        │                          │                                  │
│  ┌─────┴──────┐            ┌──────┴───────────┐                      │
│  │ Navbar     │            │ ProductDetail    │   (MODIFY both)      │
│  │ widget(NEW)│            │ estimator(NEW)   │                      │
│  └─────┬──────┘            └──────┬───────────┘                      │
│        └──────────┬───────────────┘                                  │
│              useDeliveryEstimate(origin, dest, weightG)  (NEW hook)  │
│              TanStack Query · key ['delivery',o,d,bucket]           │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ supabase.functions.invoke('delivery-estimate')
                            │  (anon key + caller JWT; CORS allow-listed)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│   EDGE FUNCTION delivery-estimate  (NEW · Deno · verify_jwt=false)    │
│   1. validate dest pincode (6-digit) + read body {dest, weightG}     │
│   2. resolve origin + default weight + free-ship threshold           │
│        ← reads site_content (server-side)                            │
│   3. cache lookup (origin+dest+weightBucket, not expired)           │
│   4. on MISS → call courier rate API (RATE_API_KEY from Deno.env)   │
│   5. normalize → {serviceable, cost, etaDays, codAvailable}        │
│   6. upsert cache row with expires_at (TTL)                         │
│   7. return normalized JSON                                         │
└───────┬───────────────────────────────────────┬──────────────────────┘
        │ service-role (cache I/O only)          │ HTTPS (secret server-side)
        ▼                                         ▼
┌─────────────────────────┐            ┌──────────────────────────────┐
│ POSTGRES (Supabase)     │            │  Courier / aggregator rate   │
│  site_content (MODIFY:  │            │  API (Delhivery etc.)        │
│   +3 keys)              │            │  serviceability + cost + ETA │
│  delivery_estimate_cache│            └──────────────────────────────┘
│   (NEW, RLS deny-direct)│
│  pincode_serviceability │
│   (NEW, OPTIONAL)       │
│  profiles (+default_    │
│   pincode, OPTIONAL)    │
└─────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modify | Mirrors existing |
|-----------|----------------|--------------|------------------|
| `delivery-estimate` Edge Function | Server-side rate-API call, secret custody, normalization, cache I/O, serviceability gate | **NEW** | `verify-and-submit` |
| `delivery_estimate_cache` table | TTL'd cache of normalized results keyed by origin+dest+weight-bucket | **NEW** | (no per-user analog) |
| `site_content` keys (origin, default weight, free-ship threshold) | Admin-configurable estimator settings | **MODIFY** (+3 rows) | hero/email keys |
| `useDeliveryEstimate` hook | TanStack Query wrapper over `functions.invoke`, weight-bucketing, loading/error states | **NEW** | `catalog.ts` hooks |
| `DeliveryProvider` + `useDelivery` | Site-wide pincode state, localStorage + profile sync | **NEW** | `AuthProvider`/`useAuth` |
| Navbar "Deliver to [pincode]" widget | Capture/edit pincode, reflect site-wide | **MODIFY** Navbar.tsx | Navbar wishlist badge |
| ProductDetail estimator block | Per-product cost/ETA/COD using product weight + shared pincode | **MODIFY** ProductDetail.tsx | variant selector |
| Admin settings UI | Edit origin pincode + default weight + free-ship threshold | **MODIFY** admin site-content editor | site-content form |
| `pincode_serviceability` dataset | OPTIONAL offline serviceable/COD lookup | **NEW (optional)** | seeded catalog tables |

---

## Recommended Project Structure

```
supabase/
├── functions/
│   ├── verify-and-submit/          # existing template
│   └── delivery-estimate/          # NEW
│       └── index.ts                # CORS + Deno.env secret + adapter + cache
├── migrations/
│   ├── 0014_delivery_settings.sql  # NEW: +3 site_content keys (idempotent seed)
│   ├── 0015_delivery_cache.sql     # NEW: cache table + deny-direct RLS + index
│   ├── 0016_profile_pincode.sql    # NEW (optional): profiles.default_pincode
│   └── 0017_pincode_serviceability.sql  # NEW (optional): dataset table
└── config.toml                     # MODIFY: [functions.delivery-estimate] verify_jwt=false

client/src/
├── lib/
│   ├── delivery.ts                 # NEW: useDeliveryEstimate + types + weightBucket()
│   └── deliverySettings.ts         # OPTIONAL: typed readers over site_content keys
├── delivery/                       # NEW (mirrors client/src/auth/)
│   ├── DeliveryProvider.tsx
│   └── useDelivery.ts
└── components/
    ├── DeliveryWidget.tsx          # NEW: navbar pincode pill + popover input
    └── DeliveryEstimate.tsx        # NEW: product-detail estimate block
```

### Structure Rationale

- **`delivery-estimate/` as a sibling Edge Function:** keeps the proven one-function-per-concern shape; reuses the exact CORS + `Deno.env` secret custody of `verify-and-submit`.
- **`lib/delivery.ts`:** matches `catalog.ts`/`siteContent.ts` — query hook + snake→camel mapping + pure helpers (`weightBucket`) co-located, tested like `variants.test.ts`.
- **`client/src/delivery/` provider folder:** intentionally mirrors `client/src/auth/` so site-wide pincode state has the same mental model as auth — single source of truth mounted once in `App.tsx`.
- **Two components, one hook:** Navbar widget and ProductDetail block both read the same `DeliveryProvider` pincode and both can call the same `useDeliveryEstimate`; no duplicated fetch logic.

---

## Architectural Patterns

### Pattern 1: Edge Function owns the rate-API call (NEVER client-direct)

**What:** All courier-API traffic goes through `delivery-estimate`, which holds the API key in `Deno.env` and returns a normalized `{serviceable, cost, etaDays, codAvailable}`.

**When to use:** Always, for this feature. This is non-negotiable given the constraints.

**Why (justification against the three hard constraints):**
1. **Secret custody.** The frontend is a *static SPA* — anything in `import.meta.env.VITE_*` is shipped in the public bundle (`supabase.ts` proves only the anon key lives there, and v1.0 ships a `check-no-secret.sh` gate). A courier API key in the bundle would be world-readable. The only place a secret can live is an Edge Function's env, set via `supabase secrets set` and read with `Deno.env.get` — exactly how `TURNSTILE_SECRET_KEY`/`RESEND_API_KEY` are handled today.
2. **CORS.** Courier APIs are not browser-CORS-friendly and would reject/leak from `sutravan.in`. The Edge Function makes a server→server HTTPS call (no CORS) and re-exposes a tight, origin-allow-listed endpoint, copying `corsHeadersFor()` verbatim (echo allow-listed origin, never `*`).
3. **No runtime Node server.** GitHub Pages serves static files only — there is no other server-side seam. The Edge Function *is* the backend seam, and v1.0 already established it as the pattern.

**Key difference from `verify-and-submit` (the cache twist):**
`verify-and-submit` deliberately uses the **anon key scoped to the caller's JWT** because `customization_submissions` has a per-user *ownership invariant* that RLS must enforce. The delivery cache has **no ownership invariant** — cache rows are global, non-sensitive, identical for every visitor. So `delivery-estimate` legitimately uses the **service-role key for cache reads/writes** (already available as `SUPABASE_SERVICE_ROLE_KEY` in function env). This is NOT the anti-pattern called out for submissions: there is no RLS guarantee being bypassed, and the function is the sole writer (preventing client cache-poisoning). Call this out explicitly in the function header comment so a future reader doesn't "fix" it.

**Example:**
```typescript
// delivery-estimate/index.ts (shape only)
const corsHeaders = corsHeadersFor(req.headers.get('Origin')); // copied from verify-and-submit
// ... validate dest (6-digit), read settings from site_content, cache lookup ...
const rated = await callCourierAdapter(origin, dest, weightG); // RATE_API_KEY = Deno.env.get(...)
const normalized = { serviceable, cost, etaDays, codAvailable }; // courier-agnostic shape
// upsert cache with expires_at, then return normalized
```

### Pattern 2: Settings in `site_content`, results in a dedicated cache table

**What:** Admin-tunable scalars (origin pincode, default shipping weight, free-ship threshold) ride the existing `site_content` key/value table. Volatile machine-generated estimate results ride a new purpose-built table.

**When to use:** This is the right split because the two have opposite lifecycles.

**Trade-offs / why this split:**
- `site_content` is the *established* owner-configurable pattern (read by `useSiteContent()` with mandatory code defaults, written by the admin upsert with `onConflict:"key"`, public-read + admin-write RLS). Adding 3 keys is a one-line idempotent seed (`on conflict (key) do nothing`, like `0006`) and the admin UI already exists — near-zero new surface.
- Estimate results are multi-field, high-cardinality, and TTL-expiring — a wrong fit for a flat string key/value table. They need their own columns, a composite key, and an `expires_at`.

**Why NOT put settings in a new table:** it would duplicate the `site_content` admin editor and RLS for three scalars. Don't.

### Pattern 3: Two-tier cache (Postgres durable + TanStack Query in-session)

**What:** TanStack Query caches per browser session; the Postgres cache table caches across sessions/visitors and shields the rate-limited courier API.

**When to use:** Both tiers, because they solve different problems.

**Trade-offs:**
- TanStack Query alone (the default config is `staleTime: Infinity`, no refetch, `retry:false`) already dedupes within a session — but it's per-browser and lost on reload, so it does nothing for rate-limit protection across visitors.
- The Postgres table is the real rate-limit shield: a popular pincode is fetched from the courier *once* per TTL window globally, then served from Postgres to every visitor.
- Cost: one extra table + a cron-free TTL check inside the function. Cheap.

### Pattern 4: Adapter/normalizer isolates the courier choice

**What:** A single `callCourierAdapter()` inside the function maps the chosen provider's response to `{serviceable, cost, etaDays, codAvailable}`. The frontend, hook, cache schema, and UI only ever see the normalized shape.

**When to use:** Always — PROJECT.md explicitly leaves Delhivery-vs-alternatives to research, so the seam must be swappable without touching the SPA. Mirrors how `catalog.ts` does snake→camel mapping "ONCE at the boundary."

---

## Data Model

### `site_content` — ADD 3 keys (MODIFY existing table, migration `0014`)

| Key | Example value | Purpose |
|-----|---------------|---------|
| `delivery_origin_pincode` | `"302001"` | Dispatch origin driving every estimate |
| `delivery_default_weight_g` | `"100"` | Fallback parcel weight when a product/variant has none |
| `delivery_free_ship_threshold` | `"999"` | Order value above which shipping shows as free (display-only; no cart yet, so this gates the per-product "free over ₹X" line) |

- **RLS:** inherits the existing `site_content_public_read` (anon+auth) + `site_content_admin_write` (`is_admin()`). No new policy.
- **Read path:** extend `SITE_CONTENT_DEFAULTS` in `siteContent.ts` with these three so the estimator never blocks on a missing row (mandatory-fallback rule D-20). The Edge Function reads them server-side via its own select with hardcoded fallbacks too.
- **Write path:** the existing admin upsert + `['siteContent']` invalidation already covers it — just add three fields to the admin form.

> **CRITICAL FINDING — weight has no numeric home today.** `product_variants.label` is free text (`"70gm"`) and there is **no `weight_grams` column anywhere** (verified across all migrations + `variants.ts`). The estimator needs grams. Recommended posture:
> - **MVP:** use the `delivery_default_weight_g` site_content key for all products (handmade soaps cluster around one weight; good enough to ship).
> - **Accuracy upgrade (optional, sequence later):** add `weight_g int` to `product_variants` (and/or `products`); the hook passes the selected variant's weight, falling back to the default key. Do NOT parse the `"70gm"` label string at runtime — it's lossy and locale-fragile.

### `delivery_estimate_cache` — NEW table (migration `0015`)

```sql
create table public.delivery_estimate_cache (
  id uuid primary key default gen_random_uuid(),
  origin_pincode text not null,
  dest_pincode   text not null,
  weight_bucket  int  not null,          -- e.g. 250g buckets: ceil(weightG/250)
  serviceable    boolean not null,
  cost           numeric(10,2),          -- null when not serviceable
  eta_days       int,
  cod_available  boolean not null default false,
  fetched_at     timestamptz not null default now(),
  expires_at     timestamptz not null,   -- fetched_at + TTL
  created_at     timestamptz default now()
);
create unique index delivery_cache_key_uniq
  on public.delivery_estimate_cache (origin_pincode, dest_pincode, weight_bucket);
```

- **RLS posture: deny-direct.** `enable row level security` with **NO anon/authenticated policies** → the table is unreachable from the public PostgREST API. Only the Edge Function (service-role) reads/writes it. Rationale: prevents client cache-poisoning and keeps the function the single normalizer. (Estimates aren't secret, so a public-read policy would also be *safe* — but routing everything through the function keeps one code path and lets the function apply settings/serviceability consistently. Prefer deny-direct.)
- **Invalidation:** TTL via `expires_at` (function ignores expired rows and re-fetches). Plus **on origin change**: when the admin saves a new `delivery_origin_pincode`, stale rows simply stop matching the new origin key, so they age out naturally — no explicit purge needed. Optionally add a `truncate`-style admin action later.
- **Weight bucketing:** `weightBucket(g)` is a pure helper (in `lib/delivery.ts`, unit-tested) so 95g and 110g share a cache row, maximizing hit rate without materially changing cost.

### `profiles.default_pincode` — OPTIONAL column (migration `0016`)

- `alter table public.profiles add column default_pincode text;`
- **RLS:** already covered — `profiles_self_update` lets a logged-in user write their own row; `profiles_self_read` reads it. No new policy.
- **Use:** logged-in users get their pincode pre-filled and persisted across devices; anon users fall back to localStorage only. Keep this optional/last — localStorage alone satisfies the requirement.

### `pincode_serviceability` — OPTIONAL dataset table (migration `0017`)

- Only if the chosen courier lacks a free serviceability endpoint, or to answer serviceable/COD instantly without an API round-trip. Columns: `pincode text primary key, serviceable bool, cod bool, zone text`. Seeded from a courier/India-Post CSV via a service-role script (mirrors `scripts/seed.ts`). **RLS:** public-read (`using(true)`), admin/service-role write — same posture as catalog tables.
- **Decision:** treat as a fallback/enhancement, not core. The Edge Function can consult it before/instead of the live rate API. Sequence last; the live-API path is the baseline.

---

## Data Flow

### Estimate request flow

```
User types pincode in Navbar widget (or ProductDetail)
   ↓ setPincode()  → DeliveryProvider → localStorage (+ profiles.default_pincode if logged in)
ProductDetail reads { pincode } + product weight
   ↓ useDeliveryEstimate(origin?, pincode, weightG)
TanStack Query key ['delivery', origin, pincode, weightBucket]
   ├─ cache HIT (in-session) → return immediately
   └─ MISS → supabase.functions.invoke('delivery-estimate', { body })
                ↓
         Edge Function: validate → read site_content → Postgres cache lookup
                ├─ Postgres HIT (not expired) → return normalized
                └─ Postgres MISS → courier adapter (secret) → normalize → upsert cache → return
                ↓
         { serviceable, cost, etaDays, codAvailable }
   ↓
DeliveryEstimate renders cost + ETA + COD, or graceful "not serviceable / estimate unavailable"
```

### Pincode state flow (site-wide reflection)

```
DeliveryProvider (mounted once in App.tsx, beside AuthProvider)
   initial = profiles.default_pincode ?? localStorage['sutravan_pincode'] ?? null
        ↓ context
Navbar widget  ──setPincode──┐
ProductDetail  ──setPincode──┤→ single source of truth → both re-render with same pincode
                             └→ persist to localStorage (+ profile on auth)
```

The "global pincode reflects on product pages" requirement is satisfied purely by both surfaces reading the **same context** — no prop drilling, no duplicate storage.

---

## Suggested Build Order

Dependency-ordered; each step is independently shippable/testable.

1. **Data + settings (migrations `0014`, `0015`; optional `0016`/`0017`).** Add the 3 `site_content` keys (idempotent seed) and the cache table with deny-direct RLS. *No dependency.* Push live first so the function has something to read. Extend `SITE_CONTENT_DEFAULTS`.
2. **Edge Function `delivery-estimate`.** Copy `verify-and-submit` CORS scaffold; add `[functions.delivery-estimate] verify_jwt=false` to `config.toml`; implement settings read → cache lookup → courier adapter (stub/mock first) → normalize → cache upsert. Set `RATE_API_KEY` via `supabase secrets set`. *Depends on step 1.* Verify with a mock adapter before wiring the real courier.
3. **`useDeliveryEstimate` hook + `DeliveryProvider` (`lib/delivery.ts`, `client/src/delivery/`).** Pure `weightBucket()` + typed normalized result; provider with localStorage. Mount provider in `App.tsx`. *Depends on step 2 (contract), but can develop against the mock.*
4. **ProductDetail estimator UI (`DeliveryEstimate.tsx`).** Wire into the existing variant selector area; pass selected variant weight (or default key). Render all states incl. graceful unavailable. *Depends on steps 2–3.*
5. **Navbar widget (`DeliveryWidget.tsx`).** "Deliver to [pincode]" pill + popover input writing the shared context; reflects on product pages automatically. *Depends on step 3.*
6. **Admin settings UI.** Add origin pincode + default weight + free-ship threshold to the existing site-content admin form (rides existing upsert + `['siteContent']` invalidation). *Depends on step 1.*
7. **(Optional, last) `profiles.default_pincode` sync and/or `pincode_serviceability` dataset.** Enhancements; do only if accuracy/offline-serviceability is wanted. *Depends on 3 / 2 respectively.*

**Why this order:** settings/schema must exist before the function can read them; the function contract must exist before the hook; the hook/provider before the two UIs; admin settings can land any time after step 1 (parallelizable with 4/5). Mirrors v1.0's "migration → Edge Function → lib hook → UI" rhythm (e.g. `0007` → `verify-and-submit` → `questionnaire.ts` → wizard).

---

## Anti-Patterns

### Anti-Pattern 1: Calling the courier API directly from the SPA
**What people do:** `fetch('https://courier.api/rate', {headers:{ key: import.meta.env.VITE_RATE_KEY }})`.
**Why it's wrong:** the key ships in the public bundle (world-readable), CORS will block/leak it, and there's no server seam on GitHub Pages. Violates the project's `check-no-secret.sh` invariant.
**Do this instead:** Pattern 1 — Edge Function with `Deno.env` secret.

### Anti-Pattern 2: Reusing the caller-JWT insert pattern for the cache "to be consistent"
**What people do:** insert cache rows under the caller's anon JWT + an anon RLS policy, copying `verify-and-submit`.
**Why it's wrong:** an anon write policy on the cache lets any client poison it via raw PostgREST; the cache has no ownership invariant that RLS protects, so the caller-JWT discipline buys nothing here.
**Do this instead:** deny-direct RLS + service-role cache I/O inside the function. (Document the intentional divergence.)

### Anti-Pattern 3: Storing estimate results in `site_content`
**What people do:** stuff `cost`/`eta` per pincode into key/value rows.
**Why it's wrong:** wrong lifecycle (volatile, TTL'd, multi-field, high-cardinality) and pollutes the admin-editable content surface.
**Do this instead:** dedicated `delivery_estimate_cache` table; `site_content` holds only the 3 admin scalars.

### Anti-Pattern 4: Parsing weight out of the `"70gm"` variant label
**What people do:** regex the free-text label to get grams.
**Why it's wrong:** lossy, locale-fragile, breaks on `"100 g"`/`"1 kg"`/`"Large"`.
**Do this instead:** `delivery_default_weight_g` key now; optional numeric `weight_g` column later.

### Anti-Pattern 5: Wildcard CORS on the new function
**What people do:** `Access-Control-Allow-Origin: *` to "just make it work."
**Why it's wrong:** v1.0 explicitly allow-lists origins (Pitfall 2). A wildcard invites abuse of your rate-limited courier quota.
**Do this instead:** copy `corsHeadersFor()` (echo allow-listed origin, default to `sutravan.in`).

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Courier/aggregator rate API | server→server HTTPS from `delivery-estimate` Edge Function; key in `Deno.env` | Provider selection deferred to STACK.md; isolate behind `callCourierAdapter()`. Watch rate limits → Postgres cache shields them. |
| Supabase Postgres | service-role (cache I/O) + anon-read (`site_content`) from the function | Cache table deny-direct; settings public-read. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| SPA ↔ Edge Function | `supabase.functions.invoke('delivery-estimate')` (anon key + optional caller JWT) | Same client transport as `verify-and-submit`. |
| Navbar widget ↔ ProductDetail | shared `DeliveryProvider` context | Single source of truth for pincode; no prop drilling. |
| Hook ↔ Function | normalized `{serviceable,cost,etaDays,codAvailable}` JSON | The ONLY contract the SPA knows; courier shape never leaks past the function. |
| Admin form ↔ settings | `site_content` upsert (`onConflict:"key"`) + `['siteContent']` invalidation | Reuses the shipped admin write path. |

---

## Sources

- Project source (read directly): `supabase/functions/verify-and-submit/index.ts` (Edge Function CORS + secret + caller-JWT pattern), `supabase/migrations/0002_rls_policies.sql` + `0006_seed_site_content.sql` + `0011_product_variants.sql` (RLS posture + site_content seed + variant schema confirming no weight column), `client/src/lib/siteContent.ts` + `catalog.ts` + `queryClient.ts` + `variants.ts` + `admin.ts` (hook/mapping/cache/invalidation patterns), `supabase/config.toml` (`verify_jwt=false` precedent). — HIGH
- `.planning/PROJECT.md`, `.planning/MILESTONES.md` (milestone scope + constraints). — HIGH

---
*Architecture research for: pincode delivery estimator on Supabase + static SPA*
*Researched: 2026-06-27*
