# Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A server-side `delivery-estimate` Supabase Edge Function (cloned from the v1.0
`verify-and-submit` CORS + secret pattern) returns a normalized,
vendor-agnostic `{ serviceable, cost, etaDays (range), codAvailable }` computed
from a seeded **zone-weight slab table**, behind a swappable
`callCourierAdapter()` boundary. This phase also lands ALL delivery data
structures so a real estimate returns **before any UI exists**:

- New `site_content` keys (origin pincode, default weight, dispatch lead time, COD rules, free-ship threshold)
- The zone-weight rate slab table (5 zones × 4 weight bands → cost + ETA range)
- The `pincodes` serviceability dataset (full India Post directory)
- The `delivery_estimate_cache` table (deny-direct RLS, service-role sole writer)
- A `profiles.default_pincode` column

**In scope:** schema/migrations + seeded defaults + the Edge Function + RLS.
**Out of scope (other phases):** any UI (Phase 7 product estimator, Phase 8
navbar widget), admin *editing* of these settings (Phase 9 settings form,
Phase 10 slab editor). Phase 6 only seeds sensible defaults; it does not build
forms to edit them.

</domain>

<decisions>
## Implementation Decisions

### Zone-Weight Slab Table
- **D-01:** **5 zones** — `local` (same city), `regional` (neighboring states / ~500km), `metro` (major metros), `national` (rest of India), `remote` (NE, J&K, Ladakh, A&N/islands).
- **D-02:** **4 weight bands (grams):** 0–250, 251–500, 501–1000, 1001–2000. (Products are small: soaps ~100–150g, jars ~200–300g; bands give headroom for gifting bundles.)
- **D-03:** Slab table is the cartesian grid: one row per (zone × weight band) → `cost` (integer ₹) + `eta_min_days` + `eta_max_days`. This is the contract a live courier API (DLVR-F1) later swaps behind unchanged.
- **D-04:** **Seed ₹ rates = researcher-recommended placeholders** (internally consistent Indian-D2C grid, e.g. ~₹40 local 0–250g rising to ~₹180 remote 1–2kg). They are explicitly placeholders; the owner replaces them with real courier rates in **Phase 10**'s editor — no redeploy.
- **D-05:** **Seed ETA ramp (working days):** local 1–2 · regional 2–4 · metro 3–5 · national 4–7 · remote 6–10.

### COD Rules
- **D-06:** **Fixed flat COD fee** model (NOT percentage — there is no cart/order value in v1.1). Schema stores a fee field; **seed default ₹30**.
- **D-07:** **Optional COD order-value cap** field; **seed generous (₹5000)** so COD shows available for normal orders now. Nullable/optional in schema.
- **D-08:** **COD availability = single global admin on/off toggle.** NOT per-zone, NOT per-pincode (the India Post dataset carries no COD info — per-pincode COD would be guesswork). Seed = COD on.
- **D-09:** COD rules stored as a single `delivery_cod_rules` jsonb `site_content` key (shape ~ `{ enabled: bool, fee: int, valueCap: int|null }`) — exact field shape is planner's discretion, but it MUST ride the existing `site_content` upsert + `['siteContent']` invalidation pattern.

### Weight Fallback & Rounding
- **D-10:** **Default fallback weight = 250g** (`delivery_default_weight_g` site_content key). This is the ONLY weight every estimate uses (no numeric weight column exists; the free-text `product_variants.label` like "70gm" is **NEVER** regex-parsed — Pitfall 9). Errs slightly high to bias toward a ceiling estimate.
- **D-11:** **Rounding: round UP to nearest ₹10.** Always a ceiling, clean professional numbers (₹50, ₹60).
- **D-12:** **No separate buffer/markup field.** The slab value IS the estimate; round-up alone provides the cushion. Any margin is baked into the slab rates set in Phase 10 — one source of truth.
- **D-13:** **The ENGINE returns the final rounded integer `cost`.** The cache stores the rounded number; every UI surface (Phase 7 + 8) shows identical figures. UI only adds the `₹` prefix + thousands separators (no rounding in UI).

### Pincodes & Serviceability
- **D-14:** **Seed the full ~19k India Post All-India Pincode Directory** (data.gov.in). Membership in this table is the serviceability source.
- **D-15:** **Zone is derived RELATIVE to the configured origin**, NOT a static per-pincode label. Each `pincodes` row carries `state` + region/circle + `is_metro` + `is_remote` flags; the engine computes the zone by comparing destination to the origin pincode (same city→local, same/adjacent state→regional, metro↔metro→metro, NE/J&K/islands→remote, else national). This keeps estimates correct when the owner changes the dispatch origin (Pitfall 10). Exact adjacency/metro logic is planner+researcher's to specify.
- **D-16:** **Serviceable = membership in the pincodes table AND a `serviceable` boolean column (default true).** The boolean lets a real pincode be switched off later without deleting the row / running a migration.

### Edge Function & Cache
- **D-17:** **Cache TTL = 24h**, keyed by `(origin, dest, weight-bucket)` where weight-bucket = the 4 bands in D-02. `delivery_estimate_cache` is **deny-direct RLS**; the Edge Function (service role) is the sole writer. Mirrors the cache pattern in the research SUMMARY.
- **D-18:** **Origin pincode seeded as a clearly-fake placeholder (`000000`).** The owner sets the real dispatch pincode in Phase 9. The function should treat an unconfigured/placeholder origin as "not yet configured" rather than silently producing skewed-but-real-looking numbers (Pitfall 10). Estimates still compute for testing.
- **D-19:** **Free-ship threshold:** `delivery_free_ship_threshold` site_content key present but seeded **off/null**; owner sets it in Phase 9.
- **D-20:** Seed `delivery_dispatch_lead_days` = 1 (working day).
- **D-21:** Reuse `verify-and-submit` security posture verbatim: `corsHeadersFor()` allowlist (no wildcard, echo only `sutravan.in` + localhost dev), secrets via `Deno.env` only (never VITE_/bundled), Turnstile hosted-CDN abuse protection, `verify_jwt=false`, server-side 6-digit/numeric pincode validation **before** any compute, an upstream timeout, and generic error responses (never reflect raw Postgres errors).

