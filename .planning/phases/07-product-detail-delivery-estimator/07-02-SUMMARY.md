---
phase: 07-product-detail-delivery-estimator
plan: 02
subsystem: ui
tags: [delivery, pincode, turnstile, estimate-framing, skeleton, react-query]

# Dependency graph
requires:
  - phase: 07-01
    provides: "DeliveryEstimate block (serviceable happy path), useDeliveryEstimate/EstimateError, DeliveryProvider/useDelivery"
  - phase: 06
    provides: "delivery-estimate Edge Function — { serviceable, cost, etaDays, codAvailable, originConfigured }"
provides:
  - "Complete five-state DeliveryEstimate block: loading skeleton, inline invalid-format, non-serviceable, serviceable result, fetch-failure retry"
  - "Full estimate framing: provisional banner (origin unconfigured), ₹ disclaimer, ETA working-days IST caption, COD line, Phase-9-ready free-ship wiring"
affects: [phase-08-navbar-widget, phase-09-admin-delivery-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EstimateError.code branch mapping: .code === 'retry' → retriable fetch-failure with Turnstile reset; .code === 'invalid-format' → inline invalid (no retry framing, D-13)"
    - "Skeleton rows mirror final result layout (cost + ETA + COD) so no layout shift during loading"
    - "Phase-9-ready display path: free-ship line reads delivery_free_ship_threshold and renders only when set (null today → renders nothing, no future rework)"

key-files:
  created: []
  modified:
    - client/src/components/delivery/DeliveryEstimate.tsx

key-decisions:
  - "Button weight raised font-medium(500) → font-semibold(600) to honor the UI-SPEC two-weights rule (400/600) — human-approved deviation"
  - "Provisional banner NEVER hides the numbers — soft AlertCircle banner sits above the still-visible cost/ETA/COD when originConfigured === false (D-07)"
  - "Try-again resets Turnstile before re-invoking so a fresh single-use token issues per attempt (T-07-06)"

patterns-established:
  - "Boundary-mapped generic error copy only (T-07-05): never renders raw function/Postgres error"
  - "Free-ship display wired now, value set later — Phase 9 sets delivery_free_ship_threshold with zero Phase 7 rework (D-12)"

requirements-completed: [DLVR-06, DLVR-07]

# Metrics
duration: ~10min
completed: 2026-07-04
---

# Phase 07 Plan 02: Delivery Estimator Every-State + Estimate Framing Summary

**The DeliveryEstimate block completed to all five distinct states (loading skeleton, inline invalid-format, non-serviceable, serviceable, fetch-failure retry) with full "honest estimate" framing — provisional banner, ₹ disclaimer, ETA working-days IST caption, and Phase-9-ready free-ship wiring — verified live by the owner across every state.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-04
- **Tasks:** 3 (2 auto + 1 blocking human-verify)
- **Files modified:** 1

## Accomplishments

- **DLVR-06 — every state handled distinctly.** Loading now renders `Skeleton` rows mirroring the final result layout (cost + ETA + COD lines) so there is no layout shift; a server `bad_request` (`EstimateError.code === "invalid-format"`) routes to the same inline `text-destructive` "Enter a valid 6-digit pincode." message (no retry framing, D-13); `data.serviceable === false` renders the clean single line "Sorry, we don't deliver to this pincode yet." with the input still editable; and a retriable failure (`.code === "retry"` — captcha/network/timeout/5xx) renders "Couldn't get an estimate right now. Please try again." with the CTA relabeled "Try again", which resets Turnstile (single-use token consumed) before re-invoking.
- **DLVR-07 — prominently framed as an estimate.** Provisional banner ("Delivery estimates are provisional and will be finalized shortly." with the lucide `AlertCircle` icon) shows when `originConfigured === false` (the 000000 placeholder until Phase 9) while NEVER hiding the numbers; "Estimated — final delivery charge may vary." sits adjacent to every ₹ figure; the ETA sub-caption "Working days, excluding weekends & holidays (IST)." (`text-xs text-foreground/50`) sits under the working-days range; the free-ship line reads `useSiteContent().data?.delivery_free_ship_threshold` and renders "Free delivery on orders over ₹{X}." only when the value is set (null today → nothing), in the gold `--secondary` accent (not a button fill, no cart progress bar).
- **Live verification passed (blocking checkpoint).** Owner ran the estimate block live and confirmed all five states plus the fetch-failure Try-again re-solve, the provisional banner, the disclaimer, the ETA caption, and the prefill-without-auto-fire-on-open behavior — user response: "approved".

## Task Commits

1. **Task 1: Complete every-state handling (DLVR-06)** — `23faa9b` (feat)
2. **Task 2: Estimate framing — provisional banner, ETA caption, COD, free-ship wiring (DLVR-07)** — `e4c69b8` (feat)
3. **Task 3: Human verification across all states** — verified live via owner approval (no code commit; position recorded in `2f9d127`)

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs: complete plan)

