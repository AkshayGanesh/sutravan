---
phase: 10-admin-zone-weight-rate-slab-editor
plan: 02
subsystem: admin
tags: [delivery, rate-slabs, react-hook-form, zod, tanstack-query, supabase, admin-ui]

# Dependency graph
requires:
  - phase: 10-admin-zone-weight-rate-slab-editor
    provides: rateSlabsSchema, RateSlabsFormValues, RateSlabUpsertRow, mapSlabsToForm, expandFormToRows, ZONE_ORDER, WEIGHT_BAND_LABELS (10-01)
  - phase: 06-estimate-engine-delivery-schema-settings-edge-function
    provides: delivery_rate_slabs table (unique(zone,weight_band)) + delivery-estimate {purge:true} branch — migration 0016
  - phase: 09-admin-delivery-settings-cod-rules
    provides: useSaveDeliverySettings invalidate+purge+toast pattern; AdminLayout NAV_ITEMS; AdminRoute guard
provides:
  - "useDeliveryRateSlabs() — read hook for the 5×4 grid, query key ['deliverySlabs']"
  - "useSaveRateSlabs() — 20-row bulk upsert (onConflict zone,weight_band) + ['deliverySlabs'] invalidate + best-effort delivery-estimate purge + toast"
  - "RateSlabs page (/admin/rates) — spreadsheet rate-card editor behind AdminGuard"
  - "Rate Slabs NAV_ITEMS entry (after Delivery); /admin/rates route"
