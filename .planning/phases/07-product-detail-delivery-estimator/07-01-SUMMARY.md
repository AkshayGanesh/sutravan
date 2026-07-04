---
phase: 07-product-detail-delivery-estimator
plan: 01
subsystem: delivery-estimator
tags: [delivery, pincode, turnstile, edge-function, react-query, tdd]
requires:
  - "delivery-estimate Edge Function (deployed, Phase 6) — { serviceable, cost, etaDays, codAvailable, originConfigured }"
  - "TurnstileWidget + lib/turnstile hosted-CDN loader (Phase 5)"
  - "AuthProvider + QueryClientProvider app-root nesting (Phase 3)"
provides:
  - "estimateDelivery / useDeliveryEstimate / mapEstimateError / EstimateError / DeliveryEstimateResult (client/src/lib/delivery.ts)"
  - "DeliveryProvider + useDelivery (localStorage pincode persistence, key sutravan.delivery.pincode)"
  - "DeliveryEstimate block (per-product cost + ETA + COD) inside ProductDetail"
  - "formatPrice en-IN thousands grouping (site-wide)"
affects:
  - "client/src/components/ProductDetail.tsx (renders DeliveryEstimate)"
  - "client/src/App.tsx (mounts DeliveryProvider at root)"
  - "every price render site-wide (formatPrice now groups thousands)"
tech-stack:
  added: []
  patterns:
    - "Edge Function invoke wrapper cloned from submitQuestionnaire (throw-on-error, read FunctionsHttpError body via error.context.json())"
    - "Context provider + throw-outside-provider hook mirrored from AuthProvider/useAuth"
    - "useMutation (not useQuery) for single-use-token actions — token never a cache key"
key-files:
  created:
    - client/src/lib/delivery.ts
    - client/src/lib/delivery.test.ts
    - client/src/lib/format.test.ts
    - client/src/delivery/DeliveryProvider.tsx
    - client/src/delivery/useDelivery.ts
    - client/src/components/delivery/DeliveryEstimate.tsx
  modified:
    - client/src/lib/format.ts
    - client/src/App.tsx
    - client/src/components/ProductDetail.tsx
decisions:
  - "mapEstimateError kept PURE and unit-pinned: bad_request -> invalid-format, everything else -> retry (D-13)"
  - "Invoke body carries NO weightG — server 250g fallback exercised (D-10)"
  - "formatPrice drops Math.round in favor of toLocaleString('en-IN') — never re-rounds (engine already rounds to ₹10, D-04)"
  - "DeliveryProvider nested inside AuthProvider, QueryClientProvider stays outermost (D-11)"
metrics:
  tasks_completed: 3
  files_created: 6
  files_modified: 3
  commits: 4
  duration_minutes: ~8
  completed: 2026-07-04
---

# Phase 07 Plan 01: Delivery Estimator Vertical Slice Summary

Happy-path per-product delivery estimator: a customer opens a product, enters a valid 6-digit pincode, presses "Check delivery", and sees a real estimated shipping cost + working-days ETA range + COD availability from the deployed `delivery-estimate` Edge Function — with the pincode persisted in localStorage across reloads via a site-wide `DeliveryProvider` that Phase 8 plugs into with no refactor.

## What Was Built

**Task 1 — Delivery service layer (TDD).** `client/src/lib/delivery.ts`: the `estimateDelivery(token, destPincode)` invoke wrapper (body `{ token, destPincode }` — no `weightG`, D-10), the pure `mapEstimateError` boundary mapper, the `EstimateError`/`EstimateErrorCode` types, the `DeliveryEstimateResult` interface mirroring the Edge Function's public contract, and the `useDeliveryEstimate()` mutation hook. `formatPrice` extended with `toLocaleString('en-IN')` thousands grouping (never re-rounds, D-04). Pinned by `delivery.test.ts` + `format.test.ts` (RED → GREEN).

