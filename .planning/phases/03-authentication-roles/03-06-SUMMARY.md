---
phase: 03-authentication-roles
plan: 06
subsystem: auth-bootstrap
tags: [supabase, service-role, admin, bootstrap, scripts, security]

# Dependency graph
requires:
  - phase: 03-authentication-roles
    provides: "public.profiles.role column + enforce_profile_role_lock BEFORE UPDATE trigger with null-auth.uid() service-role carve-out (Plan 01, migration 0004 live)"
provides:
  - "scripts/promote-admin.ts — out-of-band first-admin bootstrap (service-role, idempotent, mirrors seed.ts)"
  - "The only path to admin: a trusted local service-role script (no self-serve UI/code path — D-03 / success criterion #5)"
affects: [03-04-route-guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Out-of-band privileged mutation via a native Node 22 --env-file script reading a non-VITE_ service-role key (mirrors scripts/seed.ts)"
    - "Idempotent role promotion: update profiles.role='admin' where email=arg (re-run is a no-op)"

key-files:
  created:
    - "scripts/promote-admin.ts"
  modified: []

key-decisions:
  - "promote-admin.ts mirrors scripts/seed.ts exactly: non-VITE_ env guard with fail-fast, createClient persistSession:false, OK/FAIL logging, process.exit, main().catch wrapper"
  - "Idempotency is achieved by a plain UPDATE (no upsert needed) — setting role='admin' on an already-admin row is a harmless no-op"
  - ".env.promote.local reuses .env.seed.local values; it is gitignored via the existing .env*.local rule (no new gitignore entry needed)"

patterns-established:
  - "Admin is granted ONLY out-of-band via a local service-role script; the role-lock trigger's null-auth.uid() carve-out (Plan 01) is what lets this single legitimate path succeed while blocking all client-side escalation"

requirements-completed: [AUTH-04, AUTH-05]

# Metrics
duration: ~1min
completed: 2026-06-01
---

# Phase 3 Plan 06: Admin Bootstrap Summary

**`scripts/promote-admin.ts` is the sole, out-of-band path to admin — a native Node 22 service-role script that idempotently flips a registered email's `profiles.role` to `'admin'`, mirroring `scripts/seed.ts` and relying on Plan 01's null-`auth.uid()` role-lock carve-out so the legitimate promotion is not blocked (Pitfall 4); the service-role key never reaches the public bundle (`check-no-secret.sh` PASS).**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-06-01T01:21:56Z
- **Completed:** 2026-06-01T01:22:49Z

## What Was Built

### Task 1 — `scripts/promote-admin.ts` (commit `09210e7`)

An idempotent service-role admin bootstrap that mirrors `scripts/seed.ts`:

- **Header:** JSDoc stating purpose (out-of-band first-admin bootstrap, D-03 / success criterion #5), the SECURITY note (non-`VITE_` `process.env` only; never imported by client code; enforced by `check-no-secret.sh`), the Pitfall-4 carve-out rationale, and the exact run command.
- **Env guard:** Reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from non-`VITE_` `process.env`; fails fast (`process.exit(1)`) if either is missing.
- **Arg guard:** Reads `process.argv[2]` as the email; fails fast with a usage message if absent.
- **Mutation:** `createClient(url, serviceKey, { auth: { persistSession: false } })`, then `admin.from('profiles').update({ role: 'admin' }).eq('email', email)`. On error, throws; on success, logs `OK: ${email} is now admin (idempotent).` and exits 0. Wrapped in `main().catch(...)` mirroring seed.ts.
- **Idempotency:** A plain UPDATE — re-running on an already-admin row is a harmless no-op.

The target `profiles.email` column exists (populated by Plan 01's `handle_new_user` from `new.email`), so the `.eq('email', email)` lookup is valid.

### Task 2 — End-to-end + secret hygiene

- Created gitignored `.env.promote.local` by reusing `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.seed.local`. Confirmed gitignored (`git check-ignore .env.promote.local` -> matched the `.env*.local` rule) and untracked (`git status --porcelain` empty for it).
- Ran `bash scripts/check-no-secret.sh` -> **PASS** ("no service_role token in dist/"). The bundle builds clean and the script is never imported by client code, so the service-role key never reaches `dist/` (T-3-17 mitigated).
- No new tracked artifacts: `dist/` is gitignored; the only new file is the gitignored env file. Task 2 therefore produced no separate commit (the script itself was committed in Task 1).

## Run Command

```bash
node --env-file=.env.promote.local scripts/promote-admin.ts owner@example.com
```

Expected: `OK: owner@example.com is now admin (idempotent).` and exit 0. A second run is a no-op (still exits 0, role stays `admin`), which also proves Plan 01's null-`auth.uid()` carve-out works for the no-JWT service-role caller (Pitfall 4).

## Verification Evidence

| Check | Result |
|-------|--------|
| `npm run check` (`tsc`) | exit 0, clean |
| grep gates (non-`VITE_` service-role, `process.env.SUPABASE_URL`, `role: 'admin'`, `process.argv[2]`, no `import.meta.env`/`VITE_SUPABASE_SERVICE`) | `GATES_OK` |
| `scripts/check-no-secret.sh` (build + scan dist/) | **PASS** — no `service_role` in `dist/` |
| `.env.promote.local` gitignored | yes (`git check-ignore` matched; untracked) |

## Deferred / Manual Verification

The Task 2 `<human-check>` (live functional proof) was NOT executed here — it requires a registered user, a hosted SQL query, and a running app, and is a documented manual step per VALIDATION.md (success criterion #5 / D-03). It is NOT auto-fixable and does not block the plan's deliverable (the script + secret hygiene are complete and proven automatically). To complete the live proof:

1. Register a throwaway user (or use the owner's registered email).
2. Run `node --env-file=.env.promote.local scripts/promote-admin.ts <email>` -> expect `OK` + exit 0.
3. In the Supabase SQL editor: `select role from public.profiles where email='<email>'` -> expect `admin`.
4. Run the script a SECOND time -> still `OK`/exit 0, role stays `admin` (idempotent no-op; proves the Pitfall-4 carve-out).
5. Confirm the promoted user reaches `/admin` (Plan 04 guard) and can write catalog data (RLS allows admins), and that NO UI/code path anywhere grants admin.

## Deviations from Plan

None — plan executed exactly as written. No bugs, missing functionality, or blocking issues encountered. No new package installs (Pitfall-free: `@supabase/supabase-js` is pre-existing).

## Threat Mitigations Applied

- **T-3-17 (service-role key leaks into bundle):** key read from non-`VITE_` `process.env`; script never imported by client code; `check-no-secret.sh` PASS.
- **T-3-18 (self-serve admin path):** admin granted ONLY by this local script; no UI sets `role=admin`.
- **T-3-05 (role-lock blocks legitimate promote):** relies on Plan 01's null-`auth.uid()` carve-out; the no-JWT service-role caller is permitted.
- **T-3-19 (`.env.promote.local` committed):** file is gitignored; verified via `git check-ignore`.

## Known Stubs

None — the script is fully wired (no placeholder data, no TODO/FIXME, no hardcoded empties flowing to UI).

## Self-Check: PASSED

- `scripts/promote-admin.ts` — FOUND
- Commit `09210e7` — FOUND