### Claude's Discretion
- Exact placeholder ₹ values within the seeded grid (must be internally consistent and monotonic across zones/bands).
- Exact jsonb shape of `delivery_cod_rules`, the precise adjacency/metro classification logic for zone derivation, column names, and migration file numbering (continue from `0013`).
- Whether `pincodes` region/circle is stored as an explicit column or derived — as long as zone derivation stays origin-relative.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 6" — goal, 5 success criteria, milestone scope guardrail (zone-weight table is the ONLY rate source in v1.1; live API and per-variant weight are deferred).
- `.planning/REQUIREMENTS.md` — DLVR-05 (the requirement this phase delivers) + the full DLVR-01..10 traceability so the schema anticipates Phases 7–10.

### Research (v1.1 — directly applicable)
- `.planning/research/SUMMARY.md` — recommended stack, normalized contract, build order (migrations → Edge Function → hook → UI → admin), owner-decision list (now resolved in this CONTEXT).
- `.planning/research/PITFALLS.md` — Pitfalls 2 (estimate-as-promise/rounding), 3 (token leak), 4 (anon abuse), 9 (missing weight), 10 (origin misconfig), 11 (ETA/INR formatting), 12 (vendor lock-in). Each maps to a decision above.
- `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/FEATURES.md` — supporting context.

### Codebase patterns to clone
- `supabase/functions/verify-and-submit/index.ts` — the EXACT Edge Function pattern to clone: `corsHeadersFor()` allowlist, `Deno.env` secrets, Turnstile siteverify, `verify_jwt=false`, generic error handling, field allow-listing.
- `supabase/migrations/0006_seed_site_content.sql` — the `site_content` key-value seed pattern (idempotent upsert) for the new delivery keys.
- `supabase/migrations/0001_init_schema.sql`, `0002_rls_policies.sql` — table + RLS conventions (fully-qualified refs, `(select auth.uid())` initPlan form, locked search_path) to mirror for the slab/pincodes/cache tables.
- `supabase/migrations/0004_auth_profiles.sql` — `profiles` table conventions; add `profiles.default_pincode` here.

### Live-ops
- Memory `supabase-live-ops.md` — how to push migrations + seed/clean data against the live Supabase project (the ~19k pincode seed will run through this).
- Memory `turnstile-no-npm-wrapper.md` — reuse the hosted-CDN Turnstile loader; never add the npm wrapper.

[No standalone ADR/SPEC docs exist for this phase — requirements fully captured in the decisions above + the research docs.]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verify-and-submit/index.ts`: clone wholesale for `delivery-estimate` — CORS allowlist, secret handling, Turnstile, error posture, `verify_jwt=false` config.toml entry.
- `site_content` table + admin upsert pattern (`['siteContent']` cache key): the 5 new delivery settings keys ride this directly; no new admin plumbing needed in Phase 6.
- Idempotent migration convention (`supabase/migrations/00NN_*.sql`): new migrations continue from `0013`.

### Established Patterns
- Deny-direct RLS with service-role as sole writer (research SUMMARY) → `delivery_estimate_cache`.
- Public-read RLS on catalog tables (`0005_cr01_products_public_read.sql`) → `pincodes` and slab table likely need public/anon read so the function (and later UI) can resolve estimates.
- Normalized vendor-agnostic contract → `callCourierAdapter()` stub returns the seeded-table result now; the courier shape never leaks past the function (Pitfall 12).

### Integration Points
- `profiles.default_pincode` (new column) — written/read by Phase 8 (profile pincode sync); only the column lands in Phase 6.
- Edge Function reads `site_content` keys + slab table + `pincodes` + writes `delivery_estimate_cache` on every request — all four must exist before the function deploys (build order: migrations first).

</code_context>

<specifics>
## Specific Ideas

- Estimates must always read as an **estimate, not a promise** — round UP, show ETA as a working-days range, COD as a clear yes/no. (UI framing is Phase 7, but the engine's rounded-integer + range contract exists to support it.)
- The placeholder origin `000000` is deliberately fake so the owner is forced to configure the real dispatch pincode in Phase 9 before estimates are trustworthy — better than a plausible-looking wrong guess.

</specifics>

<deferred>
## Deferred Ideas

- **Per-pincode COD serviceability** — needs a real courier COD feed; revisit if/when a live API (DLVR-F1) is added. (COD is a global toggle for now.)
- **Per-variant numeric weight column (`weight_g`)** — DLVR-F2; post-launch accuracy upgrade. Until then everything uses the 250g fallback.
- **Live courier API (Shiprocket / DLVR-F1)** — drops in behind `callCourierAdapter()` with no frontend change; explicitly out of v1.1 scope.
- **Per-zone or % COD fee model** — schema stores a flat fee; richer models deferred.
- **Configurable global buffer %** — considered and rejected for now (margin lives in slab rates); a `site_content` key could add it later if estimates prove systematically low.

None of the above were in scope — discussion stayed within the Phase 6 boundary.

</deferred>

---

*Phase: 6-estimate-engine-delivery-schema-settings-edge-function*
*Context gathered: 2026-06-28*
