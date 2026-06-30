---
phase: 06-estimate-engine-delivery-schema-settings-edge-function
plan: 03
subsystem: delivery-estimate-edge-function
tags: [edge-function, deno, supabase, delivery, turnstile, cors, cache, zone-derivation]
requires:
  - "06-01: delivery schema (site_content keys, delivery_rate_slabs 20-row grid, delivery_estimate_cache deny-direct, profiles.default_pincode)"
  - "06-02: pincodes seeded (19,486 rows, canonical states, is_metro/is_remote)"
provides:
  - "delivery-estimate Edge Function (deployed to ref wfbnrcnmpcqzeyjlfflv): normalized { serviceable, cost, etaDays, codAvailable, originConfigured } from the seeded slab grid behind callCourierAdapter()"
  - "config.toml [functions.delivery-estimate] verify_jwt=false registration"
  - "scripts/verify-delivery-estimate.ts smoke harness (SC1-SC4)"
affects:
  - "Phase 7 (client hook/provider + product-detail UI consumes the Estimate contract)"
  - "DLVR-F1 (future live courier API swaps in behind callCourierAdapter with no frontend change)"
tech-stack:
  added: []
  patterns:
    - "Edge Function cloned from verify-and-submit (CORS allowlist + Turnstile siteverify + generic try/catch)"
    - "Service-role compute (legitimate divergence — no ownership invariant; sole writer of deny-direct cache)"
    - "Origin-relative zone derivation as in-file TS constants (ADJACENT map + metro prefixes + remote states)"
    - "Native Node 22 smoke harness (--env-file, type-stripping), token-free + SMOKE_COMPUTE gating"
key-files:
  created:
    - "supabase/functions/delivery-estimate/index.ts"
    - "scripts/verify-delivery-estimate.ts"
  modified:
    - "supabase/config.toml"
decisions:
  - "Service-role key (not anon) is correct for delivery-estimate — no per-user ownership invariant; cache rows are global; function is the sole writer of the deny-direct cache (NOT Pitfall 4). Documented in the file header."
  - "etaDays = slab transit + dispatch_lead_days (OQ1/A4); cost = roundUpTo10(slab.cost) (D-11/D-13)."
  - "Cache write SKIPPED when originConfigured=false (OQ2) — no provisional 000000 rows linger after Phase 9 sets a real origin."
  - "pincodes has no first3 column — first3 is computed in-function via substring(pincode,0,3); selects request only existing columns."
  - "Compute-path smoke (SC1/SC4-hit) is a human-action: the Turnstile secret swap is owner-only (Supabase secrets are write-only and cannot be read back to restore)."
metrics:
  duration: ~10min
  completed: 2026-06-30
---

# Phase 6 Plan 03: Delivery-Estimate Edge Function Summary

The `delivery-estimate` Supabase Edge Function — the server-side engine that turns a destination pincode + weight into a normalized `{ serviceable, cost, etaDays, codAvailable, originConfigured }` estimate from the seeded zone-weight slab grid behind a swappable `callCourierAdapter()` seam — is built, deployed live to ref `wfbnrcnmpcqzeyjlfflv`, and proven green by a token-free smoke harness.

## What Was Built

- **`supabase/functions/delivery-estimate/index.ts`** (≈490 lines) — clones the proven `verify-and-submit` CORS/Turnstile scaffold (`ALLOWED_ORIGINS`, `corsHeadersFor`, OPTIONS preflight, generic `catch → bad_request 400`, `Deno.env` secret read, siteverify POST). A header comment documents the **service-role divergence** (legitimate — no ownership invariant; sole writer of the deny-direct cache) so a future reader does not "fix" it to the anon key. Request flow: shape-guard → `/^\d{6}$/` validation **before** any Turnstile/compute → siteverify → read `site_content` settings → `weightBucket` → cache read → `callCourierAdapter` → cache write (guarded) → normalized JSON. `callCourierAdapter` is the swappable seam: serviceability (`pincodes` membership) → `deriveZone` (in-file `ADJACENT`/metro/remote constants, 5 ordered steps, `000000`/absent origin → `originConfigured:false` + national lane) → slab lookup (`delivery_rate_slabs`) → `roundUpTo10(slab.cost)` → `etaDays = transit + dispatch_lead_days` → `codAvailable`. An `AbortController` (8s) bounds all upstream work. The internal `zone` field is stripped from the public response on both the compute and cache-hit paths.
- **`supabase/config.toml`** — appended `[functions.delivery-estimate]` (sibling of `verify-and-submit`) with `verify_jwt = false` so anon visitors reach the body; Turnstile is the gate (D-21).
- **`scripts/verify-delivery-estimate.ts`** — native Node 22 smoke harness with two modes. Token-free (default) proves SC2-format, SC3 (no-secret bundle + CORS bad-origin not echoed + `ALLOWED_ORIGINS`/`AbortController` present), and SC4-deny-direct. `SMOKE_COMPUTE=1` adds SC1 (serviceable integer cost), SC2-serviceability (`999999 → false`), and SC4-hit (transient real-origin swap → write-then-hit asserting `fetched_at` unchanged, restored in `finally`).

