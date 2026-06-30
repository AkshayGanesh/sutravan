---
phase: 06-estimate-engine-delivery-schema-settings-edge-function
verified: 2026-06-30T12:00:00Z
status: human_needed
score: 3/5 must-haves verified
re_verification: false
human_verification:
  - test: "Run SMOKE_COMPUTE=1 against live function with Turnstile always-pass test secret"
    expected: "SC1 PASS (560001 → serviceable, cost ÷ 10, etaDays present, originConfigured:false, no zone in response); SC2-serviceability PASS (999999 → serviceable:false, HTTP 200); SC4-hit PASS (2nd call fetched_at unchanged)"
    why_human: "Compute path is gated by Turnstile siteverify. The real TURNSTILE_SECRET_KEY is write-only on Supabase (cannot be read back), so the executor intentionally deferred the test-secret swap to avoid stranding production. Owner must execute: (1) supabase secrets set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA, (2) SMOKE_COMPUTE=1 node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts, (3) restore the real secret."
---

# Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function Verification Report

**Phase Goal:** A server-side rate engine computes a normalized, vendor-agnostic delivery estimate (serviceability, estimated cost in INR, ETA day range, COD availability) from an admin-tunable zone-weight table behind a swappable adapter — with all delivery data structures, RLS, and seeded defaults in place so estimates return real numbers before any UI exists.
**Verified:** 2026-06-30
**Status:** human_needed
**Re-verification:** No — initial verification

## MVP Mode Note

The ROADMAP marks this phase `mode: mvp` but the goal text does not follow the `As a [user], I want to [capability], so that [outcome]` User Story format (it is a declarative engine description). `gsd-tools` is not available in this environment, so the formal User Story format guard cannot be applied. Verification proceeds against the five enumerated ROADMAP Success Criteria, which are testable regardless of goal framing. This discrepancy is noted but does not block the verification outcome — the SCs are clear and unambiguous.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Invoking delivery-estimate with pincode + weight returns normalized {serviceable, cost, etaDays, codAvailable} from the seeded slab; courier shape never leaks past callCourierAdapter() | ? HUMAN NEEDED | Code is substantively correct: callCourierAdapter() exists (line 247), Estimate shape defined (lines 63-73), zone stripped from public response (line 478). Live execution proof requires Turnstile test-secret swap. |
| 2 | SC2-format: Non-6-digit / non-numeric pincode rejected server-side BEFORE any compute — never a 500 | ✓ VERIFIED | `/^\d{6}$/` check at line 357, ordering confirmed: regex at line 357 precedes siteverify at line 367. VERIFIED LIVE by token-free smoke: `PASS: SC2-format` (06-03-SUMMARY.md) |
| 3 | SC2-serviceability: Non-serviceable destination returns clean serviceable:false, HTTP 200 | ? HUMAN NEEDED | Code: `if (!destRow || destRow.serviceable === false)` returns `{serviceable:false, cost:null, etaDays:null, codAvailable:false}` (lines 269-278). Live proof requires Turnstile test-secret. |
| 4 | SC3: No client secret, CORS allowlist (no wildcard), Turnstile-gated, upstream work bounded by timeout | ✓ VERIFIED (with WR-01 warning) | No VITE_ in source (grep confirmed); ALLOWED_ORIGINS Set with 3 explicit origins, no wildcard (lines 43-47); corsHeadersFor() defaults to prod (lines 49-60); Turnstile siteverify block present (lines 364-383); AbortController (8s) present (line 393-394). check-no-secret.sh PASS + SC3-CORS PASS live (06-03-SUMMARY.md). WR-01: Turnstile fetch and readSettings are outside the AbortController scope (see Anti-Patterns). |
| 5 | SC4-deny-direct: delivery_estimate_cache is RLS-enabled, no policies, anon cannot read | ✓ VERIFIED | 0017 migration: `enable row level security` present (line 38), zero non-comment `create policy` statements (confirmed by Python grep). VERIFIED LIVE by both verify-delivery-seed.ts and verify-delivery-estimate.ts: `PASS: SC4-deny-direct` (06-01-SUMMARY.md, 06-03-SUMMARY.md). |
| 6 | SC4-cache-hit: Repeat (origin, dest, weight-bucket) lookups within TTL served from cache; function is sole writer | ? HUMAN NEEDED | Code: cache read with `gt('expires_at', nowIso)` (line 405-415); upsert with `onConflict: 'origin_pincode,dest_pincode,weight_bucket'` (lines 454-469); write skipped when `!estimate.originConfigured` (line 450). Live proof (write-then-hit with real origin) requires Turnstile test-secret. |
| 7 | SC5: All delivery data exists via idempotent migrations with seeded defaults | ✓ VERIFIED | See artifacts section below. All 5 migrations verified by static analysis. |

