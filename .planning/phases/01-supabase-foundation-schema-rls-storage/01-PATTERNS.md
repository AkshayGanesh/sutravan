# Phase 1: Supabase Foundation — Schema, RLS & Storage - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 13 (3 new, 4 modified, 6 deleted)
**Analogs found:** 5 / 7 (the 2 with no analog are net-new SQL — see "No Analog Found")

## File Classification

| New/Modified/Deleted File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------------|------|-----------|----------------|---------------|
| `client/src/lib/supabase.ts` (NEW) | provider / client singleton | request-response | `client/src/lib/queryClient.ts` (module-export singleton) + `drizzle.config.ts` (env-or-throw) | role-match (singleton) + exact (env guard) |
| `supabase/migrations/<ts>_init_schema.sql` (NEW) | migration / schema | batch / DDL | `shared/schema.ts` (column shape only) + `client/src/data/products.ts` (real columns) | partial (data shape only — no SQL analog) |
| `supabase/migrations/<ts>_storage_buckets.sql` (NEW, or folded) | migration / config | batch / DDL | none | **no analog** |
| `.env.example` (NEW, committed) | config | — | none committed; `drizzle.config.ts` documents required env implicitly | partial |
| `client/src/lib/queryClient.ts` (MODIFIED — strip Express path) | provider / client | request-response | itself (lines 44-57 QueryClient kept; 1-42 removed) | exact (in-file) |
| `package.json` (MODIFIED — strip deps + scripts) | config | — | itself (current `scripts`/`dependencies`) | exact (in-file) |
| `tsconfig.json` (MODIFIED — drop `@shared`, server include) | config | — | itself | exact (in-file) |
| `vite.config.ts` (MODIFIED — drop `@shared`/`@assets` aliases) | config | — | itself | exact (in-file) |
| `.gitignore` (MODIFIED — add `.env.local`) | config | — | itself | exact (in-file) |
| `server/` (DELETE) | — | — | — | n/a |
| `shared/schema.ts` (DELETE) | — | — | — | n/a |
| `drizzle.config.ts` (DELETE) | — | — | — | n/a |
| `script/build.ts` (DELETE or rewrite) | — | — | — | n/a |

## Pattern Assignments

### `client/src/lib/supabase.ts` (NEW — provider, client singleton)

**Analog A — module-level singleton export:** `client/src/lib/queryClient.ts` line 44.
The whole app's React Query client is one module-level `export const` instance — never per-component. The Supabase client follows the identical shape:
```typescript
// queryClient.ts:44 — the pattern to mirror (one exported const instance)
export const queryClient = new QueryClient({ /* ... */ });
```
New file mirrors this: `export const supabase = createClient(url, anonKey);` (one instance, named export, imported wherever needed). Named-export-for-utilities is the established convention (CLAUDE.md "Module Design").

