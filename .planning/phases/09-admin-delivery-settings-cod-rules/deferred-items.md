# Deferred Items — Phase 09

Out-of-scope discoveries logged during execution (not fixed — outside the current task's changes).

## Pre-existing `npm run check` (tsc) errors in `scripts/transform-pincodes.ts`

- **Found during:** Plan 09-01 Task 1 verification (`npm run check`).
- **Errors (3):** `TS2802` at lines 58, 224, 256 — `Set`/`MapIterator` iteration requires `--downlevelIteration` or `--target es2015+`.
- **Scope:** `scripts/transform-pincodes.ts` is a Phase-06 seed transform script, IDENTICAL to base commit `2a5bff2` — NOT modified by any Plan 09-01 change.
- **Impact on this plan:** None. All Plan 09-01 source/test files compile cleanly (verified by filtering tsc output). The pincode NDJSON was already seeded live in Phase 06, so this script is off the runtime/build path.
- **Suggested fix (future):** bump `tsconfig.json` `target` to `es2015`+ or add `downlevelIteration` (or convert the `for..of` over `Set`/`Map` iterators to `Array.from(...)`).

## Pre-existing env-dependent `npm test` failures (5 test files)

- **Found during:** Plan 09-01 full-suite verification (`npm test`).
- **Symptom:** 5 test files fail to import with `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY` — `client/src/lib/{admin,questionnaire,submissions,wishlist}.test.ts` and `client/src/components/delivery/DeliveryPincodePill.test.ts`.
- **Cause:** These suites import supabase-touching modules WITHOUT `vi.mock("@/lib/supabase")`, so `supabase.ts`'s env-or-throw guard fires because the worktree has no `.env.local` (only `.env.example`). They pass in a dev/CI environment where the VITE_ vars are set.
- **Scope:** All 5 files are pre-existing and UNMODIFIED by Plan 09-01. All 88 runnable tests pass, including the 41 new tests from this plan (which all mock supabase and need no env).
- **Impact on this plan:** None — the failures are an environment condition, not a regression.
- **Suggested fix (future):** provide a `.env.test` (or vitest `env`/setup file) with dummy VITE_ vars, or add `vi.mock("@/lib/supabase")` to those 5 suites so the pure logic tests run env-free.
