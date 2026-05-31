# Phase 1: Supabase Foundation — Schema, RLS & Storage - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up a live Supabase project wired to the app: the full Postgres schema (all six tables) via versioned migrations, default-deny RLS on every table, the `is_admin()` authorization helper, public-read/admin-write Storage buckets, and the Supabase client singleton. Also remove the dead Express + Drizzle + Passport scaffolding so the repo is cleanly Supabase-direct and still builds/runs.

**Nothing user-facing changes this phase.** The public Shop continues to read the static `client/src/data/products.ts` until Phase 2 rewires it. Auth flows (login/register) are Phase 3; admin portal is Phase 4; customer features are Phase 5. This phase only builds the foundation those depend on.

Covers requirements **DATA-01** (env-based Supabase config, anon key in client), **DATA-02** (schema for all six tables with RLS), **DATA-04** (remove Express/Drizzle scaffolding).

</domain>

<decisions>
## Implementation Decisions

### Product Schema Shape
- **D-01:** `products.id` is a UUID primary key (`gen_random_uuid()`), with a separate **unique `slug`** column (e.g. `neem`). FKs reference the stable UUID; the Phase 2 seed upserts on `slug`. Slug is NOT the primary key.
- **D-02:** `products.price` is `numeric(10,2)` holding INR rupees, **nullable** — all 68 products are currently unpriced and that must be a valid state. Single currency (INR) assumed; no currency column.
- **D-03:** Product images are an ordered **`images text[]`** column on the product row holding Storage paths. Ordering = array order. No separate `product_images` table in v1 (image reorder / primary-pick is deferred to v2 / ADME-01; the array still supports it later).
- **D-04:** Products link to categories via **`category_id uuid` FK → `categories.id`**. The `categories` table carries a `slug` (for URLs/display). The FK constraint provides the in-use delete protection that Phase 4 (ADMIN-04) requires. This replaces the literal `'soap' | 'scrub' | 'cream'` type.

