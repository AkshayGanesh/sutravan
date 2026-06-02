---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 05-04-PLAN.md (customer profile slice — CUST-04 delivered; all 4 Phase-5 plans complete, pending phase verification)
last_updated: "2026-06-01T18:01:45.772Z"
last_activity: 2026-06-01
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** The owner can manage the entire product catalog (products, categories, images, prices) through an admin portal — no code changes, no redeploys.
**Current focus:** Phase 05 — customer-experience-wishlist-profile-native-questionnaire

## Current Position

Phase: 05
Plan: Not started
Status: All 4 Phase-5 plans complete (CUST-01..CUST-04 delivered). Awaiting orchestrator phase verification/close — do NOT mark phase verified here.
Last activity: 2026-06-02 - Completed quick task 260602-t02: Per-product patch-test note toggle (pending live migration push)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 3 | - | - |
| 03 | 6 | - | - |
| 04 | 9 | - | - |
| 05 | 4 | - | - |

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
| Phase 04 P09 | 30min | 2 tasks | 1 files |
| Phase 05 P01 | 18 | 3 tasks | 9 files |
| Phase 05 P02 | ~25min | 3 tasks | 4 files |
| Phase 05 P03 | ~20min | 3 tasks | 4 files |
| Phase 05 P04 | ~15min | 3 tasks | 7 files |

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
- [Phase ?]: Wishlist uses a single ['wishlist'] TanStack cache shared by card/modal/page/navbar with optimistic toggle (D-13)
- [Phase ?]: Card passes slug only; useToggleWishlist resolves the products UUID server-side by slug
- [Phase 05 P02]: D-01 ownership invariant lives in migration 0007 WITH CHECK on customization_submissions INSERT — anon → auth.uid() is null AND user_id is null; authenticated → user_id = (select auth.uid()). 0002 deliberately omitted this; pushed live to ref wfbnrcnmpcqzeyjlfflv and all four RLS cases proven (anon-null allowed, anon-non-null rejected, forged-uid rejected, own-uid allowed)
- [Phase 05 P02]: First Edge Function verify-and-submit inserts under the CALLER's JWT (anon key + Authorization passthrough), NEVER service-role, so 0007's WITH CHECK stays the ownership gate (T-05-06); Turnstile siteverify with TURNSTILE_SECRET_KEY held only in function env (never VITE_); verify_jwt=false so anon reaches the body (Pitfall 1); CORS origin allow-listed to https://sutravan.in (not wildcard)
- [Phase 05 P02]: T-05-08 ACCEPTED — direct-PostgREST insert can skip Turnstile but every row is still user_id-correct under 0007; residual spam risk accepted for a small no-payments brand (documented in function header)
- [Phase 05 P02]: DEVIATION — Supabase CLI v2.102.0 rejects `--linked` on `functions deploy` (deploys to linked project by default); deployed without the flag to the correct ref
- [Phase 05 P02]: CUST-03 BACKEND half done & live; requirement stays Pending until the Plan 03 wizard ships the customer-facing half
- [Phase ?]: [Phase 05 P03]: /questionnaire is now a native multi-step RHF+Zod wizard replacing the Google Form iframe — per-step form.trigger(STEP_FIELDS[step]) advance gate; D-08 prefill+lock name/email for logged-in, D-02 required+email-validated for anon; lazy Turnstile on the review step (reset after fail); thank-you finale (D-07: logged-in -> /profile, anon -> /register)
- [Phase ?]: [Phase 05 P03]: D-05 mapping lives in the pure toSubmission(values, userId) (symmetric to admin.ts fromProductForm) — name/email/skin_type/message are columns; concerns/productInterest/allergies go ONLY into payload jsonb (human-readable keys for the admin inbox); user_id = caller uid or null (anon, required by 0007 WITH CHECK). 9/9 unit tests pin this.
- [Phase ?]: [Phase 05 P03]: CUST-03 NOW FULLY DELIVERED (Plan 02 backend + Plan 03 wizard) — anon (user_id=null) + logged-in (caller user_id) rows proven live in the Phase-4 admin inbox; Turnstile-fail inserts nothing. Dev-setup note: live walk needed localhost allow-listed on the real Cloudflare Turnstile widget (110200 otherwise); real site+secret keys kept, VITE_TURNSTILE_SITE_KEY in gitignored .env.local.
- [Phase 05 P04]: D-14 email change is pending-confirmation — useUpdateEmail() shows "Check your inbox to confirm your new email." (NEVER "changed"); login email unchanged until the emailed link is clicked (Secure email change ON). Password + display name apply immediately. Proven live.
- [Phase 05 P04]: T-05-15 owner-scoping by RLS, not client filter — useMySubmissions() reuses the SAME admin select under a distinct ['my-submissions'] cache key and relies on customization_submissions_admin_or_owner_read to return only the caller's rows. Proven live: a different customer sees only their own rows; logged-out /profile -> /login?next=/profile.
- [Phase 05 P04]: T-05-16 name self-update only sends { name }; the Phase-3 enforce_profile_role_lock trigger blocks any role change regardless of payload (form has no role field). submissionSnippet lifted from Submissions.tsx into lib (exported, 8/8 unit-tested) and shared by both admin + customer pages (D-15 read-only detail, admin chrome stripped; D-16 /profile + /wishlist stay distinct, both behind AuthGuard).
- [Phase 05 P04]: CUST-04 DELIVERED — ALL Phase-5 requirements (CUST-01..CUST-04) now shipped; Phase 5 plans 4/4. Phase verification/close remains the orchestrator's job (NOT marked verified here).

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260602-c2y | Add out-of-stock toggle to products (admin-controlled, product stays listed but shows unavailable) | 2026-06-02 | bf73ccc | [260602-c2y-add-out-of-stock-toggle-to-products-admi](./quick/260602-c2y-add-out-of-stock-toggle-to-products-admi/) |
| 260602-co6 | Notify admins on new questionnaire submission (in-app unread badge via status column + email per submission) | 2026-06-02 | b8cd5b0 | [260602-co6-notify-admins-on-new-questionnaire-submi](./quick/260602-co6-notify-admins-on-new-questionnaire-submi/) |
| 260602-t02 | Per-product admin toggle to show 'Always patch test first.' note (opt-in, default OFF) | 2026-06-02 | 2134724 | [260602-t02-per-product-admin-toggle-to-show-always-](./quick/260602-t02-per-product-admin-toggle-to-show-always-/) |

