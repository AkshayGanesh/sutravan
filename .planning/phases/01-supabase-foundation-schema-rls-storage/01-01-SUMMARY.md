---
phase: 01-supabase-foundation-schema-rls-storage
plan: 01
subsystem: supabase-client-foundation
tags: [supabase, cleanup, config, vite, validation-scaffold]
requires: []
provides:
  - supabase-client-singleton
  - vite-env-contract
  - secret-leak-guard
  - walking-skeleton-script
affects:
  - client/src/lib/queryClient.ts
tech-stack:
  added:
    - "@supabase/supabase-js@^2.106.2 (runtime client)"
    - "supabase@^2.102.0 (CLI, devDependency)"
  removed:
    - "express, express-session, passport, passport-local, drizzle-orm, drizzle-zod, pg, connect-pg-simple, memorystore, ws, zod-validation-error"
    - "drizzle-kit, esbuild, tsx, @types/express, @types/express-session, @types/passport, @types/passport-local, @types/connect-pg-simple, @types/ws, bufferutil"
  patterns:
    - "module-level singleton export (mirrors queryClient.ts)"
    - "env-or-throw boot guard (carries forward drizzle.config.ts precedent, adapted to import.meta.env)"
key-files:
  created:
    - client/src/lib/supabase.ts
    - .env.example
    - scripts/check-no-secret.sh
    - scripts/verify-skeleton.ts
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - vite.config.ts
    - .gitignore
    - client/src/lib/queryClient.ts
  deleted:
    - server/index.ts
    - server/routes.ts
    - server/static.ts
    - server/storage.ts
    - server/vite.ts
    - shared/schema.ts
    - drizzle.config.ts
    - script/build.ts
decisions:
  - "verify-skeleton.ts selects id, slug from products (slug is in the Plan-03 live schema, not the static products.ts) — it is the failing-test-first artifact that goes GREEN in Plan 03"
  - "check-no-secret.sh runs npm run build then greps dist/ recursively for service_role — backs success criterion #1"
  - "Supabase client singleton created but intentionally NOT wired into the render tree this phase (Shop still reads static products.ts); the throwing env guard therefore does not block build/dev without .env.local"
metrics:
  duration: ~7m
  tasks_completed: 3
  files_created: 4
  files_modified: 6
  files_deleted: 8
  completed: 2026-05-31
---

# Phase 01 Plan 01: Supabase Client Foundation Summary

Converted the repo to clean Supabase-direct shape — deleted the dead Express + Drizzle + Passport scaffolding, rewired build/dev/TS config to client-only, added the `@supabase/supabase-js` client singleton with a VITE_ env-or-throw guard, and created the secret-leak guard plus the walking-skeleton script that Plan 03 will run GREEN against a live project.

## What Was Built

- **Task 1 (`refactor`, 6a16d94):** Removed `server/`, `shared/schema.ts`, `drizzle.config.ts`, `script/build.ts`. Stripped all Express/Passport/Drizzle/pg runtime deps and their `@types`/build tooling (drizzle-kit, esbuild, tsx, bufferutil). Rewrote `package.json` scripts to `dev: vite dev --port 3200`, `build: vite build`, `check: tsc` (dropped `start`, `db:push`, `dev:client`). Repointed `tsconfig.json include` to `["client/src/**/*", "scripts/**/*"]` and removed the `@shared` path; removed `@shared` and the (unused) `@assets` aliases from `vite.config.ts`. Regenerated `package-lock.json` via `npm install`.
- **Task 2 (`feat`, 236f6f7):** Added `@supabase/supabase-js` (dep) and `supabase` CLI (devDep) — both verified to declare no `postinstall` hook. Created `client/src/lib/supabase.ts` (module-level `supabase` singleton, `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` read, throws if either missing). Stripped the dead Express path (`throwIfResNotOk`, `apiRequest`, `getQueryFn`, default `queryFn`) from `queryClient.ts`, keeping only the `queryClient` export. Created `.env.example` (anon URL+key only, with a security note that the service_role key is never build-inlined), added `.env.local` + `.env*.local` to `.gitignore`, created `scripts/check-no-secret.sh` and `scripts/verify-skeleton.ts`.
- **Task 3 (verification only, no file changes):** Proved the app still builds and dev-serves after cleanup.

