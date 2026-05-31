---
phase: 01-supabase-foundation-schema-rls-storage
verified: 2026-05-31T11:40:17Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Confirm migrations are applied on the live Supabase project (ref wfbnrcnmpcqzeyjlfflv)"
    expected: "supabase migration list --linked shows 0001_init_schema.sql, 0002_rls_policies.sql, 0003_storage_buckets.sql in the Remote column"
    why_human: "Verifier has no Supabase credentials to run CLI commands against the live project"
  - test: "Run scripts/verify-skeleton.ts against the live project: SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx scripts/verify-skeleton.ts"
    expected: "Prints PASS: anon select on products returned 0 row(s) with no RLS error — exit 0"
    why_human: "Requires live Supabase credentials not available to the automated verifier"
  - test: "Confirm anon write is denied on the live project: insert into products via anon key"
    expected: "Error 42501 new row violates row-level security policy (not success)"
    why_human: "Requires live Supabase credentials; checks the actual enforcement on the real database"
  - test: "Run supabase/tests/rls_assertions.sql against the live project via supabase db query --linked"
    expected: "No exception raised; final NOTICE contains 'ALL DATA-02 RLS INVARIANTS PASSED'"
    why_human: "Requires linked Supabase CLI with DB access; checks actual live database invariants"
---

# Phase 1: Supabase Foundation — Schema, RLS & Storage — Verification Report

**Phase Goal:** A working Supabase project is wired to the app with the full database schema, correct default-deny Row Level Security on every table, the `is_admin()` authorization helper, and Storage buckets — the secure foundation everything else builds on.
**Verified:** 2026-05-31T11:40:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All five automated truths are VERIFIED from committed codebase artifacts. Four live-database truths are credible from SUMMARY evidence (specific error codes cited, fix commits present) but cannot be re-run without credentials — marked as requiring human spot-check.

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App boots on VITE_ anon key only; service-role key absent from bundle | VERIFIED | `npm run check` exit 0; `npm run build` exit 0; `bash scripts/check-no-secret.sh` PASS against live .env.local build; no `service_role` in dist/; .env.local contains only VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (2 lines, no service_role) |
| 2 | All six tables exist via versioned migrations with RLS enabled and default-deny | VERIFIED | 0001–0003 migration files committed with correct ordering; `grep -c "enable row level security"` = 6 in 0002; all six tables defined in 0001 with full columns; public-read only on products/categories/site_content; `is_admin()` gating on writes confirmed in 0002 |
| 3 | is_admin() exists as SECURITY DEFINER with search_path locked, callable without profiles recursion | VERIFIED | 0001_init_schema.sql L115: `create or replace function private.is_admin()` with `security definer`, `set search_path = ''`, `language sql`, `stable`; function defined AFTER `public.profiles` (fix commit ee9edb8 moved it to end of file); profiles_self_read uses `(select auth.uid()) = id` — never calls is_admin() |
| 4 | product-images and site-content Storage buckets exist, public read, admin-only write | VERIFIED | 0003_storage_buckets.sql: 8 `create policy` statements on storage.objects (4 per bucket); public read policies for anon+authenticated; admin insert/update/delete all gated on `bucket_id AND private.is_admin()`; `on conflict (id) do nothing` idempotency |
| 5 | Express + Drizzle + Passport scaffolding removed; app still builds and runs | VERIFIED | `server/` deleted (confirmed); `shared/schema.ts`, `drizzle.config.ts`, `script/build.ts` deleted (confirmed); package.json: no express/passport/drizzle-orm/pg/memorystore/esbuild/tsx deps; scripts: `dev: vite dev --port 3200`, `build: vite build`, `check: tsc`; `npm run check` exit 0; `npm run build` exit 0 with dist/public/ produced |

**Score:** 5/5 truths verified from committed code

### Live-Database Verification (Requires Human)

The SUMMARY claims the following live-DB checks passed. These cannot be independently re-run by the automated verifier (no Supabase credentials). The evidence credibility is HIGH based on:

1. Fix commits are present in git history (`ee9edb8`) with accurate error messages (`ERROR: relation "public.profiles" does not exist (42P01)` and `ERROR: operator does not exist: name[] @> text[] (42883)`) — these are real Postgres errors that only manifest on a live push, not fabricated.
2. `config.toml project_id = "wfbnrcnmpcqzeyjlfflv"` was updated from the worktree placeholder — evidence of a real `supabase link` run.
3. The `rls_assertions.sql` fix (casting `array['anon']` to `name[]`) is a real, verifiable code change committed in `ee9edb8` — it was only needed because the assertion actually ran against the live DB.

