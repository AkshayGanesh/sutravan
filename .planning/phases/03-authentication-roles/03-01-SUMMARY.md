---
phase: 03-authentication-roles
plan: 01
subsystem: database
tags: [supabase, postgres, auth, rls, triggers, security-definer, plpgsql]

# Dependency graph
requires:
  - phase: 01-supabase-foundation
    provides: "public.profiles table, private.is_admin() SECURITY DEFINER helper, default-deny RLS, profiles_self_read/self_update/admin_* policies, rls_assertions.sql harness"
provides:
  - "public.profiles.name nullable text column (D-06)"
  - "public.handle_new_user() SECURITY DEFINER trigger fn + on_auth_user_created trigger (auto-creates a role='customer' profile row on signup — AUTH-01, D-05)"
  - "public.enforce_profile_role_lock() SECURITY DEFINER trigger fn + profiles_role_lock BEFORE UPDATE trigger (blocks role self-escalation — AUTH-04, D-04)"
  - "supabase/tests/auth_rls_assertions.sql structural invariant harness (passing live)"
  - "Hosted Auth runtime config: Confirm-email OFF (D-01), Site URL + exact /reset-password redirect allowlisted (D-02)"
affects: [03-03-register-login-logout, 03-04-route-guard, 03-05-password-reset, 03-06-admin-bootstrap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER trigger fns with set search_path='' and fully-qualified object refs (mirrors 0001 is_admin convention)"
    - "Server-side profile-row creation via signup trigger (no client INSERT policy on profiles — D-05)"
    - "Column-scoped role lockdown via BEFORE UPDATE trigger with a null-auth.uid() service-role carve-out (Pitfall 4)"

key-files:
  created:
    - "supabase/migrations/0004_auth_profiles.sql"
    - "supabase/tests/auth_rls_assertions.sql"
  modified:
    - "supabase/config.toml"

key-decisions:
  - "handle_new_user hard-codes role='customer' and never reads role from raw_user_meta_data (privilege-escalation vector closed — D-05/T-3-03)"
  - "name column is 'name' (not full_name) to match customization_submissions.name (D-06)"
  - "enforce_profile_role_lock carves out (select auth.uid()) is not null so the no-JWT service-role bootstrap can still promote an admin (Pitfall 4)"
  - "Deployed origin is the custom domain https://sutravan.in (build base '/'), NOT akshayganesh.github.io; exact reset URL is https://sutravan.in/reset-password"
  - "config.toml governs LOCAL supabase start only; the hosted Dashboard URL Configuration is the runtime source of truth and is NOT in git"

patterns-established:
  - "Auth DB invariants are proven by a dedicated psql harness (auth_rls_assertions.sql) run against the LIVE DB — structure asserted in psql, functional role-escalation rejection proven manually with a real customer JWT downstream (VALIDATION.md)"
  - "Hosted Auth config (confirm-email, redirect allowlist) recorded in SUMMARY so downstream reset/bootstrap slices can rely on it without re-deriving"

requirements-completed: [AUTH-01, AUTH-04]

# Metrics
duration: ~50min (incl. human-action checkpoint dwell)
completed: 2026-06-01
---

# Phase 3 Plan 01: Auth DB Foundation Summary

**Migration 0004 ships the auth security boundary — a `handle_new_user` SECURITY DEFINER trigger that auto-creates a `customer` profile on signup and an `enforce_profile_role_lock` BEFORE UPDATE trigger that blocks role self-escalation — pushed live and proven by a passing psql invariant harness against the hosted DB.**

## Performance

- **Duration:** ~50 min (includes dwell at the Task 3 blocking human-action checkpoint)
- **Started:** 2026-06-01T00:51:59Z (Task 1 commit dc31095)
- **Completed:** 2026-06-01T01:12:38Z (continuation: config fix + docs)
- **Tasks:** 3 (1 & 2 autonomous, 3 human-action checkpoint)
- **Files modified:** 3

## Accomplishments
- Migration `0004_auth_profiles.sql` authored to 0001/0002 conventions, **pushed live** (`supabase db push` → 0004 applied, per owner).
- Trusted server-side profile-row creation: `handle_new_user` inserts `(id, email, name, role='customer')`; no client INSERT policy on `profiles` (D-05) — rows can ONLY be created by the trigger.
- Role self-escalation closed: `enforce_profile_role_lock` raises `'role change not permitted'` on a customer JWT changing `role`, while non-privileged self-updates (name/email) still succeed (AUTH-04/D-04, T-3-01 PRIMARY THREAT).
- Extended psql harness `auth_rls_assertions.sql` asserts the four new structural invariants + carried-over no-insert-policy invariant; **both harnesses pass against the live DB** (per owner).
- Hosted Auth runtime config set and corrected to the real custom-domain origin.

## Object Names Created (live on the hosted project)

| Object | Type | Definition |
|--------|------|------------|
| `public.profiles.name` | column | nullable `text` (D-06; named `name`, not `full_name`) |
| `public.handle_new_user()` | SECURITY DEFINER fn, `search_path=''` | inserts `(new.id, new.email, new.raw_user_meta_data ->> 'name', 'customer')` — role hard-coded |
| `on_auth_user_created` | trigger | `after insert on auth.users for each row execute public.handle_new_user()` |
| `public.enforce_profile_role_lock()` | SECURITY DEFINER fn, `search_path=''` | raises when `new.role is distinct from old.role` AND `(select auth.uid()) is not null` AND `not private.is_admin()` |
| `profiles_role_lock` | trigger | `before update on public.profiles for each row execute public.enforce_profile_role_lock()` |

## Live Deployment State (reported by owner at checkpoint approval)

- **`supabase db push`** → migration **0004 applied** to the hosted project. The hosted DB has the `name` column, both functions, and both triggers.
- **`auth_rls_assertions.sql`** → exited 0, PASSED notice printed (structure: name column, both DEFINER fns with locked `search_path`, both triggers, no profiles INSERT policy).
- **`rls_assertions.sql`** (Phase-1 invariants) → still exits 0, PASSED — RLS posture intact.

## Hosted Auth Config (runtime source of truth — NOT in git)

Downstream slices (Plan 05 password reset, Plan 06 admin bootstrap) can rely on these exact values:

| Setting | Location | Value set |
|---------|----------|-----------|
| Confirm email (D-01) | Authentication → Sign In / Providers → Email | **OFF** |
| Site URL (D-02) | Authentication → URL Configuration | **`https://sutravan.in`** |
| Redirect URL added (D-02) | Authentication → URL Configuration → Redirect URLs allowlist | **`https://sutravan.in/reset-password`** (exact — Supabase only redirects to exact allowlisted URLs, Pitfall 1) |

`config.toml` `[auth]` mirrors these for local parity: `enable_confirmations = false`, `site_url = "https://sutravan.in"`, `additional_redirect_urls` includes `https://sutravan.in/reset-password` (plus the local dev origins `http://127.0.0.1:3000` / `:3200`).

## Task Commits

1. **Task 1: migration 0004 (name column + handle_new_user + role-lock triggers)** — `dc31095` (feat)
2. **Task 2: auth DB-invariant psql assertion harness** — `faab923` (test)
3. **Task 3 [checkpoint:human-action]: live push + hosted Auth config + harness** — config local-parity `04df168` (chore), checkpoint position `e2993ef` (docs); corrected to production origin in continuation `9488e9f` (fix)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `supabase/migrations/0004_auth_profiles.sql` — name column, handle_new_user + on_auth_user_created, enforce_profile_role_lock + profiles_role_lock
- `supabase/tests/auth_rls_assertions.sql` — structural invariant harness for the 0004 objects
- `supabase/config.toml` — `[auth]` local parity (confirm-off + sutravan.in origin + reset redirect)

## Decisions Made
- Followed plan as specified for Tasks 1–2. The one continuation change was a **correction** (see Deviations): the deployed origin is the custom domain `https://sutravan.in`, not the GitHub Pages origin assumed in commit `04df168`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected config.toml auth URLs to the real production origin**
- **Found during:** Task 3 continuation (checkpoint resolution)
- **Issue:** Commit `04df168` set `site_url`/`additional_redirect_urls` to `https://akshayganesh.github.io` (+ `/reset-password`), assuming a GitHub Pages origin. The site is actually served from the custom domain `https://sutravan.in` (build base `/`), so the local-parity values and the documented exact reset URL were wrong.
- **Fix:** Set `site_url = "https://sutravan.in"` and the redirect allowlist entry to `https://sutravan.in/reset-password`; removed the `akshayganesh.github.io` values; updated the `[auth]` header comment to reflect the custom-domain origin. `enable_confirmations = false` kept (D-01).
- **Files modified:** `supabase/config.toml`
- **Verification:** `grep` confirms only `sutravan.in` URLs present, no stray `akshayganesh` refs, `enable_confirmations = false` intact. Hosted Dashboard already set to the matching `https://sutravan.in` Site URL + exact `/reset-password` redirect (per owner).
- **Committed in:** `9488e9f`

---

**Total deviations:** 1 auto-fixed (1 bug — wrong production origin)
**Impact on plan:** Correction only — aligns local-parity config and documentation with the real deployed origin so the downstream reset slice (Plan 05) builds the correct `redirectTo`. No scope creep.

## Issues Encountered
- Task 3 is a blocking human-action checkpoint (interactive `supabase db push` + hosted Dashboard config not in git). Resolved by the owner: push applied, hosted Auth config set, both psql harnesses green. The original executor paused; this continuation completed the correction and documentation.

## User Setup Required
Owner completed the hosted setup at checkpoint approval (no further action needed for this plan):
- `supabase db push` (0004 applied live)
- Authentication → Email: Confirm email **OFF**
- Authentication → URL Configuration: Site URL `https://sutravan.in` + redirect `https://sutravan.in/reset-password`
- `SUPABASE_DB_URL` used to run both psql harnesses against the live DB

## Next Phase Readiness
- **DB security boundary is LIVE** — every downstream auth slice can rely on:
  - signup auto-creating a `role='customer'` profile row with the metadata name (Plan 03 register);
  - role self-escalation being blocked at the DB (Plan 03 functional proof / VALIDATION.md);
  - the service-role carve-out enabling the Plan 06 admin-bootstrap promote;
  - the exact `https://sutravan.in/reset-password` redirect being allowlisted for Plan 05 password reset.
- The functional customer-JWT escalation rejection is proven manually in the register slice (Plan 03) per VALIDATION.md — this plan established the mechanism that proof exercises.

## Self-Check: PASSED

All artifacts verified present (0004 migration, auth_rls_assertions.sql, config.toml, this SUMMARY) and all referenced commits exist in git history (dc31095, faab923, 04df168, e2993ef, 9488e9f).

---
*Phase: 03-authentication-roles*
*Completed: 2026-06-01*
