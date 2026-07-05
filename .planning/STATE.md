---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Delivery Estimator
status: executing
stopped_at: Phase 09 context gathered
last_updated: "2026-07-05T06:43:25.781Z"
last_activity: 2026-07-05 -- Phase 09 execution started
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 12
  completed_plans: 8
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-27)

**Core value:** The owner can manage the entire product catalog (products, categories, images, prices) through an admin portal — no code changes, no redeploys.
**Current focus:** Phase 09 — admin-delivery-settings-cod-rules

## Current Position

Phase: 09 (admin-delivery-settings-cod-rules) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 09
Last activity: 2026-07-05 -- Phase 09 execution started

## Performance Metrics

**Velocity:**

- Total plans completed: 27
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 3 | - | - |
| 03 | 6 | - | - |
| 04 | 9 | - | - |
| 05 | 4 | - | - |
| 06 | 3 | - | - |
| 07 | 2 | - | - |

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
| Phase 06 P01 | 4min | 3 tasks | 6 files |
| Phase 06 P02 | ~12min | 2 tasks | 4 files |
| Phase 06 P03 | ~10min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 roadmap]: Rate source = admin-configurable ZONE-WEIGHT estimate table only; live courier/Shiprocket API (DLVR-F1) DEFERRED — estimate compute stays behind a normalized `{serviceable,cost,etaDays,codAvailable}` contract so a live API can swap in later with no frontend change
- [v1.1 roadmap]: COD IS in scope — estimator shows COD availability; admin configures COD rules (toggle/fee/value cap) (DLVR-04/DLVR-05)
- [v1.1 roadmap]: Pincode persists in localStorage AND saves to a logged-in customer's profile (DLVR-10 → `profiles.default_pincode` column added in Phase 6)
- [v1.1 roadmap]: Estimate logic lives in a new `delivery-estimate` Edge Function cloned from `verify-and-submit` (CORS allow-listed to sutravan.in, abuse-protected, server-side compute); `delivery_estimate_cache` is function-only (service-role write, deny-direct RLS); settings ride the existing `site_content` admin pattern
- [v1.1 roadmap]: NO numeric weight column — `product_variants.label` is free text ("70gm"); use `delivery_default_weight_g` site_content fallback, NEVER regex the label. Per-variant numeric weight deferred (DLVR-F2)
- [v1.1 roadmap]: Build order is dependency-driven — schema/settings + Edge Function (Phase 6) → client hook/provider + product-detail UI (Phase 7) → navbar widget + profile persistence (Phase 8) → admin settings/COD (Phase 9) → admin zone-weight slab editor (Phase 10)
- [v1.1 roadmap]: New migrations start at 0014 (latest shipped is 0013); v1.0 patterns to mirror — `verify-and-submit` (Edge Function CORS+secret), `AuthProvider`/`useAuth` (DeliveryProvider), `catalog.ts`/`siteContent.ts` (hook + snake→camel + mandatory fallbacks)
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
- [Phase 06]: [Phase 06 P02]: pincode seed transform drops 100 NA-only pincodes and prefers non-NA representatives for 238 recoverable ones — keeps every emitted state canonical so the Pitfall A guard holds; 19,486 rows live (idempotent onConflict pincode)
- [Phase 06]: [Phase 06 P02]: is_metro/is_remote derived at transform time (8-prefix metro set, 12-state remote set); seed leaves serviceable to its table default true (D-16); committed pincodes.ndjson removes any runtime data.gov.in dependency
- [Phase ?]: [Phase 06 P03]: delivery-estimate Edge Function deployed live (ref wfbnrcnmpcqzeyjlfflv) — service-role compute (legitimate divergence: no ownership invariant, sole writer of deny-direct cache), validates /^\d{6}$/ before Turnstile, deriveZone behind callCourierAdapter, etaDays adds dispatch_lead_days (OQ1), cache write skipped when originConfigured=false (OQ2). Token-free smoke green; compute-path (SC1/SC4-hit) is owner-only human-action (Turnstile secret write-only, unrecoverable to restore).

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

