---
phase: 01-supabase-foundation-schema-rls-storage
plan: 03
subsystem: database
tags: [supabase, postgres, rls, migrations, storage, walking-skeleton]

# Dependency graph
requires:
  - phase: 01-01
    provides: Supabase client singleton, .env contract, verify-skeleton.ts + check-no-secret.sh guards
  - phase: 01-02
    provides: Versioned migrations (schema, RLS, storage) + rls_assertions.sql
provides:
  - Live hosted Supabase project, linked and migrated (0001→0002→0003 applied)
  - Walking skeleton proven end-to-end: anon SELECT on products OK, anon INSERT denied
  - DATA-02 RLS invariants asserted GREEN against the real database
  - .env.local populated (gitignored) with VITE_ anon credentials only
affects: [admin-portal, public-shop, auth, customization-questionnaire, storage-uploads]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration-only schema changes (never edit remote DB directly; fix file + re-push)"
    - "language-sql SECURITY DEFINER functions must be defined after the tables their body references"
    - "Non-interactive supabase link/db push via SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD env"

key-files:
  created:
    - .planning/phases/01-supabase-foundation-schema-rls-storage/01-03-SUMMARY.md
  modified:
    - supabase/config.toml
    - supabase/migrations/0001_init_schema.sql
    - supabase/tests/rls_assertions.sql

key-decisions:
  - "Set config.toml project_id to the real linked ref (replaced Plan 02's worktree-name placeholder)"
  - "Used supabase db query --linked (Management API) to run the RLS assertion block — psql direct connect not needed"

patterns-established:
  - "Pattern: blocking live-push gate — build/tsc pass without the live DB, so phase only truly passes after db push + live assertions"
  - "Pattern: secrets pass via gitignored .env.cli.local, sourced for CLI ops then shredded; never in a VITE_ var"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: ~25min
completed: 2026-05-31
---

# Phase 1 / Plan 03: Bring the Foundation Live Summary

**Live Supabase project linked and migrated (six tables + RLS + is_admin() + two Storage buckets); walking skeleton proven — anon catalog read returns with no RLS error, anon write denied (42501), all DATA-02 invariants GREEN, no service_role in the bundle.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-05-31T11:34:15Z
- **Tasks:** 3 (1 human checkpoint + 2 automated)
- **Files modified:** 3 (config.toml, 0001_init_schema.sql, rls_assertions.sql)

## Accomplishments
- Human created the hosted Supabase project (ref `wfbnrcnmpcqzeyjlfflv`); `.env.local` populated with the two `VITE_` anon vars only, gitignored.
- `supabase link` + `supabase db push --linked` applied migrations `0001 → 0002 → 0003` to the live database (confirmed via `supabase migration list --linked` — all three show in the Remote column).
- Walking skeleton proven: anon-key `select` on `products` returns an empty set with `error === null` (public-read RLS works end-to-end).
- Default-deny proven: anon-key `insert` into `products` rejected with `42501 new row violates row-level security policy`.
- `rls_assertions.sql` ran clean against the live DB (no exception raised → all 5 invariants pass: RLS on all six tables, public-read on the three catalog tables, no anon INSERT on profiles, `private.is_admin()` SECURITY DEFINER + locked search_path, both buckets public).
- `npm run build` exits 0 with the live `.env.local` present; `check-no-secret.sh` confirms no `service_role` token in `dist/`.

## Task Commits

1. **Task 1: Human creates live project + credentials** — no commit (`.env.local` is gitignored; human-action checkpoint)
2. **Task 2: Link + push migrations** — `ee9edb8` (fix: migration/assertion bugs surfaced at push gate) + `576c290` (feat: config.toml linked ref)
3. **Task 3: Prove walking skeleton + invariants** — verification only (no source change; results recorded here)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `supabase/config.toml` - `project_id` set to the real linked ref `wfbnrcnmpcqzeyjlfflv`
- `supabase/migrations/0001_init_schema.sql` - `private.is_admin()` moved to end of file (after `public.profiles` exists)
- `supabase/tests/rls_assertions.sql` - policy-role membership checks cast to `name[]`
- `.env.local` - (gitignored) `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for the live project

## Decisions Made
- `config.toml project_id` set to the real project ref, replacing the worktree-name placeholder `supabase init` produced in Plan 02's parallel worktree.
- Ran the live SQL assertion block via `supabase db query --linked` (Management API) rather than a direct `psql` connection — avoids needing the region/pooler connection string; the linked Management API surfaces any raised exception as a 400, giving the same fail-on-error behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `private.is_admin()` defined before `public.profiles` existed**
- **Found during:** Task 2 (`supabase db push --linked`)
- **Issue:** `0001` created the `language sql` `is_admin()` function (whose body reads `public.profiles`) before the `profiles` table. SQL-language bodies are validated at creation time → `ERROR: relation "public.profiles" does not exist (42P01)`, rolling back the whole push (nothing applied remotely).
- **Fix:** Kept `create schema private` up-front but moved the `create or replace function private.is_admin()` block to the end of `0001`, after all six tables. Added header/inline comments explaining the ordering requirement.
- **Files modified:** `supabase/migrations/0001_init_schema.sql`
- **Verification:** `supabase db push --linked` re-ran clean; `migration list --linked` shows 0001/0002/0003 applied.
- **Committed in:** `ee9edb8`

**2. [Rule 3 - Blocking] RLS assertion type mismatch on `pg_policies.roles`**
- **Found during:** Task 3 (`rls_assertions.sql` against live DB)
- **Issue:** `pg_policies.roles` is `name[]`; the invariant-2 and invariant-3 checks compared it with `@> array['anon']` (`text[]`) → `ERROR: operator does not exist: name[] @> text[] (42883)`.
- **Fix:** Cast both literal arrays to `name[]` (`array['anon']::name[]`, `array['public']::name[]`) at the two comparison sites.
- **Files modified:** `supabase/tests/rls_assertions.sql`
- **Verification:** Assertion block runs with no exception raised against the live DB (all 5 invariants pass).
- **Committed in:** `ee9edb8`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking). Both were latent bugs in Plan 02 artifacts that only manifest against a live Postgres (build/tsc never exercise them) — exactly the false-pass risk T-03-FALSEPASS anticipated. No scope creep.
**Impact on plan:** Necessary for the live push and live assertions to succeed; the schema/RLS/posture is unchanged in intent.

## Issues Encountered
- `npx tsx` of a throwaway anon-insert script in `/tmp` failed with a `TransformError` (top-level await outside the project's module context). Resolved by writing the throwaway check inside `scripts/` (picks up project tsconfig) with an async `main()` wrapper, then deleting it.

## User Setup Required
The human-action checkpoint (Task 1) is complete: a live Supabase project exists and `.env.local` holds the `VITE_` anon credentials (gitignored). For a fresh clone, a developer must supply their own `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and, for CLI ops, `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` in the shell.

## Next Phase Readiness
- The Supabase foundation is live: schema, default-deny RLS, non-recursive `is_admin()`, and the two public-read/admin-write Storage buckets all exist on the real database.
- Phase 2+ (seed data, admin portal, public shop) can now read/write through the Supabase client against a real backend. The service-role key (needed only for the Phase 2 seed) is intentionally NOT in `.env.local` — keep it shell-only.

---
*Phase: 01-supabase-foundation-schema-rls-storage*
*Completed: 2026-05-31*
