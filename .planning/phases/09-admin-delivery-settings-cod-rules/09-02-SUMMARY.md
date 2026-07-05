---
phase: 09-admin-delivery-settings-cod-rules
plan: 02
subsystem: delivery-estimate-edge-function
tags: [supabase, edge-function, admin, turnstile, cache, rls]
requires:
  - "delivery-estimate edge function (Phase 6 / Plan 03)"
  - "public.profiles.role (migration 0004)"
  - "delivery_estimate_cache deny-direct table (migration 0017)"
provides:
  - "delivery-estimate admin branch: isAdmin detection (auth.getUser + profiles.role)"
  - "admin-only originPincode override for pre-save preview (D-08)"
  - "service-role cache-purge branch (D-11/D-12)"
affects:
  - "supabase/functions/delivery-estimate/index.ts"
tech-stack:
  added: []
  patterns:
    - "Server-side JWT verification via admin.auth.getUser(jwt) inside an edge function"
    - "PostgREST delete-all guard: .delete().neq('id', <impossible-uuid>)"
    - "Admin bypass gated strictly behind server-verified isAdmin; public path unchanged"
key-files:
  created: []
  modified:
    - "supabase/functions/delivery-estimate/index.ts"
decisions:
  - "verify_jwt stays false in centralized supabase/config.toml; the function does its own JWT verification for the admin decision"
  - "originPincode override honored ONLY when isAdmin to prevent shared-cache poisoning (Pitfall 2)"
  - "Cache purge routed through the service-role function, NOT a new RLS policy (0017 deny-direct banner preserved)"
metrics:
  duration: "~8m"
  completed: "2026-07-05"
  tasks: 2
  files: 1
---

# Phase 09 Plan 02: delivery-estimate Admin Branch Summary

Extended the deployed `delivery-estimate` edge function with a server-verified admin
branch that skips Turnstile for authenticated admins, honors an admin-only
`originPincode` preview override, and adds a service-role cache-purge path — while
leaving the public anon Turnstile-gated contract behaviorally unchanged.

## What Was Built

**Task 1 — Server-side admin detection (D-07), commit `537eeab`:**
- The request body is now read once into a `body` object; `token`/`destPincode`/`weightG`
  are destructured from it (so `body.originPincode` and `body.purge` are available to the
  admin branch).
- The service-role `admin` client is constructed EARLY (moved above the Turnstile block)
  so admin detection can precede and gate the captcha path.
- `isAdmin` is derived only from a server-verified JWT: `Authorization: Bearer <jwt>` →
  `admin.auth.getUser(jwt)` (verifies signature + expiry) → `profiles.role === 'admin'`.
  Role lives in `public.profiles.role` (migration 0004), not a JWT claim, so the profiles
  read is required. A logged-out caller sends the anon key → `getUser` returns no user →
  `isAdmin` stays false (safe public default).
- The existing Turnstile `siteverify` block is wrapped in `if (!isAdmin) { ...unchanged... }`.
  The anon path (validate → siteverify → `captcha_failed`) is byte-for-byte behavioral.

**Task 2 — Cache purge + origin override (D-08 / D-11 / D-12), commit `1ee29a1`:**
- Added an early-return purge branch AFTER `isAdmin` is established but BEFORE the
  `destPincode` validation (a purge carries no destPincode): `body.purge === true` →
  non-admin returns `403 { error: 'forbidden' }`; a verified admin runs
  `admin.from('delivery_estimate_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000')`
  (idiomatic PostgREST delete-all against the confirmed `id uuid` PK), logs any error
  server-side (never throws), and returns `{ purged: !error }` 200.
- The origin assignment now gates the override:
  `origin = (isAdmin && typeof body.originPincode === 'string' && /^\d{6}$/.test(body.originPincode)) ? body.originPincode : settings.originPincode`.
  Public callers always use the saved `site_content` origin (Pitfall 2 — prevents cache
  poisoning).
- No RLS policy was added to `delivery_estimate_cache`; the 0017 deny-direct banner and
  the migration itself are untouched.

## Verification

All source grep assertions from the plan pass:
- `auth.getUser`, `if (!isAdmin)`, `profiles`, `role` present (admin detection).
- `turnstile/v0/siteverify` and `captcha_failed` still present and unchanged (gated anon path).
- `purge`, `forbidden`, `delivery_estimate_cache`, `.delete()`, `body.originPincode` present,
  with the override inside an `isAdmin &&` guard.
- `verify_jwt = false` unchanged (centralized `supabase/config.toml`, L386).
- No real `create policy` statement in 0017 (the single grep match is the comment banner).

The Deno function has no in-repo test harness; behavioral verification (admin skips
Turnstile, anon still `captcha_failed`, admin purge deletes rows, non-admin purge → 403,
admin origin override changes the previewed route) is the live UAT in **plan 09-04**.

## NOT Deployed

The edited function is **NOT yet deployed**. Deploy + live UAT is plan **09-04**
(BLOCKING-HUMAN). This plan only edits the source.

## Deviations from Plan

### Auto-fixed / Documented adjustments

**1. [Rule 3 - Blocking] config.toml path — centralized, not per-function**
- **Found during:** Task 1 read_first.
- **Issue:** The plan's acceptance criteria reference
  `supabase/functions/delivery-estimate/config.toml`, but this project keeps a single
  centralized `supabase/config.toml`. There is no per-function config file.
- **Resolution:** Verified `verify_jwt = false` for `[functions.delivery-estimate]` in the
  central `supabase/config.toml` (L382-386) and left it untouched, satisfying the plan's
  intent ("Do NOT touch config.toml — verify_jwt stays false").
- **Files modified:** none (verification only).

**2. [Note] 0017 "create policy" grep is a benign false positive**
- The plan asserts `! grep -qi "create policy" supabase/migrations/0017...`. That grep
  matches the load-bearing comment banner (`DELIBERATELY NO \`create policy\` statement
  follows`), not an actual policy. Confirmed no non-comment policy statement exists and the
  migration is unchanged. Intent (no new RLS policy) is satisfied.

## Known Stubs

None. Both behaviors are fully wired; live behavioral confirmation is deferred to the
09-04 deploy UAT by design (Deno function has no in-repo harness).

## Threat Flags

None. No new security surface beyond the plan's `<threat_model>`. The admin bypass,
origin override, and purge branch each map to mitigations T-9-01…T-9-04 and are enforced
strictly behind server-verified `isAdmin`.

## Self-Check: PASSED
- FOUND: supabase/functions/delivery-estimate/index.ts (modified)
- FOUND commit: 537eeab (Task 1)
- FOUND commit: 1ee29a1 (Task 2)