affects: [delivery-estimate, admin-portal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk full-table upsert (no dirty-row tracking) for a tiny fixed grid, onConflict composite key"
    - "RHF spreadsheet grid via z.record-keyed register paths (costs.${zone}_${band}, etas.${zone}.min/max)"
    - "mode: onChange so formState.isValid drives a block-save gate (D-07)"

key-files:
  created:
    - client/src/pages/admin/RateSlabs.tsx
  modified:
    - client/src/lib/admin.ts
    - client/src/pages/admin/AdminLayout.tsx
    - client/src/App.tsx

key-decisions:
  - "Query key ['deliverySlabs'] (D-10); onConflict 'zone,weight_band' (composite unique key from 0016, not id) so 20 rows UPDATE in place"
  - "Best-effort purge — tolerate any failure; 24h TTL is the fallback (D-11)"
  - "Lucide IndianRupee icon for the Rate Slabs nav item (chosen over Table to avoid a component-name collision)"
  - "Grid rendered as an HTML table (zones down, weight bands across, one ETA pair per zone), horizontally scrollable"

requirements-completed: [DLVR-03]

# Metrics
duration: 3min
completed: 2026-07-06
---

# Phase 10 Plan 02: Rate Slabs Editor UI + Save/Purge Wiring Summary

**The end-to-end Rate Slabs vertical slice: a new `/admin/rates` spreadsheet editor (5 zones × 4 weight-band cost cells + one ETA pair per zone) that prefills from the live `delivery_rate_slabs` table and, on a single Save, bulk-upserts all 20 rows (onConflict `zone,weight_band`), invalidates `['deliverySlabs']`, and best-effort purges the estimate cache so customer estimates recompute live with no redeploy (DLVR-03, SC1–SC4).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-06T04:51:51Z
- **Completed:** 2026-07-06T04:54:57Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `useDeliveryRateSlabs()` reads the fixed 5×4 grid under `['deliverySlabs']` via the table's public-read RLS; `useSaveRateSlabs()` clones `useSaveDeliverySettings` verbatim, swapping the target to a 20-row `delivery_rate_slabs` upsert on the composite `zone,weight_band` key (rows UPDATE in place, no duplication) and the invalidation key to `['deliverySlabs']`, keeping the same best-effort `delivery-estimate {purge:true}` + `toast.success` + `mapWriteError` shape.
- `RateSlabs.tsx` renders a courier-tariff-style rate card: zones down the side (read-only row headers), the 4 gram-range weight bands across the top (read-only `WEIGHT_BAND_LABELS` column headers), 20 `₹`-prefixed cost inputs, and one ETA min/max pair per zone (D-06). No insert/remove-row affordance — the cartesian grid is always complete (D-01), so SC3's "no missing slab" holds structurally.
- Block-save gate: `mode: "onChange"` + `disabled={save.isPending || !isValid}` (D-07); `onSubmit` re-parses through `rateSlabsSchema` then `expandFormToRows` fans each zone's ETA pair across its 4 bands into exactly 20 upsert rows.
- Wired reachable: `IndianRupee` "Rate Slabs" nav item sits between Delivery and Submissions (D-05); `/admin/rates` route renders under the unchanged `AdminRoute` (AdminGuard + AdminLayout). Contract untouched — no edit to `delivery-estimate/index.ts` or the `{ serviceable, cost, etaDays, codAvailable }` shape (SC4).

## Task Commits

Each task was committed atomically:

1. **Task 1: useDeliveryRateSlabs + useSaveRateSlabs hooks** — `cd79cfb` (feat)
2. **Task 2: RateSlabs.tsx 5×4 grid editor** — `ce3b29e` (feat)
3. **Task 3: NAV_ITEMS entry + /admin/rates route** — `af9a59f` (feat)

## Files Created/Modified
- `client/src/pages/admin/RateSlabs.tsx` (created) — the spreadsheet grid editor page (RHF + zodResolver + single Save).
- `client/src/lib/admin.ts` (modified) — added `RATE_SLAB_COLUMNS`, `fetchRateSlabs`, `useDeliveryRateSlabs`, `useSaveRateSlabs`, and the `RateSlabUpsertRow` import.
- `client/src/pages/admin/AdminLayout.tsx` (modified) — `IndianRupee` import + "Rate Slabs" NAV_ITEMS entry after Delivery.
- `client/src/App.tsx` (modified) — `RateSlabs` import + `/admin/rates` route under `AdminRoute`.

## Decisions Made
- Followed all plan decisions (D-01..D-11). Discretion exercised: `IndianRupee` icon (avoids the shadcn `Table` name collision the patterns file flagged); grid rendered as a horizontally-scrollable HTML `<table>` with `aria-label`ed inputs for the 20 cost cells and 10 ETA inputs.

## Deviations from Plan

**1. [Rule 3 - Blocking] Reworded a source comment to satisfy the literal grep gate**
- **Found during:** Task 2
- **Issue:** The acceptance grep `add.?row|delete.?row|removeRow|appendRow` must return nothing, but a code comment described the deliberate *absence* of the affordance ("no add-row / delete-row affordance"), matching the pattern.
- **Fix:** Reworded the comment to "no affordance to insert or remove rows" — no behavior change; the page genuinely has no such control.
- **Files modified:** client/src/pages/admin/RateSlabs.tsx
- **Commit:** ce3b29e

## Issues Encountered
- `npm run check` reports the same 3 pre-existing TS2802 errors in `scripts/transform-pincodes.ts` (Phase 6, `d3676ea`), unrelated to this plan and already logged in 10-01's `deferred-items.md`. All four files in this plan are TypeScript-clean (0 tsc errors mentioning them).

## Known Stubs
None — the page reads live data via `useDeliveryRateSlabs` and writes live via `useSaveRateSlabs`; no placeholder/mock data or unwired inputs.

## User Setup Required
None — no new dependencies, no schema migration, no edge-function change. The `delivery_rate_slabs` table, its RLS, and the purge branch already exist (migration 0016 / Phase 9).

## Next Phase Readiness
- 10-03 (verification) can now: open `/admin/rates` behind AdminGuard, edit a cost/ETA, Save, and confirm the upsert + `['deliverySlabs']` invalidation + estimate-cache purge; and verify T-10-02 (a non-admin `delivery_rate_slabs` upsert is rejected by RLS).
- No blockers.

## Self-Check: PASSED
- All created/modified files exist on disk (RateSlabs.tsx, admin.ts, AdminLayout.tsx, App.tsx).
- All 3 task commits present in git history (cd79cfb, ce3b29e, af9a59f).

---
*Phase: 10-admin-zone-weight-rate-slab-editor*
*Completed: 2026-07-06*
