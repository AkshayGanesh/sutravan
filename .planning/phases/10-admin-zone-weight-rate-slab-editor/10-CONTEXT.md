# Phase 10: Admin Zone-Weight Rate Slab Editor - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A new admin portal editor for the **`delivery_rate_slabs`** table — the
(zone × weight-band → cost + ETA range) grid that drives every delivery
estimate. Phase 6 seeded the grid with explicit *placeholder* rates (D-04);
this phase gives the owner a UI to replace them with real rates and tune ETAs,
with edits flowing **live** into customer estimates (product detail + navbar)
and **no redeploy**.

**In scope:** the admin grid-editing UI (spreadsheet matrix of the 20 fixed
cells), input validation, a bulk save, and the cache purge that makes edits
appear live.

**Out of scope (other phases / locked upstream):**
- Any change to zones or weight bands — the 5×4 vocabulary is a fixed
  structural constant (Phase 6 D-01/D-02, migration `0016`); the editor never
  adds/removes zones, bands, or rows.
- Scalar delivery settings (origin, default weight, lead time, COD, free-ship)
  — those are Phase 9's `/admin/delivery` page.
- A live courier API (DLVR-F1), per-variant numeric weight (DLVR-F2), or any
  new rate source — the slab table stays the single rate source behind the
  normalized contract (milestone guardrail).

</domain>

<decisions>
## Implementation Decisions

### CRUD Model — SC1 reconciliation
- **D-01:** **Edit-in-place of a fixed, complete grid.** SC1's "add, edit,
  delete" is delivered as **edit-only** of the existing 20 cells. Zones
  (`local/regional/metro/national/remote`) and weight bands (1–4) are
  structural constants enforced by the `unique(zone, weight_band)` key and CHECK
  constraints in migration `0016`. The editor exposes **no add-row or
  delete-row affordance** — the cartesian grid is always complete by
  definition. This makes SC3 ("no coverage gaps / no missing-slab crash")
  **structurally guaranteed**: every serviceable destination + weight always
  resolves to a slab because a cell can never be missing.
- **D-02:** Only **`cost`** (per cell) and **`eta_min_days` / `eta_max_days`**
  (per zone — see D-06) are editable. `zone`, `weight_band`,
  `weight_min_g/weight_max_g`, `id` are read-only display context, never
  written by the editor as new values.

### Editing Surface & Home
- **D-03:** **Spreadsheet matrix layout** — 5 zone rows × 4 weight-band
  columns, whole grid visible at once, edited inline. Weight-band column
  headers show the gram ranges (0–250 / 251–500 / 501–1000 / 1001–2000g) as
  read-only labels. Fastest way to scan and tune a rate card; mirrors how the
  owner thinks about shipping rates.
- **D-04:** **Single "Save" button for the entire grid** (Save-all), mirroring
  the one-Save-button pattern of `SiteContent.tsx` / `Delivery.tsx`. NOT
  per-cell or per-row save.
