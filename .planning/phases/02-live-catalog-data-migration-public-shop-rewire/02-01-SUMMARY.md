---
phase: 02-live-catalog-data-migration-public-shop-rewire
plan: 01
subsystem: database
tags: [supabase, postgres, storage, seed, rls, service-role, anon-key, node22]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "products/categories schema (0001_init_schema.sql), product-images bucket + public-read/admin-write RLS (0003_storage_buckets.sql), private.is_admin() RLS helper, scripts/verify-skeleton.ts + scripts/check-no-secret.sh guards"
provides:
  - "Live Supabase project seeded with exactly 28 products (13 soap + 10 scrub + 5 cream) and 3 categories"
  - "84 soap images uploaded to product-images bucket under products/{slug}/{filename}; soap rows carry their Storage paths in images[]"
  - "client/src/data/catalog-data.ts — glob-free (no import.meta.*) catalog metadata: productMeta (28), categoryMeta (3), SLUG_TO_SOAP_FOLDER (13), BATCH_NOTE; importable by both Node and Vite"
  - "scripts/seed.ts — idempotent service-role seed (upsert on slug; converges, never duplicates)"
  - "scripts/verify-seed.ts — anon-key verification of 28/3 counts + proven is_active published-only filter (PUB-02 foundation)"
affects: [02-02, 02-03, public-shop-rewire, admin-portal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Glob-free shared data module (catalog-data.ts) consumable by both Node scripts and the Vite client — image acquisition deferred to fs at seed time / Storage at read time"
    - "Native Node 22 --env-file runners (no tsx, no dotenv) mirroring scripts/verify-skeleton.ts"
    - "Idempotent upsert-on-slug seed: categories first (FK), then products referencing category_id"
    - "Service-role secret read only from non-VITE_ process.env via gitignored .env.seed.local; script never imported by client code"

key-files:
  created:
    - client/src/data/catalog-data.ts
    - scripts/seed.ts
    - scripts/verify-seed.ts
  modified: []

key-decisions:
  - "Catalog count is 28 products / 3 categories (13 soap + 10 scrub + 5 cream) — NOT 68; the 68 in ROADMAP/REQUIREMENTS referred to soap images (actual ~84 jpgs)"
  - "Every product price seeded as null (D-09) — no zero/placeholder"
  - "Scrub/cream products seeded with empty images[] — owner uploads via portal in a later phase"
  - "Slugs kept category-prefixed and globally unique (soap-neem stays soap-neem)"

patterns-established:
  - "Pattern: glob-free metadata module shared across Node + Vite"
  - "Pattern: idempotent service-role seed converges on slug; RLS stays enabled throughout"
  - "Pattern: anon-key verification asserting both counts and the is_active published-only filter"

requirements-completed: [DATA-03, PUB-02]

# Metrics
duration: 3min
completed: 2026-05-31
---

# Phase 2 Plan 01: Seed Vertical Slice Summary

**Live Supabase project seeded with 28 products / 3 categories and 84 soap images via an idempotent service-role upsert; anon read + is_active published-only filter proven.**

## Performance

- **Duration:** 3 min (Task 3 execution only; Tasks 1+2 completed in a prior session)
- **Started:** 2026-05-31T12:36:02Z
- **Completed:** 2026-05-31T12:39:13Z
- **Tasks:** 3 of 3 (Tasks 1+2 in prior session; Task 3 + checkpoint clearance this session)
- **Files modified:** 3 created (Tasks 1+2); 0 in Task 3 (no bugs surfaced)

## Accomplishments
- First seed run landed 3 categories + 28 products + 84 soap images into live Supabase (exit 0).
- Anon verify PASS: exactly 28 products / 3 categories; an is_active=false row is hidden from an anon `.eq('is_active', true)` select (PUB-02 server-side filter proven at the data layer).
- Idempotency confirmed: a second consecutive seed + verify still reports 28 / 3 — upsert on slug converges, no duplicates (DATA-03 success criterion #2).
- Storage sanity confirmed: all 13 soap rows carry non-empty images[] under `products/{slug}/`; all 15 scrub+cream rows carry empty images[]; no malformed paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract glob-free catalog metadata into catalog-data.ts** - `e274f22` (feat)
2. **Task 2: Idempotent service-role seed + anon verify scripts** - `0579f12` (feat)
3. **Task 3: Run seed, verify 28/3 + idempotency + published-only filter** - no commit (execution-only task; no source changes — no bug surfaced)

Checkpoint pause record (Task 2.5, now cleared): `0756d13` (docs)

**Plan metadata:** see final docs commit (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified
- `client/src/data/catalog-data.ts` - Glob-free catalog metadata (productMeta 28, categoryMeta 3, SLUG_TO_SOAP_FOLDER 13, BATCH_NOTE); created Task 1.
- `scripts/seed.ts` - Idempotent service-role seed; created Task 2; exercised Task 3.
- `scripts/verify-seed.ts` - Anon-key 28/3 + published-only verification; created Task 2; exercised Task 3.

## Decisions Made
None during Task 3 — the seed and verify scripts ran correctly on the first attempt against the live project. Plan-level decisions (28 not 68, price null, empty scrub/cream images, category-prefixed slugs) were settled in Tasks 1+2.

## Deviations from Plan

None - plan executed exactly as written. Task 3 surfaced no bugs; the seed converged and the verification passed on the first and second runs without any code change.

## Authentication / External Gates

The plan's blocking human-action checkpoint (Task 2.5 — owner supplies the Supabase service-role key into a gitignored `.env.seed.local`) was satisfied before this session. The file was confirmed present, gitignored (`git check-ignore .env.seed.local` matches via `.env*.local`), and untracked, carrying SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY. This is normal flow for a service-role seed, not a deviation.

## Issues Encountered
- The one-off Storage sanity script initially failed with ERR_MODULE_NOT_FOUND for `@supabase/supabase-js` when run from `/tmp` (no node_modules on the resolution path). Resolved by running the throwaway script from the repo root so it resolved the project's node_modules; the temp script was then deleted. This was an ad-hoc verification helper only — no plan artifact was affected.

## User Setup Required
None beyond the already-satisfied `.env.seed.local` (service-role key). That file stays local and gitignored; it is never committed and never enters the bundle (`scripts/check-no-secret.sh` enforces no `service_role` token in dist/).

## Next Phase Readiness
- The live catalog exists in Postgres + Storage: Plan 02-02 and 02-03 can now build the public read path (`catalog.ts`) against real seeded rows and Storage paths.
- `catalog-data.ts` is ready to be re-exported by `products.ts` in Plan 02-02.
- The `is_active` published-only filter is proven at the data layer, so the read layer (PUB-02) can rely on it.
- No blockers carried forward.

## Self-Check: PASSED

All created files exist on disk (catalog-data.ts, seed.ts, verify-seed.ts, 02-01-SUMMARY.md) and all task commits resolve in git history (e274f22, 0579f12).

---
*Phase: 02-live-catalog-data-migration-public-shop-rewire*
*Completed: 2026-05-31*