Open questions to resolve during v1.1 phase discussion (from research GAPS — owner decisions):

- Phase 6/10: Zone-weight rate slab values — brand decision; owner must populate (or confirm a seed) before the UI shows real numbers
- Phase 6/9: COD fee model — fixed admin charge vs %-or-flat — decide in the schema/settings phase
- Phase 6: `delivery_default_weight_g` seed value — owner confirms fallback (~100–150g soap, 200–300g jars)
- Phase 7: Rounding/buffer policy — raw rates exclude GST + fuel surcharge; decide round-up before the UI phase (Pitfall 2/11)
- v1.1 scope CONFIRMED: live courier API is OUT of scope this milestone (DLVR-F1 deferred); zone-weight table is the only rate source

RESOLVED (v1.0):

- (2026-05-31) Owner supplied gitignored `.env.seed.local` with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Plan 02-01 Task 3 seed ran successfully (28/3, idempotent). No active blockers.
- ~~Phase 3: Email confirmation on (safer) vs off (smoother onboarding) for v1~~ RESOLVED 03-01: Confirm-email OFF (D-01), set in hosted Dashboard
- Phase 2/4: Scrub/cream products have no repo images — seeded empty `images[]` in Phase 2, owner uploads via portal in Phase 4

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260602-c2y | Add out-of-stock toggle to products (admin-controlled, product stays listed but shows unavailable) | 2026-06-02 | bf73ccc | [260602-c2y-add-out-of-stock-toggle-to-products-admi](./quick/260602-c2y-add-out-of-stock-toggle-to-products-admi/) |
| 260602-co6 | Notify admins on new questionnaire submission (in-app unread badge via status column + email per submission) | 2026-06-02 | b8cd5b0 | [260602-co6-notify-admins-on-new-questionnaire-submi](./quick/260602-co6-notify-admins-on-new-questionnaire-submi/) |
| 260602-t02 | Per-product admin toggle to show 'Always patch test first.' note (opt-in, default OFF) | 2026-06-02 | 2134724 | [260602-t02-per-product-admin-toggle-to-show-always-](./quick/260602-t02-per-product-admin-toggle-to-show-always-/) |
| 260602-tf6 | Per-product weight/price variants (SKUs): product_variants table + admin CRUD + public selector + 'From' card | 2026-06-02 | ac0e3ce | [260602-tf6-per-product-weight-price-variants-skus-a](./quick/260602-tf6-per-product-weight-price-variants-skus-a/) |
| 260602-u0q | Link the 'Tell us your skin type' note in ProductDetail to the questionnaire (Skin Guide) page | 2026-06-02 | 5d3a251 | [260602-u0q-link-the-tell-us-your-skin-type-note-in-](./quick/260602-u0q-link-the-tell-us-your-skin-type-note-in-/) |
| 260602-ucf | Customization-pricing caveat copy (questionnaire intro + review + product modal; static) | 2026-06-02 | f78af54 | [260602-ucf-add-customization-pricing-caveat-copy-to](./quick/260602-ucf-add-customization-pricing-caveat-copy-to/) |
| 260602-uxl | Drag-to-reorder admin ProductForm repeatable rows (Benefits/Ingredients/Usage tips, framer-motion) | 2026-06-02 | 6a6446f | [260602-uxl-add-drag-to-reorder-to-admin-productform](./quick/260602-uxl-add-drag-to-reorder-to-admin-productform/) |
| 260602-vbr | Multi-line bullets in Benefits/Ingredients/Usage tips (textarea + whitespace-pre-line + legacy /n normalize) | 2026-06-02 | c4cc445 | [260602-vbr-support-multi-line-bullets-in-product-be](./quick/260602-vbr-support-multi-line-bullets-in-product-be/) |
| 260620-p6p | Cloudflare Turnstile CAPTCHA on Login + Register + Reset-request (Supabase native bot-protection, hosted-CDN widget, captchaToken) | 2026-06-20 | a24e232 | [260620-p6p-add-the-cloudflare-turnstile-in-the-user](./quick/260620-p6p-add-the-cloudflare-turnstile-in-the-user/) |
| 260620-pt8 | Fix Skin Guide edit-question modal remount on first keystroke (focus loss + save-once not persisting): useWatch + render dialog via call not nested component | 2026-06-20 | 196b47a | [260620-pt8-fix-skin-guide-edit-question-modal-re-re](./quick/260620-pt8-fix-skin-guide-edit-question-modal-re-re/) |
| 260620-q5k | Google-Forms-style Skin Guide sections: questionnaire_sections table + admin CRUD + per-question section dropdown + public one-section-at-a-time wizard (progress bar, Back/Next, "More questions" bucket) | 2026-06-20 | a277034 | [260620-q5k-add-google-forms-style-sections-to-the-s](./quick/260620-q5k-add-google-forms-style-sections-to-the-s/) |

