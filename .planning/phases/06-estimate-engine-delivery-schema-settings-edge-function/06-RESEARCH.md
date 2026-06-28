# Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function - Research

**Researched:** 2026-06-28
**Domain:** Supabase Postgres schema + RLS + Deno Edge Function (server-side delivery rate engine) on a static React/Vite SPA
**Confidence:** HIGH (grounded in this repo's shipped v1.0 patterns + locked CONTEXT decisions; external dataset/zone facts cross-verified)

<user_constraints>
## User Constraints (from CONTEXT.md)

> All 21 decisions below are LOCKED. Do not re-litigate. This research fills only the implementation gaps CONTEXT left to "Claude's Discretion."

### Locked Decisions

**Zone-Weight Slab Table**
- **D-01:** 5 zones — `local` (same city), `regional` (neighboring states / ~500km), `metro` (major metros), `national` (rest of India), `remote` (NE, J&K, Ladakh, A&N/islands).
- **D-02:** 4 weight bands (grams): 0–250, 251–500, 501–1000, 1001–2000.
- **D-03:** Slab table = cartesian grid: one row per (zone × weight band) → `cost` (integer ₹) + `eta_min_days` + `eta_max_days`. This is the contract a live courier API (DLVR-F1) later swaps behind unchanged.
- **D-04:** Seed ₹ rates = researcher-recommended placeholders (internally consistent Indian-D2C grid, ~₹40 local 0–250g rising to ~₹180 remote 1–2kg). Explicitly placeholders; owner replaces in Phase 10's editor — no redeploy.
- **D-05:** Seed ETA ramp (working days): local 1–2 · regional 2–4 · metro 3–5 · national 4–7 · remote 6–10.

**COD Rules**
- **D-06:** Fixed flat COD fee model (NOT percentage). Schema stores a fee field; seed default ₹30.
- **D-07:** Optional COD order-value cap field; seed generous (₹5000). Nullable/optional.
- **D-08:** COD availability = single global admin on/off toggle. NOT per-zone, NOT per-pincode. Seed = COD on.
- **D-09:** COD rules stored as a single `delivery_cod_rules` jsonb `site_content` key (~`{ enabled, fee, valueCap }`) — exact field shape planner's discretion, but MUST ride the existing `site_content` upsert + `['siteContent']` invalidation pattern.

**Weight Fallback & Rounding**
- **D-10:** Default fallback weight = 250g (`delivery_default_weight_g`). The ONLY weight every estimate uses; `product_variants.label` ("70gm") is NEVER regex-parsed (Pitfall 9). Errs slightly high.
- **D-11:** Rounding: round UP to nearest ₹10. Always a ceiling.
- **D-12:** No separate buffer/markup field. The slab value IS the estimate; round-up alone is the cushion. Margin baked into slab rates (Phase 10).
- **D-13:** The ENGINE returns the final rounded integer `cost`. Cache stores the rounded number; every UI surface shows identical figures. UI only adds `₹` prefix + thousands separators (no rounding in UI).

**Pincodes & Serviceability**
- **D-14:** Seed the full ~19k India Post All-India Pincode Directory (data.gov.in). Membership = serviceability source.
- **D-15:** Zone is derived RELATIVE to the configured origin, NOT a static per-pincode label. Each `pincodes` row carries `state` + region/circle + `is_metro` + `is_remote`; engine computes zone by comparing destination to origin (same city→local, same/adjacent state→regional, metro↔metro→metro, NE/J&K/islands→remote, else national). Keeps estimates correct when owner changes origin (Pitfall 10).
- **D-16:** Serviceable = membership in `pincodes` AND a `serviceable` boolean column (default true). Boolean lets a real pincode be switched off without deleting the row.

**Edge Function & Cache**
- **D-17:** Cache TTL = 24h, keyed by `(origin, dest, weight-bucket)` where weight-bucket = the 4 bands in D-02. `delivery_estimate_cache` is deny-direct RLS; the Edge Function (service role) is sole writer.
- **D-18:** Origin pincode seeded as a clearly-fake placeholder (`000000`). Owner sets the real origin in Phase 9. Function treats unconfigured/placeholder origin as "not yet configured" rather than silently producing skewed-but-real-looking numbers (Pitfall 10). Estimates still compute for testing.
- **D-19:** Free-ship threshold: `delivery_free_ship_threshold` site_content key present but seeded off/null; owner sets it in Phase 9.
- **D-20:** Seed `delivery_dispatch_lead_days` = 1 (working day).
- **D-21:** Reuse `verify-and-submit` security posture verbatim: `corsHeadersFor()` allowlist (no wildcard, echo only `sutravan.in` + localhost), secrets via `Deno.env` only, Turnstile hosted-CDN abuse protection, `verify_jwt=false`, server-side 6-digit/numeric pincode validation BEFORE any compute, an upstream timeout, generic error responses (never reflect raw Postgres errors).

### Claude's Discretion (this research fills these)
- Exact placeholder ₹ values within the seeded grid (internally consistent + monotonic across zones/bands).
- Exact jsonb shape of `delivery_cod_rules`, the precise adjacency/metro classification logic for zone derivation, column names, migration file numbering (continue from `0013`).
- Whether `pincodes` region/circle is an explicit column or derived — as long as zone derivation stays origin-relative.

### Deferred Ideas (OUT OF SCOPE)
- Per-pincode COD serviceability (needs real courier COD feed; revisit with DLVR-F1).
- Per-variant numeric weight column (`weight_g`) — DLVR-F2; everything uses the 250g fallback until then.
- Live courier API (Shiprocket / DLVR-F1) — drops in behind `callCourierAdapter()`.
- Per-zone or % COD fee model; configurable global buffer %.
- Any UI (Phase 7/8), admin editing of settings/slabs (Phase 9/10).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DLVR-05 | Customer can enter a 6-digit destination pincode and receive serviceability, an estimated shipping cost (INR), an estimated delivery ETA range, and COD availability | This phase lands the entire server-side engine that produces that `{ serviceable, cost, etaDays, codAvailable }` result. Sections: Standard Stack (tables), Zone-Derivation Algorithm, Seed Slab Grid, Edge Function Structure, RLS Posture. The Phase 7 UI (DLVR-06/07/08) consumes this engine; Phase 6 proves it returns real numbers with no UI. |
</phase_requirements>

## Summary

Phase 6 is **pure backend integration on proven v1.0 patterns** — no new paradigms, no new npm packages. It lands every delivery data structure (zone-weight slab grid, the ~19k India Post pincode directory, a deny-direct estimate cache, a `profiles.default_pincode` column, and 5 new `site_content` keys) plus RLS, then deploys one Deno Edge Function (`delivery-estimate`) cloned verbatim from `verify-and-submit`. The function validates the destination pincode, checks serviceability (membership in `pincodes`), derives an **origin-relative zone**, looks up the slab, rounds the cost up to ₹10, applies the global COD rules, reads-then-writes a 24h Postgres cache, and returns a normalized `{ serviceable, cost, etaDays, codAvailable }` — the courier-specific shape never leaks past the `callCourierAdapter()` boundary (Pitfall 12). Phase 6 builds **no UI** (Phases 7–10).

The two genuinely-novel pieces of work are the **origin-relative zone-derivation algorithm** (D-15) and the **~19k-row pincode seed strategy** (D-14). Both are fully specified below. The zone algorithm maps cleanly onto the standard Indian-courier zone model (Zone A–E ≈ local/regional/metro/national/remote) and is computed from three per-pincode facts derivable at seed time from the data.gov.in directory: `state`, a metro flag (`is_metro`, from a fixed 8-city PIN-prefix list), and a remote flag (`is_remote`, from a fixed StateName set). The seed is delivered as a **schema-only migration + a service-role node script** (mirroring `scripts/seed.ts`), never a 19k-row INSERT inside a migration.

**Primary recommendation:** Land five migrations (continuing from `0013`) — `site_content` seed, `pincodes` table, `delivery_rate_slabs` table + grid, `delivery_estimate_cache` (deny-direct), `profiles.default_pincode` — then a `scripts/seed-pincodes.ts` service-role loader, then clone `verify-and-submit` into `supabase/functions/delivery-estimate/index.ts` with a table-backed `callCourierAdapter()`. Build order: migrations → pincode seed → Edge Function. Verify with node service-role scripts (the repo has no unit-test framework; this matches `scripts/verify-seed.ts`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Destination pincode format validation | API / Edge Function | Browser (Phase 7, UX only) | Must be server-side BEFORE compute (D-21, SC2); client validation is convenience only |
| Serviceability check (membership + `serviceable` flag) | Database (pincodes) read by Edge Function | — | Authoritative serviceability lives in the seeded `pincodes` table |
| Origin-relative zone derivation | API / Edge Function | — | Pure compute over origin+dest pincode rows; must re-derive when origin changes (D-15) |
| Slab lookup + round-up + COD application | API / Edge Function | Database (slab + site_content read) | The engine is the single source of the rounded integer (D-13) |
| Secret custody (Turnstile) + CORS allowlist | API / Edge Function | — | Static SPA cannot hold secrets; only server seam on GitHub Pages |
| Estimate result caching (24h TTL) | Database (delivery_estimate_cache) | API (sole writer) | Cross-visitor cache; deny-direct RLS, service-role-only write (D-17) |
| Admin-tunable settings (origin, weight, lead, COD, free-ship) | Database (site_content) | Admin UI (Phase 9, out of scope) | Rides existing `site_content` key/value + `['siteContent']` pattern |
| Per-customer pincode persistence | Database (profiles.default_pincode) | Browser localStorage (Phase 8) | Column lands here; read/write wired in Phase 8 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jsr:@supabase/supabase-js` | `@2` | Supabase client inside the Edge Function (cache + settings + pincode + slab reads/writes) | EXACT import already used by `verify-and-submit/index.ts` line 40 — clone verbatim `[VERIFIED: codebase grep]` |
| `@supabase/supabase-js` | `2.x` (already a dependency) | Service-role node seed script (`scripts/seed-pincodes.ts`) | Same import `scripts/seed.ts` already uses `[VERIFIED: codebase grep]` |
| Supabase CLI (`supabase`) | `2.102.0` (devDep, cached auth) | `db push --linked` + `functions deploy` | Established live-ops flow (memory: supabase-live-ops) `[CITED: memory/supabase-live-ops.md]` |
| Deno | `2` (config.toml `deno_version = 2`) | Edge Function runtime | `[VERIFIED: codebase grep — supabase/config.toml]` |
| Postgres | major_version `17` | All new tables / RLS | `[VERIFIED: codebase grep — supabase/config.toml]` |

### Supporting (data, not packages)

| Item | Source | Purpose | Notes |
|------|--------|---------|-------|
| All-India Pincode Directory CSV | data.gov.in (India Post source) | Seed `pincodes` serviceability dataset (~19.5k unique pincodes) | Columns: `CircleName, RegionName, DivisionName, OfficeName, Pincode, OfficeType, Delivery, District, StateName, Latitude, Longitude` `[VERIFIED: data.gov.in dataset 6818292]`. Full file is ~165k post-office rows; dedupe to unique pincode. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Origin-relative zone derivation (D-15) | Static per-pincode zone label | Rejected by D-15 — breaks when owner changes dispatch origin (Pitfall 10). Do NOT implement static labels. |
| Service-role node seed script for pincodes | 19k-row INSERT inside a migration | Rejected — huge/slow migration; no `COPY` via pooler (no psql password, per live-ops memory). Use chunked PostgREST upsert. |
| `state` adjacency map for `regional` | Same-state-only → regional | Adjacency is required by D-15 ("same/adjacent state"). Same-state-only is an acceptable degraded fallback ONLY if adjacency proves heavy — but D-15 names adjacency explicitly, so implement the map. |

**Installation:** No new npm packages. The Edge Function imports `jsr:@supabase/supabase-js@2` (already in use). The seed script uses the existing `@supabase/supabase-js` dependency. Nothing to `npm install`.

## Package Legitimacy Audit

> No external packages are installed in this phase. The Edge Function reuses the JSR `@supabase/supabase-js@2` import already vendored by `verify-and-submit`; the seed script reuses the existing `@supabase/supabase-js` dependency. slopcheck was therefore not run (nothing to audit).

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — no new dependencies) | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
  Browser (Phase 7+ UI — NOT built in Phase 6)
        │  supabase.functions.invoke('delivery-estimate', { body: { token, destPincode, weightG? } })
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION delivery-estimate (NEW · Deno · verify_jwt=false)     │
│  1. OPTIONS → CORS preflight (corsHeadersFor, allowlist)            │
│  2. Parse body; shape-guard (object, not array/null)               │
│  3. VALIDATE destPincode  /^\d{6}$/  ── fail → 400 'bad_request'    │  ← BEFORE any compute (D-21/SC2)
│  4. Turnstile siteverify (TURNSTILE_SECRET_KEY via Deno.env)       │
│  5. Read settings from site_content (origin, defWeight, lead,      │
│     cod_rules, free_ship)        ─────────────┐                    │
│  6. weightBucket(weightG ?? defWeight) → 1..4 │                    │
│  7. Cache lookup (origin,dest,bucket) WHERE   │  service-role      │
│     expires_at > now()  ── HIT → return ──────┤  client           │
│  8. MISS → callCourierAdapter():              │                    │
│       a. dest serviceable? (pincodes member + serviceable=true)    │
│            └ no → { serviceable:false }                            │
│       b. deriveZone(origin,dest)  (origin-relative, see algorithm) │
│       c. slab = delivery_rate_slabs[zone][bucket]                  │
│       d. cost = roundUpTo10(slab.cost)                             │
│       e. eta = { min: slab.eta_min+lead, max: slab.eta_max+lead }  │
│       f. cod = cod_rules.enabled                                   │
│  9. Upsert cache row (expires_at = now()+24h)                      │
│ 10. return { serviceable, cost, etaDays, codAvailable,            │
│              originConfigured }  ── normalized, vendor-agnostic    │
└───────┬──────────────────────────────┬──────────────────────────────┘
        │ service-role                  │ (DLVR-F1 future: HTTPS courier call here,
        ▼                               │  mapped to the SAME normalized shape)
┌──────────────────────────────────────┴────────────────────────────┐
│  POSTGRES (Supabase)                                               │
│   site_content        (+5 keys; public-read, admin-write — exists) │
│   pincodes            (NEW; public-read, admin-write; ~19.5k rows) │
│   delivery_rate_slabs (NEW; public-read, admin-write; 20 rows)     │
│   delivery_estimate_cache (NEW; DENY-DIRECT RLS, service-role only)│
│   profiles.default_pincode (NEW column; inherits profiles RLS)     │
└────────────────────────────────────────────────────────────────────┘
```

A reader traces the primary use case (DLVR-05) top-to-bottom: pincode in → validate → serviceability → zone → slab → round → cache → normalized estimate out.

### Recommended Project Structure
```
supabase/
├── functions/
│   ├── verify-and-submit/index.ts   # existing template — clone wholesale
│   └── delivery-estimate/index.ts   # NEW
├── migrations/
│   ├── 0014_delivery_settings_seed.sql   # NEW: +5 site_content keys (idempotent)
│   ├── 0015_pincodes.sql                 # NEW: pincodes table + RLS + indexes (schema only)
│   ├── 0016_delivery_rate_slabs.sql      # NEW: slab table + RLS + 20-row grid seed
│   ├── 0017_delivery_estimate_cache.sql  # NEW: cache table + deny-direct RLS + unique index
│   └── 0018_profiles_default_pincode.sql # NEW: profiles.default_pincode column
└── config.toml                           # MODIFY: [functions.delivery-estimate] verify_jwt=false
scripts/
├── seed-pincodes.ts                      # NEW: service-role chunked upsert of ~19.5k rows
├── data/pincodes.ndjson                  # NEW (committed): transformed unique-pincode dataset
└── verify-delivery-seed.ts               # NEW: node assertions (mirrors verify-seed.ts)
```
Migration numbering continues from `0013` (CONTEXT said "from 0013" but `0013_questionnaire_sections.sql` exists — start at `0014`). `[VERIFIED: codebase grep — supabase/migrations/]`

### Pattern 1: Clone `verify-and-submit` for compute-not-insert
**What:** Copy the CORS scaffold (`ALLOWED_ORIGINS`, `corsHeadersFor`, OPTIONS handling, generic try/catch, `Deno.env` secret read, Turnstile siteverify) verbatim. Replace the body's "insert under caller JWT" with "read settings + cache + compute + cache-write."
**When to use:** This function, exactly.
**Key divergence from `verify-and-submit` (document in the header comment):** `verify-and-submit` deliberately uses the **anon key scoped to the caller's JWT** because `customization_submissions` has a per-user ownership invariant RLS must enforce. `delivery-estimate` has **no ownership invariant** — cache rows are global and identical for every visitor — so it legitimately uses the **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`, already in function env) for cache + settings + pincode + slab access. This is NOT the Pitfall-4 anti-pattern: no RLS guarantee is bypassed, and the function being sole writer is what prevents client cache-poisoning. State this explicitly so a future reader does not "fix" it. `[CITED: .planning/research/ARCHITECTURE.md Pattern 1]`
```typescript
// delivery-estimate/index.ts (shape only — full CORS/Turnstile copied from verify-and-submit)
const corsHeaders = corsHeadersFor(req.headers.get('Origin'))   // verbatim copy
if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
const { token, destPincode, weightG } = await req.json()
if (typeof destPincode !== 'string' || !/^\d{6}$/.test(destPincode))   // BEFORE compute
  return json({ error: 'bad_request' }, 400)
// ...Turnstile siteverify (secret via Deno.env)...
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const estimate = await callCourierAdapter(admin, originPincode, destPincode, weightG, settings)
return json(estimate, 200)
```

### Pattern 2: `callCourierAdapter()` is the swappable seam (Pitfall 12 / DLVR-F1)
**What:** A single async function inside `index.ts` that returns the normalized `Estimate`. In Phase 6 its body is the table-backed compute. In DLVR-F1 the body is replaced with a Shiprocket call mapped to the identical shape — no other file changes.
```typescript
type Estimate = {
  serviceable: boolean
  cost: number | null              // rounded integer ₹ (D-13); null when !serviceable
  etaDays: { min: number; max: number } | null
  codAvailable: boolean
  originConfigured: boolean         // false when origin is '000000'/unknown (D-18)
}
async function callCourierAdapter(
  admin: SupabaseClient, origin: string, dest: string,
  weightG: number, settings: DeliverySettings,
): Promise<Estimate> { /* serviceability → zone → slab → round → cod */ }
```
The frontend, the cache schema, and Phases 7–10 only ever see `Estimate`. The courier JSON shape never leaves this function.

### Pattern 3: Settings in `site_content` (text values, JSON-encoded where structured)
`site_content.value` is a single `text` column `[VERIFIED: codebase grep — 0001_init_schema.sql]`. The 5 delivery settings ride it directly (no schema change to `site_content`). Scalars are plain strings; `delivery_cod_rules` is a **JSON string** stored in the text column, parsed by the function and the Phase 9 admin form. This preserves the existing upsert + `['siteContent']` invalidation pattern exactly.

### Anti-Patterns to Avoid
- **Static per-pincode zone label** — violates D-15; breaks on origin change. Derive origin-relative every time.
- **Regex-parsing `product_variants.label` ("70gm")** — Pitfall 9 / D-10. Use the 250g default only.
- **19k-row INSERT inside a migration** — use the service-role seed script.
- **Wildcard CORS** — copy `corsHeadersFor()` allowlist; echo only allow-listed origin (Pitfall 4 / D-21).
- **Reflecting raw Postgres errors** — generic `{ error: 'bad_request' }` (CR-01 / D-21).
- **Anon/public write policy on the cache** — deny-direct only (D-17); service role is sole writer.

## Zone-Derivation Algorithm (D-15 — the hardest unknown, fully specified)

The project's 5 zones map onto the **standard Indian-courier zone model** (Shiprocket Zone A–E) `[VERIFIED: shiprocket.in/blog/shipping-zones-india-explained + indiapost circle structure]`:

| Project zone | Courier analog | Rule |
|--------------|----------------|------|
| `local`    | Zone A (same city) | dest in same sorting-district as origin |
| `regional` | Zone B (same/adjacent state) | dest state == origin state OR adjacent |
| `metro`    | Zone C (metro↔metro) | both origin and dest are metros |
| `national` | Zone D (rest of India) | everything else serviceable |
| `remote`   | Zone E (NE + J&K + islands) | dest is in the remote set |

### Per-pincode facts (derived at seed time, stored on each `pincodes` row)
- `state` — normalized `StateName` from the directory.
- `first3` — `substring(pincode,1,3)` = the **sorting district** (India Post: digits 1–3 identify the sorting district ≈ city catchment). Used as the deterministic "same city" key. `[VERIFIED: India Post PIN structure]`
- `is_metro` — `true` when `first3` ∈ the fixed 8-metro prefix set:
  `{ '110' Delhi, '400' Mumbai, '700' Kolkata, '600' Chennai, '560' Bengaluru, '500' Hyderabad, '380' Ahmedabad, '411' Pune }`. `[ASSUMED]` (standard tier-1 metro list; planner may extend to NCR satellites later — Phase 10 owns rate tuning).
- `is_remote` — `true` when `state` ∈ the fixed remote set:
  `{ Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Tripura, Sikkim, Jammu and Kashmir, Ladakh, Andaman and Nicobar Islands, Lakshadweep }`. `[VERIFIED: India Post North-East circle + WB-circle islands + zone-E definition]`

### `deriveZone(origin, dest)` — evaluate in THIS order (order is load-bearing)
```
function deriveZone(origin, dest):            // both are pincodes rows
  1. if dest.is_remote:                  return 'remote'      // remote overrides all
  2. if dest.first3 == origin.first3:    return 'local'       // same sorting district
  3. if origin.is_metro and dest.is_metro: return 'metro'     // metro↔metro
  4. if dest.state == origin.state
       or dest.state in ADJACENT[origin.state]: return 'regional'
  5. else:                               return 'national'
```
**Why this order:** `remote` first so a remote destination is never cheapened by a coincidental same-state/metro match. `local` before `metro` so an intra-metro-city shipment (Mumbai→Mumbai) is `local`, not `metro`. `metro` before `regional` so two different metros in adjacent states (Delhi→Jaipur is NOT both-metro; Delhi→Mumbai IS) resolve to the metro lane.

### Origin-not-configured handling (D-18)
The seeded origin is `000000`, which is **not a real pincode** and will not be found in `pincodes`. When `origin === '000000'` OR the origin row is absent:
- set `originConfigured: false` in the response,
- **default the zone to `national`** (a safe mid-band lane) so an estimate still computes for testing,
- the destination still must pass the serviceability check (membership + `serviceable=true`).
Phase 7's UI reads `originConfigured:false` to flag estimates as provisional until the owner configures the real origin in Phase 9. This satisfies D-18 ("treat as not-yet-configured rather than silently producing skewed-but-real-looking numbers" while "estimates still compute for testing").

### State adjacency map (`ADJACENT`)
Required by D-15 ("adjacent state → regional"). Keyed by normalized `StateName`; values are land-bordering states. `[ASSUMED]` (Indian political geography — stable, but planner should spot-check; an incorrect edge only mis-sizes a `regional` vs `national` placeholder rate, which the owner re-tunes in Phase 10). Recommended seed:
```
Delhi:            [Haryana, Uttar Pradesh]
Haryana:          [Delhi, Punjab, Himachal Pradesh, Rajasthan, Uttar Pradesh, Uttarakhand, Chandigarh]
Punjab:           [Haryana, Himachal Pradesh, Rajasthan, Jammu and Kashmir, Chandigarh]
Rajasthan:        [Punjab, Haryana, Uttar Pradesh, Madhya Pradesh, Gujarat]
Uttar Pradesh:    [Delhi, Haryana, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, Bihar, Uttarakhand, Himachal Pradesh]
Uttarakhand:      [Himachal Pradesh, Haryana, Uttar Pradesh]
Himachal Pradesh: [Jammu and Kashmir, Ladakh, Punjab, Haryana, Uttarakhand]
Madhya Pradesh:   [Rajasthan, Uttar Pradesh, Chhattisgarh, Maharashtra, Gujarat]
Gujarat:          [Rajasthan, Madhya Pradesh, Maharashtra, Dadra and Nagar Haveli and Daman and Diu]
Maharashtra:      [Gujarat, Madhya Pradesh, Chhattisgarh, Telangana, Karnataka, Goa]
Chhattisgarh:     [Madhya Pradesh, Maharashtra, Telangana, Odisha, Jharkhand, Uttar Pradesh]
Telangana:        [Maharashtra, Chhattisgarh, Andhra Pradesh, Karnataka]
Andhra Pradesh:   [Telangana, Odisha, Chhattisgarh, Karnataka, Tamil Nadu]
Karnataka:        [Maharashtra, Goa, Telangana, Andhra Pradesh, Tamil Nadu, Kerala]
Goa:              [Maharashtra, Karnataka]
Kerala:           [Karnataka, Tamil Nadu]
Tamil Nadu:       [Kerala, Karnataka, Andhra Pradesh, Puducherry]
Odisha:           [West Bengal, Jharkhand, Chhattisgarh, Andhra Pradesh]
Jharkhand:        [Bihar, Uttar Pradesh, Chhattisgarh, Odisha, West Bengal]
Bihar:            [Uttar Pradesh, Jharkhand, West Bengal]
West Bengal:      [Bihar, Jharkhand, Odisha, Sikkim, Assam]
Sikkim:           [West Bengal]
Assam:            [West Bengal, Arunachal Pradesh, Nagaland, Manipur, Meghalaya, Mizoram, Tripura]
Arunachal Pradesh:[Assam, Nagaland]
Nagaland:         [Assam, Arunachal Pradesh, Manipur]
Manipur:          [Assam, Nagaland, Mizoram]
Mizoram:          [Assam, Manipur, Tripura]
Meghalaya:        [Assam]
Tripura:          [Assam, Mizoram]
Jammu and Kashmir:[Ladakh, Himachal Pradesh, Punjab]
Ladakh:           [Jammu and Kashmir, Himachal Pradesh]
```
UTs and small states omitted resolve to `national` (acceptable — they are not the origin in v1.1; the owner sets a single real origin in Phase 9). The map can live as a TS constant inside the Edge Function (no DB round-trip needed for adjacency).

## Pincode Seed Strategy (D-14 — concrete)

**Split: schema in migration, data in a service-role script.** A 19k-row INSERT does not belong in a migration; the repo convention is small idempotent seeds in migrations (0006 = 7 rows) and bulk data via service-role node scripts (`scripts/seed.ts`). `[VERIFIED: codebase grep]`

1. **Source:** data.gov.in *All India Pincode Directory* CSV. Columns: `CircleName, RegionName, DivisionName, OfficeName, Pincode, OfficeType, Delivery, District, StateName, Latitude, Longitude` `[VERIFIED: data.gov.in dataset 6818292]`. Raw file is ~165k post-office rows (~10–15 MB).
2. **Transform (one-time, committed):** dedupe to **unique `Pincode`** (~19.5k rows), keeping one representative row's `StateName`, `District`, `CircleName`, `RegionName`. Derive `first3`, `is_metro`, `is_remote` (rules above). Normalize StateName casing (directory uses upper-case like `JAMMU & KASHMIR` → normalize to `Jammu and Kashmir` to match the adjacency/remote sets — **normalization is critical**, an unnormalized `&` vs `and` mismatch silently breaks zone derivation). Write `scripts/data/pincodes.ndjson` (one JSON object per line: `{ pincode, state, district, circle, region, is_metro, is_remote }`). Committing the transformed NDJSON (<2 MB) removes any runtime data.gov.in dependency and makes the seed reproducible.
3. **Load (`scripts/seed-pincodes.ts`):** mirror `seed.ts` — service-role client from non-`VITE_` `process.env`, run via `node --env-file=.env.seed.local scripts/seed-pincodes.ts`. Read the NDJSON, **chunked upsert** (~1000 rows/batch) with `onConflict: 'pincode'`. Idempotent — re-running converges to ~19.5k rows, never duplicates. **Use PostgREST upsert, not `COPY`** — the live-ops memory notes the pooler URL carries no password so direct `psql`/`COPY` is unavailable.
4. **`serviceable` column** defaults `true` (D-16); the seed never sets it false. The boolean lets the owner switch a real pincode off later without a migration.

## Seed Slab Grid (D-04 / D-05 — fully specified, monotonic)

20 rows = 5 zones × 4 bands. **ETA = D-05 verbatim** (transit working days; the engine adds `dispatch_lead_days`). **₹ cost** below is internally consistent: strictly increasing across zones (within each band) and across bands (within each zone); anchored at local 0–250g = ₹40 and remote 1–2kg = ₹180 (D-04). All multiples of ₹5 for clean tuning; the engine still round-ups the final to ₹10 (D-11). `[ASSUMED — placeholder values; owner replaces in Phase 10]`

| zone | band (g) | cost ₹ | eta_min | eta_max |
|------|----------|-------:|--------:|--------:|
| local    | 0–250    |  40 | 1 | 2 |
| local    | 251–500  |  55 | 1 | 2 |
| local    | 501–1000 |  75 | 1 | 2 |
| local    | 1001–2000|  95 | 1 | 2 |
| regional | 0–250    |  55 | 2 | 4 |
| regional | 251–500  |  70 | 2 | 4 |
| regional | 501–1000 |  95 | 2 | 4 |
| regional | 1001–2000| 120 | 2 | 4 |
| metro    | 0–250    |  65 | 3 | 5 |
| metro    | 251–500  |  85 | 3 | 5 |
| metro    | 501–1000 | 110 | 3 | 5 |
| metro    | 1001–2000| 140 | 3 | 5 |
| national | 0–250    |  75 | 4 | 7 |
| national | 251–500  |  95 | 4 | 7 |
| national | 501–1000 | 125 | 4 | 7 |
| national | 1001–2000| 160 | 4 | 7 |
| remote   | 0–250    |  95 | 6 | 10 |
| remote   | 251–500  | 120 | 6 | 10 |
| remote   | 501–1000 | 150 | 6 | 10 |
| remote   | 1001–2000| 180 | 6 | 10 |

Monotonicity check (per band, across zones): band1 40<55<65<75<95 ✓ · band2 55<70<85<95<120 ✓ · band3 75<95<110<125<150 ✓ · band4 95<120<140<160<180 ✓. Per zone, across bands: every row strictly increases ✓.

**`weightBucket(g)`** (pure helper, also unit-testable): `g<=250→1`, `<=500→2`, `<=1000→3`, `<=2000→4`, `else→4` (clamp). With the 250g default (D-10) every Phase-6 estimate lands in band 1.

## Proposed Schema (DDL, mirroring 0001/0002/0011 conventions)

```sql
-- 0014_delivery_settings_seed.sql  (idempotent; site_content is text key/value)
insert into public.site_content (key, value) values
  ('delivery_origin_pincode',    '000000'),                                  -- D-18 placeholder
  ('delivery_default_weight_g',  '250'),                                     -- D-10
  ('delivery_dispatch_lead_days','1'),                                       -- D-20
  ('delivery_cod_rules',         '{"enabled":true,"fee":30,"valueCap":5000}'),-- D-06/07/08/09 (JSON string)
  ('delivery_free_ship_threshold', null)                                     -- D-19 (off/null)
on conflict (key) do nothing;

-- 0015_pincodes.sql  (schema only; data via scripts/seed-pincodes.ts)
create table public.pincodes (
  pincode     text primary key,                 -- unique pincode (deduped)
  state       text not null,
  district    text,
  circle      text,                              -- CircleName (postal circle ≈ state)
  region      text,                              -- RegionName
  is_metro    boolean not null default false,
  is_remote   boolean not null default false,
  serviceable boolean not null default true,     -- D-16
  created_at  timestamptz default now()
);
create index pincodes_state_idx on public.pincodes (state);
alter table public.pincodes enable row level security;
create policy "pincodes_public_read"  on public.pincodes for select
  to anon, authenticated using (true);          -- mirrors 0002 categories_public_read
create policy "pincodes_admin_write" on public.pincodes for all
  to authenticated using (private.is_admin()) with check (private.is_admin());

-- 0016_delivery_rate_slabs.sql
create table public.delivery_rate_slabs (
  id           uuid primary key default gen_random_uuid(),
  zone         text not null check (zone in ('local','regional','metro','national','remote')),
  weight_band  int  not null check (weight_band between 1 and 4),
  weight_min_g int  not null,
  weight_max_g int  not null,
  cost         integer not null,                 -- base ₹; engine round-ups final to 10 (D-11/13)
  eta_min_days int  not null,
  eta_max_days int  not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (zone, weight_band)
);
alter table public.delivery_rate_slabs enable row level security;
create policy "delivery_rate_slabs_public_read" on public.delivery_rate_slabs for select
  to anon, authenticated using (true);
create policy "delivery_rate_slabs_admin_write" on public.delivery_rate_slabs for all
  to authenticated using (private.is_admin()) with check (private.is_admin());
-- + insert the 20-row grid above with `on conflict (zone, weight_band) do nothing`

-- 0017_delivery_estimate_cache.sql  (DENY-DIRECT: RLS enabled, NO policies)
create table public.delivery_estimate_cache (
  id             uuid primary key default gen_random_uuid(),
  origin_pincode text not null,
  dest_pincode   text not null,
  weight_bucket  int  not null,
  serviceable    boolean not null,
  cost           integer,                         -- null when !serviceable
  eta_min_days   int,
  eta_max_days   int,
  cod_available  boolean not null default false,
  zone           text,
  fetched_at     timestamptz not null default now(),
  expires_at     timestamptz not null,            -- fetched_at + 24h (D-17)
  unique (origin_pincode, dest_pincode, weight_bucket)
);
alter table public.delivery_estimate_cache enable row level security;
-- NO policies → unreachable via PostgREST; service-role (Edge Function) is sole I/O (D-17)

-- 0018_profiles_default_pincode.sql
alter table public.profiles add column default_pincode text;   -- inherits profiles RLS (0002)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS allowlist / preflight | A new CORS helper | Copy `corsHeadersFor()` from `verify-and-submit` verbatim | Already correct, allow-listed, `Vary: Origin` set |
| Secret custody | `VITE_` env / bundled key | `Deno.env.get(...)` inside the function | Static SPA bundle is world-readable (Pitfall 3); `check-no-secret.sh` guards it |
| Abuse protection | Custom rate limiter | Reuse hosted-CDN Turnstile siteverify | Pitfall 4; memory: no npm wrapper |
| Bulk pincode load | Hand-rolled migration INSERT | Service-role chunked upsert (`seed.ts` pattern) | No psql/COPY via pooler; idempotent convergence |
| Currency rounding | Float formatting per call | One `roundUpTo10()` helper in the function (D-11/13) | Single source of the integer; UI never rounds |
| Pincode validity | A custom serviceability heuristic | Membership in the seeded `pincodes` table (D-14/16) | Authoritative India Post data |

**Key insight:** Every server-side concern in this phase already has a proven implementation in `verify-and-submit` or `seed.ts`. The only genuinely-new logic is `deriveZone()` + the slab lookup — keep everything else a copy.

## Common Pitfalls

### Pitfall A: StateName normalization mismatch silently breaks zone derivation
**What goes wrong:** The directory stores `JAMMU & KASHMIR` / `ANDAMAN & NICOBAR ISLANDS`; the adjacency/remote sets use `Jammu and Kashmir` / `Andaman and Nicobar Islands`. An unnormalized compare makes `is_remote`/adjacency silently miss, mis-zoning remote shipments as `national`.
**How to avoid:** Normalize StateName ONCE in the seed transform (canonical title-case, `&`→`and`); the Edge Function compares against the same canonical strings. Add a seed-time assertion that every distinct `state` value is in a known canonical set.
**Warning signs:** A Srinagar/Port Blair pincode returns the `national` rate instead of `remote`.

### Pitfall B: Origin `000000` reaches zone derivation and crashes / returns nonsense (Pitfall 10)
**What goes wrong:** `000000` is not in `pincodes`; a naive `origin.state` lookup throws or returns undefined.
**How to avoid:** Guard before `deriveZone` — if origin row missing OR `origin==='000000'`, set `originConfigured:false` and default zone `national`. Never let an absent origin throw.

### Pitfall C: Caching the not-serviceable / not-configured result incorrectly
**What goes wrong:** Caching a `serviceable:false` is fine and useful; but caching an estimate computed while `originConfigured:false` means after the owner sets a real origin in Phase 9, stale provisional rows linger for up to 24h. They naturally age out (new origin → new cache key), but a provisional row under `origin='000000'` would keep serving if the function still queried `000000`.
**How to avoid:** The cache key includes `origin_pincode`; once the real origin is configured the key changes and `000000` rows are never read again. Acceptable. Optionally skip caching when `originConfigured:false`.

### Pitfall D: 6-digit but non-existent pincode (passes regex, fails membership)
**What goes wrong:** `999999` passes `/^\d{6}$/` but is not a real pincode. Must return a clean `serviceable:false`, not a crash or a slab miss.
**How to avoid:** Serviceability (membership) check is step (a) inside `callCourierAdapter`, before zone/slab. Absent dest row → `{ serviceable:false }`.

### Pitfall E: ETA omits dispatch lead and undercounts
**What goes wrong:** Returning the raw slab transit range ignores `dispatch_lead_days` (D-20), so estimates read faster than reality.
**How to avoid (recommended):** `etaDays = { min: slab.eta_min + lead, max: slab.eta_max + lead }`. Phase 9 makes `lead` editable and SC2 requires it to "flow into live estimates," so the engine must incorporate it. `[ASSUMED — engine-incorporates-lead; flagged for planner confirmation, see Assumptions Log A4]`

## Code Examples

### Round-up to ₹10 (D-11/13)
```typescript
// Source: derived from D-11 (round UP to nearest ₹10)
const roundUpTo10 = (n: number) => Math.ceil(n / 10) * 10
// slab.cost = 55  → 60 ; slab.cost = 75 → 80 ; slab.cost = 40 → 40
```

### Cache read-then-write (service role)
```typescript
// Source: ARCHITECTURE.md Pattern 3 + D-17
const { data: hit } = await admin.from('delivery_estimate_cache')
  .select('*')
  .eq('origin_pincode', origin).eq('dest_pincode', dest).eq('weight_bucket', bucket)
  .gt('expires_at', new Date().toISOString())
  .maybeSingle()
if (hit) return toEstimate(hit)
const est = await computeFromTable(/* ... */)
await admin.from('delivery_estimate_cache').upsert({
  origin_pincode: origin, dest_pincode: dest, weight_bucket: bucket,
  serviceable: est.serviceable, cost: est.cost,
  eta_min_days: est.etaDays?.min ?? null, eta_max_days: est.etaDays?.max ?? null,
  cod_available: est.codAvailable, zone: est.zone,
  expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
}, { onConflict: 'origin_pincode,dest_pincode,weight_bucket' })
return est
```

### config.toml registration (D-21)
```toml
# Source: supabase/config.toml [functions.verify-and-submit] precedent
[functions.delivery-estimate]
verify_jwt = false   # anon visitors must reach the body; Turnstile is the gate
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Live courier rate API on the critical path | Seeded zone-weight table behind `callCourierAdapter()` | Ships with zero KYC/onboarding; DLVR-F1 swaps later with no frontend change |
| Static per-pincode zone column | Origin-relative derivation (D-15) | Estimates stay correct when the owner changes dispatch origin |
| 19k-row INSERT migration | Schema migration + service-role chunked upsert | Fast, idempotent, re-runnable; matches `seed.ts` |

**Deprecated/outdated for this phase:** Live API (Shiprocket/Delhivery), per-variant weight, token-refresh logic — all explicitly deferred (DLVR-F1/F2). Do not research or implement them in Phase 6.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 8-metro prefix set for `is_metro` (110/400/700/600/560/500/380/411) | Zone-Derivation | Low — only affects which placeholder `metro` rate applies; owner re-tunes in Phase 10. Planner may extend to NCR satellites. |
| A2 | State adjacency map edges | Zone-Derivation | Low–Med — a wrong edge mis-sizes `regional` vs `national` placeholder rate; cosmetic until Phase 10 tuning, but verify NE + J&K edges (they gate `remote` neighbors). |
| A3 | Placeholder ₹ slab values (40→180 grid) | Seed Slab Grid | Low — explicitly placeholder (D-04); owner replaces in Phase 10. Must stay monotonic (verified). |
| A4 | Engine adds `dispatch_lead_days` to the ETA range | Pitfall E / Edge Function | Med — changes the returned ETA contract. Phase 9 SC2 implies lead must flow into estimates; confirm with planner whether lead is added by engine or surfaced separately by UI. |
| A5 | Committing a transformed `pincodes.ndjson` (vs fetching data.gov.in at seed time) | Pincode Seed Strategy | Low — committed dataset removes a runtime dependency; refresh cadence is a non-issue (pincodes change rarely). |
| A6 | `delivery_free_ship_threshold` seeded as SQL `null` in the text column | Schema | Low — alternative is omitting the row; either satisfies D-19 ("present but off/null"). |

## Open Questions

1. **ETA lead-day composition (A4).** Should the engine return `slab ETA + dispatch_lead_days`, or return slab ETA and let later UI add lead? Recommendation: engine adds it (single source of truth, D-13 philosophy). Planner to confirm.
2. **Cache write when `originConfigured:false`.** Cache provisional estimates, or skip? Recommendation: skip caching while origin is the `000000` placeholder to avoid any stale provisional rows (low cost; trivial to drop the upsert when `!originConfigured`).
3. **Pincode dataset acquisition.** Exact data.gov.in CSV snapshot to commit — the transform/dedup is a one-time human step. Planner should make "obtain + transform the directory into `scripts/data/pincodes.ndjson`" an explicit task (likely a `checkpoint:human-verify` or a documented manual step), since it requires downloading the dataset.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `db push` + `functions deploy` | ✓ (devDep, cached auth) | 2.102.0 | — |
| Node | seed + verify scripts | ✓ | 22 | — |
| Deno | Edge Function runtime (managed by Supabase) | ✓ (config `deno_version=2`) | 2 | — |
| `supabase secrets` (TURNSTILE_SECRET_KEY) | Turnstile siteverify | ✓ (already set for verify-and-submit) | — | reuse existing secret |
| data.gov.in pincode CSV | `pincodes` seed | ✗ (must be downloaded once) | — | None — a one-time human download/transform step is required (Open Question 3) |
| Unit-test framework (vitest/jest) | Validation Architecture | ✗ (none configured) | — | Node service-role verification scripts (mirrors `scripts/verify-seed.ts`) — see Wave 0 |

**Missing dependencies with no fallback:** the data.gov.in dataset must be obtained once by a human; no automated fallback. Planner must add an explicit acquire+transform task.
**Missing dependencies with fallback:** no test framework → node verification scripts (the repo's established style).

## Validation Architecture

> nyquist_validation is enabled (`.planning/config.json` workflow.nyquist_validation = true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None configured** (CLAUDE.md "Testing: Not detected"). The repo validates via node service-role scripts run with `node --env-file` (e.g., `scripts/verify-seed.ts`, `scripts/verify-skeleton.ts`). |
| Config file | none — see Wave 0 |
| Quick run command | `node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` (NEW) |
| Full suite command | `echo y \| ./node_modules/.bin/supabase db push --linked` then the verify script + `supabase functions invoke delivery-estimate` smoke calls |

### Phase Requirements → Test Map (mapped to the 5 ROADMAP success criteria)

| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | Serviceable pincode + weight → normalized `{ serviceable, cost, etaDays, codAvailable }` from the seeded slab; courier shape never leaks | integration | `supabase functions invoke delivery-estimate --body '{"token":"...","destPincode":"560001","weightG":250}'` → assert shape + integer cost | ❌ Wave 0 (smoke script) |
| SC2 | Non-serviceable dest → clean `serviceable:false`; non-6-digit → 400, never a 500 | integration | invoke with `destPincode:"999999"` (→ serviceable:false) and `"12ab"` (→ 400) | ❌ Wave 0 |
| SC3 | No client secret; only `sutravan.in` echoed (no wildcard); Turnstile-gated; upstream timeout bounds work | static + integration | `bash scripts/check-no-secret.sh` (no secret in bundle) + grep function for `ALLOWED_ORIGINS`/`AbortController`; invoke with bad Origin → not echoed | ✓ check-no-secret.sh exists; ❌ grep assertions Wave 0 |
| SC4 | Repeat `(origin,dest,bucket)` served from cache within TTL; cache deny-direct, function sole writer | integration + RLS probe | invoke twice, assert 2nd has a cache row (`fetched_at` unchanged); anon `select` on `delivery_estimate_cache` returns 0 rows / denied | ❌ Wave 0 (in verify-delivery-seed.ts) |
| SC5 | All structures exist via idempotent migrations + seeded defaults → real estimate with no admin UI | seed assertions | `verify-delivery-seed.ts`: assert 5 site_content keys present, `delivery_rate_slabs` count = 20 + monotonic, `pincodes` count ≈ 19.5k, cache table exists, `profiles.default_pincode` column exists; re-run migrations → no error (idempotent) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` (row-count + RLS assertions; < 30s).
- **Per wave merge:** `db push --linked` (idempotent re-apply) + the verify script + 4 `functions invoke` smoke calls (serviceable / non-serviceable / bad-format / cache-hit).
- **Phase gate:** all five SC commands green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/seed-pincodes.ts` — service-role chunked upsert of `scripts/data/pincodes.ndjson` (covers SC5 data)
- [ ] `scripts/data/pincodes.ndjson` — transformed unique-pincode dataset (human acquire+transform; Open Question 3)
- [ ] `scripts/verify-delivery-seed.ts` — assertions for SC4 (RLS deny-direct) + SC5 (counts, idempotency, slab monotonicity)
- [ ] Edge Function smoke harness — documented `supabase functions invoke` calls for SC1/SC2/SC3/SC4 (no test runner; a short shell snippet or README block)
- [ ] No framework install needed — node scripts match the repo's established verification style

## Security Domain

> security_enforcement = true, ASVS level 1, block_on = high (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Function is `verify_jwt=false` public (D-21); no auth performed. Abuse is gated by Turnstile, not auth. |
| V3 Session Management | no | Stateless function; no session. |
| V4 Access Control | yes | RLS: `pincodes`/`delivery_rate_slabs` public-read + admin-write (`private.is_admin()`); `delivery_estimate_cache` **deny-direct** (no policies) — service-role sole writer (D-17). Mirrors 0002/0011. |
| V5 Input Validation | yes | Server-side `/^\d{6}$/` on `destPincode` BEFORE compute (D-21/SC2); body shape-guard (object, not array/null) copied from `verify-and-submit`; reject early with generic 400. |
| V6 Cryptography | yes (reuse, never hand-roll) | Turnstile siteverify; `TURNSTILE_SECRET_KEY` via `Deno.env` only — never `VITE_`/bundled (`check-no-secret.sh` enforces). |
| V7 Error Handling / Logging | yes | Generic `{ error: 'bad_request' }` responses; never reflect raw Postgres/PostgREST errors (CR-01 / D-21); `console.error` server-side only, never echo auth header/secret. |

### Known Threat Patterns for {static SPA + public Edge Function + Supabase}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Wildcard/reflected CORS lets any site invoke the endpoint | Spoofing / Elevation | `corsHeadersFor()` allowlist; echo only `sutravan.in` + localhost; default to prod origin (D-21) |
| Secret leak into the public bundle | Information Disclosure | Secrets only in `Deno.env`; `check-no-secret.sh` CI guard; no `VITE_` courier/Turnstile var |
| Anon endpoint scraping / DoS (pincode→price oracle) | Denial of Service | Turnstile siteverify + 24h Postgres cache + server-side format validation before compute + upstream `AbortController` timeout (Pitfall 4/7) |
| Client cache poisoning | Tampering | Deny-direct RLS on `delivery_estimate_cache`; service-role sole writer (no anon/auth policy) |
| Raw DB error reflection leaks schema | Information Disclosure | Generic error bodies; log server-side only (CR-01) |
| 6-digit-but-nonexistent / malformed pincode crash | Denial of Service | Regex gate + membership check → clean `serviceable:false` / 400, never a 500 (SC2) |

No high-severity gaps identified — the phase reuses the v1.0 security posture verbatim and adds deny-direct RLS for the new cache. ASVS L1 controls are all covered by cloning `verify-and-submit` + the RLS table policies above.

## Sources

### Primary (HIGH confidence)
- Codebase (read directly): `supabase/functions/verify-and-submit/index.ts`, `supabase/config.toml`, `supabase/migrations/0001/0002/0004/0005/0006/0011`, `scripts/seed.ts`, `client/src/lib/siteContent.ts` — Edge Function/CORS/secret pattern, RLS conventions, site_content text key/value, seed pattern, idempotent migration convention.
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,STACK}.md` — v1.1 milestone research (normalized contract, deny-direct cache, weight pitfall, vendor-lock-in adapter).
- `.planning/phases/06.../06-CONTEXT.md` — D-01..D-21 locked decisions.
- data.gov.in *All India Pincode Directory* (dataset 6818292) — CSV columns. https://www.data.gov.in/datasets_webservices/datasets/6818292
- India Post organisation/circles + PIN zone structure (Wikipedia + indiapost.gov.in) — circle≈state, NE circle, WB-circle islands, 9 PIN zones.

### Secondary (MEDIUM confidence)
- Shiprocket "Shipping Zones Explained — Zone A to E" — confirms the local/regional/metro/national/remote zone model used by Indian couriers. https://www.shiprocket.in/blog/shipping-zones-india-explained/
- Memory `supabase-live-ops.md` (live push/seed flow, pooler-no-password), `turnstile-no-npm-wrapper.md`.

### Tertiary (LOW confidence / ASSUMED)
- Metro prefix set + state adjacency map — general Indian geography (A1/A2); planner spot-check recommended; only affects placeholder rate sizing (re-tuned in Phase 10).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all imports verified in-repo.
- Schema / RLS: HIGH — mirrors shipped 0001/0002/0011 verbatim.
- Zone derivation: MEDIUM-HIGH — algorithm grounded in standard courier zone model + India Post structure; adjacency/metro sets are ASSUMED but low-risk (placeholder rates).
- Seed strategy: HIGH — mirrors `seed.ts` + live-ops memory; dataset columns verified.
- Pitfalls / security: HIGH — reuses v1.0 posture; ASVS L1 covered.

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (stable; only the data.gov.in dataset snapshot and placeholder rates are time-sensitive, and both are explicitly owner-replaceable).