**Task 2 — Site-wide pincode layer.** `DeliveryProvider` persists the pincode in localStorage key `sutravan.delivery.pincode` (all storage access try/catch-guarded so blocked storage never throws), `useDelivery` throws outside the provider, and `App.tsx` mounts the provider inside `AuthProvider` (with `QueryClientProvider` outermost so the estimate mutation's React Query works, D-11).

**Task 3 — The estimate block.** `client/src/components/delivery/DeliveryEstimate.tsx`: idle prompt, inline `/^\d{6}$/` format guard (no network call when invalid, D-02), a reused `TurnstileWidget` for the single-use token, and the serviceable result panel (cost figure + "Estimated — final delivery charge may vary." disclaimer, "Arrives in {min}–{max} working days" ETA, COD yes/no line). `setPincode` on success; Turnstile reset after every invoke (D-01/D-13). Rendered in `ProductDetail` as `<DeliveryEstimate key={product.id} product={product} />` between the price/variant block and Benefits (D-03/D-08). Non-serviceable + fetch-failure branches are minimal stubs (Plan 02 completes the five-state treatment, provisional banner, ETA sub-caption, and free-ship messaging).

## Verification

- `npm run check` — clean across all Plan-07 files (`client/src/lib/**`, `client/src/delivery/**`, `client/src/components/**`); the only tsc errors are pre-existing in `scripts/transform-pincodes.ts` (see Deferred Issues).
- `npm test` — `delivery.test.ts` (4) + `format.test.ts` (4) GREEN; 44 total assertions pass.
- `npm run build` — production bundle builds successfully.
- Invoke body is `{ token, destPincode }` with no `weightG` — server 250g fallback exercised (D-10).
- `DeliveryProvider` mounted at app root; serviceable result renders cost + ETA range + COD with the inline estimate disclaimer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] delivery.test.ts could not load without VITE_ env vars**
- **Found during:** Task 1 verification
- **Issue:** `delivery.ts` transitively imports `lib/supabase.ts`, which throws at module load when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are unset (the same env gate that already breaks `questionnaire.test.ts`/`wishlist.test.ts` in this worktree, which has no `.env`). The pure `mapEstimateError` spec could not import the module.
- **Fix:** Added `vi.mock("@/lib/supabase", () => ({ supabase: {} }))` (hoisted above imports) so the pure boundary mapper is unit-tested in isolation — no env, no network.
- **Files modified:** `client/src/lib/delivery.test.ts`
- **Commit:** ecfe116

**2. [Rule 3 - Blocking] "marsidev" mention tripped the no-wrapper acceptance grep**
- **Found during:** Task 3 verification
- **Issue:** The component's explanatory comment literally contained `@marsidev/react-turnstile`, so the acceptance guard `! grep -qi 'marsidev'` failed even though no such package is imported.
- **Fix:** Reworded the comment to describe the forbidden wrapper without naming the package.
- **Files modified:** `client/src/components/delivery/DeliveryEstimate.tsx`
- **Commit:** d339521

## Deferred Issues

- **Pre-existing `npm run check` errors in `scripts/transform-pincodes.ts`** (3× TS2802 Set/Map iteration needing `--downlevelIteration`). Unrelated to the delivery estimator; logged in `deferred-items.md`. All Phase-7 files typecheck clean.
- **Env-gated test suites** (`questionnaire.test.ts`, `wishlist.test.ts`, and 2 others) fail at module load in this worktree only because no `.env` provides the `VITE_` Supabase vars — an environment condition, not a code defect. They pass where env is configured. Plan-07's own specs avoid this via `vi.mock`.

## Known Stubs

Intentional, per plan scope — Plan 02 resolves each:
- `DeliveryEstimate.tsx` non-serviceable branch: plain single line ("Sorry, we don't deliver to this pincode yet.") instead of the finalized state.
- `DeliveryEstimate.tsx` fetch-failure branch: plain `text-destructive` line instead of the "Try again"-relabeled retry treatment.
- Loading state: a "Checking…" disabled button instead of the `Skeleton` rows.
- No provisional banner / ETA sub-caption / free-ship messaging yet.
These do not block Plan 01's goal (the serviceable happy path is fully wired end-to-end).

## Self-Check: PASSED

- All 6 created files present on disk.
- All 4 commits (ecfe116, d70cdc2, 97230de, d339521) present in git history.
