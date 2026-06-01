# Roadmap: Earthen Luxury Sutravan — Admin CMS + Supabase Backend

## Overview

This milestone turns a static, code-managed React/Vite showcase into a self-managed product backed by Supabase (Postgres + Auth + Storage). The journey is strictly dependency-driven: first stand up the Supabase foundation with the schema and Row Level Security that every other capability depends on; then migrate the 68 existing products and soap images into Supabase and rewire the public Shop to read live data (delivering owner/visitor value before any login exists); then add auth and the admin/customer role model; then build the admin portal that is the milestone's core value (catalog, content, and submissions management); and finally the customer-facing features (wishlist, profile/history, native questionnaire). Security — RLS, service-role key handling, secure role assignment — is woven through every phase rather than bolted on at the end. E-commerce (cart, checkout, payments) is explicitly deferred to a later milestone.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Supabase Foundation — Schema, RLS & Storage** - Live Supabase project with all tables, default-deny RLS, `is_admin()`, Storage buckets, and the client singleton; dead Express/Drizzle scaffolding removed (completed 2026-05-31)
- [x] **Phase 2: Live Catalog — Data Migration & Public Shop Rewire** - 68 products + soap images migrated into Supabase, and the public Shop/Home/ProductDetail read live data (no login required) (completed 2026-05-31)
- [x] **Phase 3: Authentication & Roles** - Customers can register/log in/log out across sessions; admin vs customer roles enforced in the database; admin routes protected (completed 2026-06-01)
- [x] **Phase 4: Admin Portal — Catalog & Content Management** - Owner manages products, prices, images, categories, site content, and visibility, and views customization submissions — no code, no redeploy (completed 2026-06-01)
- [ ] **Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire** - Logged-in customers can save products, view their profile and submission history, and submit a native questionnaire that lands in the admin inbox

## Phase Details

### Phase 1: Supabase Foundation — Schema, RLS & Storage

**Goal**: A working Supabase project is wired to the app with the full database schema, correct default-deny Row Level Security on every table, the `is_admin()` authorization helper, and Storage buckets — the secure foundation everything else builds on.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-04
**Success Criteria** (what must be TRUE):

  1. The app boots against a live Supabase project using only `VITE_SUPABASE_URL` + the anon key, with the service-role key kept local and absent from any `VITE_`-prefixed var or the built bundle
  2. All tables (`products`, `categories`, `site_content`, `customization_submissions`, `profiles`, `wishlists`) exist via versioned migrations with RLS enabled and default-deny — an unauthenticated client can read public catalog tables but cannot write to any table
  3. The `is_admin()` helper exists as a `plpgsql` SECURITY DEFINER function with `search_path` locked, and is callable without triggering recursive-policy errors on `profiles`
  4. The `product-images` (and `site-content`) Storage bucket(s) exist with public read and admin-only write policies on `storage.objects`
  5. The unused Express + Drizzle + Passport scaffolding (`server/`, `shared/schema.ts`, `drizzle.config.ts`) is removed and the app still builds and runs

**Plans**: 3 plansPlans:
**Wave 1**

