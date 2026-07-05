# Deferred Items — Phase 08

Out-of-scope discoveries logged during execution (SCOPE BOUNDARY rule — not fixed here).

## Pre-existing, unrelated to Plan 08-02 changes

### 1. `scripts/transform-pincodes.ts` — 3 tsc errors under `npm run check`

- **Discovered during:** Plan 08-02, Task 2 (`npm run check` verify step).
- **Errors:** TS2802 `Set`/`MapIterator` "can only be iterated through with `--downlevelIteration` or `--target es2015`+" at lines 58, 224, 256.
- **Origin:** Committed in Phase 6 (`d3676ea feat(06-02): transform India Post pincode CSV to normalized NDJSON`) — an ancestor of the Plan 08-02 base commit. Confirmed present at base with Plan 08-02 changes stashed.
- **Scope:** Unrelated to Plan 08-02 files. The Plan 08-02 files (`loginMerge.ts`, `DeliveryProvider.tsx`) add zero new tsc errors.
- **Suggested fix (future):** raise the `scripts`-scope TS `target` to `es2015`+ or enable `downlevelIteration`, or exclude one-off transform scripts from `tsc` project include.

### 2. Four Vitest suites fail to collect without Supabase env vars

- **Discovered during:** Plan 08-02, Task 2 (`npm test` / full `vitest run`).
- **Suites:** `client/src/lib/admin.test.ts`, `questionnaire.test.ts`, `submissions.test.ts`, `wishlist.test.ts`.
- **Error:** `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY` (thrown at `@/lib/supabase` module load).
- **Origin:** These suites transitively import `@/lib/supabase`, which throws at import when the env vars are unset. This worktree has only `.env.example` (the real `VITE_SUPABASE_*` values live in a gitignored `.env.local` per project convention).
- **Scope:** Pre-existing and environment-only — confirmed failing at base with Plan 08-02 changes stashed. None of these suites import `loginMerge` or `DeliveryProvider`. All 51 collectable tests pass, including the new `loginMerge.test.ts` (7/7, isolated/pure — no supabase import).
- **Suggested fix (future):** provide a test-mode `.env` (or vitest `setupFiles` stub) so supabase-importing suites can collect in CI/agent environments.
