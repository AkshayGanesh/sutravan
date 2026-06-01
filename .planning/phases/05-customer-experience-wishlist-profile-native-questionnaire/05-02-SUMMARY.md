---
phase: 05-customer-experience-wishlist-profile-native-questionnaire
plan: 02
subsystem: database
tags: [supabase, rls, edge-function, deno, turnstile, postgrest, cors, questionnaire]

# Dependency graph
requires:
  - phase: 01-supabase-foundation
    provides: "customization_submissions table (0001) + admin_or_owner_read SELECT policy (0002, INSERT deliberately omitted) + the supabase-live-ops db-push flow"
  - phase: 04-admin-portal-catalog-content-management
    provides: "read-only admin submissions inbox (Submissions.tsx, D-17) that this plan's INSERT path finally feeds"
provides:
  - "Migration 0007 — anon+authenticated INSERT policy customization_submissions_anon_or_owner_insert with the D-01 WITH CHECK ownership invariant (live & enforced)"
  - "verify-and-submit — the project's FIRST Supabase Edge Function: Turnstile siteverify -> insert under the caller's JWT (never service-role)"
  - "[functions.verify-and-submit] verify_jwt = false config so anon submitters reach the function body"
  - "submissions_insert_assertions.sql — structural assertion harness proving the policy shape (both roles, real WITH CHECK)"
affects: [questionnaire-wizard, plan-05-03, profile, customer-account]

# Tech tracking
tech-stack:
  added: ["Supabase Edge Functions (Deno runtime)", "Cloudflare Turnstile (server-side siteverify)"]
  patterns:
    - "Edge Function inserts under the CALLER's JWT (anon key + Authorization passthrough), never the service-role key, so RLS WITH CHECK stays the ownership boundary (Pitfall 4 / T-05-06)"
    - "Turnstile token verified server-side via siteverify; secret held only in the function env (supabase secrets set), never VITE_-prefixed or bundled (T-05-09)"
    - "verify_jwt = false per-function so anon callers are not rejected at the platform edge; Turnstile + INSERT RLS are the real gates (Pitfall 1)"
    - "CORS Access-Control-Allow-Origin restricted to an allow-list (https://sutravan.in + localhost dev), never a wildcard; OPTIONS preflight handled (Pitfall 2 / T-05-10)"
    - "Structural SQL assertion harness for INSERT policies: assert existence, both-roles membership, and a real (non-true) WITH CHECK predicate"

key-files:
  created:
    - supabase/migrations/0007_submissions_insert_policy.sql
    - supabase/tests/submissions_insert_assertions.sql
    - supabase/functions/verify-and-submit/index.ts
  modified:
    - supabase/config.toml

key-decisions:
  - "D-01 ownership invariant lives in 0007 WITH CHECK: anon -> auth.uid() is null AND user_id is null; authenticated -> user_id = (select auth.uid()). No SELECT/UPDATE/DELETE policy (reads ride 0002's admin_or_owner_read)."
  - "Edge Function uses the caller's JWT (anon key + Authorization header), NEVER the service-role key, so the 0007 WITH CHECK actually fires (T-05-06)."
  - "Open Question 1 / T-05-08 ACCEPTED: a client can still insert directly via PostgREST (skipping Turnstile), but every such row is still user_id-correct under 0007 — residual spam risk accepted for a small no-payments brand; documented in the function header."
  - "DEVIATION: `supabase functions deploy --linked` was specified by the plan but CLI v2.102.0 rejects --linked on functions deploy (deploys to the linked project by default) — deployed without the flag to project ref wfbnrcnmpcqzeyjlfflv."

patterns-established:
  - "Edge Function security idiom: verify third-party token -> createClient(anon, { Authorization: callerHeader }) -> insert; RLS is the boundary, not service-role"
  - "Per-function verify_jwt = false for anonymous-reachable functions, with the real gates pushed down to Turnstile + RLS"

requirements-completed: []  # CUST-03 BACKEND HALF only — wizard (Plan 03) completes the customer-facing half before CUST-03 is marked done

# Metrics
duration: ~25min
completed: 2026-06-01
---

# Phase 05 Plan 02: Questionnaire Backend Summary