- **D-05:** **New sibling nav item — "Rate Slabs"** — added to `AdminLayout`
  `NAV_ITEMS` next to (after) **Delivery**, with its own route (e.g.
  `/admin/rates`; exact path is Claude's discretion). Keeps the two shipping
  surfaces cleanly separated: **Delivery** = scalar settings (Phase 9),
  **Rate Slabs** = the grid (Phase 10). NOT a sub-tab inside `/admin/delivery`
  (avoids introducing a tab pattern the admin portal doesn't use and mixing two
  save models on one page). This resolves the "sub-tab or sibling" question left
  open in Phase 9 D-01.

### ETA Editing Scope
- **D-06:** **Per-zone ETA, not per-cell.** Although the schema stores
  `eta_min_days/eta_max_days` per row, the editor exposes **one ETA min–max
  input per zone row**, and on save writes that value to **all 4 cells** of the
  zone. Rationale: transit time depends on distance/zone, not parcel weight —
  matches reality and the Phase 6 seed (each zone's 4 bands share one ETA). This
  reduces 20 ETA pairs to 5. **Cost stays per-cell** (20 independent cost
  inputs).

### Validation (SC3)
- **D-07:** **Block-save with inline per-cell errors** — the Save button is
  disabled/rejected while any field is invalid; errors render inline
  (`role="alert"`, matching the Phase 9 form convention).
- **D-08:** **Bounds:**
  - **Cost:** integer **≥ 1** (strictly positive) — required. A cell can never
    be ₹0, which satisfies SC3's "no silent ₹0" **by construction** (free
    shipping is handled separately by the Phase 9 free-ship threshold, not by a
    ₹0 slab). No separate ₹0-confirmation dialog is needed.
  - **ETA:** `eta_min_days` integer **≥ 1**; `eta_max_days` integer with
    **`eta_min_days ≤ eta_max_days`**; a sane upper bound (~30 working days) is
    Claude's discretion.
  - Reject blanks, negatives, and decimals with inline errors.
- **D-09:** **No monotonicity enforcement and no monotonicity warnings** — the
  owner may set any internally-consistent rates they choose; the editor does not
  warn if a heavier band is cheaper than a lighter one or a farther zone cheaper
  than a nearer one. (Considered and explicitly declined to keep the editor
  simple; the seed is monotonic but that is not enforced on edits.)

### Save & Live Reflection (SC2)
- **D-10:** On Save: **bulk-upsert all 20 rows** to `delivery_rate_slabs` in one
  call under the existing admin-write RLS (`private.is_admin()`), then
  **invalidate the slab query cache** (a new `['deliverySlabs']`-style query key
  for reading the grid). A full 20-row upsert every save is chosen over
  dirty-row tracking — the table is tiny and a full upsert is cheap and simpler.
- **D-11:** **Reuse the existing `delivery-estimate` `{ purge: true }` cache
  purge branch** (built in Phase 9, D-11/D-12) after the upsert to clear
  `delivery_estimate_cache`, so customer estimates (product detail + navbar)
  recompute with the new rates immediately rather than lingering up to the 24h
  TTL. Best-effort / failure-tolerated, exactly like `useSaveDeliverySettings`
  (`admin.ts`). **No new edge-function work should be required** — verify the
  existing purge branch is source-agnostic (it clears the whole cache) and reuse
  it verbatim.

### Claude's Discretion
- Exact route path (`/admin/rates` vs `/admin/slabs` vs `/admin/delivery/rates`)
  and the Lucide sidebar icon.
- The read hook/query for the grid (new `useDeliveryRateSlabs()` in `admin.ts`
  or `delivery.ts`) and the exact query-key string.
- The precise matrix cell markup (cost + ETA arrangement), column-header
  wording, currency prefix rendering, and responsive behavior of the dense grid
  on narrow screens.
- The exact upper bound for `eta_max_days` and helper-text wording.
- Toast/success feedback on save (reuse the existing admin save-toast pattern).
- Whether a "reset to seeded defaults" affordance is offered (optional, not
  required by any SC).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 10: Admin Zone-Weight Rate Slab Editor" — goal,
  4 success criteria (SC1 view/edit slabs, SC2 live reflection no-redeploy, SC3
  validation + no coverage gaps, SC4 normalized contract preserved) + the
  milestone scope guardrail (slab table is the ONLY rate source in v1.1).
- `.planning/REQUIREMENTS.md` — **DLVR-03** (the single requirement this phase
  delivers).

### Prior-phase decisions this phase builds on (READ — source of truth for the grid being edited)
- `.planning/phases/06-estimate-engine-delivery-schema-settings-edge-function/06-CONTEXT.md`
  — the slab table's shape and reasoning: D-01 (5 zones), D-02 (4 weight bands
  0–250/251–500/501–1000/1001–2000g), D-03 (cartesian grid = the swappable
  contract), D-04 (seed rates are placeholders replaced HERE, no redeploy), D-05
  (seed ETA ramp), D-11/D-12/D-13 (round-up happens in the ENGINE, cost is base
  ₹, no buffer field — the editor writes base cost only).
- `.planning/phases/09-admin-delivery-settings-cod-rules/09-CONTEXT.md` — the
  admin settings-form pattern to mirror (D-02 single sectioned form + one Save),
  and especially **D-11/D-12** (cache purge via the `delivery-estimate`
  `{purge:true}` service-role branch) which this phase reuses verbatim. D-01
  explicitly deferred "sub-tab or sibling" home for the slab editor to this
  phase (resolved as sibling — D-05 above).

### Codebase patterns to clone / integrate
- `supabase/migrations/0016_delivery_rate_slabs.sql` — the table being edited:
  columns, `unique(zone, weight_band)` key, CHECK constraints, public-read +
  `private.is_admin()` admin-write RLS, and the 20-row seed grid. The editor's
  upsert must satisfy these constraints; zones/bands are fixed here.
- `client/src/pages/admin/Delivery.tsx` — the closest UI analog (Phase 9 admin
  settings page): RHF + zodResolver, prefill-from-live via `reset()` in
  `useEffect`, single Save, inline `role="alert"` errors. Clone its structure for
  the matrix page.
- `client/src/pages/admin/SiteContent.tsx` — the original settings-form template
  Delivery.tsx itself cloned; secondary reference.