| # | Live Check | SUMMARY Claim | Credibility |
|---|-----------|---------------|-------------|
| L1 | `supabase migration list --linked` shows 0001/0002/0003 Applied | Confirmed in SUMMARY | HIGH — config.toml has real ref, fix commits prove real push |
| L2 | anon `select` on `products` returns `error === null` | PASS printed | HIGH — walking skeleton script implemented correctly |
| L3 | anon `insert` into `products` rejected with `42501` | Confirmed | HIGH — specific PostgreSQL error code cited correctly |
| L4 | `rls_assertions.sql` runs with zero failed assertions | All 5 invariants pass | HIGH — fix commit proves real assertion run |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/lib/supabase.ts` | createClient singleton, VITE_ env-or-throw | VERIFIED | Exports `supabase`, reads `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, throws if either missing |
| `.env.example` | VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY only | VERIFIED | No `VITE_`-prefixed service/secret var; documents service_role must stay non-VITE_ |
| `scripts/check-no-secret.sh` | Greps dist/ for service_role, exits 1 on match | VERIFIED | Builds bundle then greps; PASS confirmed against live .env.local |
| `scripts/verify-skeleton.ts` | anon-key select on products, asserts error === null | VERIFIED | Calls `supabase.from('products').select('id, slug').limit(1)`, exits non-zero on error |
| `supabase/migrations/0001_init_schema.sql` | private schema + is_admin() + all 6 tables | VERIFIED | All 6 tables with full columns; is_admin() in private schema with SECURITY DEFINER + search_path = ''; function defined after public.profiles |
| `supabase/migrations/0002_rls_policies.sql` | RLS enabled x6 + D-12 policies | VERIFIED | 6 RLS-enable statements; all auth.uid() in `(select ...)` form; profiles self-read avoids is_admin() |
| `supabase/migrations/0003_storage_buckets.sql` | 2 buckets + 8 storage.objects policies | VERIFIED | Both buckets with `on conflict do nothing`; 8 policy statements; admin writes gated on bucket_id + private.is_admin() |
| `supabase/tests/rls_assertions.sql` | DATA-02 invariant assertions, raises on failure | VERIFIED | 5 invariant groups covering relrowsecurity, public-read policies, profiles no-anon-INSERT, is_admin SECURITY DEFINER + proconfig, bucket existence |
| `supabase/config.toml` | project_id set to real linked ref | VERIFIED | project_id = "wfbnrcnmpcqzeyjlfflv" (real ref, not worktree placeholder) |
| `package.json` | @supabase/supabase-js dep; no express/drizzle/passport/pg | VERIFIED | @supabase/supabase-js in dependencies; supabase CLI in devDependencies; zero express/drizzle/passport/pg matches |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/lib/supabase.ts` | `import.meta.env.VITE_SUPABASE_URL` | `createClient(url, anonKey)` | VERIFIED | Pattern confirmed at L6-L13 of supabase.ts |
| `supabase/migrations/0002_rls_policies.sql` | `private.is_admin()` | admin-write USING/WITH CHECK | VERIFIED | 15 occurrences of `private.is_admin()` in 0002; both products/categories/site_content admin-write policies use it |
| `supabase/migrations/0003_storage_buckets.sql` | `private.is_admin()` | storage.objects admin policies | VERIFIED | 7 occurrences of `private.is_admin()` in 0003; all admin insert/update/delete policies gated correctly |
| `supabase/migrations/0001_init_schema.sql` | `auth.users(id)` | profiles.id and wishlists.user_id FKs | VERIFIED | L67: `references auth.users(id) on delete cascade` (profiles); L89: `references auth.users(id) on delete set null` (submissions); L102: `references auth.users(id) on delete cascade` (wishlists) |

### Data-Flow Trace (Level 4)

Not applicable this phase. No components render dynamic data — the Supabase client singleton is deliberately NOT wired into the render tree. The Shop still reads static `products.ts`. Data-flow tracing deferred to Phase 2 when TanStack Query reads from Supabase.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run check` exits 0 (no missing imports) | `npm run check` | exit 0 | PASS |
| `npm run build` exits 0 with dist/public/ produced | `npm run build` | exit 0, `dist/public/assets/index-*.js` produced | PASS |
| `check-no-secret.sh` exit 0 with live .env.local | `bash scripts/check-no-secret.sh` | PASS: no service_role in dist/ | PASS |
| supabase.ts NOT in render tree (no import) | `grep -rq "lib/supabase" client/src/` | Exit 1 — not imported | PASS |
| No bad deps in package.json | `grep -E '"(express|passport|drizzle-orm|pg)"' package.json` | No match | PASS |

