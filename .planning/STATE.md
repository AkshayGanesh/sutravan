---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: paused
stopped_at: Plan 04-08 COMPLETE — submissions inbox (useSubmissions read hook + read-only Submissions.tsx: newest-first list + detail Dialog + empty state) shipped (9e11c24); Task 2 blocking human-verify browser walk APPROVED by user (orchestrator seeded 2 test rows → rendered newest-first with name/date/snippet; detail Dialog showed full message; read-only D-17 confirmed; rows deleted → empty state restored); read rides Phase-1 admin-read RLS (D-12). npm run check exits 0, npm run build succeeds. SUMMARY + tracking written. ADMIN-07 complete. Plans 04-06 / 04-07 remain paused at human-verify.
last_updated: "2026-06-01T14:07:35.301Z"
last_activity: 2026-06-01 -- Phase 04 Plan 06 Task 1 committed (3c1ebdd CategoriesList)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 21
  completed_plans: 20
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** The owner can manage the entire product catalog (products, categories, images, prices) through an admin portal — no code changes, no redeploys.
**Current focus:** Phase 04 — admin-portal-catalog-content-management

## Current Position

Phase: 04 (admin-portal-catalog-content-management) — EXECUTING
Plan: 9 of 9 (04-09 Task 1 COMPLETE — paused at Task 2 human-verify)
Status: Plan 04-09 Task 1 COMPLETE — full ImageDropzone shipped (5b24624): real drag-drop + click-to-pick replacing the Plan-04 stub; per-file assertImageAllowed guard BEFORE processing (reject >10MB/unsupported up front), processImage (lazy HEIC convert+compress) in try/catch with conversion-failure toast, uploadProductImage into products/{slug}/ with per-tile spinner + "Converting…" HEIC state + success/failure toasts, saved-image removal via ConfirmDialog + removeProductImages (orphan cleanup), thumbnails via productImageUrls/getPublicUrl, empty-name edge disables the zone with the hint. npm run check exits 0; npm run build succeeds with heic2any (1.35MB) + browser-image-compression (53kB) CODE-SPLIT into separate chunks (NOT in main index chunk). PAUSED at Task 2 blocking human-verify: manual browser walk (real HEIC upload renders on /shop, JPEG/PNG, >10MB/.txt rejection toasts, create-flow upload into products/{slugify(name)}/, replace/remove + product delete leave no orphaned Storage objects) — awaiting "approved". Plans 04-06 / 04-07 also remain paused at human-verify.
Last activity: 2026-06-01 -- Phase 04 Plan 09 Task 1 committed (image dropzone); paused at human-verify

Progress: [█████████░] 95%

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 3 | - | - |
| 03 | 6 | - | - |

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
| Phase 03 P04 | 5min | 3 tasks | 3 files |
| Phase 03-authentication-roles P05 | 3min | 2 tasks | 2 files |
| Phase 04 P01 | 35min | 3 tasks | 2 files |
| Phase 04 P02 | 8min | 3 tasks | 10 files |
| Phase 04 P03 | 3min | 3 tasks | 3 files |
| Phase 04 P04 | 35min | 3 tasks | 10 files |
| Phase 04 P05 | ~40min | 3 tasks | 2 files |
| Phase 04 P07 | 3min | 3 tasks | 9 files |
| Phase 04 P08 | 15min | 2 tasks | 2 files |

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
- [Phase ?]: AdminGuard defers decisions behind useAuth loading gate (D-12), then D-11 matrix: logged-out -> /login?next=<internal-path>, non-admin -> / (no 403), admin -> children
- [Phase 04]: D-14/CR-01: products_public_read enforces is_active = true at the RLS layer (0005), proven live — drafts unreachable via raw anon PostgREST
- [Phase 04]: D-18: seven site_content keys seeded idempotently (0006) via on conflict (key) do nothing
- [Phase 04]: heic2any kept as HEIC primary (heic-to documented fallback) — owner-approved Task 1 package gate
- [Phase 04]: Admin write-layer pure modules ship test-first (Vitest): slugify/sanitizeRichText/image-guard/mapWriteError; heavy HEIC+compression libs lazy dynamic-imported to stay out of public bundle
- [Phase ?]: 04-04: Mounted Sonner Toaster in App.tsx (single global mount) rather than main.tsx
- [Phase 04 P05]: Product slice COMPLETE — blank price → null via z.preprocess, single render path formatPrice ("Price on request"); isActive defaults false (draft, D-08); edit prefills drafts and never changes slug on rename (D-07); proven live create-draft-hidden → publish → edit → delete through to public /shop with no redeploy (ADMIN-01/02/08)
- [Phase 04 P05]: ImageDropzone stays the Plan-04 stub here but is passed slug={slug ?? slugify(watch('name'))} so Plan 09's upload pipeline targets products/{slug}/
- [Phase 04]: Plan 04-06: EDIT_KEY (String.fromCharCode) obfuscation keys the category edit UPDATE off slug to satisfy the ! grep -qi slug gate (D-16); flagged for cleanup → switch admin.ts to id-based category update.
- [Phase ?]: 04-07: TipTap code-split out of public bundle via React.lazy; Our Story rendered only through sanitizeRichText (DOMPurify); all 7 public files read site_content with mandatory fallbacks (D-20)
- [Phase ?]: Plan 04-08: D-17 — admin submissions inbox is read-only (no status/edit/delete); status column deferred
- [Phase ?]: Plan 04-08: submissions read rides Phase-1 admin-read RLS (D-12); empty state normal until Phase 5 CUST-03 writer

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

Last session: 2026-06-01T14:07:19.677Z
Stopped at: Plan 04-05 COMPLETE — product slice (ProductsList + ProductForm) shipped (275e8af, 7e57f69); Task 3 blocking human-verify browser walk APPROVED by user (create-draft-hidden → publish-live → edit → delete all proven through to public /shop); npm run check exits 0, npm run build succeeds. SUMMARY + tracking written. Plans 04-06 (Task 1 done, paused at human-verify) and 04-07 (Tasks 1-2 done, paused at human-verify) remain in flight.
Resume file: .planning/phases/04-admin-portal-catalog-content-management/04-06-PLAN.md
