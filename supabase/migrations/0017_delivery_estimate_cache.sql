-- 0017_delivery_estimate_cache.sql
-- Phase 6 / Plan 01 / Task 1 — DLVR-05 / D-17: DENY-DIRECT estimate cache.
--
-- Sorts after 0001 (gen_random_uuid() pk convention) and 0002 (RLS baseline).
--
-- ⚠️ DENY-DIRECT BY DESIGN — DO NOT ADD A POLICY. ⚠️
-- RLS is ENABLED below and DELIBERATELY NO `create policy` statement follows. With
-- RLS on and zero policies, the table is UNREACHABLE via anon/authenticated PostgREST
-- (every row is denied). This is intentional and load-bearing security, NOT an
-- oversight: the service-role `delivery-estimate` Edge Function (Plan 03) is the SOLE
-- reader/writer of this cache. Service-role bypasses RLS, so it still has full I/O;
-- untrusted clients get nothing, which prevents cache-poisoning (T-6-01 mitigate).
-- A future reader MUST NOT "add the missing policy" — the absence IS the mitigation.
--
-- The cache key is `unique (origin_pincode, dest_pincode, weight_bucket)` (D-17). cost
-- is nullable (null when not serviceable, D-13). expires_at = fetched_at + 24h, set by
-- the Edge Function on write.

create table public.delivery_estimate_cache (
  id             uuid primary key default gen_random_uuid(),
  origin_pincode text not null,
  dest_pincode   text not null,
  weight_bucket  int  not null,
  serviceable    boolean not null,
  cost           integer,                         -- null when !serviceable (D-13)
  eta_min_days   int,
  eta_max_days   int,
  cod_available  boolean not null default false,
  zone           text,
  fetched_at     timestamptz not null default now(),
  expires_at     timestamptz not null,            -- fetched_at + 24h, set by the Edge Function (D-17)
  unique (origin_pincode, dest_pincode, weight_bucket)
);

-- ──────────────────────────────────────────────────────────────────────────
-- DENY-DIRECT: RLS on, NO policies. See banner above — do NOT add a policy.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.delivery_estimate_cache enable row level security;
