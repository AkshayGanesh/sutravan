---
quick_id: 260620-q5k
slug: add-google-forms-style-sections-to-the-s
status: complete
date: 2026-06-20
---

# Quick Task 260620-q5k — Summary

## What was built

Google-Forms-style **sections** for the Skin Guide questionnaire. The owner
groups questions into sections from the admin portal; the public form reveals
**one section at a time** (Back/Next wizard, progress bar, Submit on the last
section) so customers aren't shown every question at once.

## Decisions (locked with user — see CONTEXT.md)

1. Full sections CRUD (`questionnaire_sections` table + `section_id` FK).
2. Ungrouped questions → auto trailing **"More questions"** section; empty
   sections omitted; deleting a section moves its questions to that bucket.
3. Wizard: progress bar + "Section x of N" counter + Back/Next + required-gated Next.

## Changes (atomic commits)

- **DB** `supabase/migrations/0013_questionnaire_sections.sql` — new
  `questionnaire_sections` table (public-read / admin-write RLS mirroring 0012) +
  nullable `questionnaire_questions.section_id` FK (`ON DELETE SET NULL`).
  Applied live to project `wfbnrcnmpcqzeyjlfflv`.
- **Data layer** `client/src/lib/questionnaire.ts` — `QuestionnaireSection` type,
  `useQuestionnaireSections()`, and pure `groupIntoSections()` (ungrouped →
  synthetic "More questions"; empty groups dropped). `section_id` added to the
  question read. Submission payload shape unchanged.
- **Public wizard** `client/src/pages/Questionnaire.tsx` — steps derived from
  sections (About → one step per non-empty section → Review), progress bar,
  per-section validation, contextual eyebrow + section description.
- **Admin** `client/src/lib/admin.ts` (sections CRUD hooks + question
  `section_id` write), new `client/src/pages/admin/SectionsList.tsx`,
  `AdminLayout.tsx` "Sections" nav item, `App.tsx` `/admin/sections` route, and a
  "Section" dropdown on the question form in `QuestionsList.tsx`.

## Verification

- `npm run check` (tsc) passes after every commit.
- Playwright MCP against the live admin + public site (logged in as admin):
  - Created sections "Basic Information" + "Your Skin" (admin Sections page).
  - Assigned "Skin type" → Basic Information, "Skin concerns" → Your Skin via the
    new Section dropdown.
  - Public `/questionnaire`: About (Step 1 of 5) → "Section 1 of 3 — Basic
    Information" (only Skin type) → "Section 2 of 3 — Your Skin" → "Section 3 of 3
    — More questions" (the 3 ungrouped questions) → "Step 5 of 5 — Review" with
    all answers correct.
  - Confirmed: progress bar advances, required field gated Next ("This field is
    required."), Back preserves typed values.
  - Deleted both test sections (ON DELETE SET NULL returned questions to the
    bucket); live DB left clean ("No sections yet").

## Notes / follow-ups

- Did not submit a real questionnaire (avoids a live submission row + Turnstile);
  the submit path is unchanged from before.
- Section reordering is via the numeric "Display order" field (consistent with
  Questions/Categories); no drag-reorder for sections in this task.