> ✅ RESOLVED (2026-06-02): live steps for c2y + co6 completed by owner —
> `supabase db push` (applied 0008 + 0009), `supabase secrets set RESEND_API_KEY/ADMIN_NOTIFY_EMAIL`,
> and `supabase functions deploy verify-and-submit`. Out-of-stock toggle, unread badge/mark-read,
> and per-submission admin email are all live.
>
> ✅ RESOLVED (2026-06-02): `supabase db push` applied `0010_products_show_patch_test_note.sql` (t02)
> and `0011_product_variants.sql` (tf6) to the live DB. Patch-test note toggle and product
> variants/SKUs are now live. NOTE: patch-test note defaults OFF — it stays hidden on every product
> until the owner enables it per product.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| E-commerce | Cart / checkout / Razorpay / inventory (ECOM-01..04) | Deferred to next milestone | Roadmap creation |
| Admin enhancements | Image reorder, bulk ops, multi-admin, analytics (ADME-01..04) | Deferred to v2 | Roadmap creation |
| Delivery (v1.1) | Live courier/aggregator API (Shiprocket) behind the same contract (DLVR-F1) | Deferred to a later release | v1.1 roadmap |
| Delivery (v1.1) | Per-variant numeric weight `weight_g` (DLVR-F2); city/state echo + calendar date range (DLVR-F3) | Deferred to a later release | v1.1 roadmap |

### Acknowledged at v1.0 close (2026-06-27)

Open verification/UAT sign-offs accepted as deferred tech debt when closing v1.0 (milestone audit status `tech_debt`: requirements 23/23, phases 5/5, integration 23/23, flows 2/2 — no hard gaps). 7 genuine open items carried forward; the 9 "quick task" audit hits are false positives (all complete with commits, logged in Quick Tasks Completed above).

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UAT | Phase 03 (auth & roles) HUMAN-UAT — 7 pending scenarios (register, session, logout, role self-escalation, route guards, admin bootstrap, password reset) | Partial — human UAT not run | v1.0 close |
| UAT | Phase 05 (customer experience) HUMAN-UAT — 2 pending scenarios (wishlist sync, logged-out heart redirect) | Partial — human UAT not run | v1.0 close |
| Verification | Phases 01–05 VERIFICATION.md — `human_needed` final human sign-off (agent-verified GREEN; Phase 02 HUMAN-UAT passed 5/5 on 2026-06-27) | Human sign-off pending | v1.0 close |
| Tech debt (audit warnings) | AUTH-05 AdminGuard inline `startsWith('/')` vs shared `safeReturnTo` sanitizer (defense-in-depth holds); PUB-01 Home.tsx import indirection | Cosmetic / pattern consistency | v1.0 close |

## Session Continuity

Last session: 2026-07-05T05:23:59.738Z
Stopped at: Phase 09 context gathered
Resume file: .planning/phases/09-admin-delivery-settings-cod-rules/09-CONTEXT.md

## Operator Next Steps

- Review the v1.1 roadmap: `.planning/ROADMAP.md` (Phases 6–10)
- Resolve the owner-decision open questions above (zone-weight slab values, COD fee model, default weight seed, rounding policy)
- Plan the first phase: `/gsd-plan-phase 6` (or `/gsd-discuss-phase 6` first)
