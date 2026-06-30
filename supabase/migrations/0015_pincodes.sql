-- 0015_pincodes.sql
-- Phase 6 / Plan 01 / Task 1 — DLVR-05: pincode serviceability table (D-14/D-15/D-16).
--
-- Sorts after 0001 (created public.products + private.is_admin()) and 0002 (the RLS
-- baseline + the categories_public_read `using (true)` posture this table mirrors).
--
-- THIS IS A NEW RELATIONAL TABLE WITH POLICIES — like 0011 (product_variants) and
-- unlike the column-add migrations (0008/0010). A NEW table starts with no access at
-- all once RLS is enabled, so this migration MUST legitimately `create policy`
-- (public read + admin write). This is expected, not a leak.
--
-- SCHEMA ONLY. The ~19.5k deduped pincode rows load via scripts/seed-pincodes.ts in
-- Plan 02 (PostgREST chunked upsert — the pooler URL has no password so psql/COPY are
-- unavailable). Do NOT inline a bulk data INSERT here (RESEARCH Anti-Patterns).
--
-- `serviceable` defaults true (D-16) so the owner can switch a real pincode off later
-- without deleting the row or shipping a migration. Public read is unconditional
-- (`using (true)`) — pincodes are non-draft reference data, mirroring 0002
-- categories_public_read, not the is_active-scoped products read.

create table public.pincodes (
  pincode     text primary key,                 -- unique pincode (deduped from the postal directory)
  state       text not null,
  district    text,
  circle      text,                              -- CircleName (postal circle ≈ state)
  region      text,                              -- RegionName
  is_metro    boolean not null default false,
  is_remote   boolean not null default false,
  serviceable boolean not null default true,     -- D-16 — toggle a real pincode off without deleting it
  created_at  timestamptz default now()
);

create index pincodes_state_idx on public.pincodes (state);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: deny-all baseline, then open public read (reference data, not draft-scoped)
-- and gate writes behind the canonical private.is_admin() admin check.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.pincodes enable row level security;

-- Public read is unconditional — pincode serviceability is non-sensitive data the
-- customer estimator needs (T-6-02 accept). Mirrors 0002 categories_public_read.
create policy "pincodes_public_read"
  on public.pincodes for select
  to anon, authenticated
  using (true);

-- Admin-only write rides private.is_admin(), exactly like products_admin_write (0002)
-- and product_variants_admin_write (0011). THIS policy is the real server-side gate
-- (T-6-03); any client UI in Phases 9-10 is convenience only.
create policy "pincodes_admin_write"
  on public.pincodes for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