**Analog B — env-var-or-throw guard:** `drizzle.config.ts` lines 3-5 (being deleted, but it is the repo's only precedent for required-env validation, and CLAUDE.md "Error Handling" names "Build-time errors: Throw if required environment variables missing" as an established pattern):
```typescript
// drizzle.config.ts:3-5 — the env-guard pattern to carry forward
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}
```
Adapt for the client: use `import.meta.env.VITE_*` (NOT `process.env` — this is browser/Vite code; see `App.tsx:15` which already reads `import.meta.env.BASE_URL`), and throw if missing. Target result (from RESEARCH Pattern 1):
```typescript
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}
export const supabase = createClient(url, anonKey);
```

**Existing client env-read precedent:** `client/src/App.tsx:15` — `import.meta.env.BASE_URL.replace(...)`. Confirms `import.meta.env` (not `process.env`) is the correct client-side env access in this repo.

---

### `client/src/lib/queryClient.ts` (MODIFIED — strip Express request-response path, D-14)

**In-file analog (keep vs delete):**
- **KEEP** lines 44-57: `export const queryClient = new QueryClient({ defaultOptions: { ... } })`. Phase 2 reads Supabase through this. Note `queryFn: getQueryFn(...)` on line 47 references the to-be-removed `getQueryFn` — the default `queryFn` must be dropped (Supabase calls pass their own `queryFn`), or `getQueryFn` retained as a no-op. Planner picks; simplest is removing the default `queryFn` line so each Supabase query supplies its own.
- **DELETE** lines 1-42: `throwIfResNotOk`, `apiRequest`, `getQueryFn`, and the `fetch(... credentials: "include")` calls — all bound to the deleted Express server.

Net target: keep only the `QueryClient` construction (without the Express `queryFn` default).

---

### Schema migration SQL — `products` / `categories` tables (NEW migration)

**Analog (column shape ONLY — there is no SQL precedent in this repo):** `client/src/data/products.ts` lines 18-39 define the live data shape the tables must absorb:
```typescript
// products.ts:18-39 — the shape the SQL columns mirror
export type Category = 'soap' | 'scrub' | 'cream';   // → categories.slug rows + category_id FK (D-04)
export interface Product {
  id: string; name: string; subtitle: string;
  category: Category;        // → category_id uuid FK
  price: string;             // → price numeric(10,2) NULLABLE (all '' today, D-02)
  benefits: string[]; ingredients: string[]; tips?: string[];
  shelfLife: string; batchNote: string;
  images: string[];          // → images text[] ordered storage paths (D-03)
}
export interface CategoryInfo { id: Category; label: string; description: string; image: string; }
```
Maps directly to the SQL in RESEARCH §"Schema Column Recommendations" lines 339-406. Naming: TS camelCase (`shelfLife`, `batchNote`) → SQL snake_case (`shelf_life`, `batch_note`). The `'soap'|'scrub'|'cream'` union becomes `categories` rows keyed by `slug`, replaced on products by `category_id uuid` FK.

**`shared/schema.ts` (being deleted) — what NOT to copy:** lines 6-10 define a Drizzle `pgTable` `users` table. Do NOT carry it forward; Supabase Auth owns `auth.users`, and `profiles` references it (`id uuid references auth.users(id)`). The Drizzle/`pgTable`/`drizzle-zod` idiom is retired entirely — migrations are raw SQL.

**Pattern source for the SQL itself:** RESEARCH Patterns 2-5 (lines 150-260) are verified/cited — lift the `private.is_admin()` SECURITY DEFINER fn, the `enable row level security` + minimal-read policies, and the `storage.buckets` inserts directly. Migration ordering: `private` schema + `is_admin()` FIRST, then tables, then policies (RESEARCH Pitfall 3).

---

### `package.json` (MODIFIED — D-13/D-15)

**In-file analog:** current `scripts` (lines 6-13) and `dependencies`/`devDependencies`.
- Scripts: `dev:client` (line 7, `vite dev --port 3200`) is the surviving dev pattern — promote to `dev`. DELETE `dev` (line 8, `tsx server/index.ts`), `build` becomes `vite build` (line 9 currently `tsx script/build.ts` — but deploy.yml already runs `npx vite build` so align it), DELETE `start` (line 10), DELETE `db:push` (line 12). KEEP `check` (line 11, `tsc`).
- Strip deps (lines 48-77): `connect-pg-simple`, `drizzle-orm`, `drizzle-zod`, `express`, `express-session`, `memorystore`, `passport`, `passport-local`, `pg`, `ws`, `zod-validation-error` (used only by server validation). Strip devDeps (lines 81-98): `@types/connect-pg-simple`, `@types/express`, `@types/express-session`, `@types/passport`, `@types/passport-local`, `@types/ws`, `drizzle-kit`, `esbuild`, `tsx`. Strip `optionalDependencies` `bufferutil` (lines 100-102).
- ADD: `@supabase/supabase-js` (dep), `supabase` CLI (devDep).
- KEEP `@tanstack/react-query` (line 44), `zod` (line 76 — still used by react-hook-form resolvers), all `@radix-ui/*`, `react`, `wouter`, etc.

### `tsconfig.json` (MODIFIED)

**In-file analog:** lines 2 and 18-21.
- Line 2 `"include": ["client/src/**/*", "shared/**/*", "server/**/*"]` → drop `shared` and `server` (both deleted) → `["client/src/**/*"]`.
- Lines 18-21 `paths`: remove `"@shared/*": ["./shared/*"]`; KEEP `"@/*": ["./client/src/*"]`.

### `vite.config.ts` (MODIFIED)

**In-file analog:** lines 12-18 `resolve.alias`.
- KEEP `"@"` (line 14). Remove `"@shared"` (line 15, dir deleted). Verify `"@assets"` (line 16 → `attached_assets`) usage before removing — RESEARCH A6/line 298 flags it may be unused; grep `@assets` first.
- `base: process.env.VITE_BASE_PATH ?? "/"` (line 7) stays — it is the GitHub Pages sub-path mechanism.

### `.gitignore` (MODIFIED) and `.env.example` (NEW)

**In-file analog:** current `.gitignore` (10 lines) — `node_modules`, `dist`, `.venv/` already ignored. ADD `.env.local` (and `.env*.local`) so the anon key / service-role key never commit. There is NO committed `.env`/`.env.example` today — `.env.example` is net-new; document only the two `VITE_` vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), never the service-role key.

