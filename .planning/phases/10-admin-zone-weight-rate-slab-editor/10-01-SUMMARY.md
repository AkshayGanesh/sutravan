---
phase: 10-admin-zone-weight-rate-slab-editor
plan: 01
subsystem: database
tags: [zod, validation, delivery, rate-slabs, react-hook-form, vitest]

# Dependency graph
requires:
  - phase: 06-estimate-engine-delivery-schema-settings-edge-function
    provides: delivery_rate_slabs table (5×4 grid, unique(zone,weight_band), seed rows) — migration 0016
  - phase: 09-admin-delivery-settings-cod-rules
    provides: deliverySchema.ts pure-validation pattern (z.coerce.number().int + superRefine cross-field)
provides:
  - "rateSlabsSchema — Zod contract enforcing cost int ≥ ₹1, ETA int 1..30, cross-field min ≤ max, no monotonicity"
  - "RateSlabsFormValues — form value type (typeof rateSlabsSchema._input)"
  - "RateSlabUpsertRow — the 7-column upsert-row shape 10-02's mutation sends"
  - "mapSlabsToForm(rows) — 20 slab rows → { costs, etas } grid form shape"
  - "expandFormToRows(values) — grid form → 20 upsert rows (per-zone ETA fanned to 4 bands, D-06)"
  - "ZONE_ORDER, WEIGHT_BAND_LABELS, WEIGHT_BAND_BOUNDS — grid constants"
affects: [10-02-rate-slabs-editor-ui, delivery-estimate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first pure module unit-tested in node env (no supabase/React import), mirroring deliverySchema.ts"
    - "z.record keyed grids: costs Record<`${zone}_${band}`,int>, etas Record<zone,{min,max}>"
    - "superRefine cross-field validation flagged on a nested path (etas.<zone>.max)"

key-files:
  created:
    - client/src/pages/admin/rateSlabsSchema.ts
    - client/src/pages/admin/rateSlabsSchema.test.ts
  modified: []

key-decisions:
  - "Cost floor is min(1) (strictly positive) so a ₹0 slab is impossible by construction — SC3 'no silent ₹0' (D-08)"
  - "No monotonicity check/warning across zones or bands — explicitly declined (D-09)"
  - "Per-zone ETA fanned to all 4 bands on expand; first row per zone sets the pair on collapse (D-06)"
  - "ETA upper bound set at 30 working days (D-08 discretion)"

patterns-established:
  - "Pure validation + data-shaping module proven test-first before any React/supabase consumer exists (10-02 imports tested logic)"
  - "TDD RED→GREEN per task with atomic test()/feat() commits"

requirements-completed: [DLVR-03]

# Metrics
duration: 5min
completed: 2026-07-06
---

# Phase 10 Plan 01: Rate Slabs Validation Contract + Grid⇄Rows Mapping Summary

**Pure, test-first Zod contract (`rateSlabsSchema`) enforcing cost ≥ ₹1, ETA 1..30 with cross-field min ≤ max and no monotonicity, plus `mapSlabsToForm`/`expandFormToRows` that round-trip the 20-row `delivery_rate_slabs` grid to 20 costs + 5 per-zone ETA pairs.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-06T04:44:10Z
- **Completed:** 2026-07-06T04:48:55Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `rateSlabsSchema` encodes SC3 (`cost ≥ ₹1` — a ₹0 slab cannot be saved) and the D-08 ETA bounds (int 1..30, `min ≤ max` cross-field flagged on `etas.<zone>.max`).
- Deliberately imposes **no** monotonicity rule (D-09) — a heavier band or farther zone may be cheaper without error.
- `mapSlabsToForm` collapses the 20 fetched rows into 20 per-cell costs + 5 per-zone ETA pairs; `expandFormToRows` fans each zone's single ETA pair across all 4 bands and always emits the fixed `weight_min_g/weight_max_g`, producing exactly 20 numeric upsert rows.
- Seed round-trip test proves `expandFormToRows(mapSlabsToForm(seedRows))` reproduces migration 0016's 20 cost + ETA values.
- Module is pure (no supabase/React import) so the 20-case Vitest suite runs in the plain node env.

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1: rateSlabsSchema validation contract + grid constants**
   - RED: `80e9459` (test)
   - GREEN: `8f2c3fe` (feat)
2. **Task 2: mapSlabsToForm + expandFormToRows grid⇄rows mapping**
   - RED: `40040ec` (test)
   - GREEN: `63be247` (feat)

_No REFACTOR commits — the GREEN implementations were already clean._

## Files Created/Modified
- `client/src/pages/admin/rateSlabsSchema.ts` - Zod validation contract + grid constants + `mapSlabsToForm`/`expandFormToRows` pure mapping (exports the full symbol set consumed by 10-02).
- `client/src/pages/admin/rateSlabsSchema.test.ts` - 20-case Vitest suite pinning bounds (D-08), no-monotonicity (D-09), and the ETA-fan / seed round-trip (D-06).

## Decisions Made
None beyond the plan — followed D-06/D-08/D-09 as specified. ETA upper bound chosen at 30 working days (explicit plan discretion).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run check` (tsc) reports 3 pre-existing TS2802 errors in `scripts/transform-pincodes.ts` (from Phase 6 commit `d3676ea`), unrelated to this plan. My two files are TypeScript-clean (`grep -i rateSlabs` on tsc output → none). Logged to `deferred-items.md`; not fixed (out of scope).

## TDD Gate Compliance
- Plan `type: tdd`. Gate sequence satisfied for both tasks: a `test(...)` (RED) commit precedes each `feat(...)` (GREEN) commit. RED runs confirmed genuine failures before implementation (Task 1: module-not-found; Task 2: 6 new tests failing, 14 prior passing).

## Known Stubs
None — this is a complete pure module with a full test suite; no placeholder data or unwired consumers.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 10-02 (Rate Slabs editor UI) can import the proven contract: `rateSlabsSchema` for the zodResolver, `mapSlabsToForm` to prefill the RHF grid from the fetched rows, and `expandFormToRows` to build the 20-row bulk upsert payload.
- No blockers.

## Self-Check: PASSED
- All created files exist on disk (schema, test, summary).
- All 4 task commits present in git history (80e9459, 8f2c3fe, 40040ec, 63be247).

---
*Phase: 10-admin-zone-weight-rate-slab-editor*
*Completed: 2026-07-06*