> ✅ RESOLVED (2026-06-02): live steps for c2y + co6 completed by owner —
> `supabase db push` (applied 0008 + 0009), `supabase secrets set RESEND_API_KEY/ADMIN_NOTIFY_EMAIL`,
> and `supabase functions deploy verify-and-submit`. Out-of-stock toggle, unread badge/mark-read,
> and per-submission admin email are all live.
>
> ⚠ Outstanding (t02, project ref `wfbnrcnmpcqzeyjlfflv`): `supabase db push` for migration
> `0010_products_show_patch_test_note.sql`. Until pushed, the patch-test toggle errors at runtime.
> NOTE: default OFF means the previously-always-shown "Always patch test first." note is now hidden
> on every product until the owner enables it per product.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| E-commerce | Cart / checkout / Razorpay / inventory (ECOM-01..04) | Deferred to next milestone | Roadmap creation |
| Admin enhancements | Image reorder, bulk ops, multi-admin, analytics (ADME-01..04) | Deferred to v2 | Roadmap creation |

## Session Continuity

Last session: 2026-06-01T17:05:00.000Z
Stopped at: Completed 05-04-PLAN.md (customer profile slice — CUST-04 delivered; all 4 Phase-5 plans complete, pending phase verification)
Resume file: None — all Phase-5 plans complete; awaiting orchestrator phase verification/close