## Verification Results

- `npm run check` (tsc): exit 0 — no source references deleted modules or the `@shared` alias.
- `bash scripts/check-no-secret.sh`: PASS — `npm run build` exits 0, `dist/public/` produced, no `service_role` token in the bundle.
- `npm run dev`: Vite v7.3.1 serves on `http://localhost:3200/` (HTTP 200) without `.env.local` present — confirms the throwing singleton is not yet in the render tree.
- `grep` confirms no file under `client/src/` imports `./lib/supabase` (singleton created, not consumed until Phase 2).
- `grep -E '"(express|passport|drizzle-orm|pg)"' package.json`: no match.

## Deviations from Plan

None affecting behavior. One minor wording adjustment:

**1. [Rule 3 - Blocking] Reworded `.env.example` security comment to satisfy the acceptance-criteria grep**
- **Found during:** Task 2 verification.
- **Issue:** The acceptance check `! grep -Eq "VITE_.*SERVICE|VITE_.*SECRET" .env.example` matched my explanatory comment ("...a non-VITE_ env var (e.g. SUPABASE_SERVICE_ROLE_KEY)") because `.*` spanned from `VITE_` to `SERVICE` within one line. No actual VITE_-prefixed secret variable existed.
- **Fix:** Reworded the comment so `VITE_` and `SERVICE`/`SECRET` no longer co-occur on a single line; the documented privileged var is now described as "a plain env var named SUPABASE_SERVICE_ROLE_KEY (no build prefix)".
- **Files modified:** `.env.example`
- **Commit:** 236f6f7

## Threat Model Coverage

- **T-01-SECRET** (mitigate): `check-no-secret.sh` greps `dist/` for `service_role` and fails the build on a match; `.env.example` documents only the anon URL+key. Verified PASS against a real build.
- **T-01-ENVLEAK** (mitigate): `.gitignore` now ignores `.env.local` and `.env*.local`.
- **T-01-DEADCODE** (mitigate): `server/`, `shared/schema.ts`, `drizzle.config.ts`, `script/build.ts` and all related deps fully removed — attack surface eliminated.
- **T-01-SC** (accept): both npm installs are first-party official Supabase packages, [VERIFIED] in RESEARCH; confirmed no `postinstall` hook on either.

## Known Stubs

- `scripts/verify-skeleton.ts` is a **failing-test-first artifact** by design — it will FAIL until Plan 03 pushes the schema/RLS to a live Supabase project, at which point Plan 03 runs it GREEN. This is the intended Walking-Skeleton sequencing, not an unresolved stub.
- `client/src/lib/supabase.ts` is created but intentionally not wired into the render tree; Phase 2 will consume it when the Shop reads live data. Documented in the plan; not a defect.

## Requirements

- DATA-04: satisfied — Express + Drizzle + Passport scaffolding removed; app builds and dev-serves.
- DATA-01 (client half): satisfied — env-based singleton, anon key only, no `VITE_`-prefixed secret, service_role absent from the bundle.

## Self-Check: PASSED

- FOUND: client/src/lib/supabase.ts
- FOUND: .env.example
- FOUND: scripts/check-no-secret.sh
- FOUND: scripts/verify-skeleton.ts
- FOUND: commit 6a16d94
- FOUND: commit 236f6f7
- VERIFIED DELETED: server/, shared/schema.ts, drizzle.config.ts, script/build.ts

## Commits

- 6a16d94: refactor(01-01): remove dead Express/Drizzle/Passport stack, rewire config (D-13, D-15)
- 236f6f7: feat(01-01): add Supabase client singleton, env contract, validation scaffolds (DATA-01)
