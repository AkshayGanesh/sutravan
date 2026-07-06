# Deferred Items — Phase 10

Out-of-scope discoveries logged during execution. NOT fixed (SCOPE BOUNDARY).

## Pre-existing tsc errors in scripts/transform-pincodes.ts

- **Found during:** Plan 10-01 (`npm run check`)
- **Errors:** 3× TS2802 ("Set/MapIterator can only be iterated with --downlevelIteration
  or --target es2015+") at lines 58, 224, 256.
- **Origin:** commit `d3676ea` (Phase 6-02), predates Phase 10 — unrelated to the
  Rate Slabs editor. `rateSlabsSchema.ts`/`.test.ts` are TypeScript-clean.
- **Disposition:** Deferred. Not caused by this plan's changes; fixing the tsconfig
  target / iteration flag is outside the Phase 10 boundary.