## Shared Patterns

### Env-var-or-throw (build/boot-time validation)
**Source:** `drizzle.config.ts:3-5` (precedent, being deleted) + CLAUDE.md "Error Handling → Build-time errors: Throw if required environment variables missing."
**Apply to:** `client/src/lib/supabase.ts` (throw if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing). Use `import.meta.env` in client code, not `process.env`.

### Module-level singleton, named export
**Source:** `client/src/lib/queryClient.ts:44` (`export const queryClient = ...`); reinforced by CLAUDE.md "Named exports for utilities."
**Apply to:** `client/src/lib/supabase.ts` (`export const supabase = createClient(...)`). One instance per module, never per-component.

### Client env access via `import.meta.env`
**Source:** `client/src/App.tsx:15` (`import.meta.env.BASE_URL`).
**Apply to:** the Supabase singleton; confirms Vite-style env access is the repo convention for browser code.

### Naming: TS camelCase ↔ SQL snake_case
**Source:** CLAUDE.md "Naming Patterns" (camelCase utils/fields) vs Postgres convention.
**Apply to:** every migration table — map `products.ts` `shelfLife`/`batchNote`/`category` to `shelf_life`/`batch_note`/`category_id`.

### Security boundary lives in Postgres, not client
**Source:** PROJECT.md Constraints (RLS, not UI hiding) + RESEARCH "Don't Hand-Roll."
**Apply to:** all migration files — RLS default-deny on all 6 tables, `private.is_admin()` SECURITY DEFINER, owner-scoped `(select auth.uid()) = user_id`, storage policies gated on `bucket_id` + `is_admin()`. The anon key in the bundle is safe BY DESIGN; the service-role key must never be `VITE_`-prefixed.

## No Analog Found

Files the planner must establish as NEW patterns (use RESEARCH Patterns 2-5, lines 150-260, which carry verified/cited SQL):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/migrations/*.sql` (schema + RLS + `is_admin()`) | migration | batch / DDL | **No SQL exists anywhere in the repo.** The only DB precedent (`shared/schema.ts`) is Drizzle TS being deleted. This phase establishes the versioned-SQL-migration pattern for all future schema work (D-05). |
| `supabase/migrations/*_storage_buckets.sql` (buckets + `storage.objects` policies) | migration / config | batch / DDL | No Storage config precedent. New pattern; RESEARCH Pattern 4 (lines 214-248) is the cited source. Verify `storage.buckets` column set against the live project (RESEARCH A2). |
| `supabase/config.toml` | config | — | Generated by `supabase init`; no analog. |

**No test harness exists** (CLAUDE.md "Testing: Not detected"; RESEARCH line 464). RLS validation (`supabase/tests/rls_assertions.sql` or a verify script) and the bundle-secret guard (`grep -r service_role dist/`) are net-new — no test analog to copy; RESEARCH §"Validation Architecture" (lines 457-492) defines the approach.

## Metadata

**Analog search scope:** `client/src/lib/`, `client/src/data/`, `server/`, `shared/`, repo-root configs (`package.json`, `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts`, `.gitignore`, `.github/workflows/`).
**Files scanned:** 11 read + repo grep for `supabase/`, SQL, and env usage.
**Pattern extraction date:** 2026-05-31
