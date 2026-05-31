# Project Research Summary

**Project:** Earthen Luxury Sutravan — Admin CMS + Supabase Backend + Auth
**Domain:** BaaS-direct (Supabase) on a static React/Vite SPA; skincare catalog CMS + customer accounts
**Researched:** 2026-05-31
**Confidence:** HIGH (stack/architecture/features); MEDIUM on a few PITFALLS syntax items marked VERIFY

## Executive Summary

Earthen Luxury Sutravan is a mature React 19 / Vite 7 static SPA on GitHub Pages whose catalog and content are entirely hardcoded. This milestone replaces that with a Supabase-direct backend: the frontend talks to Supabase (Postgres via PostgREST, Auth, Storage) using only the public anon key and the official JS client — there is no custom server, and the static-SPA deploy model is preserved. The recommended pattern is a "thick client" architecture where **Row Level Security is the only real authorization boundary** and all security decisions are SQL, not JavaScript.

The recommended approach is: one `@supabase/supabase-js` singleton, a thin `api/` data-access layer (no React), TanStack Query hooks wrapping that layer (already installed), `AuthProvider` context for session + role, and Wouter route guards for UX-only gating. All four research areas converge on the same dependency order: schema + RLS first, then auth, then admin CMS, then public-read rewire, then customer features. The existing frontend stack (shadcn/ui, react-hook-form, Zod, Sonner, TanStack Query) already covers every UI need; the only net-new runtime dependency is `@supabase/supabase-js`.

The dominant risk is **misconfigured RLS** — either no RLS (tables fully open to the anon key), recursive policies on the `profiles` table, or role stored where the user can edit it (`user_metadata`). Secondary risks are auth redirect URLs failing on GitHub Pages' sub-path and the service-role key leaking into the `VITE_`-prefixed env (which Vite bakes into the public bundle). Both risks are well-understood, have concrete mitigations, and must be addressed in the first phase before any admin write feature is built.

## Key Findings

### Recommended Stack

The existing frontend stack is complete and needs no changes. The only additions are: `@supabase/supabase-js ^2.106` (the one runtime dependency) as the isomorphic client for Postgres, Auth, and Storage, plus `supabase` CLI as a dev dependency for local stack, migrations, and type generation. Generated `Database` types fed into `createClient<Database>()` give end-to-end TypeScript coverage matching the project's strict config. The dead Express + Drizzle + Passport scaffolding (`server/`, `shared/schema.ts`, `drizzle.config.ts`) must be deleted — it conflicts with Supabase-direct and creates confusion about schema authority.

**Core technologies:**
- `@supabase/supabase-js ^2.106`: single browser client for Postgres, Auth, Storage — the only Supabase runtime dep for a SPA
- Supabase Postgres (hosted, Postgres 15+): replaces `data/products.ts`; auto-generates PostgREST API consumed by the client
- Supabase Auth (GoTrue): email/password auth for admin + customers; JWTs drive RLS
- Supabase Storage (hosted): product image CDN; public bucket + admin-only write via `storage.objects` RLS
- Postgres RLS + `profiles(role)` + `is_admin()` SECURITY DEFINER function: the actual authorization boundary
- `supabase` CLI (dev dep): migrations, type generation, local Docker stack

**Do NOT use:** `@supabase/ssr` (server-only), `@supabase/auth-helpers-*` (deprecated), `@supabase/auth-ui-react` (unmaintained), or the service-role key anywhere near the client bundle.

### Expected Features

All P1 features are confirmed table stakes for this milestone's stated goal (owner out of the repo, no code changes for catalog/content). The scope is appropriately bounded: e-commerce (cart, checkout, payments) is explicitly deferred.

**Must have (P1 — table stakes this milestone):**
- Supabase schema + RLS + Storage bucket (everything else depends on it)
- Admin login (email/password) + role gating enforced in DB (not just UI)
- Product CRUD with real price, published/visibility flag, and soft delete
- Category CRUD with in-use delete protection
- Image upload/replace/delete with drag-drop, preview, type/size validation
- Public Shop reads live Supabase data (no UX regression; loading/empty/error states)
- Site-content editing (hero text, Our Story copy, contact/social links)
- Native customization questionnaire submitting to Supabase
- Admin submissions inbox with read/handled status
- Customer register/login + password reset
- Customer wishlist (save/unsave + Saved page)
- Customer profile + own submission history
- Confirm-on-delete + success/error toasts everywhere (non-negotiable for non-technical owner)

**Should have (P2 — after core validates):**
- Image transformations via Storage URL params (thumbnail + hero from one upload)
- Drag-to-reorder products and images; primary image selection
- "Featured products" flag managed in portal (removes hardcoded `getFeaturedProducts()`)
- Inbox status workflow (new → in progress → done) + internal notes
- Email notification to owner on new submission (Edge Function + Resend/SMTP)
- Wishlist → questionnaire prefill shortcut

