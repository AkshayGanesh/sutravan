---
phase: 06-estimate-engine-delivery-schema-settings-edge-function
plan: 01
subsystem: delivery-schema
tags: [supabase, migrations, rls, delivery, deny-direct, seed]
requires:
  - "0001/0002 RLS baseline + private.is_admin()"
  - "0004 profiles table"
  - "0006 site_content seed pattern"
  - "0011 NEW-table-with-policies pattern"
provides:
  - "public.pincodes serviceability table (schema)"
  - "public.delivery_rate_slabs + 20-row monotonic grid"
  - "public.delivery_estimate_cache (deny-direct, service-role only)"
  - "5 delivery_* site_content keys"
  - "profiles.default_pincode column"
  - "scripts/verify-delivery-seed.ts (SC4+SC5 harness)"
affects:
  - "Plan 02 (pincode seed reads pincodes + runs verify without PINCODES_OPTIONAL)"
  - "Plan 03 (delivery-estimate Edge Function reads slabs/settings, writes cache)"
tech-stack:
  added: []
  patterns:
    - "Deny-direct RLS: enable RLS, write ZERO policies → table is service-role-only I/O"
    - "Idempotent seed via on conflict do nothing (keys + slab grid)"
    - "Native Node 22 type-stripping verify harness (no tsx/dotenv)"
key-files:
  created:
    - supabase/migrations/0014_delivery_settings_seed.sql
    - supabase/migrations/0015_pincodes.sql
    - supabase/migrations/0016_delivery_rate_slabs.sql
    - supabase/migrations/0017_delivery_estimate_cache.sql
    - supabase/migrations/0018_profiles_default_pincode.sql
    - scripts/verify-delivery-seed.ts
  modified: []
decisions:
  - "delivery_estimate_cache is deny-direct (RLS on, no policies) — absence of policy IS the mitigation (T-6-01)"
  - "pincodes/delivery_rate_slabs public-read unconditional (using true), admin-write via private.is_admin()"
  - "Slab costs are placeholder but internally monotonic (D-04); owner replaces in Phase 10"
  - "delivery_origin_pincode seeded as fake 000000 (D-18) so owner must set real origin in Phase 9"
  - "verify harness honors PINCODES_OPTIONAL=1 so Plan 01 pre-seed push verifies green before Plan 02 loads pincodes"
metrics:
  duration: ~4min
  completed: "2026-06-30"
requirements: [DLVR-05]
---

# Phase 6 Plan 01: Delivery Schema & Settings Migrations Summary

Landed all five Phase 6 delivery data structures as idempotent migrations (0014–0018) and pushed them live, with a service-role/anon verify harness proving the seeded grid and the deny-direct estimate cache.

## What Was Built

- **0015_pincodes.sql** — `public.pincodes` serviceability table (schema only; ~19.5k rows load in Plan 02). Public-read (`using (true)`, reference data), admin-write via `private.is_admin()`. `serviceable` defaults true (D-16). `pincodes_state_idx` index.
- **0017_delivery_estimate_cache.sql** — deny-direct cache: RLS enabled, **zero policies** → unreachable via anon/authenticated PostgREST. Service-role `delivery-estimate` Edge Function (Plan 03) is the sole I/O (T-6-01). Cache key `unique (origin_pincode, dest_pincode, weight_bucket)`; `cost` nullable when not serviceable (D-13).
- **0018_profiles_default_pincode.sql** — `profiles.default_pincode text` nullable column (DLVR-10); inherits existing `profiles_self_update` RLS. Phase 8 wires read/write.
- **0014_delivery_settings_seed.sql** — five `delivery_*` `site_content` keys, idempotent `on conflict (key) do nothing`: origin `000000` (D-18 placeholder), default weight `250` (D-10), dispatch lead `1` (D-20), cod_rules JSON `{"enabled":true,"fee":30,"valueCap":5000}` (D-06/07/08/09), free-ship threshold `null` (D-19).
- **0016_delivery_rate_slabs.sql** — `delivery_rate_slabs` table (zone/weight_band CHECKs, `unique (zone, weight_band)`) + inline 20-row monotonic grid (5 zones × 4 bands) via `on conflict (zone, weight_band) do nothing`. Public-read, admin-write.
- **scripts/verify-delivery-seed.ts** — asserts 5 settings keys present, slabs == 20 with strict monotonicity (across zones per band + across bands per zone), `profiles.default_pincode` selectable, anon `delivery_estimate_cache` select returns 0/denied (SC4), and pincodes >= 15000 unless `PINCODES_OPTIONAL=1`.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | pincodes + deny-direct cache + profiles.default_pincode migrations | 67eea03 |
| 2 | settings seed + slab grid + verify harness | 5031540 |
| 3 | [BLOCKING] push live + verify (no repo change) | n/a |

## Verification Results

- `supabase db push --linked` applied 0014–0018 (no error). Migration list shows 0014–0018 applied local + remote.
- `PINCODES_OPTIONAL=1 node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` → **PASS** (5 keys, slabs=20 monotonic, profiles.default_pincode selectable, cache deny-direct).
- Second `db push --linked` → "Remote database is up to date" (idempotent).
- Static: 0017 has zero `create policy` (deny-direct); 0015/0016 carry public-read + `private.is_admin()` admin-write.

## Success Criteria

- **SC5 (schema half):** all delivery structures exist live via idempotent migrations with seeded defaults — MET.
- **SC4 (schema half):** `delivery_estimate_cache` RLS-enabled, no policies; anon cannot read/write — MET (proven by anon-probe in harness).

## Deviations from Plan

None — plan executed exactly as written. Task 2 carried `tdd="true"`; with `tdd_mode: false` in config and the harness only able to pass against the live (post-push) schema, the migrations are the implementation and the verify harness is the test, confirmed green in Task 3.

## Known Stubs

- Slab costs and `delivery_origin_pincode` (000000) are intentional placeholders (D-04/D-18) — the owner replaces real values via the Phase 9 settings and Phase 10 slab editor. Documented in plan; not a blocking stub.
- `pincodes` table is empty (schema only) by design — Plan 02 loads the data; the verify harness skips the count via `PINCODES_OPTIONAL=1` for this pre-seed push.

## Self-Check: PASSED
