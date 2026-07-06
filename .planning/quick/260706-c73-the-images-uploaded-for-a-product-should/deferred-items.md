# Deferred Items — 260706-c73

Out-of-scope pre-existing issues discovered during execution. NOT fixed (unrelated to this task's change to `ImageDropzone.tsx`).

## Pre-existing `npm run check` (tsc) errors in `scripts/transform-pincodes.ts`

Present on the base commit, unchanged by this task:

- `scripts/transform-pincodes.ts(58,6)`: TS2802 — `Set<string>` iteration requires `--downlevelIteration` or `--target es2015+`
- `scripts/transform-pincodes.ts(224,21)`: TS2802 — `MapIterator<RawRow>` iteration
- `scripts/transform-pincodes.ts(256,25)`: TS2802 — `Set<string>` iteration

These are in a standalone data-transform script, not in the app/client build path, and are unrelated to the image-reorder change.