**Score:** 3/5 success criteria auto-verified (SC2-format, SC3, SC4-deny-direct, SC5 confirmed; SC1, SC2-serviceability, SC4-hit pending human execution). Framed as 3/5 since SC2 and SC4 each have one auto-verified half and one human-needed half.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0014_delivery_settings_seed.sql` | 5 delivery site_content keys | ✓ VERIFIED | Exactly 5 `('delivery_*'` rows; `on conflict (key) do nothing` present. Keys: origin (000000), default_weight_g (250), dispatch_lead_days (1), cod_rules (JSON), free_ship_threshold (null). |
| `supabase/migrations/0015_pincodes.sql` | pincodes table + RLS + no bulk insert | ✓ VERIFIED | `create table public.pincodes`, `serviceable boolean not null default true`, `pincodes_public_read` (using true), `pincodes_admin_write` (private.is_admin()), no `insert into public.pincodes` bulk data. |
| `supabase/migrations/0016_delivery_rate_slabs.sql` | slab table + 20-row monotonic grid + RLS | ✓ VERIFIED | `unique (zone, weight_band)`, zone/weight_band CHECKs, exactly 20 slab rows (grep confirmed), `on conflict (zone, weight_band) do nothing`, public-read + admin-write RLS. |
| `supabase/migrations/0017_delivery_estimate_cache.sql` | deny-direct cache table | ✓ VERIFIED | `enable row level security` present; Python grep confirms zero non-comment `create policy` lines. `unique (origin_pincode, dest_pincode, weight_bucket)` present. Deny-direct banner comment explains design. |
| `supabase/migrations/0018_profiles_default_pincode.sql` | profiles.default_pincode column | ✓ VERIFIED | `alter table public.profiles add column default_pincode text;` present. Inherits profiles_self_update RLS per comment. |
| `supabase/functions/delivery-estimate/index.ts` | Edge Function (min 180 lines, callCourierAdapter) | ✓ VERIFIED | ~490 lines; all required symbols present: corsHeadersFor, callCourierAdapter, deriveZone, weightBucket, roundUpTo10, AbortController, ALLOWED_ORIGINS, Estimate type, originConfigured. No VITE_ refs. SUPABASE_SERVICE_ROLE_KEY used (with documented justification). |
| `supabase/config.toml` | [functions.delivery-estimate] verify_jwt=false | ✓ VERIFIED | `[functions.delivery-estimate]` block confirmed at line 382; `verify_jwt = false` present. |
| `scripts/verify-delivery-estimate.ts` | Smoke harness SC1-SC4 | ✓ VERIFIED | Substantive (297 lines): assertSC2Format, assertSC3Static, assertSC3Cors, assertSC4DenyDirect (token-free); assertSC1AndServiceability, assertSC4CacheHit (SMOKE_COMPUTE=1). exports main. |
| `scripts/transform-pincodes.ts` | CSV → NDJSON with canonical states | ✓ VERIFIED | Exists (271 lines). Quote-aware CSV parser, StateName normalization, KNOWN_STATES guard (Pitfall A), is_metro/is_remote derivation, NA-only pincode drop. |
| `scripts/data/pincodes.ndjson` | ~19.5k normalized rows | ✓ VERIFIED | 19,486 lines confirmed (wc -l). State field uses `"The Dadra and Nagar Haveli and Daman and Diu"` (with "The" — canonical form per KNOWN_STATES). |
| `scripts/seed-pincodes.ts` | Service-role chunked upsert | ✓ VERIFIED | Exists (3.4K); references pincodes.ndjson, uses `onConflict: 'pincode'`. |
| `scripts/verify-delivery-seed.ts` | SC4+SC5 harness | ✓ VERIFIED | Exists; asserts 5 delivery keys, slabs==20+monotonic, profiles.default_pincode selectable, anon cache denied, pincodes>=15000 (PINCODES_OPTIONAL=1 skip). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `delivery-estimate/index.ts` | `public.pincodes` | `from('pincodes')` service-role query | ✓ WIRED | Lines 258-261 (dest), 285-289 (origin). `.abortSignal(signal)` on both. |
| `delivery-estimate/index.ts` | `public.delivery_rate_slabs` | `from('delivery_rate_slabs')` slab lookup | ✓ WIRED | Lines 302-310; `.abortSignal(signal)`. |
| `delivery-estimate/index.ts` | `public.delivery_estimate_cache` | read-then-write (sole writer) | ✓ WIRED | Cache read lines 404-415 (`.abortSignal(ac.signal)`); cache write lines 454-469 (guarded by `estimate.originConfigured`). Upsert NOT using ac.signal (WR-01 partial). |
| `delivery-estimate/index.ts` | `public.site_content` | `from('site_content')` settings read | ✓ WIRED | readSettings() lines 196-241; reads 5 delivery keys. NOT using ac.signal (WR-01). |
| `scripts/seed-pincodes.ts` | `public.pincodes` | chunked upsert onConflict pincode | ✓ WIRED | Confirmed by grep: `onConflict: 'pincode'`. |
| `scripts/transform-pincodes.ts` | `scripts/data/pincodes.ndjson` | writes normalized NDJSON | ✓ WIRED | OUT_PATH references pincodes.ndjson. 19,486 rows confirmed. |

### Data-Flow Trace (Level 4)

Not applicable for server-side Edge Functions (no React component rendering dynamic state). The Edge Function itself is the data producer; the consumer (Phase 7 product detail UI) does not yet exist.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Format-invalid pincode → 400 before compute | Token-free smoke via verify-delivery-estimate.ts | PASS (06-03-SUMMARY.md) | ✓ PASS |
| Disallowed Origin not echoed | SC3-CORS assertion in token-free smoke | PASS (06-03-SUMMARY.md) | ✓ PASS |
| No service_role in client bundle | check-no-secret.sh | PASS (06-03-SUMMARY.md) | ✓ PASS |
| Anon cannot read delivery_estimate_cache | SC4-deny-direct probe (both verify scripts) | PASS (06-01-SUMMARY.md, 06-03-SUMMARY.md) | ✓ PASS |
| Serviceable pincode → normalized estimate (SC1) | SMOKE_COMPUTE=1 with Turnstile test secret | NOT RUN (deferred) | ? SKIP |
| Non-serviceable pincode → serviceable:false (SC2-svc) | SMOKE_COMPUTE=1 | NOT RUN (deferred) | ? SKIP |
| Repeat call served from cache (SC4-hit) | SMOKE_COMPUTE=1 | NOT RUN (deferred) | ? SKIP |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` files exist for this phase. The verification harness is `scripts/verify-delivery-estimate.ts` (two-mode smoke) and `scripts/verify-delivery-seed.ts`. Token-free probes passed live per SUMMARY. Compute-path probe deferred (see Human Verification Required).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DLVR-05 | 06-01, 06-02, 06-03 | Customer receives serviceability, estimated cost, ETA, COD availability for a 6-digit pincode | PARTIALLY SATISFIED | Server-side engine deployed and data structures in place. Live compute-path proof pending (Turnstile swap). REQUIREMENTS.md marks DLVR-05 "Complete" at Phase 6 — the server-side implementation is done; the UI layer ships in Phase 7. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/functions/delivery-estimate/index.ts` | 366-376 | Turnstile fetch has no AbortController signal (WR-01) | Warning | A hung Cloudflare siteverify call holds the request open beyond the intended 8s bound. The comment at line 391-392 claims "Bound all upstream work" but the Turnstile fetch at line 366 is created before `ac` at line 393 and passes no signal. Code reviewer flagged as WR-01 (warning, not critical). |
| `supabase/functions/delivery-estimate/index.ts` | 204 | readSettings() query has no AbortController signal (WR-01) | Warning | The site_content read inside readSettings() issues a PostgREST query without `.abortSignal()`. Part of WR-01 scope. |
| `supabase/functions/delivery-estimate/index.ts` | 454-469 | Cache write upsert has no AbortController signal (WR-01) | Warning | The cache upsert at line 454 does not pass `ac.signal`, so a hung write is not cancelled. Part of WR-01 scope. |
| `supabase/functions/delivery-estimate/index.ts` | 132 | ADJACENT['Gujarat'] lists 'Dadra and Nagar Haveli and Daman and Diu' without the 'The' prefix (WR-02) | Warning | pincodes.ndjson seeds 'The Dadra and Nagar Haveli and Daman and Diu' (confirmed in NDJSON). The adjacency check `(ADJACENT[origin.state] ?? []).includes(dest.state)` will never match for Gujarat→UT pincodes, mis-zoning them as 'national' instead of 'regional'. LATENT under Phase 6 (origin is '000000', originConfigured=false, no adjacency check runs). Becomes active when Phase 9 sets a Gujarat origin. |
| `scripts/verify-delivery-estimate.ts` | 189-273 | assertSC4CacheHit() mutates live production delivery_origin_pincode with no crash-safe restore (WR-03) | Warning | The SMOKE_COMPUTE probe temporarily UPDATEs site_content.delivery_origin_pincode to '110001'. If the process is killed between swap and finally-restore, production is left with the wrong origin. Affects the verify script, not the function code. Mitigation: WR-03 is in the verify script, not in the shipped Edge Function. |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 6 modified file.

### Human Verification Required

#### 1. Compute-Path Live Smoke (SC1 + SC2-serviceability + SC4-hit)

**Test:** Run the compute-path smoke harness after temporarily swapping the Turnstile secret to the Cloudflare always-pass test value:
```bash
# 1. Swap to the always-pass test secret
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# 2. Run the compute-path smoke
SMOKE_COMPUTE=1 node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts
# 3. RESTORE the real secret immediately
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=<the real Turnstile secret>
# 4. Confirm delivery_origin_pincode is restored to 000000
```

**Expected:**
- `PASS: SC1` — 560001 returns serviceable:true, cost is an integer multiple of 10 (round-up to ₹10), etaDays has {min, max} integers (slab transit + dispatch_lead_days), codAvailable is boolean, originConfigured:false (origin is 000000), NO `zone` field in response.
- `PASS: SC2-serviceability` — 999999 (valid 6-digit format but absent from pincodes table) returns serviceable:false, HTTP 200, never a 500.
- `PASS: SC4-hit` — Two identical calls to (origin, dest, bucket) within 24h: second call is served from delivery_estimate_cache (fetched_at value unchanged between calls).
- Script prints: `restored delivery_origin_pincode → 000000` and `removed the provisional cache row`.

**Why human:** The Turnstile siteverify gate blocks all compute without a valid token. The real `TURNSTILE_SECRET_KEY` cannot be read back from Supabase (write-only), so automated CI cannot restore it. The owner must execute this swap manually from an authenticated CLI session. The 06-03 executor intentionally skipped this to avoid stranding production on the test secret.

**Blocking for:** SC1, SC2-serviceability, SC4-cache-hit

### Gaps Summary

No BLOCKER gaps found. All code implementing the five success criteria exists in the codebase and is deployed. The phase goal is substantively achieved in code and schema; what remains is live execution proof of the compute path, which is gated by a Cloudflare Turnstile token and deferred by design to avoid an unrecoverable secret-rotation risk.

**WR-01** (AbortController doesn't cover Turnstile fetch or readSettings) is the most actionable open issue from the code review. It does not prevent estimates from computing correctly — it only weakens the "hung dependency" protection described in SC3. The review classified it as WARNING (not critical).

**WR-02** (state-name mismatch for Dadra UT) is latent under the `000000` origin and has zero impact on Phase 6 SCs. It must be fixed before Phase 9 ships (when the owner sets a real Gujarat origin). No SC4 or SC5 assertion runs the adjacency check in Phase 6.

**WR-03** (destructive SC4-hit smoke) affects only the verify script, not the deployed function. The SMOKE_COMPUTE path should be run in a maintenance window or against a staging project.

---

## Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-02: ADJACENT['Gujarat'] missing 'The' prefix for Dadra UT — adjacency mis-zones Gujarat→UT as 'national' | Phase 9 (Admin Delivery Settings) | Phase 9 sets the real origin pincode. If the owner is Gujarat-based, this mis-zoning activates. Recommend fixing in Phase 7 or Phase 9 before origin is set to a Gujarat pincode. |

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
