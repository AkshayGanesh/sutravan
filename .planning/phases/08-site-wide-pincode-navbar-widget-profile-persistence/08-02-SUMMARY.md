---
phase: 08-site-wide-pincode-navbar-widget-profile-persistence
plan: 02
subsystem: ui
tags: [react, supabase, delivery, pincode, context, rls, vitest, tdd]

# Dependency graph
requires:
  - phase: 06-delivery-schema-settings-edge-function
    provides: "profiles.default_pincode column + enforce_profile_role_lock trigger (migration 0004)"
  - phase: 07-product-detail-delivery-estimator
    provides: "DeliveryProvider { pincode, setPincode } context + DELIVERY_PINCODE_KEY localStorage"
  - phase: 03-authentication-roles
    provides: "useAuth() { user, loading } + AuthProvider role-read effect pattern"
provides:
  - "Cross-device pincode persistence (DLVR-10): logged-in customer's pincode saves to profiles.default_pincode and restores on fresh login"
  - "Pure resolveDeliveryLoginMerge(profilePin, localPin) decision (D-01 adopt-profile / D-02 push-local / D-09 equality-noop)"
  - "Silent-degrade profile write-through inside setPincode (D-08) with unchanged public context shape (D-09)"
affects: [08-03-live-verification, navbar-pincode-widget]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure decision helper extracted from a React/Supabase provider so branch logic is unit-provable without a harness"
    - "AuthProvider role-read effect cloned for a login-merge effect: gate on loading, active cleanup flag, .eq(id).single()"

key-files:
  created:
    - client/src/delivery/loginMerge.ts
    - client/src/delivery/loginMerge.test.ts
  modified:
    - client/src/delivery/DeliveryProvider.tsx

key-decisions:
  - "Extended the existing DeliveryProvider in place — no second provider — keeping the public context shape { pincode, setPincode } byte-for-byte unchanged (D-09) so the Phase 7 estimator and Plan 01 pill need zero changes."
  - "writePincodeToProfile kept module-level (not a useCallback) to avoid churning the setPincode/effect dependency arrays; payload is minimal { default_pincode } only (T-08-02 defense-in-depth)."
  - "Login-merge effect returns early while auth loading (the resolvedFor race) and for logged-out users (D-04 anonymous = localStorage only)."

patterns-established:
  - "Login-merge decision as a pure LoginMergeAction union, dispatched via switch in the provider effect"

requirements-completed: [DLVR-10]

# Metrics
duration: ~15min
completed: 2026-07-05
---

# Phase 08 Plan 02: Site-wide Pincode — Profile Persistence Summary

**Cross-device pincode persistence (DLVR-10): a logged-in customer's delivery pincode now writes through to `profiles.default_pincode` and restores on a fresh login via a pure, unit-tested D-01/D-02/D-09 merge — with the public `{ pincode, setPincode }` context shape unchanged.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-05
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Pure `resolveDeliveryLoginMerge(profilePin, localPin)` helper with a `LoginMergeAction` union — 7/7 Vitest cases green (adopt-profile, equality-noop, push-local, both-null noop, empty-string-as-absent on both inputs).
- Extended `DeliveryProvider` in place: module-level `writePincodeToProfile` (silent-degrade, minimal `{ default_pincode }` payload), best-effort write-through inside `setPincode` for logged-in users, and a login-merge `useEffect` keyed on `[user?.id, loading]`.
- Public context shape `{ pincode, setPincode }` preserved exactly (D-09) — zero downstream changes needed; anonymous visitors remain localStorage-only (D-04); profile I/O failures degrade silently with no toast (D-08).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing loginMerge decision tests** - `b63fa18` (test)
2. **Task 1 (GREEN): implement resolveDeliveryLoginMerge** - `7b54567` (feat)
3. **Task 2: profile write-through + login-merge in DeliveryProvider** - `30434ba` (feat)

_TDD gate order satisfied: `test(...)` RED precedes `feat(...)` GREEN in history._

