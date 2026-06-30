-- 0014_delivery_settings_seed.sql
-- Phase 6 / Plan 01 / Task 2 — DLVR-05: seed the five delivery site_content keys.
--
-- Sorts after 0001 (public.site_content: key text primary key, value text) and 0002
-- (site_content_public_read / site_content_admin_write RLS). Clones 0006's idempotent
-- `on conflict (key) do nothing` seed — re-running never clobbers later owner edits.
-- site_content itself is unchanged; these keys ride the existing ['siteContent'] admin
-- upsert pattern, so NO admin plumbing is added in Phase 6.
--
-- delivery_cod_rules is a JSON STRING stored in the text `value` column (a single
-- jsonb-in-text key, D-09) — single quotes inside JSON need no escaping here since the
-- JSON uses double quotes. delivery_free_ship_threshold seeds SQL null (D-19: present
-- but off). delivery_origin_pincode is the deliberately-fake '000000' placeholder
-- (D-18) so the owner MUST configure the real origin in Phase 9 before estimates are
-- meaningful.

insert into public.site_content (key, value) values
  ('delivery_origin_pincode',     '000000'),                                   -- D-18 placeholder (owner sets real origin in Phase 9)
  ('delivery_default_weight_g',   '250'),                                      -- D-10 fallback weight
  ('delivery_dispatch_lead_days', '1'),                                        -- D-20 dispatch lead days
  ('delivery_cod_rules',          '{"enabled":true,"fee":30,"valueCap":5000}'),-- D-06 ₹30 fee / D-07 ₹5000 cap / D-08 toggle on / D-09 jsonb-in-text
  ('delivery_free_ship_threshold', null)                                       -- D-19 present but off (null)
on conflict (key) do nothing;
