# Deferred Items — Phase 07

Out-of-scope discoveries found during execution. Not fixed (SCOPE BOUNDARY: only
issues directly caused by the current task's changes are auto-fixed).

## Pre-existing `npm run check` (tsc) failures — `scripts/transform-pincodes.ts`

Discovered during Plan 01, Task 1 verification. `npm run check` (bare `tsc`, which
includes `scripts/**/*` per tsconfig) reports 3 pre-existing errors in a file this
plan does not touch:

```
scripts/transform-pincodes.ts(58,6):  error TS2802: Type 'Set<string>' can only be iterated ... '--downlevelIteration' / '--target' 'es2015'+
scripts/transform-pincodes.ts(224,21): error TS2802: Type 'MapIterator<RawRow>' can only be iterated ...
scripts/transform-pincodes.ts(256,25): error TS2802: Type 'Set<string>' can only be iterated ...
```

- **Cause:** the tsconfig `target` predates `for...of` over `Set`/`Map` iterators in this Phase-6 seed script; needs `--downlevelIteration` or a higher `target`.
- **Scope:** unrelated to the delivery estimator (a one-off pincode-seed transform script). All Phase-7 `client/src/lib/**` files typecheck clean.
- **Action:** left as-is. A future tsconfig/target bump or a `[...set]` spread in that script resolves it.
