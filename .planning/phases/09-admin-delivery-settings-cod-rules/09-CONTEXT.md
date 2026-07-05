# Phase 9: Admin Delivery Settings & COD Rules - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A new admin portal page (`/admin/delivery`) that lets the owner **edit** the five
delivery settings Phase 6 already seeded into `site_content`, with edits flowing
live into estimates and no redeploy:

- **Origin (dispatch) pincode** — validated as a 6-digit *serviceable* pincode, with a live preview
- **Default fallback weight** (grams)
- **Dispatch lead time** (working days)
- **COD rules** — availability toggle, optional flat fee, optional order-value cap
- **Free-shipping threshold** — optional; surfaced as static "free over ₹X" messaging (no cart progress bar)

**In scope:** the admin editing UI (form + validation + live preview), the
minimal `delivery-estimate` edge-function extensions needed to power an admin
preview (admin-JWT Turnstile bypass + admin-only origin override), and estimate
cache purge on save.

**Out of scope (other phases):** the zone-weight rate slab editor (Phase 10 —
its own nav item / sub-view), any new delivery data structures (Phase 6 landed
them all), and customer-facing estimator UI (Phases 7/8, already built). This
phase edits existing keys; it adds no new `site_content` keys.

</domain>

<decisions>
## Implementation Decisions

