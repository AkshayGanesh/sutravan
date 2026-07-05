---
phase: 09-admin-delivery-settings-cod-rules
plan: 01
subsystem: testing
tags: [zod, vitest, tdd, supabase, delivery, cod, pincodes, site_content]

# Dependency graph
requires:
  - phase: 06-delivery-schema-settings-edge-function
    provides: "delivery-estimate Edge Function (canonical {enabled,fee,valueCap} CodRules parse + {serviceable,cost,etaDays,codAvailable} contract), public.pincodes table, 0014 delivery site_content seed"
  - phase: 07-delivery-estimator-client-hook-product-ui
    provides: "delivery.ts estimateDelivery/EstimateError/mapEstimateError, DeliveryEstimateResult contract, useDeliveryEstimate hook"
provides:
  - "deliverySchema (Zod D-15 bounds) + formatPreviewLine (SC1/D-06 preview string)"
  - "parseCodRules / serializeCodRules — canonical COD JSON-in-text codec (D-09/D-14)"
  - "checkServiceable — pincode serviceability lookup mapping to {known,serviceable,label} (D-09)"
  - "previewDelivery — admin preview invoke wrapper ({originPincode,destPincode}, no token) (D-06/D-08)"
  - "5 delivery keys appended to SITE_CONTENT_DEFAULTS (D-03)"