## Verification Results

**Deploy:** `supabase functions deploy delivery-estimate` (no `--linked` flag, per Phase 5 deviation) — `Deployed Functions on project wfbnrcnmpcqzeyjlfflv: delivery-estimate`.

**Token-free smoke (`<automated>` gate) — ALL PASS:**
- `PASS: SC2-format` — malformed / non-6-digit / non-string `destPincode` → 400 `bad_request` before Turnstile.
- `PASS: SC3-static` — no `service_role` in `dist/` (check-no-secret.sh green); `ALLOWED_ORIGINS` + `AbortController` present; no `VITE_` ref.
- `PASS: SC3-CORS` — disallowed Origin not echoed (defaults to `https://sutravan.in`, no wildcard).
- `PASS: SC4-deny-direct` — anon cannot read `delivery_estimate_cache` (0 rows / permission denied).

**Task verify greps:** Task 1 grep gate `PASS order` (all symbols present, regex-before-siteverify ordering holds, all four tables referenced, no `VITE_`). Task 2 config grep `verify_jwt = false` present.

## Pending Human-Action: Compute-Path Smoke (SC1 / SC2-serviceability / SC4-hit)

The compute path is gated behind a Cloudflare Turnstile always-pass **test secret** swap. This is an **owner-only human-action** and was deliberately NOT performed by the executor because **the real `TURNSTILE_SECRET_KEY` is not recoverable** — Supabase secrets are write-only (cannot be read back), and the repo holds only the public `VITE_TURNSTILE_SITE_KEY`, not the secret. Swapping would leave production on the always-pass secret with no automated way to restore it (and `supabase secrets set` currently errors on access-token format in this environment). The live project was therefore left **completely untouched** (verified: `delivery_origin_pincode = "000000"`, `delivery_estimate_cache` = 0 rows).

To complete the compute-path proof, the owner runs (from their authenticated CLI, with their real secret in hand):
```bash
# 1. Swap in the Cloudflare always-pass TEST secret
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# 2. Run the compute-path smoke (the script transiently swaps + restores the origin itself)
SMOKE_COMPUTE=1 node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts
# 3. RESTORE the REAL secret (do NOT leave the test secret on production)
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=<the real Turnstile secret>
# 4. Confirm delivery_origin_pincode is back to 000000 (the script restores it; verify)
```
Expected: `PASS: SC1` (560001 → serviceable, integer cost ÷10, etaDays, originConfigured:false), `PASS: SC2-serviceability` (999999 → false), `PASS: SC4-hit` (2nd call served from cache, `fetched_at` unchanged), then `restored delivery_origin_pincode → 000000`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `pincodes` table has no `first3` column**
- **Found during:** Task 1
- **Issue:** RESEARCH "Per-pincode facts" listed `first3` as a stored column, but migration `0015_pincodes.sql` (and the Plan 02 seed) never added it — selecting `first3` from `pincodes` would raise a PostgREST column error.
- **Fix:** The function computes `first3` in-process via `pincode.substring(0,3)` (`first3Of()`), and the `PincodeRow` selects request only existing columns (`pincode, state, is_metro, is_remote, serviceable`). The `first3` type field stays optional with a substring fallback, so zone derivation is unaffected.
- **Files modified:** `supabase/functions/delivery-estimate/index.ts`
- **Commit:** 8353f10

**2. [Rule 3 - Blocking] `VITE_` token in a comment tripped the no-secret gate**
- **Found during:** Task 1
- **Issue:** The acceptance gate requires `! grep -q 'VITE_'`; an explanatory comment ("never VITE_/bundled") contained the literal token and failed the gate.
- **Fix:** Reworded the comment to "never a client-bundled env var" — no behavior change.
- **Files modified:** `supabase/functions/delivery-estimate/index.ts`
- **Commit:** 8353f10

### Designed Human-Action (not a deviation)

The compute-path smoke (SC1/SC4-hit) is the plan's `<human-check>` — it requires the owner-only Turnstile secret swap and is documented above. The plan's `<automated>` verify (token-free SC2-format/SC3/SC4-deny-direct) passed without it.

## Live Side-Effects

None performed. No Turnstile secret swap, no origin swap, no cache rows written by the executor. The live project (ref `wfbnrcnmpcqzeyjlfflv`) is in its original state: real Turnstile secret intact, `delivery_origin_pincode = 000000`, `delivery_estimate_cache` empty. The only live mutation this plan made is the **function deploy** itself (Task 2).

## Self-Check: PASSED
