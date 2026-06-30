---
phase: 06-estimate-engine-delivery-schema-settings-edge-function
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - supabase/functions/delivery-estimate/index.ts
  - scripts/transform-pincodes.ts
  - scripts/seed-pincodes.ts
  - scripts/verify-delivery-estimate.ts
  - scripts/verify-delivery-seed.ts
  - supabase/config.toml
  - supabase/migrations/0014_delivery_settings_seed.sql
  - supabase/migrations/0016_delivery_rate_slabs.sql
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the delivery-estimate Edge Function and its supporting schema/seed/verify
scripts. The core security posture is sound: input validation (`/^\d{6}$/`) precedes
Turnstile and all compute (line 357), CORS never reflects a disallowed origin or a
wildcard (defaults to prod), the service-role usage is the documented legitimate
divergence (no per-user invariant, function is sole writer of the deny-direct cache),
all DB access is parameterized PostgREST `.eq()` (no SQL injection surface), secrets
are read only from `Deno.env` and never reflected into responses, and both seed
migrations plus the pincode upsert are genuinely idempotent.

No BLOCKERs found. However, three WARNINGs degrade robustness/correctness:
(1) the documented "bound all upstream work with an 8s AbortController" invariant is
not actually upheld — the Turnstile fetch and the settings read run unbounded, and the
SC3 smoke only greps for the literal string so it gives false assurance;
(2) a state-name canonicalization drift between the seed and the engine's adjacency
table mis-zones one UT; (3) the live SC4 smoke mutates production settings with a
crash/concurrency window that can corrupt the prod origin and pollute the cache.

## Warnings

### WR-01: AbortController does not bound the Turnstile fetch or the settings read — documented 8s invariant is false

**File:** `supabase/functions/delivery-estimate/index.ts:366-376, 393-397, 452`
**Issue:** The header and inline comment (lines 391-392) assert: "Bound all upstream
work with an AbortController timeout so a hung dependency cannot stall the request."
In practice the `AbortController` (`ac`) is created at line 393 — *after* the Turnstile
`siteverify` fetch (line 366), which is the most likely external dependency to hang
(network call to `challenges.cloudflare.com`). That fetch has no timeout at all.
Additionally, `readSettings()` (called line 397) issues a `site_content` query (line
204) that never receives `ac.signal`, and the cache-write `upsert` (line 452) is also
unbounded. So a hung Cloudflare endpoint or a stalled settings query holds the request
open well past the intended 8s. The SC3 assertion only does `/AbortController/.test(src)`
(verify-delivery-estimate.ts:125), so it passes regardless of whether the timeout
actually covers the work — false confidence.
**Fix:** Wrap the Turnstile fetch with the same abort signal (create `ac` before the
fetch and pass `signal: ac.signal` into the `fetch` options), thread `ac.signal` through
`readSettings()` (`.abortSignal(signal)` on its query), and add `.abortSignal(ac.signal)`
to the cache-write `upsert`. Start the `setTimeout(() => ac.abort(), 8000)` before the
Turnstile call so the whole request path is bounded.

### WR-02: Zone mis-derivation — seed canonicalizes "The Dadra and Nagar Haveli and Daman and Diu" but the engine's adjacency uses the un-prefixed form

**File:** `supabase/functions/delivery-estimate/index.ts:132` vs `scripts/transform-pincodes.ts:79`
**Issue:** `transform-pincodes.ts` canonicalizes (and the `KNOWN_STATES` guard requires)
the UT state string as `'The Dadra and Nagar Haveli and Daman and Diu'` (with the leading
"The"), so that is the exact `state` value seeded into `public.pincodes`. The engine's
`ADJACENT['Gujarat']` array (index.ts:132) lists the neighbor as
`'Dadra and Nagar Haveli and Daman and Diu'` (no "The"). In `deriveZone()` the equality
check `(ADJACENT[origin.state] ?? []).includes(dest.state)` therefore never matches for a
destination in that UT, so once the owner sets a Gujarat origin (Phase 9) those shipments
are mis-classified `'national'` instead of `'regional'` — wrong cost band and wrong ETA.
The mismatch is a direct symptom of the duplicated constant sets (see IN-02). It is latent
in Phase 6 only because the origin is the `000000` placeholder.
**Fix:** Make the two strings identical — either add the `'The'` prefix in index.ts:132
(and any other reference), or strip it during normalization. Prefer a single shared
canonical-state source so engine and seed cannot drift.

