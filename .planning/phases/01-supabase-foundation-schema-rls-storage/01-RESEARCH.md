# Phase 1: Supabase Foundation — Schema, RLS & Storage - Research

**Researched:** 2026-05-31
**Domain:** Supabase (Postgres + RLS + Storage) backend bootstrap; Vite SPA client wiring; Express/Drizzle scaffolding removal
**Confidence:** HIGH (all five CONTEXT "VERIFY" items confirmed against current Supabase + Vite docs)

## Summary

This phase stands up a live hosted Supabase project, writes the full six-table schema with default-deny RLS via versioned Supabase CLI migrations, adds a non-recursive `is_admin()` SECURITY DEFINER helper, creates two Storage buckets with public-read/admin-write policies on `storage.objects`, wires a `@supabase/supabase-js` client singleton into the existing React/Vite SPA, and fully removes the dead Express + Drizzle + Passport scaffolding. **No user-facing behavior changes** — the Shop keeps reading the static `products.ts` until Phase 2.

The dominant technical risks are well-documented Supabase footguns, all of which have canonical fixes confirmed in this research: (1) the **profiles RLS infinite-recursion** trap (a policy on `profiles` that calls a function which itself reads `profiles`) — solved by a `SECURITY DEFINER` function with `SET search_path = ''` placed in a private (non-API-exposed) schema; (2) **`storage.objects` policy syntax** — policies are plain `CREATE POLICY ... ON storage.objects` rows scoped by `bucket_id`, RLS is already enabled on that table by Supabase; (3) **service-role-key leakage** into the Vite bundle — prevented absolutely by Vite's `VITE_` prefix rule (only `VITE_`-prefixed vars are inlined). The cleanup is low-risk because the GitHub Pages workflow already builds with `npx vite build` directly, not the Express-based `npm run build`.

**Primary recommendation:** Write ONE ordered migration (or a small ordered set) that creates the `private` schema + `is_admin()` first, then all six tables, then enables RLS and adds the minimal read policies per D-12, then the two buckets and their `storage.objects` policies. Use `@supabase/supabase-js@2.106.2` for the client singleton reading only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Prove the walking skeleton by booting the SPA against the live project and doing one real anon-key `select` on `products` (returns empty set, no RLS error).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition + migrations | Database / Storage | — | Versioned SQL in `supabase/migrations/`, applied to hosted Postgres |
| Row Level Security (authz) | Database / Storage | — | Security must be server-side; client route guards are not real security (PROJECT.md) |
| `is_admin()` authorization helper | Database / Storage | — | plpgsql SECURITY DEFINER function in Postgres, reused by table + storage policies |
| Storage buckets + object policies | Database / Storage | — | `storage.objects` RLS lives in Postgres; buckets created via SQL or API |
| Supabase client singleton | Browser / Client | — | `createClient()` reads `VITE_` env at build time; anon key is public-by-design |
| Env var exposure / secret keeping | CDN / Static (build) | Browser | Vite inlines only `VITE_`-prefixed vars; service-role key never `VITE_`-prefixed |
| Express/Drizzle/Passport removal | (none — pure deletion) | Build | Removes a tier entirely; no runtime tier owns the dead server code |
| App boot + dev server | Browser / Client | Build | Vite dev server (port 3200) replaces the Express dev entrypoint |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.106.2` | Browser client singleton — `createClient(url, anonKey)`; `.from().select()`, `.storage`, `.auth` | The official, only first-party JS client. ~19.7M downloads/week. [VERIFIED: npm registry — official supabase/supabase-js repo] |
| `supabase` (CLI) | `2.102.0` | Migration workflow: `init`, `login`, `link`, `migration new`, `db push` | Official Supabase CLI; the canonical versioned-migration tool. ~1.75M downloads/week. [VERIFIED: npm registry — official supabase/cli repo] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new for client) | — | TanStack React Query 5.60.5 is already present and kept (D-14) | Phase 2 reads Supabase through it; not wired this phase |

**Do NOT add** `@supabase/ssr` (0.10.3) — that is for Next.js/SSR cookie-based auth. This is a static SPA; the plain browser client with default `localStorage` session persistence is correct. [ASSUMED — based on Supabase SSR-vs-SPA guidance; confirm if planner considers SSR]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase CLI migrations | Dashboard SQL editor | Not versioned, not in repo — explicitly rejected by D-05 |
| `category_id` FK | text enum `'soap'｜'scrub'｜'cream'` | No in-use delete protection (ADMIN-04); rejected by D-04 |
| supabase-js `2.106.2` (latest stable) | `3.0.0-next.x` | v3 is pre-release (`next` dist-tag); use stable 2.x — `latest` tag is 2.106.2 |

**Installation:**
```bash
# CLI: install as a dev dependency (avoids global version drift); or use brew/scoop
npm install --save-dev supabase@^2.102.0
# Client runtime dependency:
npm install @supabase/supabase-js@^2.106.2
```
> The CLI can also be installed via Homebrew (`brew install supabase/tap/supabase`). Installing it as a devDependency keeps the version pinned in the repo, which is preferable for a reproducible migration workflow. **Do not run the CLI via `npx --yes supabase`** (auto-downloads unverified). [CITED: supabase.com/docs/guides/local-development]

**Version verification (run 2026-05-31):**
- `@supabase/supabase-js` → `2.106.2`, published 2026-05-28, repo `github.com/supabase/supabase-js`, no postinstall. [VERIFIED]
- `supabase` CLI → `2.102.0`, repo `github.com/supabase/cli`, no postinstall. [VERIFIED]

## Package Legitimacy Audit

> slopcheck could not be installed in this environment (no network for `pip install`). Per protocol, packages are verified by ecosystem registry + official-repo provenance + download volume; both are first-party Supabase packages from the official org, so they are treated as `[VERIFIED]` rather than `[ASSUMED]`. The planner may still gate the install behind a `checkpoint:human-verify` if desired, but the risk here is minimal.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/supabase-js` | npm | since 2020-01 | ~19.7M/wk | github.com/supabase/supabase-js | unavailable | Approved (official) |
| `supabase` (CLI) | npm | mature | ~1.75M/wk | github.com/supabase/cli | unavailable | Approved (official) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Postinstall check:** neither package declares a `postinstall` script. [VERIFIED: npm view]