### Probe Execution

No `probe-*.sh` files exist for this phase. Plan 03 used `supabase db query --linked` and `scripts/verify-skeleton.ts` directly — these are live-credential operations that cannot be replicated here. See Human Verification section.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|------------|-------------|--------|---------|
| DATA-01 | App wired to Supabase via env-based config (anon key in client) | VERIFIED | supabase.ts singleton with VITE_ env-or-throw; .env.example contract; check-no-secret.sh pass |
| DATA-02 | Postgres schema with RLS on all 6 tables | VERIFIED (code) / human_needed (live) | Migration files fully verified in code; live-push credibly evidenced; human spot-check requested |
| DATA-04 | Express + Drizzle scaffolding removed | VERIFIED | server/, shared/schema.ts, drizzle.config.ts, script/build.ts all absent; package.json clean |

### Anti-Patterns Found

No blockers. Scan of all files created/modified in this phase:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none found) | — | — | — | — |

No TBD/FIXME/XXX markers. No stubs in any file created by this phase. `scripts/verify-skeleton.ts` is a FAILING-TEST-FIRST artifact by design (documented in SUMMARY, not an unresolved stub). The Supabase singleton not being wired into the render tree is intentional (documented; Phase 2 wires it).

### Human Verification Required

The following checks cannot be run without Supabase credentials. SUMMARY evidence credibility is HIGH but the phase gate requires confirmation.

#### 1. Migration Applied to Live Database

**Test:** Run `node_modules/.bin/supabase migration list --linked` (or check the Supabase dashboard > Database > Migrations)
**Expected:** All three migrations (0001_init_schema.sql, 0002_rls_policies.sql, 0003_storage_buckets.sql) appear in the Remote column with timestamps from 2026-05-31
**Why human:** Automated verifier has no SUPABASE_ACCESS_TOKEN or DB password to run CLI commands

#### 2. Walking Skeleton: Anon Read Returns No RLS Error

**Test:** `SUPABASE_URL=<url> SUPABASE_ANON_KEY=<anon-key> npx tsx scripts/verify-skeleton.ts`
**Expected:** Prints `PASS: anon select on products returned 0 row(s) with no RLS error.` — exit 0
**Why human:** Requires live credentials; confirms end-to-end public-read RLS behavior on the real database

#### 3. Default-Deny: Anon Write Rejected

**Test:** Attempt an anon-key insert into products (extend the skeleton script or use the Supabase JS client in a Node script with the anon key)
**Expected:** RLS error 42501 — NOT success
**Why human:** Requires live credentials; confirms the default-deny invariant holds on the real database

#### 4. RLS Assertion Suite Green

**Test:** `node_modules/.bin/supabase db query --linked --file supabase/tests/rls_assertions.sql`
**Expected:** No exception raised; output contains `NOTICE:  ALL DATA-02 RLS INVARIANTS PASSED (1: RLS-on x6, 2: public-read x3, 3: no profiles anon-insert, 4: is_admin DEFINER+search_path, 5: 2 public buckets)`
**Why human:** Requires linked Supabase CLI; confirms actual live database invariants match the schema definition

### Gaps Summary

No gaps found. All five ROADMAP success criteria are satisfied in committed code:

1. The secret posture (DATA-01) is fully verified — `check-no-secret.sh` PASS confirmed, no VITE_-prefixed secret anywhere, service_role absent from bundle.
2. The schema/RLS code (DATA-02) is fully correct in committed migrations — all six tables, RLS enabled x6, correct D-12 posture, non-recursive is_admin().
3. The architecture cleanup (DATA-04) is verified — dead stack deleted, build clean.

The only remaining items are live-DB spot-checks that cannot be automated (no credentials), where SUMMARY evidence credibility is high.

---

_Verified: 2026-05-31T11:40:17Z_
_Verifier: Claude (gsd-verifier)_
