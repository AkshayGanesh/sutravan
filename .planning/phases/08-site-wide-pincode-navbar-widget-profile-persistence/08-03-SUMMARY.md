---
phase: 08-site-wide-pincode-navbar-widget-profile-persistence
plan: 03
subsystem: verification
tags: [acceptance-gate, human-uat, delivery, pincode, dlvr-09, dlvr-10]

# Dependency graph
requires:
  - phase: 08-01
    provides: "DeliveryPincodePill navbar setter (Popover consumer of useDelivery)"
  - phase: 08-02
    provides: "profile persistence + login-merge in DeliveryProvider (profiles.default_pincode)"
provides:
  - "Human sign-off that Phase 8 SC1-SC4 hold end-to-end on the running app"
affects: [phase-08-verification, milestone-v1.1-delivery-estimator]

# Tech tracking
tech-stack:
  added: []
  patterns: []
---

# Plan 08-03 Summary — Phase 8 End-to-End Acceptance Gate

## Outcome

**APPROVED.** All four Phase 8 success criteria were confirmed live by the user on the
running app (http://localhost:3200). This plan produced no source code — it is the
acceptance gate that closes Phase 8.

## Task 1 — Automated smoke gate

| Command | Result | Notes |
|---------|--------|-------|
| `npm run build` (vite build) | ✓ exit 0 | SPA compiles with the pill mounted; 2722 modules transformed. |
| `npm test` (`vitest run`) | ✓ 106/106 across 14 suites | Includes the new `loginMerge.test.ts` (7/7) and `DeliveryPincodePill.test.ts` (2/2). |
| `npm run check` (tsc) | ⚠ 3 pre-existing errors | All 3 are `TS2802` in `scripts/transform-pincodes.ts` (Phase 6 script, byte-identical to base `1e5c51b`). **Zero** errors originate from Phase 8 files — the pill + provider extension typecheck clean. Documented in `deferred-items.md`; user chose to leave as the out-of-scope item. Not routed back to 08-01/08-02 (they do not own that file). |

**Post-merge integration fix (wave 1):** the post-merge gate caught a cross-plan failure —
Plan 08-02 added a `useAuth()` call inside `DeliveryProvider`, which broke Plan 08-01's
`DeliveryPincodePill.test.ts` (rendered `DeliveryProvider` without an `AuthProvider`
wrapper). Fixed by wrapping the static render in `AuthProvider` to mirror the real app tree
(commit `b4b199e`). Each plan passed in isolation; the failure was only visible after merge.

## Task 2 — Human verification of SC1-SC4 (blocking gate)

User reply: **"approved"** — all four success criteria pass on the running app.

- **SC1 (DLVR-09) — Set from anywhere:** navbar "Deliver to [pincode]" pill sets/changes the
  pincode from any page on desktop + mobile; format-only validation, letters stripped. ✓
- **SC2 — One shared source of truth:** navbar ↔ product-detail estimator stay in sync
  through the single `DeliveryProvider` context (two-way). ✓
- **SC3 — localStorage persistence:** the chosen pincode persists and restores on reload for
  anonymous and logged-in visitors alike. ✓
- **SC4 (DLVR-10) — Profile save + cross-device restore + login-merge:** logged-in pincode
  saves to `profiles.default_pincode` (write-through D-03), restores cross-device
  (profile-wins D-01), an anonymous choice is adopted into an empty profile (D-02), logout
  does not clear the local pincode (D-04), and profile sync is silent (no toast, D-08). ✓
- **T-08-02 (threat model):** changing the pincode updates only `default_pincode`; `role`
  unchanged and no other user's row affected. ✓

## Requirements delivered

- **DLVR-09** — site-wide navbar pincode setter (verified live).
- **DLVR-10** — cross-device profile persistence + login-merge (verified live).

## Deviations

None in this plan. The one pre-existing `npm run check` condition is out of scope (Phase 6
script) and was accepted by the user; the suggested one-line `tsconfig` fix remains logged
in `deferred-items.md` for a future maintenance pass.