**The questionnaire write path the native wizard will fire through: migration 0007's anon+authenticated INSERT policy enforces the D-01 ownership invariant (anon -> null user_id; authenticated -> own uid only) live on the project, and the project's first Edge Function `verify-and-submit` verifies a Cloudflare Turnstile token then inserts under the caller's JWT (never service-role) — all four D-01 RLS cases and the Turnstile-fail case proven against the live project.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3 (2 auto + 1 blocking-human checkpoint, all complete)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- **Migration 0007** — the single schema/RLS gap closed: policy `customization_submissions_anon_or_owner_insert` `for insert` `to anon, authenticated` whose WITH CHECK is the disjunction (anon: `auth.uid() is null and user_id is null`; authenticated: `auth.uid() is not null and user_id = (select auth.uid())`). No `using (true)`, no SELECT/UPDATE/DELETE policy. **Pushed live** to project ref `wfbnrcnmpcqzeyjlfflv` (migration list shows `0007 | 0007`).
- **verify-and-submit Edge Function** — first in the project: OPTIONS preflight, allow-listed CORS origin, Turnstile `siteverify` with the secret read from `TURNSTILE_SECRET_KEY` env, then `.from('customization_submissions').insert(submission)` under a client built from the caller's `Authorization` header (anon key, NOT service-role). Returns `400 {error:'captcha_failed'}` on token failure, `400 {error: <msg>}` on insert/RLS error, `200 {ok:true}` on success. **Deployed live** with `verify_jwt = false`.
- **submissions_insert_assertions.sql** — structural harness mirroring `rls_assertions.sql` (`do $$ … raise notice '… PASSED' end $$;`): asserts the policy exists with `cmd='INSERT'`, is reachable by both `anon` and `authenticated`, and has a non-null, non-literal-`true` WITH CHECK. **Ran live** → `ALL D-01 SUBMISSIONS-INSERT INVARIANTS PASSED`.
- **config.toml** — `[functions.verify-and-submit]` block with `verify_jwt = false` so anon submitters reach the function body.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0007 (anon+auth INSERT policy) + SQL assertion harness** - `bbfb3f0` (feat)
2. **Task 2: Edge Function verify-and-submit + verify_jwt=false config** - `f7e3a51` (feat)
3. **Task 3: [BLOCKING] push schema, set secret, deploy function, prove RLS live** - no code commit (live ops: db push + secrets set + functions deploy + manual D-01 / Turnstile proofs); outcomes recorded below.

**Plan metadata:** see the `docs(05-02)` commit that carries this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified
- `supabase/migrations/0007_submissions_insert_policy.sql` - anon+auth INSERT policy with the D-01 WITH CHECK ownership invariant on `customization_submissions` (created, pushed live).
- `supabase/tests/submissions_insert_assertions.sql` - structural assertion that the INSERT policy exists with both roles and a real WITH CHECK (created, ran live → PASSED).
- `supabase/functions/verify-and-submit/index.ts` - first Edge Function: Turnstile siteverify + caller-JWT insert + CORS/OPTIONS (created, deployed live).
- `supabase/config.toml` - added `[functions.verify-and-submit] verify_jwt = false` (modified).

## Decisions Made
- **D-01 ownership invariant in WITH CHECK** (not a blanket `true`): authenticated submitters may only set `user_id = (select auth.uid())`, anon submitters must carry `user_id = null`. Reads ride the existing `customization_submissions_admin_or_owner_read` (0002); no update/delete path this phase.
- **Caller-JWT insert, never service-role:** the function builds its client from the anon key + the caller's `Authorization` header. Using the service-role key would bypass RLS and void the ownership guarantee — deliberately avoided and documented in the function header (T-05-06).
- **Open Question 1 / T-05-08 accepted:** the direct-PostgREST insert path can skip Turnstile, but 0007 still scopes `user_id` on every such row. The residual "spam-without-Turnstile, but owner-scoped" risk is accepted for a small handmade brand with no payments; revisit (function-only insert path) only if spam appears.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `supabase functions deploy --linked` flag rejected by CLI v2.102.0**
- **Found during:** Task 3 (live deploy of the Edge Function)
- **Issue:** The plan's how-to-verify specified `./node_modules/.bin/supabase functions deploy verify-and-submit --linked`, but Supabase CLI v2.102.0 does not accept `--linked` on `functions deploy` (the command deploys to the linked project by default; the flag is an unknown flag and aborts the deploy).
- **Fix:** Ran `supabase functions deploy verify-and-submit` (without `--linked`); the CLI deployed to the linked project ref `wfbnrcnmpcqzeyjlfflv` as intended. Same project, same result — only the now-invalid flag was dropped.
- **Files modified:** none (operational deviation; no source change).
- **Verification:** Deploy succeeded; the live Turnstile proof (invalid token → `400 captcha_failed`, no row) confirms the deployed function is the one with server-side siteverify against the real secret.

