# Deferred Items — Phase 09

Out-of-scope discoveries logged during execution (not fixed — outside the current task's changes).

## Pre-existing `npm run check` (tsc) errors in `scripts/transform-pincodes.ts`

- **Found during:** Plan 09-01 Task 1 verification (`npm run check`).
- **Errors (3):** `TS2802` at lines 58, 224, 256 — `Set`/`MapIterator` iteration requires `--downlevelIteration` or `--target es2015+`.
- **Scope:** `scripts/transform-pincodes.ts` is a Phase-06 seed transform script, IDENTICAL to base commit `2a5bff2` — NOT modified by any Plan 09-01 change.
- **Impact on this plan:** None. All Plan 09-01 source/test files compile cleanly (verified by filtering tsc output). The pincode NDJSON was already seeded live in Phase 06, so this script is off the runtime/build path.
- **Suggested fix (future):** bump `tsconfig.json` `target` to `es2015`+ or add `downlevelIteration` (or convert the `for..of` over `Set`/`Map` iterators to `Array.from(...)`).