## Files Created/Modified

- `client/src/components/delivery/DeliveryEstimate.tsx` — completed the four remaining states plus the full estimate-framing copy; no new exported symbols (reads existing `useSiteContent`/`EstimateError.code`).

## Decisions Made

- **Button weight font-medium(500) → font-semibold(600).** The UI-SPEC mandates exactly two font weights (400 / 600) with sharp edges. The Plan-01 CTA carried `font-medium` (500), a third weight. It was raised to `font-semibold` (600) to bring the block into two-weight compliance. Human-approved during the live checkpoint.
- **Provisional banner never hides the estimate** — always shows the computed cost/ETA/COD with a soft banner above (D-07), so the customer always sees numbers.
- **Try-again resets Turnstile before re-invoke** — a fresh single-use token per attempt; no token replay, no unbounded no-captcha retries (T-07-06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Button font weight normalized to honor the two-weights UI contract**
- **Found during:** Task 2 (estimate framing)
- **Issue:** The Plan-01 CTA used `font-medium` (500), a third weight beyond the UI-SPEC's locked two weights (400/600).
- **Fix:** Raised the button to `font-semibold` (600).
- **Files modified:** `client/src/components/delivery/DeliveryEstimate.tsx`
- **Verification:** `grep` confirms only `font-semibold` weight classes remain; human-approved live during the blocking checkpoint.
- **Committed in:** `e4c69b8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / design-contract compliance)
**Impact on plan:** The single deviation aligns the block with the locked UI contract. No scope creep. Human-approved.

## Issues Encountered

None — Tasks 1-2 executed as written; Task 3 (blocking human-verify) passed on first live walk.

## Threat Surface

No new surface beyond the plan's `<threat_model>`. Error rendering shows only mapped generic copy (T-07-05); Try-again resets Turnstile per attempt (T-07-06); the free-ship threshold is public `site_content` read rendered as a numeric string only (T-07-07); no npm installs (T-07-SC).

## User Setup Required

None — no external service configuration introduced. (Live verification reused the existing `VITE_TURNSTILE_SITE_KEY` + localhost-allow-listed Cloudflare widget from the Phase 5 questionnaire walk.)

## Next Phase Readiness

- The per-product estimate block is production-complete and live-verified. Phase 7 requirements DLVR-06 and DLVR-07 delivered (DLVR-08 delivered in Plan 01).
- The `DeliveryProvider` / `useDelivery` layer is ready for Phase 8 to plug the navbar "Deliver to [pincode]" widget into with no refactor.
- The free-ship display path is wired to `delivery_free_ship_threshold`; Phase 9 sets the value with zero Phase 7 rework.

## Deferred Issues

- **Pre-existing `npm run check` errors in `scripts/transform-pincodes.ts`** (3× TS2802 Set/Map iteration needing `--downlevelIteration`) — unrelated to the delivery estimator, carried from Plan 01, logged in `deferred-items.md`. All Phase-7 files typecheck clean.

## Verification

- `npm run check` — only the 3 pre-existing out-of-scope `scripts/transform-pincodes.ts` TS2802 errors; all Phase-7 files clean.
- `npm test` — 12 files / 97 tests GREEN.
- Locked copy present (grep): "Sorry, we don't deliver to this pincode yet.", "Couldn't get an estimate right now. Please try again.", "Try again", "Enter a valid 6-digit pincode.", "Delivery estimates are provisional and will be finalized shortly.", "Working days, excluding weekends & holidays (IST).", "Estimated — final delivery charge may vary.", `delivery_free_ship_threshold`.
- **Human live verification (blocking checkpoint) — PASSED.** Owner confirmed all five states + fetch-failure Try-again re-solve + provisional banner + prefill-no-auto-fire — response "approved".

## Self-Check: PASSED

- `client/src/components/delivery/DeliveryEstimate.tsx` present on disk with all locked copy.
- Commits `23faa9b` (Task 1) and `e4c69b8` (Task 2) present in git history.

---
*Phase: 07-product-detail-delivery-estimator*
*Completed: 2026-07-04*
