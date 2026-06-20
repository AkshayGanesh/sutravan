-- 0013_questionnaire_sections.sql
-- Google-Forms-style SECTIONS for the Skin Guide questionnaire. Questions are
-- grouped into sections; the public form reveals one section at a time (Back/
-- Next wizard) so customers aren't shown every question at once. The owner
-- manages sections from the admin portal — no code change, no redeploy.
--
-- Sorts after 0012 (created questionnaire_questions). Like 0012 this introduces
-- a NEW table that starts deny-all once RLS is enabled, so it MUST legitimately
-- `create policy` (public read + admin write). Expected.
--
-- Posture mirrors questionnaire_questions / categories (0012 / 0002): section
-- titles + descriptions are PUBLIC form content, so anon + authenticated read
-- them; only admins write. Writes ride private.is_admin() — the client-side
-- admin editor is convenience; THIS policy is the real server-side gate.
--
-- Grouping model (LOCKED with the user):
--   * Each question gets a nullable section_id FK.
--   * Questions with section_id = NULL are collected into a synthetic trailing
--     "More questions" section by the client, so the form always works even
--     before the owner organizes anything (no seed rows here).
--   * Deleting a section sets its questions' section_id to NULL (ON DELETE SET
--     NULL) → they fall back to the "More questions" bucket, never orphaned.

create table public.questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,                 -- e.g. "Basic Information"
  description text,                    -- optional blurb shown under the title
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index questionnaire_sections_sort_order_idx
  on public.questionnaire_sections (sort_order);

-- Attach questions to sections. Nullable: ungrouped questions are valid and
-- fall into the client-side "More questions" bucket. ON DELETE SET NULL so
-- removing a section never deletes or orphans its questions.
alter table public.questionnaire_questions
  add column section_id uuid
    references public.questionnaire_sections (id) on delete set null;

create index questionnaire_questions_section_id_idx
  on public.questionnaire_questions (section_id);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: deny-all baseline, then public read + admin-only write (mirrors the
-- questionnaire_questions posture in 0012).
-- ──────────────────────────────────────────────────────────────────────────
alter table public.questionnaire_sections enable row level security;

create policy "questionnaire_sections_public_read"
  on public.questionnaire_sections for select
  to anon, authenticated
  using (true);

create policy "questionnaire_sections_admin_write"
  on public.questionnaire_sections for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
