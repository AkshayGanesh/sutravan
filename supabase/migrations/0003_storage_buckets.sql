-- 0003_storage_buckets.sql
-- Phase 1 / Plan 02 / Task 3 — Storage buckets + storage.objects policies (DATA-02, D-07/08/09).
--
-- Sorts last. private.is_admin() (0001) is referenced by the admin-write policies. RLS is ALREADY
-- enabled on storage.objects by Supabase, so we add policies only (no `enable row level security`).
--
-- D-07: two buckets — product-images (catalog photos) and site-content (editable site assets).
-- D-09: public read, admin-only write (the Shop renders images with no login; customers must never
--       write catalog images).
-- D-08: the products/{slug}/{filename} path convention is enforced by convention in the Phase 2
--       seed / Phase 4 uploads, NOT by a storage policy — no path-regex policy needed this phase.
--
-- Source: 01-RESEARCH.md Pattern 4 (lines 214-248). RESEARCH A2: if the live storage.buckets column
-- set differs from (id, name, public), the Plan 03 db push --dry-run will surface it.

-- ──────────────────────────────────────────────────────────────────────────
-- Create the two buckets idempotently. public = true allows unauthenticated
-- read via the public object URL (D-09); the explicit SELECT policies below
-- additionally cover the authenticated API read path.
-- ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('site-content',   'site-content',   true)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- product-images — public read, admin-only insert/update/delete
-- ──────────────────────────────────────────────────────────────────────────
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "product_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and private.is_admin());

create policy "product_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and private.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and private.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- site-content — public read, admin-only insert/update/delete
-- ──────────────────────────────────────────────────────────────────────────
create policy "site_content_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'site-content');

create policy "site_content_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-content' and private.is_admin());

create policy "site_content_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-content' and private.is_admin());

create policy "site_content_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-content' and private.is_admin());
