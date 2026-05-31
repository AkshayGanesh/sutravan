# Walking Skeleton — Earthen Luxury Sutravan (Admin CMS + Supabase Backend)

**Phase:** 1
**Generated:** 2026-05-31

## Capability Proven End-to-End

> The React/Vite SPA boots against a live hosted Supabase project and performs a real anon-key `select` on the public `products` catalog table — returning rows/empty-set with NO RLS error — while anon writes are denied by default-deny RLS and the service-role key is absent from the built bundle.

This is the thinnest meaningful slice that exercises the full backend stack: client singleton → `@supabase/supabase-js` → PostgREST → RLS check → Postgres. It proves the architecture (Supabase-direct, anon key + RLS as the trust boundary) before any catalog data, auth, or admin UI is built.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend | Supabase (hosted Postgres + Auth + Storage), single cloud project, no local Docker | User-chosen (CLAUDE.md); D-06 — meets "app boots against a live project" without a `supabase start` dependency; suitable for a solo owner-developer |
| Architecture | Supabase-direct — frontend talks to Supabase via `@supabase/supabase-js`; NO Express/custom API layer | PROJECT.md constraint; the dead Express/Drizzle/Passport stack is fully removed (D-13). Security lives entirely in Postgres RLS |
| Frontend | Existing React 19 / Vite 7 / Tailwind 4 / shadcn SPA, kept as-is | Compatibility constraint — the public Shop must keep working; no UX regression |
| Data layer | Versioned SQL migrations via the Supabase CLI (`supabase/migrations/*.sql`, `supabase db push`) | D-05 — versioned, reproducible, in-repo; the pattern for every future schema change. Rejected: dashboard SQL editor (not versioned) |
| Authorization | Postgres Row Level Security, default-deny on all six tables; `private.is_admin()` plpgsql SECURITY DEFINER helper (search_path locked) reused by table + storage write policies | D-09/D-10/D-12 — client route guards are not security on a public SPA; the anon key is public-by-design, the DB is the trust boundary. Non-recursive helper avoids the profiles-recursion footgun |
| Role model | `role text` column on `public.profiles` (`check in ('admin','customer')`, default `'customer'`), never in user-editable auth metadata | D-10 — prevents privilege escalation via editable metadata |
| Storage | Two buckets — `product-images`, `site-content` — public read, admin-only write on `storage.objects`; path convention `products/{slug}/{filename}` | D-07/D-08/D-09 — Shop renders images with no login; customers never write catalog images |
| Secret handling | Only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are `VITE_`-prefixed (inlined into the bundle); service-role key / DB password / access token are NEVER `VITE_`-prefixed; `.env.local` gitignored; `scripts/check-no-secret.sh` build guard | Success criterion #1; Vite inlines only `VITE_`-prefixed vars |
| Deployment | Static SPA on GitHub Pages (`npx vite build` in `.github/workflows/deploy.yml`); Supabase hosted separately | Existing deploy is unchanged by the cleanup — server was never deployed |
| Directory layout | `client/src/` app code (`lib/supabase.ts` singleton, `lib/queryClient.ts` kept); `supabase/migrations/` + `supabase/tests/`; `scripts/` for verify/guard; root config (`vite.config.ts`, `tsconfig.json` → client-only) | Mirrors existing conventions; `@/*` alias kept, `@shared`/`@assets` removed |

## Stack Touched in Phase 1

- [x] Project scaffold — Express/Drizzle/Passport removed; Vite-only build/dev (`npm run dev` = `vite dev --port 3200`, `npm run build` = `vite build`); `@supabase/supabase-js` + `supabase` CLI added (Plan 01)
- [x] Routing — existing Wouter SPA routes preserved; no new route this phase (the skeleton read is a script, not a page — the Shop wires live reads in Phase 2)
- [x] Database — one real read (anon `select` on `products`) AND default-deny write proven (anon `insert` rejected); all six tables + RLS + is_admin() pushed live (Plans 02, 03)
- [x] UI — the Supabase client singleton is created and the contract is in place; it is intentionally NOT wired into the render tree this phase (Shop still reads static `products.ts` until Phase 2). The interactive UI read is the Phase 2 slice
- [x] Deployment — existing GitHub Pages workflow (`npx vite build`) is unaffected by the cleanup; documented local full-stack run: `npm run dev` (port 3200) against the live project via `.env.local`, plus `npx tsx scripts/verify-skeleton.ts` exercises the live anon read

## Out of Scope (Deferred to Later Slices)

> Explicit so later phases do not re-litigate Phase 1's minimalism.

- Migrating the 68 products + soap images and rewiring the Shop to read live data — Phase 2 (DATA-03, PUB-01, PUB-02); the seed script runs with the service-role key locally
- Auth flows (register/login/logout), session persistence, first-admin bootstrap, email-confirmation toggle, Auth Site URL / redirect allowlist for the GitHub Pages sub-path — Phase 3 (AUTH-01..05)
- Admin portal CRUD for products/categories/content/images, visibility toggle, submissions inbox — Phase 4 (ADMIN-01..08)
- Customer wishlist, profile/history, native questionnaire (and the `customization_submissions` INSERT policy, left default-deny here) — Phase 5 (CUST-01..04)
- Image reordering / primary-image selection, multi-admin roles, analytics — v2 (deferred)
- Wiring the `supabase` singleton into the render tree — Phase 2 (the singleton exists but is not imported by any component yet)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions (Supabase-direct, RLS-as-authz, versioned migrations, `profiles.role` model, two Storage buckets):

- Phase 2: A visitor sees the live catalog — 68 products + soap images seeded into Supabase, public Shop/Home/ProductDetail read live data via TanStack Query (no login required)
- Phase 3: A visitor registers/logs in/logs out; admin-vs-customer enforced in the DB; admin routes guarded
- Phase 4: The owner manages the entire catalog and site content through a protected portal — no code, no redeploy (the milestone's core value)
- Phase 5: A logged-in customer saves products (wishlist), views their profile/history, and submits a native questionnaire to the admin inbox
