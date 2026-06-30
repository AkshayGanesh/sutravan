-- 0016_delivery_rate_slabs.sql
-- Phase 6 / Plan 01 / Task 2 — DLVR-05: zone-weight rate slab grid (D-01..05).
--
-- Sorts after 0001 (gen_random_uuid() pk + private.is_admin()) and 0002 (RLS baseline).
--
-- THIS IS A NEW RELATIONAL TABLE WITH POLICIES — like 0011 (product_variants). A NEW
-- table starts with no access once RLS is enabled, so it MUST legitimately
-- `create policy` (public read + admin write). Expected, not a leak.
--
-- The 20-row grid (5 zones × 4 weight bands, D-03 cartesian) is seeded inline below
-- with `on conflict (zone, weight_band) do nothing` (idempotent). Costs are explicit
-- placeholders (D-04) the owner replaces in the Phase 10 slab editor; values are
-- internally MONOTONIC (strictly increasing across zones per band AND across bands per
-- zone). cost is the base ₹ — the engine round-ups the FINAL estimate to ₹10 (D-11/13);
-- there is no separate buffer field (D-12). ETA = D-05 verbatim (transit working days;
-- the engine adds delivery_dispatch_lead_days on top).

create table public.delivery_rate_slabs (
  id           uuid primary key default gen_random_uuid(),
  zone         text not null check (zone in ('local','regional','metro','national','remote')),  -- D-01
  weight_band  int  not null check (weight_band between 1 and 4),                                -- D-02
  weight_min_g int  not null,
  weight_max_g int  not null,
  cost         integer not null,                 -- base ₹; engine round-ups final to 10 (D-11/13)
  eta_min_days int  not null,
  eta_max_days int  not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (zone, weight_band)                      -- D-03 cartesian grid key
);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: deny-all baseline, public read (non-sensitive placeholder rates the
-- estimator needs), admin-only write behind private.is_admin().
-- ──────────────────────────────────────────────────────────────────────────
alter table public.delivery_rate_slabs enable row level security;

create policy "delivery_rate_slabs_public_read"
  on public.delivery_rate_slabs for select
  to anon, authenticated
  using (true);

create policy "delivery_rate_slabs_admin_write"
  on public.delivery_rate_slabs for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- Seed the 20-row monotonic grid (D-04 placeholder costs / D-05 ETA verbatim).
-- weight bands: 1 = 0–250g, 2 = 251–500g, 3 = 501–1000g, 4 = 1001–2000g.
-- ──────────────────────────────────────────────────────────────────────────
insert into public.delivery_rate_slabs (zone, weight_band, weight_min_g, weight_max_g, cost, eta_min_days, eta_max_days) values
  ('local',     1,    0,  250,  40, 1, 2),
  ('local',     2,  251,  500,  55, 1, 2),
  ('local',     3,  501, 1000,  75, 1, 2),
  ('local',     4, 1001, 2000,  95, 1, 2),
  ('regional',  1,    0,  250,  55, 2, 4),
  ('regional',  2,  251,  500,  70, 2, 4),
  ('regional',  3,  501, 1000,  95, 2, 4),
  ('regional',  4, 1001, 2000, 120, 2, 4),
  ('metro',     1,    0,  250,  65, 3, 5),
  ('metro',     2,  251,  500,  85, 3, 5),
  ('metro',     3,  501, 1000, 110, 3, 5),
  ('metro',     4, 1001, 2000, 140, 3, 5),
  ('national',  1,    0,  250,  75, 4, 7),
  ('national',  2,  251,  500,  95, 4, 7),
  ('national',  3,  501, 1000, 125, 4, 7),
  ('national',  4, 1001, 2000, 160, 4, 7),
  ('remote',    1,    0,  250,  95, 6, 10),
  ('remote',    2,  251,  500, 120, 6, 10),
  ('remote',    3,  501, 1000, 150, 6, 10),
  ('remote',    4, 1001, 2000, 180, 6, 10)
on conflict (zone, weight_band) do nothing;