affects: [09-02, 09-03, admin-delivery-page, admin-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-first pure-logic modules unit-tested by vitest with vi.mock('@/lib/supabase') for supabase-touching modules (mirrors Phase 04 admin write-layer + delivery.test.ts precedent)"
    - "z.preprocess(emptyToNull, ...nullable()) so blank text inputs map to null before coercion (Number('')===0 guard) — D-14 blank→null"
    - "import type for the estimate result shape keeps the supabase client out of the deliverySchema runtime so its tests need no env/mock"

key-files:
  created:
    - client/src/pages/admin/deliverySchema.ts
    - client/src/pages/admin/deliverySchema.test.ts
    - client/src/lib/codRules.ts
    - client/src/lib/codRules.test.ts
    - client/src/lib/pincodes.ts
    - client/src/lib/pincodes.test.ts
  modified:
    - client/src/lib/delivery.ts
    - client/src/lib/delivery.test.ts
    - client/src/lib/siteContent.ts

key-decisions:
  - "codFee uses z.preprocess(emptyToNull, ...nullable()) so a blank fee stays null and the required-when-enabled superRefine can fire — a plain z.coerce.number() would silently coerce '' to 0 and never flag a blank fee (D-15 intent)"
  - "previewDelivery duplicates estimateDelivery's error-mapping block verbatim (rather than extracting a shared helper) to leave the public estimator path byte-for-byte unchanged"

patterns-established:
  - "Pattern: pure validation/serialization contracts ship test-first before any UI consumes them, so plan 09-03 builds on proven Zod/codec behavior"
  - "Pattern: admin invoke wrapper is a sibling of the public wrapper sharing only the error mapper, keeping the token-bearing public path isolated"

requirements-completed: [DLVR-01, DLVR-02, DLVR-04]

# Metrics
duration: 6min
completed: 2026-07-05
---

# Phase 9 Plan 01: Delivery Settings Pure-Logic Foundation Summary

**Test-first Zod delivery schema (D-15 bounds), COD JSON-in-text codec, pincode serviceability lookup, admin previewDelivery invoke wrapper, and the five SITE_CONTENT_DEFAULTS delivery keys — 41 new vitest cases, all green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-05T12:16:45+05:30 (first commit)
- **Completed:** 2026-07-05T12:21:57+05:30 (last commit)
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- `deliverySchema` enforces every D-15 bound: origin 6-digit + `000000` reject (D-10), weight 1–2000 int, lead 0–14 int, COD fee ≥0 required-when-enabled, cap/threshold blank→null / >0 — plus `formatPreviewLine` rendering the exact SC1/D-06 string via `formatPrice` (no re-round).
- `parseCodRules`/`serializeCodRules` round-trip the canonical `{enabled,fee,valueCap}` contract; malformed/falsy → COD off (identical tolerance to the deployed edge function L215-224); blank cap → null (D-14); fee/cap retained when toggled off (D-13).
- `checkServiceable` maps a single `pincodes` `maybeSingle()` lookup to `{known,serviceable,label}`; absence = not serviceable, never throws (D-09).
- `previewDelivery` invokes `delivery-estimate` with `{originPincode,destPincode}` and NO `token` (admin skips Turnstile, D-07), reusing the estimate error mapping; the public `estimateDelivery`/`useDeliveryEstimate` path is untouched.
- Five delivery keys appended to `SITE_CONTENT_DEFAULTS` mirroring the 0014 seed (D-03).

## Task Commits

Each task committed atomically (TDD RED → GREEN):

1. **Task 1: Zod delivery schema + preview formatter** - `02e4313` (test) → `7bf5e20` (feat)
2. **Task 2: COD codec + pincode serviceability lookup** - `2800730` (test) → `c57872e` (feat)
3. **Task 3: previewDelivery wrapper + SITE_CONTENT_DEFAULTS delivery keys** - `4022321` (test) → `5af8db0` (feat)

## Files Created/Modified
- `client/src/pages/admin/deliverySchema.ts` - `deliverySchema` (Zod D-15) + `formatPreviewLine` (SC1/D-06)
- `client/src/pages/admin/deliverySchema.test.ts` - 20 cases pinning every bound + preview string
- `client/src/lib/codRules.ts` - `parseCodRules`/`serializeCodRules` canonical COD codec
- `client/src/lib/codRules.test.ts` - 8 cases (round-trip, malformed→off, blank cap→null, retain-when-off)
- `client/src/lib/pincodes.ts` - `checkServiceable` serviceability lookup
- `client/src/lib/pincodes.test.ts` - 4 cases via mocked `from().select().eq().maybeSingle()` chain
- `client/src/lib/delivery.ts` - added `previewDelivery` (public estimator path unchanged)
- `client/src/lib/delivery.test.ts` - upgraded supabase mock to a controllable `functions.invoke` spy; +5 cases (no-token body, success passthrough, bad_request→invalid-format, unreadable→retry, 5 defaults)
- `client/src/lib/siteContent.ts` - 5 delivery keys in `SITE_CONTENT_DEFAULTS`

## Decisions Made
- **codFee blank-detection via preprocess:** the plan wrote `codFee: z.coerce.number().int().min(0)`, but `Number("") === 0` means a blank fee would silently pass as 0 and never trigger the "required when COD enabled" rule. Implemented codFee as `z.preprocess(emptyToNull, z.coerce.number().int().min(0).nullable())` so a blank stays `null` and the `superRefine` on `["codFee"]` fires correctly. This realizes the stated D-15 behavior, not a departure from intent.
- **previewDelivery duplicates the error block:** left `estimateDelivery` byte-for-byte unchanged (public path, D-11) rather than extracting a shared mapper, so no regression risk to the shipped estimator.

## Deviations from Plan

None affecting scope — plan executed as written. One implementation refinement (codFee preprocess, above) was required to make the plan's own D-15 "COD fee required when enabled" behavior observable; it is covered by a passing test and is faithful to the plan's stated behavior.

## Issues Encountered

Two pre-existing, out-of-scope conditions surfaced during verification (logged to `09-admin-delivery-settings-cod-rules/deferred-items.md`), neither caused by this plan:

1. **`npm run check` (tsc):** 3 `TS2802` iteration errors in `scripts/transform-pincodes.ts` — a Phase-06 seed script, identical to base `2a5bff2`, off the runtime/build path. All 9 Plan 09-01 source/test files compile cleanly (verified by filtering tsc output).
2. **`npm test` full suite:** 5 test files (`admin`, `questionnaire`, `submissions`, `wishlist`, `DeliveryPincodePill`) fail to import with `Missing VITE_SUPABASE_URL...` because they don't mock supabase and the worktree has no `.env.local`. All are unmodified by this plan; they pass in a dev/CI env with the VITE_ vars set. Every runnable test (88, incl. all 41 new) passes.

## Known Stubs

None — all five modules are fully wired to their contracts (edge function, `pincodes` table, `site_content`). No placeholder/empty-value stubs introduced.

## User Setup Required

None - no external service configuration required by this plan.

## Next Phase Readiness
- Plan 09-03 (admin Delivery page/UI) can consume `deliverySchema`, `formatPreviewLine`, `parseCodRules`/`serializeCodRules`, `checkServiceable`, and `previewDelivery` as proven contracts.
- Plan 09-02 (edge-function admin branch) is unblocked — `previewDelivery` already sends the token-free `{originPincode,destPincode}` body the admin branch expects.

---
*Phase: 09-admin-delivery-settings-cod-rules*
*Completed: 2026-07-05*
