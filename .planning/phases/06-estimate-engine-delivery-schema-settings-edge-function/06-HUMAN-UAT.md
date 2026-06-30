---
status: partial
phase: 06-estimate-engine-delivery-schema-settings-edge-function
source: [06-VERIFICATION.md]
started: 2026-06-30T15:26:25Z
updated: 2026-06-30T15:26:25Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC1 — Live compute-path returns a normalized estimate from the seeded slab
expected: Invoking the deployed `delivery-estimate` function with a real origin + a serviceable 6-digit destination pincode + a weight returns `{ serviceable:true, cost, etaDays:{min,max}, codAvailable, originConfigured }` computed from the zone-weight slab — and the courier-specific `zone` field never appears in the response body. The function code (`callCourierAdapter()` boundary, zone strip at `index.ts:478`) is verified by static analysis; only the live token-gated execution is pending.
result: [pending]

### 2. SC2 — Live non-serviceable destination returns a clean `serviceable:false`
expected: Invoking with a non-serviceable destination pincode returns a clean `{ serviceable:false }` result (no crash, no 500). Code path `if (!destRow || destRow.serviceable === false)` at `index.ts:269-278` is verified statically; live execution is pending.
result: [pending]

### 3. SC4 — Live cache write-then-hit within TTL
expected: After temporarily setting `delivery_origin_pincode` to a real seeded pincode, two identical `(origin, dest, weight-bucket)` invocations within the TTL — the second served from `delivery_estimate_cache` (the function is the sole service-role writer). Cache read (`gt('expires_at')`), upsert (`onConflict`), and the `!originConfigured` write-skip are verified statically; live execution is pending.

How to run all three (single harness run — restore the secret immediately after):
```bash
# 1. Swap to Cloudflare's always-pass TEST secret
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# 2. Run the compute-path smoke (SC1 + SC2-serviceability + SC4-hit)
SMOKE_COMPUTE=1 node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts
# 3. Restore the real secret IMMEDIATELY
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=<real secret>
```
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
