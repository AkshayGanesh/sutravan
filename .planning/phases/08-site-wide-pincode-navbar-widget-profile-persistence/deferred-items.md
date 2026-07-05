# Phase 08 — Deferred / Out-of-Scope Items

Discovered during execution but NOT caused by the current task's changes (scope
boundary). Not fixed here.

## Pre-existing `npm run check` (tsc) failures in `scripts/transform-pincodes.ts`

- **Discovered during:** Plan 08-01, Task 1 (`npm run check` verification).
- **Errors:**
  - `scripts/transform-pincodes.ts(58,6)`: TS2802 `Set<string>` iteration needs `--downlevelIteration` or `--target es2015+`.
  - `scripts/transform-pincodes.ts(224,21)`: TS2802 `MapIterator<RawRow>` iteration.
  - `scripts/transform-pincodes.ts(256,25)`: TS2802 `Set<string>` iteration.
- **Origin:** File committed in Phase 6 (`d3676ea feat(06-02): transform India Post pincode CSV to normalized NDJSON`). Byte-identical to base commit `1e5c51b` — untouched by this plan.
- **Scope decision:** Out of scope for Plan 08-01. The Plan 08-01 component and Navbar changes add ZERO tsc errors; these three errors are a pre-existing project-wide `tsc` condition in an unrelated data-transform script. Left as-is per the executor scope boundary (only auto-fix issues DIRECTLY caused by the current task).
- **Suggested fix (future):** set `"downlevelIteration": true` (or bump `"target"` to `es2015+`) in `tsconfig.json`, or exclude `scripts/` from the type-check config.
