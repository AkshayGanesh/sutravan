# Deferred items — quick task 260731-grz

Out-of-scope discoveries found while executing this plan. NOT fixed here (scope
boundary: only issues directly caused by this task's changes are auto-fixed).

| Item | Detail | Why deferred |
|------|--------|--------------|
| `npm run check` is red at baseline | 3 × TS2802 in `scripts/transform-pincodes.ts` (lines 58, 224, 256): `Set`/`MapIterator` need `--downlevelIteration` or `target >= es2015`. `tsconfig.json` sets no `target`, so it defaults to ES5. | Pre-existing and unrelated. Verified red on a clean tree BEFORE any edit in this task, and `git log` shows the file was last touched in `d3676ea feat(06-02)`. Fixing it means changing the shared `tsconfig.json` `target`, which affects the whole client build — too broad for a quick task. |

## Note on the `npm run check` gate

Tasks 5 and 6 gate on `npm run check`. It exits non-zero, but **only** because of
the three pre-existing errors above. Zero errors originate from any file this
task touched. The honest status is: **no new type errors introduced; the repo's
pre-existing tsc failure remains.**

Suggested fix (separate task): add `"target": "es2020"` (or
`"downlevelIteration": true`) to `tsconfig.json` `compilerOptions`, then re-run
`npm run check` and `npm run build` to confirm no fallout.