---

**Total deviations:** 1 auto-fixed (1 blocking — invalid CLI flag).
**Impact on plan:** No scope or behavior change; the deviation only corrected an outdated CLI flag. The function deployed to the correct project.

## Issues Encountered
None beyond the CLI-flag deviation above. The structural assertions and all live functional proofs passed on the first run; no test rows persist (the RLS-proof script cleaned up its own `rls-test-%` rows).

## Security / D-01 Proof Results (Task 3, blocking-human — verified live)

- **Schema push:** `supabase db push` applied 0007 to ref `wfbnrcnmpcqzeyjlfflv`; `supabase migration list` shows `0007 | 0007` (live & enforced).
- **Structural assertions:** ran in the Supabase SQL editor → `ALL D-01 SUBMISSIONS-INSERT INVARIANTS PASSED` (policy exists, both roles, real WITH CHECK).
- **Secret:** `TURNSTILE_SECRET_KEY` set via `supabase secrets set` — a REAL Cloudflare secret (not the always-pass test key).
- **Function deploy:** `supabase functions deploy verify-and-submit` succeeded (see deviation re: `--linked`), deployed with `verify_jwt = false`.
- **FUNCTIONAL D-01 RLS proof — all four cases PASS live (T-05-05):**
  - (A) anon + `user_id = null` → **allowed**
  - (B) anon + non-null `user_id` → **rejected**
  - (C) authenticated A forging another user's `user_id` → **rejected**
  - (D) authenticated A with own `user_id` → **allowed**
- **FUNCTIONAL Turnstile proof (T-05-07):** invalid token → `HTTP 400 {"error":"captcha_failed"}` with **no row inserted** — confirms server-side siteverify with the real secret, not a client-trusted check.

## Known Stubs
None. The migration is live, the function is deployed, and all invariants are proven against the live project.

## Threat Flags
None — no security surface beyond the plan's `<threat_model>` was introduced. The only network egress is the Cloudflare `siteverify` endpoint (planned, T-05-07/T-05-09); the only insert path is `customization_submissions` under caller-JWT RLS (planned, T-05-05/T-05-06).

## User Setup Required
External service configured during this plan (already done, recorded for reproducibility):
- **Cloudflare Turnstile** — a managed-mode widget; `TURNSTILE_SECRET_KEY` set server-side via `supabase secrets set` (Edge Function env only, NEVER a `VITE_` var). The public `VITE_TURNSTILE_SITE_KEY` is consumed by the client widget in Plan 03.

## Next Phase Readiness
- **Plan 03 (questionnaire wizard)** can now invoke `verify-and-submit` directly: POST `{ token, submission }` to the deployed function; the function handles Turnstile + the owner-scoped insert. The wizard supplies the Turnstile token (site key) and the submission body (omitting `user_id` for anon; setting it to the caller's uid for authenticated, which RLS will re-verify).
- **CUST-03 is half-complete:** the backend write path is live and proven; the customer-facing native wizard (Plan 03) completes the requirement. CUST-03 intentionally remains Pending until Plan 03 ships.
- The admin submissions inbox (Phase 4, Submissions.tsx) will start receiving real rows once the wizard is live.

## Self-Check: PASSED

- Created files exist on disk: `supabase/migrations/0007_submissions_insert_policy.sql`, `supabase/tests/submissions_insert_assertions.sql`, `supabase/functions/verify-and-submit/index.ts` — all FOUND. `supabase/config.toml` (modified) FOUND with the `verify-and-submit` block.
- Commits exist in git log: `bbfb3f0` (Task 1, feat), `f7e3a51` (Task 2, feat) — both FOUND.
- Live verification (Task 3): 0007 pushed (`0007 | 0007`), structural assertions PASSED live, secret set, function deployed, all four D-01 RLS cases + Turnstile-fail case proven.

---
*Phase: 05-customer-experience-wishlist-profile-native-questionnaire*
*Completed: 2026-06-01*
