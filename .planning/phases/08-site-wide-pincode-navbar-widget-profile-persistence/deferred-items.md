# Phase 08 — Deferred / Out-of-Scope Items

Discovered during execution but NOT caused by the current task's changes (scope
boundary). Not fixed here.

## 1. `scripts/transform-pincodes.ts` — 3 tsc errors under `npm run check`

- **Discovered during:** Plan 08-01 (Task 1) and Plan 08-02 (Task 2) — both hit it during `npm run check`.
- **Errors:** TS2802 at lines 58, 224, 256 — `Set<string>` / `MapIterator<RawRow>` iteration needs `--downlevelIteration` or `--target es2015+`.
- **Origin:** File committed in Phase 6 (`d3676ea feat(06-02): transform India Post pincode CSV to normalized NDJSON`). Byte-identical to base commit `1e5c51b` — untouched by Phase 8. Confirmed present at base with Phase 8 changes stashed.
- **Scope decision:** Out of scope for Phase 8. The Phase 8 component/provider/helper changes add ZERO tsc errors; these three errors are a pre-existing project-wide `tsc` condition in an unrelated data-transform script. Left as-is per the executor scope boundary (only auto-fix issues DIRECTLY caused by the current task).
- **Suggested fix (future):** set `"downlevelIteration": true` (or bump `"target"` to `es2015+`) in `tsconfig.json`, or exclude `scripts/` from the type-check config.

## 2. Four Vitest suites fail to collect without Supabase env vars

- **Discovered during:** Plan 08-02, Task 2 (`npm test` / full `vitest run`).
- **Suites:** `client/src/lib/admin.test.ts`, `questionnaire.test.ts`, `submissions.test.ts`, `wishlist.test.ts`.
- **Error:** `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY` (thrown at `@/lib/supabase` module load).
- **Origin:** These suites transitively import `@/lib/supabase`, which throws at import when the env vars are unset. The worktree/agent environment has only `.env.example` (the real `VITE_SUPABASE_*` values live in a gitignored `.env.local` per project convention).
- **Scope:** Pre-existing and environment-only — confirmed failing at base with Phase 8 changes stashed. None of these suites import `loginMerge` or `DeliveryProvider`. All collectable tests pass, including the new `loginMerge.test.ts` (7/7, isolated/pure — no supabase import) and `DeliveryPincodePill.test.ts`.
- **Suggested fix (future):** provide a test-mode `.env` (or vitest `setupFiles` stub) so supabase-importing suites can collect in CI/agent environments.