## Architecture Patterns

### System Architecture Diagram

```
                          BUILD TIME (Vite)
   .env.local ──VITE_*──▶ import.meta.env ──inlined──▶ client bundle
   (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY only; service-role key NEVER here)

                          RUNTIME (browser)
   React SPA ──▶ supabase singleton (client/src/lib/supabase.ts)
                      │  createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
                      ▼
            ┌─────────────────────────────────────────┐
            │      Supabase hosted project (cloud)      │
            │                                           │
   anon ───▶│  PostgREST ─▶ RLS check ─▶ Postgres tables │
   role     │                  │                         │
            │                  ├─ is_admin() SECURITY    │
            │                  │   DEFINER (private schema)│
            │                  ▼                         │
            │   products/categories/site_content (public read)
            │   profiles/wishlists (owner read)          │
            │   customization_submissions (admin+owner)  │
            │                                           │
   anon ───▶│  Storage API ─▶ storage.objects RLS ─▶ S3  │
            │     product-images (public read/admin write)│
            │     site-content   (public read/admin write)│
            └─────────────────────────────────────────┘

                     MIGRATION TIME (developer/CI, NOT browser)
   supabase/migrations/*.sql ──supabase db push──▶ hosted Postgres
   (auth via SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD)
```

A reader can trace the walking skeleton: SPA boots → singleton issues anon `select` on `products` → PostgREST applies the public-read RLS policy → returns empty rowset (no RLS error) → skeleton proven.

### Recommended Project Structure
```
supabase/
├── config.toml              # created by `supabase init` (project_id = ref)
├── migrations/
│   ├── <ts>_init_schema.sql       # private schema + is_admin() + 6 tables
│   ├── <ts>_rls_policies.sql      # enable RLS + read/write policies (or fold into above)
│   └── <ts>_storage_buckets.sql   # buckets + storage.objects policies
client/src/
├── lib/
│   ├── supabase.ts          # NEW: createClient singleton (VITE_ env)
│   └── queryClient.ts       # KEEP QueryClient; strip Express apiRequest/getQueryFn (D-14)
.env.local                   # gitignored: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
.env.example                 # committed: documents required VITE_ vars (no secrets)
```
> **Migration file ordering matters.** Files apply in timestamp order. `is_admin()` and the `private` schema MUST be created before any policy references them. Folding everything into one `init` migration sidesteps ordering bugs; splitting is fine as long as timestamps order correctly. [CITED: supabase.com/docs/guides/deployment/database-migrations]

