---
phase: 04-admin-portal-catalog-content-management
plan: 01
subsystem: database
tags: [supabase, postgres, rls, migrations, postgrest, site-content]

# Dependency graph
requires:
  - phase: 02-live-catalog-data-migration-public-shop-rewire
    provides: "products + site_content tables, baseline RLS policies (0001-0004), linked Supabase project wfbnrcnmpcqzeyjlfflv"
  - phase: 03-authentication-roles
    provides: "auth/profiles + products_admin_write FOR ALL admin policy (admins read drafts)"
provides:
  - "Migration 0005: CR-01/D-14 RLS hardening — products_public_read tightened to using (is_active = true), making draft products unreachable via raw anon PostgREST"
  - "Migration 0006: D-18 idempotent seed of the seven editable site_content keys from current hardcoded strings"
  - "Live application of 0005+0006 to project wfbnrcnmpcqzeyjlfflv (both now Local+Remote)"
  - "Proven draft-isolation invariant that ADMIN-08 draft/published toggle relies on"
affects: [admin-portal, site-content-editor, ADMIN-05, ADMIN-06, ADMIN-08, public-shop-rewire, D-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Numbered Supabase migrations with header-comment convention (file name / phase-plan-task / decision id / net invariant / source ref)"
    - "RLS drop+recreate to tighten a public-read policy without touching the admin FOR ALL policy"
    - "Idempotent seed via insert ... on conflict (key) do nothing — never clobbers owner edits"

key-files:
  created:
    - supabase/migrations/0005_cr01_products_public_read.sql
    - supabase/migrations/0006_seed_site_content.sql
  modified: []

key-decisions:
  - "D-14/CR-01: products_public_read enforces is_active = true at the RLS layer so drafts cannot leak via a raw PostgREST select that omits the filter (not just query-side filtering in catalog.ts)"
  - "D-18: seven site_content keys seeded idempotently from current code; on conflict (key) do nothing protects later owner edits"
  - "products_admin_write FOR ALL policy left untouched — admins keep reading drafts (regression guard T-04-02)"

patterns-established:
  - "Pattern 1: Public-read RLS tightening = drop + recreate the SELECT policy only; never alter the admin FOR ALL policy in the same migration"
  - "Pattern 2: site_content seeding is idempotent (on conflict do nothing) so re-running migrations is safe against owner edits"

requirements-completed: [ADMIN-05, ADMIN-06, ADMIN-08]

# Metrics
duration: ~35min
completed: 2026-06-01
---

# Phase 4 Plan 01: Foundation Migrations (CR-01 RLS + site_content Seed) Summary

**Tightened products_public_read to `is_active = true` and idempotently seeded the seven editable site_content keys, then pushed both live and proved draft products are unreachable via raw anon PostgREST.**

## Performance

- **Duration:** ~35 min (spanned a blocking human-verify checkpoint for the live push)
- **Started:** 2026-06-01T~10:20:00+05:30 (first task commit)
- **Completed:** 2026-06-01T04:54:55Z
- **Tasks:** 3 (2 auto + 1 blocking checkpoint, approved)
- **Files modified:** 2 created

## Accomplishments

- **CR-01/D-14 RLS hardening (0005):** `products_public_read` recreated as `for select to anon, authenticated using (is_active = true)`, closing the Information-Disclosure path where a raw PostgREST call omitting `.eq('is_active', true)` could leak draft products. This is the real security ADMIN-08's draft/published toggle depends on.
- **D-18 site_content seed (0006):** seven editable keys seeded idempotently from the current hardcoded strings — `hero_title`, `hero_subtitle`, `hero_cta`, `our_story_body`, `email`, `instagram_url`, `youtube_url` — so the ADMIN-05/06 content editor and the D-20 public `useSiteContent` rewire have rows to read.
- **Live application proven:** both migrations applied to project `wfbnrcnmpcqzeyjlfflv` and the draft-isolation invariant was verified end-to-end against the live database (see Checkpoint Verification).
- **Admin draft read preserved:** `products_admin_write` FOR ALL policy left untouched (regression guard T-04-02); full admin-sees-drafts proof deferred to Plan 05.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 0005 — CR-01 products_public_read tightening (D-14)** - `985b93a` (feat)
2. **Task 2: Author migration 0006 — idempotent site_content seed (D-18)** - `567c179` (feat)
3. **Task 3: [BLOCKING] Push 0005+0006 live and verify CR-01 draft isolation** - checkpoint (no code commit; live DB change + verification, approved by user)

**Plan metadata:** docs commit (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `supabase/migrations/0005_cr01_products_public_read.sql` - drops + recreates `products_public_read` with `using (is_active = true)`; does not touch the admin FOR ALL policy
- `supabase/migrations/0006_seed_site_content.sql` - idempotent `insert into public.site_content ... on conflict (key) do nothing` for the seven editable keys

## Checkpoint Verification (Task 3 — blocking human-verify, APPROVED)

User response: **"approved"**. The orchestrator performed the live push and verification with these results:

- **Push applied:** `supabase db push --linked` applied 0005 and 0006 to live project `wfbnrcnmpcqzeyjlfflv` with no error. Confirmed via `supabase migration list --linked` — 0005 and 0006 now show as both **Local + Remote**.
- **Draft isolation PROVEN:** with the service-role key, product `soap-charcoal` was flipped to `is_active=false`; an anon raw PostgREST select on `products` **without** an `is_active` filter returned **27 rows** and did **NOT** include `soap-charcoal`. The product was then restored to `is_active=true` — no draft row was left behind (acceptance criterion satisfied).
- **Seven seed keys confirmed:** anon select on `site_content` returned exactly the seven keys — `hero_title`, `hero_subtitle`, `hero_cta`, `our_story_body`, `email`, `instagram_url`, `youtube_url`.
- **Admin draft read intact:** `products_admin_write` FOR ALL policy left untouched (admins still read drafts); full proof deferred to Plan 05 as planned.

All four `must_haves.truths` are satisfied:
1. A draft product is unreachable via a raw anon PostgREST select that omits `is_active` — PROVEN (soap-charcoal absent from the 27-row anon result).
2. Admin session still reads drafts — admin FOR ALL policy unmodified (proof in Plan 05).
3. site_content contains the seven rows — confirmed.
4. Re-running 0006 does not overwrite owner edits — guaranteed by `on conflict (key) do nothing`.

## Decisions Made

None beyond the plan — followed D-14 (CR-01 RLS tightening) and D-18 (idempotent site_content seed) as specified. The decision to leave `products_admin_write` untouched is the explicit regression guard T-04-02.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The blocking checkpoint was the intended pause for the live push; the orchestrator performed the push and verification and the user approved.

## User Setup Required

None - no new external service configuration required. The push targeted the already-linked Supabase project; no new env vars introduced.

## Next Phase Readiness

- The live database now enforces draft isolation at the RLS layer, so **Plan 05** (admin product list + ADMIN-08 draft/published toggle) can rely on real server-side security, not UI hiding.
- `site_content` holds the seven editable keys, so **Plans 06/07** (site-content editor, ADMIN-05/06) and the **D-20 public `useSiteContent` rewire** have data to read.
- No blockers. Admin-sees-drafts will be fully exercised in Plan 05.

## Self-Check: PASSED

- FOUND: supabase/migrations/0005_cr01_products_public_read.sql
- FOUND: supabase/migrations/0006_seed_site_content.sql
- FOUND: .planning/phases/04-admin-portal-catalog-content-management/04-01-SUMMARY.md
- FOUND: commit 985b93a (Task 1)
- FOUND: commit 567c179 (Task 2)

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*