- `client/src/pages/admin/CategoriesList.tsx` — reference for a
  relational-table admin CRUD (this phase is edit-only, but useful for the
  upsert/query wiring conventions).
- `client/src/pages/admin/AdminLayout.tsx` — `NAV_ITEMS` array; add the
  **Rate Slabs** entry after **Delivery**.
- `client/src/App.tsx` — admin route registration; add the new
  `/admin/rates` (or chosen path) route under the existing `AdminGuard`.
- `client/src/lib/admin.ts` — `useSaveDeliverySettings()` (the purge-branch
  reuse pattern, lines ~825+), `useSaveSiteContent`, and the existing admin
  mutation/query conventions; add the new slab read + bulk-upsert here.
- `supabase/functions/delivery-estimate/index.ts` — verify the existing
  `{ purge: true }` branch clears `delivery_estimate_cache` wholesale (it should
  need no change); the editor invokes it after save. Public path stays untouched.

### Live-ops
- Memory `supabase-live-ops.md` — pushing any migration (none expected — no
  schema change) / verifying against the live Supabase project; deploying is
  not expected unless the purge branch needs a tweak.

[No standalone ADR/SPEC docs exist for this phase — requirements fully captured
in the decisions above + Phase 6 & Phase 9 CONTEXT + migration `0016`.]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Delivery.tsx` / `SiteContent.tsx`** — clone the admin settings-page
  structure (RHF + Zod + prefill + single Save + inline errors) for the matrix
  editor; swap the sectioned fieldsets for the 5×4 grid.
- **`useSaveDeliverySettings()` in `admin.ts`** — its `onSuccess` already does
  query-invalidate + best-effort `delivery-estimate {purge:true}` + success
  toast. The new slab-save mutation follows the identical shape (D-10/D-11).
- **`delivery_rate_slabs` public-read RLS** — the read hook can query the grid
  directly (anon/authenticated read); admin write is gated by
  `private.is_admin()`.
- **`delivery-estimate {purge:true}` branch** — reused as-is for live
  reflection; no new edge-function code expected.

### Established Patterns
- **Admin write via RLS** (catalog / site_content / slabs) — the bulk upsert
  inherits the existing admin-gating; no new server plumbing.
- **Query-invalidate + cache-purge = live-with-no-redeploy** — the exact SC2
  mechanism, already proven in Phase 9.
- **RHF + zodResolver + `role="alert"` inline errors** — the validation UX
  convention every admin form uses (D-07/D-08).

### Integration Points
- New **Rate Slabs** page → `AdminLayout` `NAV_ITEMS` + `App.tsx` admin route
  (behind the unchanged `AdminGuard`).
- Slab save → `delivery_rate_slabs` bulk upsert → `['deliverySlabs']`
  invalidation → `delivery-estimate {purge:true}` → customer estimator
  (Phases 7/8) reflects new rates on next lookup.
- No schema migration expected — the table and RLS already exist (`0016`); this
  phase is UI + a client mutation/query only.

</code_context>

<specifics>
## Specific Ideas

- The editor should read as a **rate card**: zones down the side, weight bands
  across the top, one ETA per zone, one cost per cell — the mental model of a
  courier tariff sheet.
- Costs are the **base ₹** the engine rounds up (Phase 6 D-11/D-13) — the editor
  never applies rounding or a buffer; what the owner types is the raw slab cost.
- SC3 is satisfied structurally (fixed complete grid) rather than by a
  gap-detection UI — there is nothing to "surface" because a cell cannot go
  missing; validation only guards against bad values within cells.

</specifics>

<deferred>
## Deferred Ideas

- **Add/remove zones or weight bands** — out of scope; the 5×4 vocabulary is a
  fixed structural constant (Phase 6 D-01/D-02). Changing it would be a schema +
  engine change, a separate effort.
- **Monotonicity warnings / rate-sanity linting** — considered and declined
  (D-09); could be added later if owners repeatedly enter inconsistent rates.
- **Per-cell ETA** — declined in favor of per-zone ETA (D-06); the schema
  already supports per-cell values if a future need arises.
- **Live courier API (DLVR-F1)** and **per-variant numeric weight (DLVR-F2)** —
  explicitly deferred at the milestone level; the slab table stays the sole rate
  source behind `callCourierAdapter()`.
- **"Reset to seeded defaults" button** — optional nicety, left to Claude's
  discretion, not required by any SC.

None of the above were in scope — discussion stayed within the Phase 10
boundary.

</deferred>

---

*Phase: 10-admin-zone-weight-rate-slab-editor*
*Context gathered: 2026-07-06*