### Page & Layout
- **D-01:** New **`Delivery`** item in the admin sidebar (after `Site Content`, before `Submissions`) → route `/admin/delivery`. Keeps operational shipping config separate from marketing copy, and gives the Phase 10 slab editor a natural home to slot next to (sub-tab or sibling nav — Phase 10's call).
- **D-02:** **Single sectioned form, one Save button** — mirrors the existing `SiteContent.tsx` editor exactly. Fieldsets: **Origin & Dispatch** (origin pincode + preview, default weight, lead days), **Cash on Delivery** (toggle, fee, cap), **Free shipping** (threshold). NOT per-section save.
- **D-03:** All settings ride the existing **`site_content` upsert + `['siteContent']` invalidation** pattern (`useSaveSiteContent` in `lib/admin.ts`). No new admin plumbing. `delivery_cod_rules` remains a single JSON-string value; the others are plain string values (see Phase 6 D-09/seed).

### Live Preview (SC1)
- **D-04:** **Manual "Preview" button** — the owner types origin + a test destination pincode and clicks Preview to run the estimate on demand. NOT auto-on-save, NOT on-keystroke. Preview is independent of Save so the owner can probe a route *before* committing.
- **D-05:** **Admin-entered test destination pincode** — a small "Test against" input beside the preview, so the owner can sanity-check any real route (their city, a far metro), not just one hardcoded sample.
- **D-06:** Preview output reads exactly as SC1: **"From &lt;origin&gt; to &lt;test pincode&gt;: ₹X, Y–Z working days"** plus COD availability. It calls the deployed `delivery-estimate` edge function (single source of truth — no client-side estimate math).
- **D-07:** **Admin-JWT Turnstile bypass** — extend `delivery-estimate` to **skip Turnstile siteverify when the caller presents a valid admin session** (verify the Supabase JWT server-side + confirm admin role). The public/anon path is UNCHANGED — it still requires a Turnstile token. The admin portal does NOT add a Turnstile widget.
- **D-08:** **Admin-only `originPincode` override** — extend the edge function to accept an optional `originPincode` in the request body that is honored **only for verified admin callers**; public callers always use the saved `site_content` origin. This lets a pre-save preview reflect the origin the owner just *typed*, not the last-saved one.

### Origin Validation & Cache
- **D-09:** **Client-side serviceability check** — on origin change/blur, query the public-read `pincodes` table (`serviceable = true`) for the typed value and show inline **✓ serviceable (city) / ✗** feedback. Format is an instant `/^\d{6}$/` regex; serviceability is one lightweight lookup.
- **D-10:** **Block Save on an invalid origin** — Save is disabled/rejected unless the origin is a 6-digit pincode present in `pincodes` with `serviceable = true`. The placeholder **`000000` is explicitly rejected** ("not a real origin").
- **D-11:** **Purge `delivery_estimate_cache` on every settings save.** The cache is keyed by `(origin, dest, weight)` — an origin change misses cache naturally, but weight / lead-days / COD / free-ship changes would otherwise linger up to the 24h TTL and look like the edit "didn't take". After a successful upsert, clear the cache so every surface recomputes with the new settings immediately (guarantees SC5).
- **D-12:** The cache purge **must go through the service role** — `delivery_estimate_cache` is deny-direct RLS with the edge function as sole writer, so a direct client `DELETE` is not permitted. Mechanism (a purge branch in the edge function invoked with the admin JWT, a dedicated admin-authorized RPC, or an admin-gated delete policy) is planner/researcher's discretion — but it cannot be a raw client delete.

### COD & Numeric Inputs
- **D-13:** When **"COD available" is toggled off**, the Fee and Value-cap inputs **grey out (disabled) but keep their values**, so re-enabling COD restores the prior fee/cap.
- **D-14:** **Blank = null/off** for the two optional numeric fields: an empty COD value-cap saves `null` (COD allowed at any order value); an empty free-shipping threshold saves `null` (no free-ship messaging). Helper text: "Leave blank to disable." Matches the Phase 6 seed (`delivery_free_ship_threshold` = null = off). No separate enable-checkbox.
- **D-15:** **Zod validation bounds (on save):**
  - Default weight: **integer 1–2000 g** (matches the 4 slab weight bands, Phase 6 D-02), required
  - Dispatch lead time: **integer 0–14** working days, required
  - COD fee: **integer ≥ 0**, required when COD is enabled
  - COD value-cap: **integer > 0 or blank**
  - Free-shipping threshold: **integer > 0 or blank**
  - Reject negatives / decimals with inline error messages.

### Claude's Discretion
- Exact `Delivery` sidebar icon (Lucide), field labels, helper-text wording, and section ordering within the form.
- The precise cache-purge mechanism (edge-function purge branch vs admin RPC vs admin-gated delete policy) per D-12.
- How the admin JWT + role is verified inside the edge function (e.g. `auth.getUser()` on the bearer token, then an `is_admin` / profiles-role check) — as long as the public path stays Turnstile-gated and unchanged.
- Whether the origin serviceability lookup reuses an existing `pincodes` query helper or adds a small one.
- Toast/success feedback on save (reuse the existing admin save-toast pattern).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 9: Admin Delivery Settings & COD Rules" — goal, 5 success criteria (SC1 live preview, SC2 weight+lead, SC3 COD, SC4 free-ship, SC5 `site_content` pattern + no redeploy).
- `.planning/REQUIREMENTS.md` — DLVR-01 (origin + validation + preview), DLVR-02 (weight + lead time), DLVR-04 (COD rules + free-ship threshold) — the three requirements this phase delivers.

### Prior-phase decisions this phase builds on (READ — these are the source of truth for the settings being edited)
- `.planning/phases/06-estimate-engine-delivery-schema-settings-edge-function/06-CONTEXT.md` — the seeded keys, their shapes, and the reasoning behind every default. Especially: D-06/07/08 (COD flat fee ₹30 / cap ₹5000 / global toggle), D-09 (`delivery_cod_rules` JSON-in-text shape `{enabled,fee,valueCap}`), D-10 (250g fallback weight), D-16 (serviceable = pincodes membership + boolean), D-17 (cache keyed by origin/dest/weight-bucket, 24h TTL, deny-direct RLS), D-18 (`000000` placeholder origin), D-19 (free-ship seeded null/off), D-20 (lead days = 1).

### Codebase patterns to clone
- `client/src/pages/admin/SiteContent.tsx` — the EXACT admin settings-form pattern to mirror: RHF + zodResolver, prefill-from-live-values via `reset()` in `useEffect`, sectioned `<fieldset>`/`<legend>`, single Save button, inline `role="alert"` errors.
- `client/src/pages/admin/AdminLayout.tsx` — `NAV_ITEMS` array; add the `Delivery` entry here.
- `client/src/lib/admin.ts` — `useSaveSiteContent` upsert + `['siteContent']` invalidation; add the cache-purge step alongside a delivery-settings save.
- `client/src/lib/siteContent.ts` — `useSiteContent` + `SITE_CONTENT_DEFAULTS`; the delivery keys (`delivery_origin_pincode`, `delivery_default_weight_g`, `delivery_dispatch_lead_days`, `delivery_cod_rules`, `delivery_free_ship_threshold`) live here.
- `client/src/lib/delivery.ts` — `estimateDelivery()` / `useDeliveryEstimate()`; the admin preview reuses this invoke wrapper (extended for the admin-JWT + `originPincode` path).
- `supabase/functions/delivery-estimate/index.ts` — the edge function to extend (admin-JWT Turnstile bypass D-07, admin-only `originPincode` override D-08, optional cache-purge branch D-12). Public path (Turnstile-gated, `verify_jwt=false`, generic errors) MUST stay unchanged.
- `supabase/migrations/0014_delivery_settings_seed.sql` — the seeded key names/values being edited.
- `supabase/migrations/0016_delivery_rate_slabs.sql`, `0017_delivery_estimate_cache.sql` — slab table (public read, admin write) + cache table (deny-direct RLS) definitions relevant to preview + purge.

### Live-ops & security
- Memory `supabase-live-ops.md` — pushing edge-function changes / migrations to the live Supabase project.
- Memory `turnstile-no-npm-wrapper.md` — relevant only as the reason we chose the admin-JWT bypass (D-07) over adding a Turnstile widget to admin; no npm wrapper is added.

[No standalone ADR/SPEC docs exist for this phase — requirements fully captured in the decisions above + Phase 6 CONTEXT + the research docs it references.]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SiteContent.tsx`** — copy its whole structure for a `Delivery.tsx` settings page (RHF + Zod + prefill + sectioned fieldsets + single Save).
- **`useSiteContent` / `SITE_CONTENT_DEFAULTS` / `useSaveSiteContent`** — read + upsert the delivery keys with zero new admin plumbing (D-03).
- **`estimateDelivery()` in `lib/delivery.ts`** — the invoke wrapper the admin preview calls; extend for the admin path (bearer token instead of Turnstile token, plus `originPincode`).
- **`pincodes` public-read table** — powers the client-side serviceability check (D-09) with a single lightweight query.

### Established Patterns
- **`site_content` upsert + `['siteContent']` invalidation** = live-with-no-redeploy (SC5). The cache purge (D-11/D-12) is the one addition needed so non-origin changes also appear immediately.
- **Admin write via RLS** — catalog/site_content admin writes are already admin-gated; the new form inherits this. The edge-function admin bypass (D-07) needs its own server-side role check.
- **Deny-direct RLS + service-role sole writer** on `delivery_estimate_cache` — dictates that purge (D-12) cannot be a raw client delete.

### Integration Points
- New `Delivery` page → `AdminLayout` `NAV_ITEMS` + `App.tsx` admin route.
- `delivery-estimate` edge function gains an admin-authenticated branch (bypass Turnstile, honor `originPincode`, optionally purge cache) while its public contract is untouched.
- Settings save → `site_content` upsert → cache purge → live estimates on the customer estimator (Phases 7/8) reflect the change on next lookup.

</code_context>

<specifics>
## Specific Ideas

- The origin field must make it impossible to leave the deliberate `000000` placeholder in place — validation treats it as "not a real origin" and blocks Save (turns Phase 6's forcing-function into an enforced gate here).
- The preview should read as an **estimate, not a promise** (consistent with Phase 6/7 framing): ₹ rounded, ETA as a working-days *range*, COD as a clear yes/no.
- "Leave blank to disable" is the whole UX for optional cap and free-ship threshold — no extra toggles beyond the single COD availability switch.

</specifics>

<deferred>
## Deferred Ideas

- **Zone-weight rate slab editing** — Phase 10 (`DLVR-03`). This phase edits scalar settings only; the slab grid is its own editor.
- **Per-zone / percentage COD fee**, **per-pincode COD serviceability**, **per-variant numeric weight**, **live courier API**, **configurable global buffer %** — all deferred in Phase 6 CONTEXT; unchanged here.
- **Cart free-shipping progress bar** — explicitly out of scope; free-ship is static "free over ₹X" messaging only (SC4). E-commerce cart/checkout is a later milestone.

None of the above were in scope — discussion stayed within the Phase 9 boundary.

</deferred>

---

*Phase: 9-admin-delivery-settings-cod-rules*
*Context gathered: 2026-07-05*