- [x] 01-01-PLAN.md — Remove dead Express/Drizzle/Passport stack, rewire config, add Supabase client singleton + validation scaffolds (DATA-01, DATA-04)
- [x] 01-02-PLAN.md — Author versioned migrations: six tables, non-recursive is_admin(), default-deny RLS, Storage buckets + RLS assertion test (DATA-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Create live project (checkpoint), push migrations [BLOCKING], prove walking skeleton + RLS invariants live (DATA-01, DATA-02)

> **Open question (surface during discussion):** Email confirmation on vs off is decided in Phase 3, but auth-related Supabase config (Site URL / redirect allowlist) should be noted here since the project is created in this phase. Storage `storage.objects` policy syntax is flagged VERIFY in research — confirm against current Supabase docs before writing the migration.

### Phase 2: Live Catalog — Data Migration & Public Shop Rewire

**Goal**: The existing catalog lives in Supabase and the public site renders it live — proving the no-redeploy promise and delivering value before any authentication exists.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-03, PUB-01, PUB-02
**Success Criteria** (what must be TRUE):

  1. A one-time seed script run locally with the service-role key inserts all 28 products (13 soap + 10 scrub + 5 cream) and their 3 categories into Supabase, uploads the existing soap images to the `product-images` bucket, and records storage paths on the rows (scrub/cream rows seeded with empty `images[]`)
  2. The seed is idempotent (upsert on slug) — re-running it yields 28 rows, not duplicates — and RLS stays enabled throughout
  3. The public Shop reads live products and categories from Supabase via TanStack Query, with working loading, empty, and error states and no UX regression versus the static file
  4. The product detail view renders entirely from Supabase data and only shows published (`is_active`/visible) products to the public
  5. The static `client/src/data/products.ts` dependency is removed from the runtime read path once parity is verified

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Seed slice: glob-free catalog metadata + idempotent service-role seed + anon verify (28 products / 3 categories, soap images to Storage) (DATA-03, PUB-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — Live read-layer foundation: formatPrice + catalog.ts hooks (server-side is_active filter, snake->camel mapper, getPublicUrl image helper) + products.ts glob removal/type adapt (PUB-01, PUB-02)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — Public read-path rewire: Shop/Home/ProductGrid/ProductCard/ProductDetail consume live hooks with loading/empty/error states; static array off runtime path (PUB-01, PUB-02)

**UI hint**: yes

> **Open question (surface during discussion):** Scrub/cream products have no repo images — they are seeded with empty `images[]` here and the owner uploads imagery via the admin portal in Phase 4. Confirm the migration handles the currently-empty `price` fields (seed blank vs placeholder).

### Phase 3: Authentication & Roles

**Goal**: Users can create accounts and sign in securely, and the admin-vs-customer distinction is enforced in the database — establishing the trust boundary that gates the admin portal and all customer features.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):

  1. A visitor can register with email and password, and a `profiles` row (defaulting to the `customer` role) is auto-created for them
  2. A user can log in and remain logged in across browser sessions/refreshes, and can log out from any page
  3. Roles are stored server-side in `profiles` (never in user-editable metadata); a non-admin authenticated user holding the anon key is rejected by RLS on every catalog/content write attempt
  4. Admin portal routes redirect non-admins away and are reachable only by an admin (UX guard backing the RLS enforcement)
  5. The first admin is bootstrapped out-of-band (not via any self-serve UI path), and an admin account can reach the protected area

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — DB foundation: migration 0004 (name column + handle_new_user trigger + role-lock trigger), psql assertion harness, `supabase db push` [BLOCKING], hosted Auth config (Confirm-email OFF + redirect allowlist) (AUTH-01, AUTH-04)
- [x] 03-02-PLAN.md — Auth-state layer: AuthProvider + useAuth (loading gate, session persistence) + authErrors mapper, mounted in App.tsx (AUTH-02, AUTH-05)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-03-PLAN.md — Register/login/logout slice: Register + Login pages, Navbar account menu, /login + /register routes (AUTH-01, AUTH-02, AUTH-03)
- [x] 03-06-PLAN.md — First-admin bootstrap: idempotent service-role promote-admin script (out-of-band, no UI path) (AUTH-04, AUTH-05)

**Wave 3** *(blocked on Wave 1, Wave 2)*

- [x] 03-04-PLAN.md — Admin guard slice: AdminGuard (loading gate + D-11 redirects + return-to) + empty /admin shell + guarded /admin/* route (AUTH-05)

**Wave 4** *(blocked on Wave 1, Wave 3)*

- [x] 03-05-PLAN.md — Password reset round-trip: ResetPassword page (implicit flow, sub-path aware) + /reset-password route (AUTH-02)

**UI hint**: yes

> **Open questions (resolved in 03-CONTEXT.md):** (1) First admin bootstrap → local `scripts/promote-admin.ts` service-role script (D-03, Plan 06). (2) Email confirmation → OFF (D-01, Plan 01); password reset IS in scope (D-02, Plan 05) with Site URL/redirect-allowlist config for the GitHub Pages sub-path set in Plan 01. Auth setting names + email rate limit verified in 03-RESEARCH.md.

### Phase 4: Admin Portal — Catalog & Content Management

**Goal**: The owner can manage the entire catalog and site content — products, prices, images, categories, visibility, contact/social links, page copy — and review customization submissions, all through a protected portal with no code changes or redeploys. This is the milestone's core value.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08
**Success Criteria** (what must be TRUE):

  1. An admin can create, edit, and delete products (name, subtitle, category, benefits, ingredients, tips, shelf life, batch note) and set/edit each product's price, with changes appearing on the live public Shop without a redeploy
  2. An admin can upload, replace, and remove product images stored in Supabase Storage, and can toggle a product's visibility (draft vs published) so unfinished products stay hidden from the public site
  3. An admin can create, edit, and delete categories (with in-use delete protection)
  4. An admin can edit site content (Our Story copy, homepage hero text) and contact details/social links (Instagram, YouTube, email), with edits reflected on the public site
  5. An admin can view customer customization submissions in an inbox; every destructive action has a confirm dialog and every write surfaces a success/error toast (non-negotiable for a non-technical owner)

**Plans**: 9 plans
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Migrations 0005 (CR-01 products_public_read -> is_active=true) + 0006 (site_content seed) + [BLOCKING] supabase db push + draft-isolation verify (ADMIN-05, ADMIN-06, ADMIN-08)
- [x] 04-02-PLAN.md — Pure-logic foundation + Vitest: slug, sanitizeHtml (DOMPurify), imagePipeline guard, adminErrors; package-legitimacy gate (ADMIN-01, ADMIN-03, ADMIN-04, ADMIN-05)

**Wave 2** *(blocked on Wave 1)*

- [x] 04-03-PLAN.md — Write data-layer lib/admin.ts (product/category/content CRUD + Storage + mandatory cache invalidation) + lib/siteContent.ts read hook (ADMIN-01..06, ADMIN-08)
- [x] 04-04-PLAN.md — Admin shell: AdminLayout (sidebar + slim header + logout) + ConfirmDialog + stub section pages + /admin/* routes + Sonner Toaster (ADMIN-01, ADMIN-04, ADMIN-05, ADMIN-07)

**Wave 3** *(blocked on Wave 2; parallel — distinct page files)*

- [x] 04-05-PLAN.md — Products slice: ProductsList (table + Published toggle + delete) + ProductForm (RHF+Zod, price, draft default, image slot) (ADMIN-01, ADMIN-02, ADMIN-08)
- [x] 04-06-PLAN.md — Categories slice: create/edit/delete with auto-hidden slug + in-use delete protection (ADMIN-04)
- [x] 04-07-PLAN.md — Site content slice: editor (plain fields + lazy TipTap rich text) + D-20 rewire of 7 public components + safe Our Story render (ADMIN-05, ADMIN-06)
- [x] 04-08-PLAN.md — Submissions inbox: read-only list + detail + empty state via admin-read RLS (ADMIN-07)

**Wave 4** *(blocked on Wave 3 — extends ProductForm)*

- [x] 04-09-PLAN.md — Image management: full ImageDropzone (drag-drop, HEIC convert+compress, upload/replace/remove, progress, orphan cleanup) (ADMIN-03)

**UI hint**: yes

> **Open question (surface during discussion):** Scrub/cream imagery (seeded empty in Phase 2) is uploaded by the owner here — plan an initial onboarding task list. Image-upload UX (drag-drop, HEIC/JPEG/PNG, size validation, progress) is flagged in research as needing careful component design and likely iteration.

> **Deferred from Phase 2 (CR-01, must-do before ADMIN-08 ships draft rows):** The `products_public_read` RLS policy (`supabase/migrations/0002_rls_policies.sql`) currently uses `using (true)`; the `is_active` published-only gate (PUB-02) is enforced only query-side in `catalog.ts`. This is safe today (no draft rows exist), but once this phase introduces the draft/published visibility toggle, a draft product would be reachable by any direct PostgREST call that omits the `is_active` filter. Add a migration tightening the policy to `using (is_active = true)` as part of the visibility work. Source: `.planning/phases/02-live-catalog-data-migration-public-shop-rewire/02-REVIEW.md`.

### Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire

**Goal**: Logged-in customers get immediate account value before checkout exists — saving products, viewing their profile and inquiry history — and submit a native customization questionnaire that replaces the Google Form and lands in the admin inbox.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4
**Requirements**: CUST-01, CUST-02, CUST-03, CUST-04
**Success Criteria** (what must be TRUE):

  1. A logged-in customer can save (wishlist) a product and view/manage their wishlist, with per-user RLS guaranteeing one customer can never read another's saved items
  2. A customer can submit a native customization questionnaire that saves to `customization_submissions` in Supabase (replacing the embedded Google Form) and appears in the admin inbox built in Phase 4
  3. A customer can view their profile and the history of their own customization submissions, scoped to their own rows only
  4. Anonymous visitors cannot read any wishlist or submission data, and no user can insert rows scoped to another user (WITH CHECK enforced on owner-scoped writes)

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Supabase Foundation — Schema, RLS & Storage | 3/3 | Complete   | 2026-05-31 |
| 2. Live Catalog — Data Migration & Public Shop Rewire | 3/3 | Complete    | 2026-05-31 |
| 3. Authentication & Roles | 6/6 | Complete    | 2026-06-01 |
| 4. Admin Portal — Catalog & Content Management | 9/9 | Complete    | 2026-06-01 |
| 5. Customer Experience — Wishlist, Profile & Native Questionnaire | 0/TBD | Not started | - |