## Files Created/Modified
- `client/src/delivery/loginMerge.ts` - Pure `resolveDeliveryLoginMerge` + `LoginMergeAction` type; no React/Supabase imports.
- `client/src/delivery/loginMerge.test.ts` - Vitest suite pinning all five behavior branches (7 cases).
- `client/src/delivery/DeliveryProvider.tsx` - Added `writePincodeToProfile` (module-level, silent), write-through in `setPincode`, and the login-merge read effect. Preserved `readStoredPincode`, lazy-init `useState`, `DELIVERY_PINCODE_KEY`, and the exported context value.

## Decisions Made
- Included `setPincode` in the login-merge effect's dependency array (it is memoized on `user?.id`, so this adds no extra runs) rather than suppressing exhaustive-deps — cleaner React correctness while keeping the same `[user?.id, loading]` trigger semantics the plan specified.
- Reworded the `writePincodeToProfile` doc comment to avoid the literal token "toast" so the D-08 "no toast" posture is unambiguous on grep; there is no `sonner` import in the file.

## Deviations from Plan

None - plan executed exactly as written. (No auto-fixes to plan-scope files were required; the pre-existing repo issues below are out of scope and were logged, not fixed.)

## Issues Encountered

Two **pre-existing, out-of-scope** repo issues surfaced during the Task 2 verify steps. Both were confirmed present at the plan base commit with my changes stashed, and neither touches the Plan 08-02 files. Logged to `deferred-items.md`, not fixed (SCOPE BOUNDARY rule):

1. **`npm run check` — 3 tsc errors in `scripts/transform-pincodes.ts`** (TS2802 Set/MapIterator downlevel-iteration). Originates from Phase 6 commit `d3676ea`, an ancestor of this plan's base. The Plan 08-02 files add **zero** new tsc errors (verified: with the provider stashed, `tsc` still reports exactly these 3).
2. **`npm test` — 4 suites fail to collect** (`admin`/`questionnaire`/`submissions`/`wishlist`.test.ts) with `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY`. These suites transitively import `@/lib/supabase`, which throws at load when the env vars are unset; this worktree has only `.env.example` (real values live in a gitignored `.env.local`). All 51 collectable tests pass, including the new **isolated, pure** `loginMerge.test.ts` (7/7 — no supabase import).

## Verification

- `npx vitest run client/src/delivery/loginMerge.test.ts` — 7/7 green.
- Grep gates all pass: `useAuth` consumed, `resolveDeliveryLoginMerge` wired, `async function writePincodeToProfile` module-level, update payload is `default_pincode`-only (negative `role` grep passes), no `toast`/`sonner` in the file.
- `npm run check` — clean for the Plan 08-02 files (only the pre-existing `transform-pincodes.ts` script errors remain, out of scope).
- `npm test` — 51/51 collectable tests green; the 4 failing collections are pre-existing env-only failures unrelated to this plan.
- Behavioral (live cross-device restore) verification is deferred to Plan 03 (Wave 2 end-to-end checkpoint), per the plan.

## User Setup Required
None - no new external service configuration required this plan (no new dependencies, no new endpoints; reuses existing `@/lib/supabase`, `@/auth/useAuth`).

## Next Phase Readiness
- DLVR-10 vertical slice complete and unit-proven; ready for the Plan 03 live end-to-end checkpoint (real login on two sessions/devices to confirm D-01/D-02 restore).
- The navbar pincode widget (Plan 01, same wave) and this profile-persistence slice both consume the unchanged `{ pincode, setPincode }` context — no integration conflict expected.

## Self-Check: PASSED

All created files present on disk (`loginMerge.ts`, `loginMerge.test.ts`, `DeliveryProvider.tsx`, `08-02-SUMMARY.md`) and all three task commits (`b63fa18`, `7b54567`, `30434ba`) exist in git history.

---
*Phase: 08-site-wide-pincode-navbar-widget-profile-persistence*
*Completed: 2026-07-05*
