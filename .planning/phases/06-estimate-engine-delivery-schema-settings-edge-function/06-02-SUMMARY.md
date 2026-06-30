---
phase: 06-estimate-engine-delivery-schema-settings-edge-function
plan: 02
subsystem: database
tags: [supabase, postgrest, pincodes, serviceability, ndjson, seed, csv-transform]

# Dependency graph
requires:
  - phase: 06-01
    provides: "public.pincodes schema (RLS public-read / admin-write), serviceable default true, verify-delivery-seed.ts harness"
provides:
  - "scripts/transform-pincodes.ts — India Post CSV → normalized NDJSON transform (dedupe, canonicalize StateName, derive is_metro/is_remote)"
  - "scripts/data/pincodes.ndjson — committed 19,486-row normalized unique-pincode dataset"
  - "scripts/seed-pincodes.ts — service-role chunked upsert loader (onConflict: pincode)"
  - "~19.5k serviceable pincodes live in public.pincodes (idempotent seed)"
affects: [07-delivery-estimate-edge-function, zone-derivation, serviceability-check]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quote-aware CSV parse keyed off the lowercase on-disk header (case-insensitive column resolution)"
    - "Transform-time canonical-state assertion (Pitfall A guard) — non-zero exit on any un-canonical state"
    - "Service-role chunked PostgREST upsert (onConflict primary key) for bulk reference-data seeding"

key-files:
  created:
    - scripts/transform-pincodes.ts
    - scripts/seed-pincodes.ts
    - scripts/data/pincodes.ndjson
  modified:
    - .gitignore

key-decisions:
  - "Dedup prefers a non-NA representative row and drops NA-only pincodes (100) — the raw dump has 715 'NA'-state rows that would otherwise trip the Pitfall A assertion or mis-zone"
  - "is_metro derived from first-3 prefix set {110,400,700,600,560,500,380,411}; is_remote from the 12-state remote set; both at transform time (D-15)"
  - "Source StateName already uses 'AND' (not '&'); transform still applies &→and for robustness, plus title-case with 'and'/'of' kept lowercase mid-string"
  - "seed never sets serviceable — it defaults true in the table (D-16); seed writes only directory facts"

patterns-established:
  - "Canonical-state guard: normalize once at transform time, assert membership in a fixed 36-state/UT known set, fail the build on any unknown value"
  - "Idempotent bulk seed: 1000-row chunked .upsert(onConflict: 'pincode'); re-run converges to the same count"

requirements-completed: [DLVR-05]

# Metrics
duration: ~12min
completed: 2026-06-30
---

# Phase 6 Plan 02: Pincode Serviceability Dataset & Seed Summary

**India Post All-India Pincode Directory transformed to 19,486 normalized unique-pincode NDJSON rows (canonical states, is_metro/is_remote flags) and idempotently seeded live into public.pincodes — the authoritative serviceability source the Plan 03 Edge Function checks before rating.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-30
- **Completed:** 2026-06-30
- **Tasks:** 2 executed (Task 1 data-acquisition checkpoint pre-completed by operator)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `scripts/transform-pincodes.ts`: quote-aware CSV parse (lowercase header, double-quoted embedded commas), dedupe-by-pincode preferring non-NA representatives, StateName canonicalization (&→and + title-case) with a Pitfall A assertion against the 36-state/UT known set, and is_metro/is_remote derivation.
- `scripts/data/pincodes.ndjson`: 19,486 normalized unique pincodes (165,627 raw rows → 19,586 unique → 100 state-less NA-only dropped). 806 metro, 1,197 remote, 36 distinct canonical states, zero `&`-style values, zero duplicates.
- `scripts/seed-pincodes.ts`: service-role client from non-VITE_ env, 1000-row chunked `.upsert(onConflict: 'pincode')`, leaves `serviceable` to its table default.
- Seeded 19,486 rows LIVE; full `verify-delivery-seed.ts` gate (no PINCODES_OPTIONAL) prints PASS with pincodes ≥ 15000; a second seed run left the count unchanged at 19,486 (idempotent).
- Gitignored the transient ~22MB `scripts/data/pincodes-raw.csv` (only the transformed NDJSON is committed).

## Task Commits

Each task was committed atomically:

1. **Task 2: Transform CSV → normalized NDJSON** — `d3676ea` (feat)
2. **Task 3: Service-role chunked seed + full verification** — `42cce00` (feat)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP commit)_

_(Task 1 was a [HUMAN] data-acquisition checkpoint completed by the operator before this run — no commit.)_

## Files Created/Modified
- `scripts/transform-pincodes.ts` - One-time CSV→NDJSON transform: dedupe, canonicalize StateName, derive flags, Pitfall A assertion.
- `scripts/data/pincodes.ndjson` - Committed 19,486-row normalized unique-pincode dataset (`{pincode,state,district,circle,region,is_metro,is_remote}` per line).
- `scripts/seed-pincodes.ts` - Service-role chunked upsert loader (`onConflict: 'pincode'`), idempotent.
- `.gitignore` - Added `scripts/data/pincodes-raw.csv` (transient ~22MB raw input).

## Decisions Made
- **Prefer non-NA representative during dedup; drop NA-only pincodes.** The raw dump contains 715 rows whose `StateName` is the sentinel `NA`. 238 of those pincodes also appear with a real state (recovered by preferring the non-NA row); 100 are NA-only and unclassifiable, so they are dropped (19,586 unique → 19,486 written). This keeps every emitted state canonical so the Pitfall A assertion holds and zone derivation can never silently miss.
- **Canonical known set is the 36 real India states/UTs** (remote 12 + all others, title-cased). The assertion fails the run listing any un-canonical value (T-6-04 mitigation).
- **`serviceable` is never written by the seed** — it defaults true in the table (D-16), letting the owner switch a real pincode off later without a migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Dedup must prefer non-NA state representatives and drop NA-only pincodes**
- **Found during:** Task 2 (Transform CSV → NDJSON)
- **Issue:** The plan specified "dedupe by Pincode keeping the first representative row," but the actual raw dump has 715 rows with the sentinel `StateName = "NA"`. Keeping a first-seen NA row would either trip the mandated Pitfall A canonical-state assertion (hard fail) or, if NA were whitelisted, silently mis-zone those shipments. The plan's literal "first row" rule did not anticipate this junk.
- **Fix:** During dedup, prefer a non-NA-state representative for each pincode (recovers 238 pincodes); after dedup, drop the 100 pincodes that are NA-only (no real state anywhere) as unclassifiable. Result: 19,486 emitted rows — comfortably within the 15,000–21,000 acceptance band.
- **Files modified:** scripts/transform-pincodes.ts
- **Verification:** Transform exits 0, asserts all 36 distinct states canonical (no `&`); plan verify command prints `PASS 19486`; spot-checks confirm 110→is_metro, J&K / A&N→is_remote with no `&`.
- **Committed in:** d3676ea (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical / data-quality guard)
**Impact on plan:** The deviation is required for the plan's own Pitfall A correctness guarantee; output stays within the planned row band and the full SC5 gate passes. No scope creep.

## Issues Encountered
- **NDJSON is ~2.9MB, above the artifact's "<2MB" estimate.** The `<2MB` figure in the plan's artifact note was an estimate; the real deduped dataset (with district/circle/region per row) is 2.9MB. No acceptance criterion or verify gate enforces size, and T-6-12 accepts committing the public transformed file. Left as-is — shrinking would mean dropping table columns the seed populates.

## User Setup Required
None - the operator's existing gitignored `.env.seed.local` (SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY) was sufficient; Task 1's one-time CSV download was completed before this run.

## Next Phase Readiness
- SC5 data half is complete: ~19.5k serviceable, zone-classifiable pincodes are live and idempotently re-seedable. Combined with Plan 01's schema/settings/slabs, the Plan 03 `delivery-estimate` Edge Function now has its serviceability source and origin-relative zone facts.
- No blockers. The seed is reproducible from the committed NDJSON with no runtime data.gov.in dependency.

## Self-Check: PASSED

- scripts/transform-pincodes.ts — FOUND
- scripts/seed-pincodes.ts — FOUND
- scripts/data/pincodes.ndjson — FOUND (19,486 lines)
- 06-02-SUMMARY.md — FOUND
- Commit d3676ea (Task 2) — FOUND
- Commit 42cce00 (Task 3) — FOUND

---
*Phase: 06-estimate-engine-delivery-schema-settings-edge-function*
*Completed: 2026-06-30*