**Defer to v2+ / next milestone:**
- Cart / checkout / Razorpay (explicit next milestone)
- Rich WYSIWYG for Story content
- Multi-admin roles/permissions
- Social login, product reviews, in-admin analytics

### Architecture Approach

The target is a pure thick-client / BaaS architecture: components call `hooks/queries/*` → `api/*` → single `supabase` singleton; no component ever imports `supabase` directly. `AuthProvider` subscribes to `onAuthStateChange`, fetches `profiles.role`, and exposes `{session, role}` to route guards and conditional UI. Guards (`RequireAdmin`, `RequireAuth`) are UX-only Wouter wrappers; every write is independently blocked by RLS. The `supabase/` directory at repo root holds all migrations and seed scripts (never bundled). A one-time seed script using the service-role key migrates 68 products + soap images before the public Shop is rewired.

**Major components:**
1. `lib/supabase.ts` — singleton `createClient<Database>()` with anon key; only import site for the SDK
2. `lib/auth/AuthProvider.tsx` — session + role context; `onAuthStateChange` subscription; drives all guards
3. `api/*.ts` — typed async functions per entity (no React); the data-access chokepoint
4. `hooks/queries/*.ts` — TanStack Query wrappers (`useProducts`, `useUpsertProduct`, etc.) over `api/`
5. `components/guards/` — `RequireAdmin` / `RequireAuth` Wouter wrappers (UX-only)
6. `pages/admin/*` — all CRUD UIs (Products, Categories, SiteContent, Submissions inbox) behind `RequireAdmin`
7. `supabase/migrations/` — canonical schema source (tables, RLS policies, buckets); never the dashboard
8. Postgres RLS + `is_admin()` SECURITY DEFINER — the actual security layer; default-deny on all tables

**Database tables:** `products`, `categories`, `profiles` (1:1 with `auth.users`, carries `role`), `site_content` (key→jsonb), `customization_submissions` (nullable `user_id` for guest submit), `wishlists` (composite PK). Images stored as storage paths (not full URLs) in `text[]` columns; URLs built at read time via `getPublicUrl`.

### Critical Pitfalls

1. **RLS is the only security boundary — not route guards** (HIGH). Default-deny on every table; gate admin writes with a `SECURITY DEFINER is_admin()` function to avoid recursive policy on `profiles`. Acceptance test: a non-admin authenticated user must receive RLS errors on every write attempt.
2. **Never expose the service-role key** (HIGH). `VITE_`-prefixed vars are baked into the public bundle at build time. Only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (safe by design with RLS on) belong in client code. Service-role key is local-only, used only in the seed script.
3. **Role must be stored where the user cannot edit it** (HIGH). `raw_user_meta_data` is user-editable — privilege escalation. Use `raw_app_meta_data` or a `profiles.role` column with an UPDATE policy that excludes `role`. Bootstrap the first admin out-of-band (SQL editor / service-role script), never via the SPA.
4. **Auth redirect URLs fail on GitHub Pages sub-path** (HIGH problem / MEDIUM exact settings). Set Supabase Site URL to the full Pages URL including sub-path; add every callback URL to the Redirect Allowlist; pass explicit `emailRedirectTo` on auth calls. Test a full email-confirmation round trip on the deployed site, not just locally.
5. **Data migration must use the service-role key, not the anon key** (MEDIUM). RLS blocks anon/authenticated inserts on admin-only tables. Run the one-time product + image import as a local Node script with the service-role key. Keep RLS on; make the import idempotent (upsert on slug); upload images first, capture paths, then insert rows.

## Implications for Roadmap

Based on research, suggested phase structure (dependency-driven):

### Phase 1: Foundation — Supabase Wiring + Schema + RLS
**Rationale:** Everything else depends on the schema existing and RLS being correctly set from day one. This phase also removes the dead Express/Drizzle scaffolding that would cause confusion. Getting RLS wrong here forces rework of every downstream policy.
**Delivers:** Working Supabase project linked to the repo; all tables with RLS enabled and default-deny; `is_admin()` helper; Storage buckets with policies; `VITE_` env vars; `lib/supabase.ts` singleton; Supabase CLI scripts; removal of `server/`, `shared/`, Drizzle deps.
**Addresses:** Schema + RLS + Storage bucket (P1 table stakes); removes dead code
**Avoids:** Pitfalls #1 (RLS boundary), #4 (service-role key leak), #5 (permissive policies), #13/#14 (policy hygiene)