### Pattern 1: Supabase client singleton
**What:** A single `createClient` instance exported from one module; never instantiate per-component.
**When to use:** Always, for the SPA.
**Example:**
```typescript
// Source: supabase.com/docs/reference/javascript/initializing
// client/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);
```
> The anon key is **public by design** — it is safe in the bundle precisely because RLS gates every row. The *service-role* key is what must never be `VITE_`-prefixed. [CITED: supabase.com/docs/guides/api/api-keys]

### Pattern 2: Non-recursive `is_admin()` SECURITY DEFINER helper (THE footgun fix)
**What:** A plpgsql/sql function that reads `profiles.role`, runs as its creator (bypassing RLS on `profiles`), with a locked empty `search_path`, placed in a `private` schema NOT exposed to the API.
**When to use:** Every admin-write policy on every table, and the admin-write storage policies, call this.
**Example:**
```sql
-- Source: supabase.com/docs/guides/database/postgres/row-level-security
--         + github.com/orgs/supabase/discussions/1138 (recursion fix)
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
security definer            -- runs as creator → bypasses RLS on profiles → no recursion
set search_path = ''        -- locked: fully-qualify every object, prevents search_path hijack
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid)   -- see note: auth.uid() fully-qualified below
      and role = 'admin'
  );
$$;
```
> **Exact `auth.uid()` reference under `search_path = ''`:** you must write `auth.uid()` fully-qualified (it lives in the `auth` schema's helper, exposed as `auth.uid()`). The canonical form is `(select auth.uid())` for the row-cache performance win. Planner: write `where id = (select auth.uid()) and role = 'admin'`. [VERIFIED: supabase RLS docs — `(select auth.uid())` initPlan optimization]

**Why it avoids recursion:** A `profiles` SELECT policy that itself did `select ... from profiles where role='admin'` re-triggers the same policy → infinite recursion error (`infinite recursion detected in policy`). Because `is_admin()` is `SECURITY DEFINER`, its internal read of `profiles` runs with the function-owner's privileges and **skips RLS entirely**, breaking the cycle. [VERIFIED: supabase discussions #1138, #32579 — the canonical profiles-recursion fix]

> **Owner-read policy on `profiles` must NOT call `is_admin()` for the self-read path.** Use `auth.uid() = id` for owner self-read (no recursion, no function needed). Reserve `is_admin()` for admin-can-read-all / admin-write paths. This keeps the common self-read path recursion-proof and cheap.

### Pattern 3: Default-deny + minimal public-read RLS (per D-12)
**What:** Enable RLS on every table (deny-all), then open only the specific reads.
**Example:**
```sql
-- Source: supabase.com/docs/guides/database/postgres/row-level-security
alter table public.products enable row level security;   -- now deny-all until a policy exists

-- Public read (anon + authenticated) for catalog tables:
create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (true);

-- Owner-scoped read (wishlists):
create policy "wishlists_owner_read"
  on public.wishlists for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Owner-scoped insert with WITH CHECK (cannot insert rows for another user):
create policy "wishlists_owner_insert"
  on public.wishlists for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Admin-only write (catalog):
create policy "products_admin_write"
  on public.products for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
```
> **Confirmed:** a table with RLS enabled and no policy denies ALL access via anon/publishable key. `anon` = unauthenticated, `authenticated` = logged-in; both are real Postgres roles. `TO anon, authenticated` opens to both. [VERIFIED: supabase RLS docs]

### Pattern 4: Storage buckets + `storage.objects` policies (D-07/08/09)
**What:** Create the two buckets, then RLS policies on `storage.objects` scoped by `bucket_id`. RLS is **already enabled** on `storage.objects` by Supabase.
**Example:**
```sql
-- Source: supabase.com/docs/guides/storage/security/access-control
-- Create buckets via SQL (idempotent) — public=true makes objects readable by URL:
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('site-content',   'site-content',   true)
on conflict (id) do nothing;

-- Public read scoped to bucket:
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Admin-only write (insert/update/delete) scoped to bucket:
create policy "product_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and private.is_admin());

create policy "product_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and private.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and private.is_admin());
-- repeat the four policies for 'site-content'
```
> **Two viable bucket-creation methods.** (1) SQL `insert into storage.buckets` inside the migration (shown above — keeps everything versioned, recommended given D-05). (2) `supabase` CLI / dashboard / `storage.createBucket()` API. SQL-in-migration is preferred here so buckets are reproducible and versioned. Setting `public = true` on the bucket allows unauthenticated read via the public object URL; the explicit SELECT policy additionally covers the authenticated API read path. [CITED: supabase.com/docs/guides/storage/security/access-control] [ASSUMED — exact `storage.buckets` column set; verify `public` column name against the live project's schema before finalizing]

### Pattern 5: CLI migration workflow against ONE hosted project (D-05/06)
```bash
# Source: supabase.com/docs/guides/deployment/database-migrations + CLI reference
supabase init                              # creates supabase/config.toml
supabase login                             # personal access token (or SUPABASE_ACCESS_TOKEN env)
supabase link --project-ref <ref>          # link to the hosted project (no local Docker)
supabase migration new init_schema         # creates supabase/migrations/<ts>_init_schema.sql
# ...write SQL into the generated file...
supabase db push                           # applies pending migrations to the linked cloud DB
```
> **Non-interactive / CI:** `supabase link --project-ref <ref> --password "$PW"` (or `SUPABASE_DB_PASSWORD` env), with `SUPABASE_ACCESS_TOKEN` env for auth. `supabase db push --linked` targets the linked project; `--dry-run` previews. Applied migrations are tracked in `supabase_migrations.schema_migrations`. **Golden rule: never edit the remote DB directly** — all changes flow through migration files. [VERIFIED: supabase CLI reference — link/db-push flags]

### Anti-Patterns to Avoid
- **`is_admin()` in the `public` schema:** it would be exposed via the auto-generated API. Put it in a `private` (or non-exposed) schema. [CITED: supabase RLS docs]
- **Omitting `set search_path = ''` on a SECURITY DEFINER function:** search_path hijack / unqualified-name bugs. Always lock it and fully-qualify (`public.profiles`, `auth.uid()`).
- **Calling `is_admin()` (or any function reading `profiles`) inside the `profiles` self-read policy:** even with SECURITY DEFINER it's unnecessary; use `auth.uid() = id` for self-read.
- **Putting the service-role key in any `VITE_`-prefixed var:** it would be inlined into the public bundle. The service-role key is for the Phase 2 seed only, kept out of repo.
- **Bare `auth.uid() = user_id` (no `select` wrapper) in hot policies:** re-evaluates per row; wrap as `(select auth.uid())`. [VERIFIED: supabase RLS performance docs]
- **Relying on `npm run build` for deploy:** the GitHub Pages workflow uses `npx vite build` directly — confirm it stays that way after script edits (it does).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB access from client | Custom fetch wrapper to PostgREST | `@supabase/supabase-js` | Handles auth headers, RLS role mapping, retries, types |
| Authorization checks | App-layer role checks only | Postgres RLS + `is_admin()` | Client guards aren't security on a public SPA (PROJECT.md) |
| Schema versioning | Hand-applied dashboard SQL | Supabase CLI migrations | Versioned, reproducible, ordered, tracked (D-05) |
| Storage access rules | App-side allow/deny | `storage.objects` RLS policies | Enforced at the storage layer regardless of client |
| Recursion-safe role lookup | Cleverly-worded recursive policy | SECURITY DEFINER function | The documented, only correct fix for the profiles-recursion footgun |

**Key insight:** Every security boundary in this phase belongs in Postgres (RLS + SECURITY DEFINER), not in client code. The SPA ships a public anon key; the database is the trust boundary.

## Runtime State Inventory

> This is a refactor/cleanup phase (D-13 full Express/Drizzle removal) — inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — `server/storage.ts` is in-memory `MemStorage` (lost on restart); no real DB ever connected. `DATABASE_URL` was never populated. Verified by reading INTEGRATIONS.md + server/storage.ts. | None |
| Live service config | **None** — no deployed Express server exists; GitHub Pages serves static assets only. The deploy workflow runs `npx vite build` (not the Express build), so removing `server/` cannot break deploy. Verified in `.github/workflows/deploy.yml`. | None |
| OS-registered state | **None** — no cron/launchd/systemd/pm2; deploy is GitHub Actions only. | None |
| Secrets/env vars | `DATABASE_URL`, `NODE_ENV`, `PORT` referenced by the dead server/drizzle.config — become dead after removal. NEW: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client, gitignored `.env.local`); service-role key kept local for Phase 2 only. No secrets in git today (`.gitignore` excludes `.venv`, no `.env`). | Add `.env.local` (gitignored) + `.env.example` (committed). Drop `DATABASE_URL`/`PORT` usage with server removal. |
| Build artifacts / installed packages | `dist/` (gitignored), `script/build.ts` (esbuild server bundle — becomes dead), the esbuild **allowlist** in `script/build.ts` references express/drizzle/pg/passport/ws etc. `node_modules` will shrink after dep removal. No global installs. | Delete/rewrite `script/build.ts` (or drop it; deploy uses `npx vite build`). Rewire `package.json` scripts. Run `npm install` after dep edits to regenerate lockfile. `tsconfig.json` still references `@shared/*` path → remove or repoint after `shared/` deletion. |

**Removal checklist (D-13/14/15):**
- Delete: `server/` (index.ts, routes.ts, static.ts, storage.ts, vite.ts), `shared/schema.ts` (+ `shared/` if empty), `drizzle.config.ts`, `script/build.ts` (or rewrite to client-only).
- Strip deps: `express`, `express-session`, `passport`, `passport-local`, `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `pg`, `connect-pg-simple`, `memorystore`, `ws`, `@types/express`, `@types/express-session`, `@types/passport`, `@types/passport-local`, `@types/connect-pg-simple`, `@types/ws`, `esbuild` (only used by the server build), `tsx` (only used by server `dev`), `bufferutil` (ws optional dep). **Keep** `tsx`/`esbuild` ONLY if any retained script needs them — neither client build nor `tsc` does, so both can go.
- Scripts: `dev` → `vite dev --port 3200`; drop `dev:client`, server `start`, `db:push`. Keep `build` → `vite build` (matches the workflow), keep `check` → `tsc`.
- `tsconfig.json`: remove `@shared/*` path mapping (and `vite.config.ts` `@shared` + `@assets` aliases if those dirs go — note `@assets`→`attached_assets` may still be unused; verify before removing).
- After edits: `npm install` (regenerate lockfile), then `npm run build` and `npm run dev` must succeed (success criterion #5).

## Common Pitfalls

### Pitfall 1: Infinite recursion on `profiles` RLS
**What goes wrong:** `ERROR: infinite recursion detected in policy for relation "profiles"`.
**Why it happens:** A policy on `profiles` queries `profiles` (directly or via a non-DEFINER function), re-triggering the policy.
**How to avoid:** `is_admin()` as `SECURITY DEFINER` (bypasses RLS); self-read policy uses `auth.uid() = id` only, never a function. [VERIFIED: discussions #1138/#32579]
**Warning signs:** Any policy or function-in-policy that reads the same table it guards.

### Pitfall 2: Service-role key leaks into the bundle
**What goes wrong:** Secret shipped to every visitor → full DB write bypass of RLS.
**Why it happens:** Naming it `VITE_SUPABASE_SERVICE_KEY` (or putting it in client code).
**How to avoid:** Service-role key is NEVER `VITE_`-prefixed and never imported in `client/`. Only the anon key + URL are `VITE_`. Add a build-time guard/grep that fails if `service_role` appears in `dist/`. [VERIFIED: vite.dev env docs]
**Warning signs:** Any `VITE_`-prefixed var whose name contains `service`/`secret`/`admin`.

### Pitfall 3: Migration applied before dependencies exist
**What goes wrong:** A policy references `private.is_admin()` before it's created → push fails.
**Why it happens:** Wrong timestamp ordering across migration files.
**How to avoid:** Create `private` schema + `is_admin()` in the first statements; or single-file migration. Test with `supabase db push --dry-run`. [CITED: db-migrations docs]
**Warning signs:** `function private.is_admin() does not exist` on push.

### Pitfall 4: Bucket public-read confusion
**What goes wrong:** Images 403 for anonymous Shop visitors, or writes succeed for non-admins.
**Why it happens:** Missing SELECT policy, or `public = false` bucket, or write policy lacks `is_admin()`.
**How to avoid:** `public = true` on the bucket AND an explicit anon SELECT policy scoped by `bucket_id`; all write policies AND `private.is_admin()`. [CITED: storage access-control docs]
**Warning signs:** Storage 403/400 with anon key on read.

### Pitfall 5: `search_path` not locked on SECURITY DEFINER
**What goes wrong:** Function resolves unqualified names against the caller's search_path (security risk + breakage).
**How to avoid:** `set search_path = ''` and fully-qualify every object (`public.profiles`, `auth.uid()`). [VERIFIED: RLS docs]

## Code Examples

(See Patterns 1–5 above — each carries a verified/cited source. The planner should lift those SQL/TS blocks directly into task actions.)

## Schema Column Recommendations (Claude's Discretion per D-11)

Derived from `client/src/data/products.ts` (Product/CategoryInfo) and the requirements. **HIGH confidence** for products/categories (mirrors existing shape); **MEDIUM** for later-phase tables (planner may refine, later phases add policies not tables).

```sql
-- categories (D-04): FK target, carries slug
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'soap' | 'scrub' | 'cream' today
  label text not null,                 -- 'Soaps'
  description text,
  image text,                          -- storage path (site-content/category hero)
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- products (D-01/02/03/04): UUID pk + unique slug, nullable INR price, images[]
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- 'neem' (Phase 2 upserts on this)
  name text not null,
  subtitle text,
  category_id uuid references public.categories(id),  -- FK = in-use delete protection
  price numeric(10,2),                       -- nullable INR (D-02)
  benefits text[] default '{}',
  ingredients text[] default '{}',
  tips text[] default '{}',
  shelf_life text,
  batch_note text,
  images text[] default '{}',                -- ordered storage paths (D-03)
  is_active boolean not null default true,   -- ADMIN-08 draft/published (Phase 4 uses it)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- profiles (D-10): role lives here, never in auth metadata
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- site_content (ADMIN-05/06): key/value editable content
create table public.site_content (
  key text primary key,                -- 'hero_title', 'our_story_body', 'instagram_url', ...
  value text,
  updated_at timestamptz default now()
);

-- customization_submissions (CUST-03): questionnaire capture (replaces Google Form)
create table public.customization_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,  -- nullable: anon may submit (Phase 5 decides)
  name text,
  email text,
  skin_type text,
  message text,
  payload jsonb,                       -- flexible field bag for evolving questionnaire
  created_at timestamptz default now()
);

-- wishlists (CUST-01/02): owner-scoped saved products
create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);
```
> **ASSUMED column choices** (flag for confirmation): `customization_submissions` field set (name/email/skin_type/message/payload) is inferred — the live Google Form's actual fields are unknown; the `payload jsonb` hedges this. `site_content` key/value shape is a recommendation. `profiles.id` references `auth.users(id)` — standard Supabase pattern. The `auth.users` FK on submissions is `set null` to allow anon submissions if Phase 5 opts in; planner/Phase 5 may tighten. [ASSUMED]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid() = col` in policy | `(select auth.uid()) = col` | ongoing perf guidance | Per-statement initPlan caching; use everywhere |
| Anon/service keys (`anon`, `service_role`) | New publishable/secret API keys also offered | 2024–2025 | Legacy anon key still works and is what D-12 assumes; **use anon key** for this phase. Note new key system exists. [ASSUMED — verify which key UI the live project surfaces] |
| SECURITY DEFINER without search_path | `set search_path = ''` mandatory | long-standing | Hardening requirement |

**Deprecated/outdated:** Drizzle/Express/Passport stack (being removed). `shared/schema.ts` users table — do not carry forward.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@supabase/ssr` is unnecessary (SPA, not SSR) | Standard Stack | Low — if SSR ever added, revisit; SPA client is correct now |
| A2 | `storage.buckets` has `(id, name, public)` columns for SQL insert | Pattern 4 | Low — verify column names against live schema; dashboard/API fallback exists |
| A3 | `customization_submissions` / `site_content` column lists | Schema Recommendations | Medium — questionnaire fields unknown; `payload jsonb` mitigates; later phases refine |
| A4 | Legacy `anon` key is the key to use (vs new publishable key system) | State of the Art | Low — both work; confirm which the live project shows |
| A5 | Anon users may submit questionnaire (FK `set null`) | Schema Recommendations | Medium — Phase 5 decides auth requirement; affects RLS insert policy |
| A6 | `esbuild`/`tsx` fully removable | Runtime State Inventory | Low — only used by server build/dev; confirm no other script needs them |

## Open Questions

1. **Which API key system does the live project expose?**
   - Known: legacy `anon`/`service_role` keys still function; D-12 assumes anon key.
   - Unclear: whether the project shows new publishable/secret keys by default.
   - Recommendation: use the anon (publishable) key for `VITE_SUPABASE_ANON_KEY`; keep service/secret key local for Phase 2.
2. **Exact `customization_submissions` fields** — the embedded Google Form's questions aren't in the repo. Recommendation: ship the inferred columns + `payload jsonb`; let Phase 5 finalize when the native form is built.
3. **Auth Site URL / redirect allowlist for the GitHub Pages sub-path** — noted in CONTEXT as a Phase 3 task; only flagged here because the project is created now. No action this phase beyond awareness. [Deferred per CONTEXT]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 | build/dev | ✓ (CI uses 22) | 22 | — |
| npm | install/scripts | ✓ | bundled | — |
| Supabase CLI | migrations (D-05) | ✗ (not installed locally) | — | `npm i -D supabase` or `brew install supabase/tap/supabase` |
| Live Supabase project | success criterion #1 | ✗ (must be created) | hosted | none — must create + capture project ref, anon key, db password |
| `@supabase/supabase-js` | client singleton | ✗ (not installed) | 2.106.2 | none — `npm install` |
| Docker | NOT needed (D-06 = cloud-only) | n/a | — | — |

**Missing dependencies with no fallback:**
- A created hosted Supabase project (project ref + anon key + DB password) — a human/setup task; the planner must include a `checkpoint:human-verify` for project creation and credential capture before `supabase link` / `db push` can run.

**Missing dependencies with fallback:**
- Supabase CLI — install as devDependency (recommended) or via Homebrew.
- `@supabase/supabase-js` — `npm install`.

## Validation Architecture

> nyquist_validation = true in config.json → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None present** (no test harness anywhere — confirmed CONTEXT + PROJECT.md) |
| Config file | none — see Wave 0 |
| Quick run command | `npm run check` (tsc) + manual boot |
| Full suite command | `npm run check && npm run build` |

> This is a security-critical, infra-bootstrap phase with no existing test runner. Heavy unit-test scaffolding is disproportionate; the high-value validations are **SQL-level RLS assertions** and the **boots-against-live-Supabase walking skeleton**. Recommend lightweight SQL assertion checks (psql `do $$ ... assert ... $$` or a small script) over standing up Vitest, unless the planner wants a runner for later phases.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | App boots with only `VITE_` anon key; service key absent from bundle | smoke + grep | `npm run build && ! grep -r "service_role" dist/` | ❌ Wave 0 |
| DATA-01 | Singleton throws if env missing | unit/manual | boot `npm run dev`, app renders | ❌ Wave 0 |
| DATA-02 | All six tables exist with RLS enabled | SQL assertion | query `pg_tables`/`pg_class.relrowsecurity` = true for all 6 | ❌ Wave 0 |
| DATA-02 | Anon can read products/categories/site_content; cannot write any table | SQL/anon-key | anon `select` returns (empty) OK; anon `insert` → RLS error | ❌ Wave 0 |
| DATA-02 | `is_admin()` callable without recursion error on profiles | SQL | `select private.is_admin();` and anon read of `profiles` no recursion | ❌ Wave 0 |
| DATA-02 | Storage buckets exist; anon read OK, anon write denied | Storage API | anon download policy passes; anon upload → 403 | ❌ Wave 0 |
| DATA-04 | App builds + runs after Express/Drizzle removal | smoke | `npm run build` exits 0; `npm run dev` serves :3200 | ❌ Wave 0 |
| (skeleton) | Real anon read of a public catalog table returns rows/empty w/o RLS error | e2e-lite | scripted `supabase.from('products').select()` against live project | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run check` (tsc green)
- **Per wave merge:** `npm run build` + `grep -r service_role dist/` returns nothing
- **Phase gate:** Full SQL RLS assertions pass against the live project + the walking-skeleton read succeeds, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `supabase/tests/rls_assertions.sql` (or a `scripts/verify-rls.ts`) — asserts RLS-on for 6 tables, public-read works, writes denied, no profiles recursion
- [ ] Bundle-secret guard: `grep -r "service_role" dist/` (and `eyJ...` JWT scan) as a build check
- [ ] Walking-skeleton script: anon-key `select` against live `products` returning OK
- [ ] No test-runner install required unless planner wants Vitest for future phases

## Security Domain

> security_enforcement = true, ASVS level 1 → section included. This phase IS the security foundation.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Supabase Auth (configured Phase 3); this phase only creates `profiles` + role model |
| V3 Session Management | no | Phase 3 (login/session) |
| V4 Access Control | **yes (core)** | RLS default-deny on all tables; `is_admin()` SECURITY DEFINER; owner-scoped policies with `WITH CHECK`; storage.objects bucket-scoped policies |
| V5 Input Validation | partial | Postgres types + CHECK constraints (`role in (...)`, `numeric(10,2)`); zod already present for client forms (later phases) |
| V6 Cryptography | yes | No hand-rolled crypto; Supabase manages auth secrets; service-role key kept out of bundle (key management) |

### Known Threat Patterns for Supabase-direct SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key in client bundle | Information Disclosure / Elevation | Never `VITE_`-prefixed; `grep service_role dist/` build guard [VERIFIED: vite env rules] |
| RLS-bypass via missing policy / RLS-off table | Elevation of Privilege | `enable row level security` on ALL six tables; default-deny; explicit minimal reads (D-12) |
| Privilege escalation via editable role | Elevation | `role` in `profiles` (server-side), never in auth metadata; `is_admin()` reads profiles (D-10) |
| profiles-recursion DoS / broken authz | Denial of Service / Elevation | SECURITY DEFINER `is_admin()` + `auth.uid()=id` self-read [VERIFIED] |
| search_path hijack on DEFINER fn | Elevation | `set search_path = ''` + fully-qualified names [VERIFIED] |
| Cross-user data read (wishlist/submissions) | Information Disclosure | Owner-scoped `(select auth.uid()) = user_id` USING + WITH CHECK |
| Unauthorized storage write | Tampering | `storage.objects` write policies gated on `private.is_admin()` + `bucket_id` |

## Sources

### Primary (HIGH confidence)
- supabase.com/docs/guides/database/postgres/row-level-security — RLS enable/deny-all, SECURITY DEFINER pattern, anon/authenticated roles, `(select auth.uid())` perf
- supabase.com/docs/guides/deployment/database-migrations — `init`/`login`/`link`/`migration new`/`db push`, timestamp ordering, `schema_migrations` table, golden rule
- supabase.com/docs/reference/cli (link / db push) — `--project-ref`, `--password`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `--linked`, `--dry-run`
- supabase.com/docs/guides/storage/security/access-control — `storage.objects` policy pattern, `bucket_id` scoping, RLS-on-by-default
- vite.dev/guide/env-and-mode — `VITE_` prefix exposure rule, `.env.local` gitignore, secrets must not be `VITE_`
- npm registry — `@supabase/supabase-js@2.106.2` (2026-05-28), `supabase@2.102.0`, official repos, no postinstall

### Secondary (MEDIUM confidence)
- github.com/orgs/supabase/discussions/1138 — canonical profiles-recursion fix via SECURITY DEFINER
- github.com/orgs/supabase/discussions/32579 — "infinite recursion detected in policy for relation profiles"

### Tertiary (LOW confidence)
- supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices (404 on direct fetch; corroborated by RLS docs + discussions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm; official repos; no postinstall
- Architecture / RLS / storage / CLI patterns: HIGH — confirmed against current Supabase docs (all 5 VERIFY items)
- Schema column lists (later tables): MEDIUM — discretionary per D-11; inferred, `payload jsonb` hedges
- Cleanup safety: HIGH — deploy uses `npx vite build`, server never deployed, storage in-memory only

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (Supabase docs stable; supabase-js moves fast — re-verify version near execution; note v3 in `next` channel)
