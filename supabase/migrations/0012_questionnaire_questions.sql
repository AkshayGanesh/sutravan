-- 0012_questionnaire_questions.sql
-- Admin-configurable Skin Guide questions: move the hard-coded questionnaire
-- fields (formerly SKIN_TYPES / CONCERN_OPTIONS + the fixed Zod schema in
-- client/src/pages/Questionnaire.tsx) into a table the owner manages from the
-- admin portal — no code change, no redeploy (the milestone's core value).
--
-- Sorts after 0001 (created public.products + private.is_admin()), 0002 (the RLS
-- baseline), and 0011 (the last NEW relational table). Like 0011, this is a NEW
-- table: once RLS is enabled it starts deny-all, so this migration MUST
-- legitimately `create policy` (public read + admin write). Expected.
--
-- Posture mirrors site_content / categories (0002): the questionnaire form is
-- PUBLIC content, so anon + authenticated read it; only admins write. Writes
-- ride private.is_admin() exactly like categories_admin_write — the client-side
-- admin editor is convenience; THIS policy is the real server-side gate.
--
-- Field model (LOCKED with the user):
--   field_type ∈ single_select | multi_select | short_text | long_text
--   options    : jsonb string array — used by the *_select types, [] for text.
--   Name + Email are NOT rows here — they stay the fixed contact step in code
--   (Email drives the admin notification email + account linking).
--
-- Answers are SNAPSHOTTED into customization_submissions.payload at submit time
-- (label + value), so editing/deleting a question never corrupts historical
-- submissions. That is why there is no FK from submissions to this table and
-- deletes are unconditionally safe.

create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  label text not null,                 -- e.g. "Skin type"
  help_text text,                      -- optional FormDescription under the label
  field_type text not null check (
    field_type in ('single_select', 'multi_select', 'short_text', 'long_text')
  ),
  options jsonb not null default '[]'::jsonb,  -- ["Normal","Dry",...]; [] for text types
  placeholder text,                    -- for the text input types
  required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index questionnaire_questions_sort_order_idx
  on public.questionnaire_questions (sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: deny-all baseline, then public read + admin-only write (mirrors the
-- site_content / categories posture in 0002).
-- ──────────────────────────────────────────────────────────────────────────
alter table public.questionnaire_questions enable row level security;

create policy "questionnaire_questions_public_read"
  on public.questionnaire_questions for select
  to anon, authenticated
  using (true);

create policy "questionnaire_questions_admin_write"
  on public.questionnaire_questions for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- Seed the 5 questions that were hard-coded in Questionnaire.tsx so the live
-- form is byte-for-byte identical on day one; the owner can then edit them.
-- ──────────────────────────────────────────────────────────────────────────
insert into public.questionnaire_questions
  (label, help_text, field_type, options, placeholder, required, sort_order)
values
  (
    'Skin type', null, 'single_select',
    '["Normal","Dry","Oily","Combination","Sensitive"]'::jsonb,
    null, true, 0
  ),
  (
    'Skin concerns', 'Choose any that apply.', 'multi_select',
    '["Acne / breakouts","Dryness","Dullness","Pigmentation","Ageing / fine lines","Sensitivity / redness"]'::jsonb,
    null, false, 1
  ),
  (
    'What are you looking for?', null, 'short_text',
    '[]'::jsonb,
    'e.g. a gentle cream, a clarifying soap…', false, 2
  ),
  (
    'Allergies or ingredients to avoid', null, 'short_text',
    '[]'::jsonb,
    'e.g. nuts, fragrance…', false, 3
  ),
  (
    'Anything else? (optional)', null, 'long_text',
    '[]'::jsonb,
    'Tell us anything else that would help us craft your blend.', false, 4
  );