### Phase 2: Auth — Admin Login + Customer Register + Role Model
**Rationale:** All admin and customer features depend on auth. Role model must be established before any write feature to avoid needing to rework every policy. Auth redirect URLs must be correct on GitHub Pages before any email flow is tested.
**Delivers:** `AuthProvider` context; `onAuthStateChange` subscription; `profiles` auto-create trigger; `RequireAdmin`/`RequireAuth` guards; Login/Register/ForgotPassword pages; first admin bootstrapped out-of-band; correct Supabase Site URL + redirect allowlist config.
**Addresses:** Admin login, customer register/login, password reset (P1 table stakes)
**Avoids:** Pitfalls #2 (recursive RLS), #3 (insecure role assignment), #8 (auth redirects on Pages), #10 (session lifecycle), #15 (email limits)

### Phase 3: Data Migration — 68 Products + Images to Supabase
**Rationale:** The public Shop cannot be rewired from the static file until data exists in Supabase. Seed script must run after schema + buckets exist (Phase 1). Migration must complete before Phase 5 to avoid an empty catalog on cutover.
**Delivers:** All 68 products and categories inserted via a local service-role seed script; soap images uploaded to the `product-images` bucket with paths recorded on product rows; idempotent upsert on slug; scrub/cream rows seeded with empty `images[]` (to be filled via admin portal in Phase 4).
**Addresses:** Backend data prerequisite for live Shop read
**Avoids:** Pitfall #7 (RLS-aware migration — service-role script, RLS stays on, idempotent, images-first-then-rows)

### Phase 4: Admin CMS — Product, Category, Content, Image Management
**Rationale:** The owner's primary need. Depends on auth (Phase 2) for admin gating and on schema/storage (Phase 1) for the data layer. Category CRUD must land before Product CRUD (FK dependency). Image upload depends on storage bucket.
**Delivers:** Admin portal layout; Product CRUD with price, published flag, soft delete; Category CRUD with in-use delete protection; Image upload/replace/delete (drag-drop, preview, type/size validation); Site-content editing (hero, Our Story, contact/social links); confirm-on-delete dialogs; success/error toasts throughout.
**Addresses:** All admin content-management P1 features; non-technical owner UX requirements
**Avoids:** Pitfall #1 (admin writes gated by `is_admin()` in DB, not just UI); Pitfall #6 (admin-only writes on `storage.objects`)

### Phase 5: Public Shop Rewire — Live Catalog Reads
**Rationale:** Can only happen after data exists (Phase 3) and schema is stable (Phase 1). Rewiring to live data removes the static file dependency and proves the no-redeploy promise.
**Delivers:** Shop, Home, ProductDetail rewired to `useProducts()`/`useCategories()` hooks; loading/empty/error states; deletion of `client/src/data/products.ts`; no UX regression.
**Addresses:** "Public Shop reads live Supabase data" P1 requirement
**Avoids:** Empty catalog regression (depends on Phase 3 completing)

### Phase 6: Customer Features — Questionnaire, Wishlist, Account
**Rationale:** Depends on auth (Phase 2) and schema (Phase 1). Admin inbox depends on questionnaire producing rows. Wishlist and account features are independent of each other and can be built in parallel once auth exists.
**Delivers:** Native customization questionnaire → `customization_submissions`; admin submissions inbox with read/handled status; customer wishlist (save/unsave + Saved page); customer profile page with own submission history; per-user RLS on all customer-owned data.
**Addresses:** All customer-side P1 features; admin inbox; native questionnaire
**Avoids:** Pitfalls #5/#16 (owner-only RLS on wishlist/submissions; no anon SELECT on user data); Pitfall #14 (WITH CHECK on all owner-scoped INSERT/UPDATE)

### Phase 7: Deploy Hardening + QA
**Rationale:** Auth callbacks, SPA routing, and Vite base path are all GitHub Pages-specific risks that must be verified end-to-end on the real deployment, not just locally.
**Delivers:** Full email-confirmation + password-reset round trip verified on deployed Pages URL; hard-refresh on `/admin` and customer routes working (404.html = index.html trick verified); Vite `base` consistent with router `basename` and Supabase Site URL; CI secrets wired in GitHub Actions; negative RLS test (non-admin cannot write).
**Addresses:** Deployment correctness; security verification
**Avoids:** Pitfalls #8 (auth redirects), #9 (SPA 404), #12 (Vite base)

### Phase Ordering Rationale

- Phase 1 (schema + RLS) gates all data work — no phase can write to or read from Supabase safely without correct policies.
- Phase 2 (auth) gates all role-scoped features — admin portal and customer features both depend on knowing who the user is.
- Phase 3 (seed/migration) must precede Phase 5 (public Shop rewire) to avoid shipping an empty catalog; it can be parallelized with Phase 2 once Phase 1 is done.
- Phase 4 (admin CMS) and Phase 6 (customer features) are independent of each other after Phases 1+2 land; teams can parallelize.
- Phase 7 (deploy hardening) wraps all phases but is explicitly called out because GitHub Pages-specific issues are only fully testable on the live deployment.

