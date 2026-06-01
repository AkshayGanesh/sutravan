---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 03-01-PLAN.md — migration 0004 live, both psql harnesses green against the live DB, hosted Auth config (D-01 confirm-off + D-02 sutravan.in Site URL/reset redirect) set; config.toml corrected to the sutravan.in origin (9488e9f).
last_updated: "2026-06-01T01:24:10.573Z"
last_activity: 2026-06-01 -- 03-01 auth DB foundation complete (migration 0004 live)
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 12
  completed_plans: 10
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** The owner can manage the entire product catalog (products, categories, images, prices) through an admin portal — no code changes, no redeploys.
**Current focus:** Phase 03 — authentication-roles

## Current Position

Phase: 03 (authentication-roles) — EXECUTING
Plan: 6 of 6
Status: Ready to execute (03-01 + 03-02 complete)
Last activity: 2026-06-01 -- 03-01 auth DB foundation complete (migration 0004 live)

Progress: [█████████░] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 02 P01 | 3min | 3 tasks | 3 files |
| Phase 02 P02 | 12min | 3 tasks | 3 files |
| Phase 02 P03 | 3min | 4 tasks | 5 files |
| Phase 03 P02 | 4min | 3 tasks | 4 files |
| Phase 03 P01 | ~50min | 3 tasks | 3 files |
| Phase 03 P03 | 6min | 3 tasks | 4 files |
| Phase 03 P06 | ~1min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Supabase-direct architecture (drop Express/Drizzle) — security lives entirely in Postgres RLS
- Roadmap: Phase order is dependency-driven — foundation/RLS first, then live catalog (value before auth), then auth, then admin portal (core value), then customer features
- Roadmap: Role stored in `profiles.role` (never user-editable metadata); `is_admin()` is a `plpgsql` SECURITY DEFINER helper to avoid recursive RLS
- [Phase ?]: Catalog count is 28 products / 3 categories, not 68 — 68 referred to soap images (~84 jpgs); seed asserts 28/3
- [Phase ?]: Seed idempotent via upsert-on-slug; re-run converges to 28/3 with RLS enabled; service-role key stays in gitignored .env.seed.local, never bundled
- [Phase 02 P02]: PUB-02 published filter is server-side (.eq('is_active', true) in catalog.ts fetchProducts) — drafts never reach the client; never client-side hide
- [Phase 02 P02]: snake->camel mapping done ONCE at the catalog.ts data-layer boundary (toProduct/toCategory), not per component
- [Phase 02 P02]: Product.price changed string -> number | null; formatPrice() is the single render path (null -> "Price on request", 0 -> "₹0")
- [Phase 02 P02]: Storage image paths resolved only via getPublicUrl (encodes spaces/parens); empty images[] -> exactly one bundled category placeholder (D-03)
- [Phase ?]: Public read surfaces (Shop/Home/ProductGrid/ProductCard/ProductDetail) consume only catalog.ts TanStack Query hooks; static products.ts data array is off the runtime path
- [Phase ?]: Loading=skeleton grid mirroring real grid classes (no layout shift); error=inline message + Retry calling refetch(); featured=first published per category by sort_order (always up to 3)
- [Phase ?]: [Phase 03 P02]: useAuth returns { session, user, role, loading, signOut }; loading folds session+role gates so guards never decide early (D-12)
- [Phase ?]: [Phase 03 P02]: role read client-side from public.profiles for UX only; real boundary is server-side RLS (D-11/T-3-07); mapAuthError collapses invalid-credentials and email-not-found into one generic message (D-14)
- [Phase 03 P01]: migration 0004 — handle_new_user SECURITY DEFINER trigger auto-creates a role='customer' profile on signup (role hard-coded, never from raw_user_meta_data — D-05/T-3-03); no client INSERT policy on profiles (rows only via the trigger)
- [Phase 03 P01]: enforce_profile_role_lock BEFORE UPDATE trigger blocks role self-escalation, with a (select auth.uid()) is not null carve-out so the no-JWT service-role bootstrap can still promote an admin (D-04/Pitfall 4); name/email self-updates still allowed
- [Phase 03 P01]: deployed origin is the custom domain https://sutravan.in (build base '/'); hosted Auth config (runtime source of truth, not in git): Confirm-email OFF (D-01), Site URL https://sutravan.in, redirect allowlist includes exact https://sutravan.in/reset-password (D-02)
- [Phase ?]: [Phase 03 P03]: safeReturnTo() is the single open-redirect sanitizer — Login reads ?next= and rejects //-prefixed or ://-containing values to / (D-10); Plan 04 must redirect to /login?next=<internal-path>

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

RESOLVED:

- (2026-05-31) Owner supplied gitignored `.env.seed.local` with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Plan 02-01 Task 3 seed ran successfully (28/3, idempotent). No active blockers.

Open questions to resolve during phase discussion (from REQUIREMENTS.md):

- Phase 3: First admin bootstrap — manual dashboard role flip (recommended) vs seeded admin
- ~~Phase 3: Email confirmation on (safer) vs off (smoother onboarding) for v1~~ RESOLVED 03-01: Confirm-email OFF (D-01), set in hosted Dashboard
- Phase 2/4: Scrub/cream products have no repo images — seed empty `images[]` in Phase 2, owner uploads via portal in Phase 4

VERIFY items flagged in research (confirm against current Supabase docs before writing migrations):

- `storage.objects` RLS policy syntax (Phase 1)
- ~~Auth URL-config setting names + email rate limits (Phase 3)~~ RESOLVED 03-01: Site URL + Redirect URLs allowlist set in hosted Dashboard (https://sutravan.in + /reset-password); built-in email fine at <=2/hr for owner resets

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| E-commerce | Cart / checkout / Razorpay / inventory (ECOM-01..04) | Deferred to next milestone | Roadmap creation |
| Admin enhancements | Image reorder, bulk ops, multi-admin, analytics (ADME-01..04) | Deferred to v2 | Roadmap creation |

## Session Continuity

Last session: 2026-06-01T01:24:06.200Z
Stopped at: Completed 03-01-PLAN.md — migration 0004 live, both psql harnesses green against the live DB, hosted Auth config (D-01 confirm-off + D-02 sutravan.in Site URL/reset redirect) set; config.toml corrected to the sutravan.in origin (9488e9f).
Resume file: None — next is 03-03-PLAN.md (register/login/logout slice)
