---
phase: 08-site-wide-pincode-navbar-widget-profile-persistence
plan: 01
subsystem: ui
tags: [react, radix-popover, delivery, pincode, navbar, vitest, tdd]

# Dependency graph
requires:
  - phase: 07 (delivery estimate)
    provides: "DeliveryProvider context ({ pincode, setPincode }), useDelivery() hook, DeliveryEstimate analog, /^\\d{6}$/ format contract"
provides:
  - "DeliveryPincodePill — site-wide navbar pincode setter (Popover consumer of useDelivery)"
  - "Navbar mounts the pill as the first right-cluster item on every route + breakpoint"
  - "SC2 wiring: navbar-set pincode is visible to the Phase 7 product-detail estimator via the shared context (zero provider changes)"
affects: [08-02 profile-persistence, 08-03 wave-2-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Popover setter consuming an existing context (no new store/cache/localStorage key)"
    - "Component TDD via react-dom/server renderToStaticMarkup in the node-env vitest suite (no testing-library, no new dependency)"

key-files:
  created:
    - client/src/components/delivery/DeliveryPincodePill.tsx
    - client/src/components/delivery/DeliveryPincodePill.test.ts
  modified:
    - client/src/components/Navbar.tsx
    - vitest.config.ts

key-decisions:
  - "Used a raw <button type=submit> (matching the DeliveryEstimate analog) rather than the shadcn Button — full custom class string, matches the plan import list"
  - "Component-behavior TDD via renderToStaticMarkup (server render) — the only rendering path available without adding @testing-library/react (a forbidden auto-install)"
  - "Set vitest esbuild jsx=automatic so component suites transform with the app's automatic JSX runtime"

patterns-established:
  - "Navbar pill setter: MapPin trigger + Popover form, format-only guard, no network (D-05)"
  - "renderToStaticMarkup-based component assertion pattern for node-env vitest"

requirements-completed: [DLVR-09]

# Metrics
duration: ~14min
completed: 2026-07-05
---

# Phase 8 Plan 01: Site-Wide Pincode Navbar Widget Summary

**A "Deliver to [pincode]" navbar pill + popover that format-validates `/^\d{6}$/` inline and writes the shared Phase 7 `DeliveryProvider` context — no network, no Turnstile, no estimate call — so a pincode set from anywhere immediately drives the product-detail estimator.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-05
- **Completed:** 2026-07-05
- **Tasks:** 2 (Task 1 via TDD RED→GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `DeliveryPincodePill` component: MapPin pill trigger with D-06 empty/set label swap (desktop `hidden md:inline` / mobile `md:hidden`), a Popover form with a sanitized numeric `Input`, a "Save pincode" submit button, and an inline format error — pure location setter (D-05: no network/Turnstile/estimate).
- Mounted the pill as the FIRST item in the Navbar right-cluster (before the Instagram link), single mount point for all breakpoints; the mobile Sheet is intentionally untouched.
- SC2 sync wiring: the pill consumes the same `useDelivery()` context as the Phase 7 `DeliveryEstimate`, so a navbar-set value reaches the estimator with zero provider changes.
- Full verification green: 46/46 vitest tests pass, `npm run build` compiles the SPA with the pill mounted, and all plan grep gates (copy contract, no-network-imports, single mount, Sheet untouched) pass.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing test for DeliveryPincodePill** - `0b3e1a5` (test)
2. **Task 1 (GREEN): implement DeliveryPincodePill + vitest jsx config** - `0cbec81` (feat)
3. **Task 2: mount DeliveryPincodePill in Navbar right-cluster** - `d923d2f` (feat)
4. **Out-of-scope log: pre-existing scripts/ tsc failures** - `91b8732` (docs)

## Files Created/Modified
- `client/src/components/delivery/DeliveryPincodePill.tsx` - NEW. Default-export Popover setter consuming `useDelivery()`; inline `PINCODE_RE = /^\d{6}$/`, format-only guard, no network.
- `client/src/components/delivery/DeliveryPincodePill.test.ts` - NEW. TDD suite: `renderToStaticMarkup` asserts the D-06 empty vs set trigger label.
- `client/src/components/Navbar.tsx` - MODIFIED. One import + `<DeliveryPincodePill />` as the first right-cluster child.
- `vitest.config.ts` - MODIFIED. `esbuild.jsx = "automatic"` to unblock component-render suites.

## Decisions Made
- Raw `<button type="submit">` for the Save action (matches the `DeliveryEstimate` analog and the plan's import list, which omits shadcn `Button`).
- TDD for the component was done via `react-dom/server` `renderToStaticMarkup` (node-env compatible, no new dependency) because `@testing-library/react` is not installed and installing it is a forbidden auto-fix. The static render exercises the D-06 label-derivation behavior (the trigger state observable without user events); interaction paths (submit/sanitize) are covered by the plan's grep/source-readable gates and the Plan 03 human checkpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled the automatic JSX runtime in vitest**
- **Found during:** Task 1 (TDD GREEN — running the component test)
- **Issue:** The component test failed with `ReferenceError: React is not defined`. The app builds with the automatic JSX runtime (`tsconfig jsx: react-jsx`) and components import named hooks only (no default `React`), but `vitest.config.ts` had no JSX-runtime configuration, so esbuild fell back to the classic runtime and required a `React` global. No component test existed before this plan, so the gap was latent.
- **Fix:** Added `esbuild: { jsx: "automatic" }` to `vitest.config.ts`, mirroring the app build's runtime.
- **Files modified:** `vitest.config.ts`
- **Verification:** Target test passes; full suite regression-checked at 46/46 pass.
- **Committed in:** `0cbec81` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix is test-infra enablement required to run any component suite; it mirrors the existing app build config and caused no regression. No scope creep to the shipped component (which matches the UI-SPEC/PATTERNS contract exactly).

## Issues Encountered
- **Pre-existing `npm run check` (tsc) failure — OUT OF SCOPE.** `scripts/transform-pincodes.ts` (a Phase 6 script, byte-identical to base) emits three TS2802 `--downlevelIteration` errors. Unrelated to this plan's files (which add zero tsc errors); the SPA `npm run build` passes regardless. Logged in `deferred-items.md` with a suggested `tsconfig` fix; NOT fixed here per the executor scope boundary.

## Threat Flags
None — the pill performs no network write and no estimate call (D-05); the client `/^\d{6}$/` guard is UX-only, and the Phase 7 estimator/Edge Function re-validate server-side. No new trust-boundary surface (matches the plan's threat register, both threats dispositioned `accept`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DLVR-09 navbar half shipped and wired to the shared context. Ready for Plan 08-02 (profile persistence: login-merge read + best-effort profile write-through in `DeliveryProvider`) and the Plan 08-03 Wave 2 end-to-end human checkpoint.
- No blockers introduced. Pre-existing `scripts/` tsc issue tracked in `deferred-items.md`.

## Self-Check: PASSED

---
*Phase: 08-site-wide-pincode-navbar-widget-profile-persistence*
*Completed: 2026-07-05*