### Research Flags

Phases needing deeper research or careful verification during planning:
- **Phase 1:** VERIFY the exact `storage.objects` RLS policy syntax for the current Supabase version (MEDIUM confidence in PITFALLS.md); VERIFY the `auth.jwt()` claim-access helper syntax before writing custom JWT-claim policies.
- **Phase 2:** VERIFY Supabase Auth URL config setting names (Site URL vs Redirect URLs) in the current dashboard; VERIFY email rate limits on the project's plan to decide whether to configure custom SMTP from the start.
- **Phase 4:** Image upload UX (drag-drop, HEIC/JPEG/PNG, size validation, progress) will require careful component design for the non-technical owner — plan for iteration.

Phases with well-established patterns (skip additional research-phase):
- **Phase 3:** Data migration via service-role Node script is a documented pattern; risk is procedural, not research.
- **Phase 5:** Public read rewire via TanStack Query is the same pattern already in the codebase; no new concepts.
- **Phase 6:** Wishlist and profile CRUD are standard per-user RLS patterns; well-documented.
- **Phase 7:** GitHub Pages SPA routing workaround is already implemented in the repo; verification is a checklist, not research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core client verified against npm registry + official Supabase docs; version compatibility confirmed; "what NOT to use" clearly documented |
| Features | HIGH | Domain is well-trodden CRUD/CMS/auth territory; Supabase capabilities for all P1 features verified; scope boundaries clearly reasoned |
| Architecture | HIGH | Patterns verified against official Supabase docs + direct codebase inspection; component boundaries and data flows are concrete and code-level |
| Pitfalls | HIGH (concepts) / MEDIUM (some syntax) | RLS boundary, key exposure, role assignment, SPA routing — all HIGH confidence. Exact `storage.objects` policy syntax and `auth.jwt()` claim helpers marked VERIFY |

**Overall confidence:** HIGH — research is internally consistent across all four files, converges on the same dependency order, and is grounded in official Supabase documentation. MEDIUM items are syntax-level and easy to verify against docs before writing the relevant migration.

### Gaps to Address

- **Exact `storage.objects` RLS policy syntax:** PITFALLS.md flagged this as MEDIUM confidence. Verify against current Supabase Storage access control docs before writing Phase 1 storage policies.
- **`auth.jwt()` vs `current_setting` for JWT claim access in policies:** Relevant only if the project switches from `profiles.role` lookup to JWT claims (not required for v1). Verify correct syntax for the upgrade path.
- **Supabase email rate limits on the project's plan:** Could silently throttle customer registration flows. Verify at project creation; configure custom SMTP if needed before Phase 6 launches.
- **`is_featured` / `sort_order` columns:** ARCHITECTURE.md includes these in the schema; FEATURES.md lists them as P2 differentiators. Recommendation: include in the Phase 1 migration now (trivial cost, avoids a blocking migration later).
- **Scrub/cream product images:** Only soap images exist in the repo. Phase 3 seeds scrub/cream rows with empty `images[]`. The owner must upload these via the admin portal (Phase 4). Plan for an initial onboarding task list for the owner.

## Sources

### Primary (HIGH confidence)
- `@supabase/supabase-js` npm registry — version 2.106.x confirmed current; no v3
- https://supabase.com/docs/guides/auth/quickstarts/react — official React SPA auth quickstart
- https://supabase.com/docs/guides/database/postgres/row-level-security — RLS patterns, `is_admin()` SECURITY DEFINER
- https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac — profiles.role vs JWT claims tradeoffs
- https://supabase.com/docs/guides/local-development/cli/getting-started — CLI install, migrations, type generation
- https://supabase.com/docs/guides/api/api-keys — anon/publishable key public-safe with RLS; service/secret key must stay private
- https://supabase.com/docs/reference/javascript/storage-from-upload — Storage upload / getPublicUrl
- `.planning/PROJECT.md` — milestone scope, constraints, key decisions
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` — existing pages/components, shadcn/ui + TanStack Query availability
- Existing codebase: `client/src/data/products.ts`, `client/src/assets/images/products/` — directly inspected

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/guides/auth/auth-helpers — confirms `auth-helpers` deprecated in favor of `@supabase/ssr`
- https://github.com/supabase/cli/releases — Supabase CLI 2.x release line (exact patch MEDIUM)
- Storage `storage.objects` RLS policy syntax — MEDIUM (flagged for VERIFY before implementation)
- `auth.jwt()` claim-access helper syntax — MEDIUM (flagged for VERIFY)
- Supabase Auth redirect URL setting names — MEDIUM (flagged for VERIFY)
- Supabase default email rate limits — MEDIUM (check at project creation)

---
*Research completed: 2026-05-31*
*Ready for roadmap: yes*