### Migration Workflow
- **D-05:** Schema is created and versioned with the **Supabase CLI** — versioned `supabase/migrations/*.sql` files checked into the repo, applied with `supabase db push`. This is the pattern for every future schema change (satisfies the roadmap's "versioned migrations"). Requires the Supabase CLI installed and the project linked.
- **D-06:** Develop against a **single hosted Supabase cloud project** directly (no local Docker stack). Meets success criterion #1 ("app boots against a live Supabase project") without a `supabase start` dependency. Suitable for a solo owner-developer; migrations still live in the repo.

### Storage Bucket Layout
- **D-07:** Two buckets: **`product-images`** (catalog photos) and **`site-content`** (editable site assets — hero image, Our Story imagery edited in Phase 4). Both created this phase even though `site-content` isn't populated until Phase 4.
- **D-08:** Image path convention inside `product-images`: **`products/{slug}/{filename}`** (e.g. `products/neem/1.jpg`). Human-readable in the Storage dashboard, easy to find/replace a product's images, stable across renames (slug is unique). The Phase 2 seed and Phase 4 uploads both follow this.
- **D-09:** Bucket access policies on `storage.objects`: **public read, admin-only write** enforced by the same `is_admin()` helper used on tables. Public read is required — the Shop renders images with no login. Customers must never write catalog images.

### Role Model & Table Depth
- **D-10:** Admin vs customer is a **`role text` column on `profiles`**, constrained to `'admin' | 'customer'`, defaulting to **`'customer'`** on signup. `is_admin()` checks `role = 'admin'`. Role lives server-side in `profiles`, **never** in user-editable auth metadata. (Extensible to a third role later; preferred over a boolean.)
- **D-11:** Define **all six tables with their full real columns** in this phase's migration(s), each with RLS enabled — not minimal stubs. Tables: `products`, `categories`, `site_content` (key/value content), `customization_submissions` (questionnaire fields), `profiles` (id, role, email, timestamps), `wishlists` (user_id + product_id). Success criterion #2 requires all six to exist with default-deny RLS; later phases add/refine policies, not whole tables. (Exact later-phase column lists are Claude/researcher discretion against the requirements — see below.)
- **D-12:** RLS baseline posture (refined, not just bare default-deny):
  - **Public read:** `products`, `categories`, `site_content` (the Shop needs them, no login).
  - **Owner-scoped read:** `profiles`, `wishlists` (a user reads only their own rows).
  - **Admin + owner read:** `customization_submissions`.
  - **Writes:** admin-only (catalog/content) or owner-scoped (wishlist/submissions). RLS enabled + default-deny on every table; only these reads are opened. Unauthenticated clients can read public catalog tables but cannot write to any table.

### Cleanup Scope
- **D-13:** **Full removal** of the dead backend: delete `server/`, `shared/schema.ts`, `drizzle.config.ts`; strip `express`, `express-session`, `passport`, `passport-local`, `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `pg`, `connect-pg-simple`, `memorystore`, `ws`, and related `@types/*` from `package.json`; remove dead npm scripts. App must still build and run after (success criterion #5).
- **D-14:** Keep **TanStack React Query** (Phase 2 reads Supabase through it), but retire the Express-specific `apiRequest()` / `getQueryFn` wiring in `client/src/lib/queryClient.ts` so nothing references the deleted server. Remove/neutralize it here or at the start of Phase 2 — do not rip out React Query itself.
- **D-15:** `npm run dev` becomes the **Vite dev server** (today's `dev:client`, port 3200). Drop the Express-based `dev`/`start`/`db:push` scripts. Exact final script names/ports are planner discretion, guided by "Vite-only dev, no Express."

### Claude's Discretion
- Exact column lists for the later-phase tables (`site_content`, `customization_submissions`, `wishlists`, and `profiles` beyond `id`/`role`/`email`/timestamps) — define sensibly against the requirements; later phases will refine.
- RLS policy SQL syntax, `is_admin()` implementation details (`plpgsql` SECURITY DEFINER with locked `search_path`, avoiding recursive-policy errors on `profiles`), and the client singleton implementation — all standard, researcher/planner handles.
- Final `package.json` script names and port wiring after Express removal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs exist for this project. The authoritative references are the planning docs and the existing code that defines the current data shape.

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 1" — goal, 5 success criteria, and the surfaced open questions (Auth Site URL/redirect config note; Storage `storage.objects` policy syntax flagged VERIFY against current Supabase docs).
- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, DATA-04 (this phase); AUTH/ADMIN/CUST requirements that the six tables must eventually support.
- `.planning/PROJECT.md` §Constraints, §Key Decisions — Supabase-direct architecture, anon key + RLS, static SPA on GitHub Pages.

### Existing data shape (the schema must absorb this)
- `client/src/data/products.ts` — the `Product` and `CategoryInfo` interfaces and all 68 products; defines the columns the `products`/`categories` tables must hold. Note `price: ''` everywhere, `images: string[]`, category as `'soap' | 'scrub' | 'cream'`.
- `shared/schema.ts` — the Drizzle `users` table being removed; do not carry it forward.

### Codebase maps
- `.planning/codebase/INTEGRATIONS.md` — current env vars, DB/auth state, GitHub Pages deploy.
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md` — frontend stack and layout to preserve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **TanStack React Query** (`client/src/lib/queryClient.ts`) — already wired; reused for Supabase reads in Phase 2. Keep the QueryClient; only the Express `apiRequest`/`getQueryFn` path is dead.
- **Product/Category type shape** (`client/src/data/products.ts`) — directly informs the SQL column definitions for `products` and `categories`.

### Established Patterns
- **Supabase-direct architecture** (PROJECT.md constraint) — frontend talks to Supabase via its client; no Express API layer. Anon key in the client, security via RLS.
- **Static SPA on GitHub Pages** — anon key + `VITE_SUPABASE_URL` are the only client env vars; **service-role key must never appear in a `VITE_`-prefixed var or the built bundle** (success criterion #1). Auth Site URL / redirect allowlist must account for the GitHub Pages sub-path (note now; configured/verified in Phase 3).
- **No tests exist** — no test harness to satisfy this phase.

### Integration Points
- New Supabase client singleton (e.g. `client/src/lib/supabase.ts`) reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- `package.json`, `vite.config.ts`, `tsconfig.json` paths, and `.github/workflows/deploy.yml` may need adjustment once `server/`/`shared/` are removed and env vars change. App must still build + deploy.
- A `.env.local` (gitignored) holds the client anon key for local dev; the service-role key is kept local/out-of-repo for the Phase 2 seed.

</code_context>

<specifics>
## Specific Ideas

- Every decision above was the recommended option — the owner wants a clean, correct, version-controlled foundation over shortcuts (e.g. chose CLI migrations over dashboard SQL, full cleanup over half-measures, FK-linked categories over text).
- Six tables, full columns, RLS on all of them, defined up front in one migration pass rather than piecemeal across phases.

</specifics>

<deferred>
## Deferred Ideas

- **Image reordering / primary-image selection** — v2 (ADME-01). The `images text[]` array supports it later without a schema change; no `product_images` table needed now.
- **Email confirmation on/off** and **Auth Site URL / redirect allowlist** — decided/configured in **Phase 3**. Noted here only because the cloud project is created this phase; verify Auth URL-config setting names and email rate limits against current Supabase docs at that point.
- **First admin bootstrap** (manually flip a role in the dashboard vs seed) — **Phase 3** decision.
- **Scrub/cream imagery** — no repo images; rows seeded with empty `images[]` in Phase 2, owner uploads via the portal in **Phase 4**.
- **Seed script** (68 products + soap images, idempotent upsert on slug, run with service-role key) — **Phase 2** (DATA-03).

</deferred>

---

*Phase: 1-Supabase Foundation — Schema, RLS & Storage*
*Context gathered: 2026-05-31*