### WR-03: SC4 cache-hit smoke mutates LIVE production settings with an unsafe crash/concurrency window

**File:** `scripts/verify-delivery-estimate.ts:189-273`
**Issue:** `assertSC4CacheHit()` runs against the live linked project and temporarily
`UPDATE site_content SET value='110001' WHERE key='delivery_origin_pincode'` (line 215),
restoring `000000` only in `finally`. If the process is killed (SIGKILL, OOM, CI timeout)
between the swap and the restore, production is left advertising the wrong origin until a
human notices. Worse, during the swap window the function is live: any concurrent real
visitor requesting a *different* destination pincode computes and writes a cache row keyed
under origin `110001`, and the cleanup (lines 268-269) deletes only the single
`DEST=560001 / bucket=1` row — every other polluted row lingers for 24h. This is
verification code, but it directly affects production state reliability.
**Fix:** Gate this destructive smoke behind an explicit non-prod / maintenance-window flag
and an idempotent pre-run restore; or exercise write-then-hit against a disposable
origin/dest pair that does not overlap real traffic; or run it only against a staging
project. At minimum, record `ORIGINAL_ORIGIN` to durable output before the swap so a
crashed run is manually recoverable.

## Info

### IN-01: `freeShipThreshold`, `codRules.fee`, `codRules.valueCap` are parsed but never used

**File:** `supabase/functions/delivery-estimate/index.ts:220, 227-239, 336`
**Issue:** `readSettings()` parses `freeShipThreshold` and the COD `fee`/`valueCap`, but
`callCourierAdapter()` only consumes `codRules.enabled` (→ `codAvailable`) and ignores the
rest. The function has no cart-value input, so free-shipping and COD-cap logic cannot be
applied here. The reads are effectively dead within this phase.
**Fix:** Acceptable if intentionally reserved for a later phase; add a one-line comment
noting they are passed through for forward-compat, or drop them from this function until
the consuming phase lands, to avoid implying they affect the returned estimate.

### IN-02: Zone constants duplicated across files (drift root cause of WR-02)

**File:** `supabase/functions/delivery-estimate/index.ts:97-121` and `scripts/transform-pincodes.ts:35-51`
**Issue:** `METRO_PREFIXES` and `REMOTE_STATES` are hand-maintained in two places. The seed
transform and the runtime engine must agree exactly for zone derivation to be correct;
WR-02 is the concrete failure this duplication already produced.
**Fix:** Extract the canonical metro-prefix set, remote-state set, and adjacency/state names
into a single shared module imported by both (or a generated constant), so they cannot
diverge.

### IN-03: CSV parser cannot handle quoted fields containing embedded newlines

**File:** `scripts/transform-pincodes.ts:154, 104-132`
**Issue:** `parseLine` is correctly quote-aware for embedded commas, but the input is first
split on `\r?\n` (line 154), so a double-quoted field spanning a newline (valid CSV) would
be mis-parsed. The India Post dump likely has none, but the guard is silent if it does.
**Fix:** Note the assumption in the header, or use a streaming CSV parser that tracks quote
state across line boundaries if multi-line fields are ever possible.

### IN-04: Weight band 4 clamp is unbounded while the slab table documents a 2000g ceiling

**File:** `supabase/functions/delivery-estimate/index.ts:188-193` and `supabase/migrations/0016_delivery_rate_slabs.sql:51,69`
**Issue:** `weightBucket()` returns band 4 for any weight > 1000g with no upper limit, but
the seeded band-4 slab is documented as 1001-2000g. A >2kg parcel silently bills at the
2kg slab. Low risk for soap/skincare parcels, and the behavior is documented ("clamp
everything above 1000g into band 4"), but the table's stated ceiling and the engine's clamp
disagree.
**Fix:** If >2kg is out of scope, return `serviceable:false` (or a heavier band) above
2000g rather than silently undercharging; otherwise document that band 4 is "1001g+".

### IN-05: `minimum_password_length = 6` is below the recommended floor

**File:** `supabase/config.toml:186`
**Issue:** Auth permits 6-character passwords (the config's own comment recommends 8+).
Pre-existing and not introduced by this phase, but in scope as a reviewed file.
**Fix:** Raise to at least 8 and consider a `password_requirements` value; coordinate with
the hosted Dashboard, which is the runtime source of truth (per the file's own note).

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
