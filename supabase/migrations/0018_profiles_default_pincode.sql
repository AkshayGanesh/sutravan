-- 0018_profiles_default_pincode.sql
-- Phase 6 / Plan 01 / Task 1 — DLVR-10: profiles.default_pincode column.
--
-- Sorts after 0004 (which added profiles.name with the same single-nullable-column
-- shape) and 0002 (profiles_self_update RLS, which this column inherits — no new
-- policy needed; an owner updating their own row already passes the existing gate).
--
-- The column lands here so the schema is complete for Phases 7-10. Phase 8 wires the
-- read/write: pincode persists in localStorage AND saves to a logged-in customer's
-- profile via this column. Nullable — logged-out and never-set users have no value.

alter table public.profiles add column default_pincode text;
