# Quick Task 260620-q5k: Skin Guide sections + progressive wizard - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Task Boundary

Add Google-Forms-style **sections** to the Skin Guide questionnaire. Questions
are grouped into sections; the public questionnaire reveals **one section at a
time** with Back/Next navigation, the final section submitting the form. Goal:
progressive disclosure so customers aren't overwhelmed by all questions at once.
</domain>

<decisions>
## Implementation Decisions

### Admin management model
- **Full sections CRUD.** New `questionnaire_sections` table + `section_id` FK on
  `questionnaire_questions`. New admin "Sections" page (create/rename/reorder,
  title + optional description). Each question gets a "Section" dropdown.

### Ungrouped questions
- Any question with `section_id = null` is collected into a single trailing
  **"More questions"** section so the form always works (zero-config safe
  default). No seeding of the existing 5 questions — they fall into this bucket
  until the owner organizes them. Deleting a section sets its questions'
  `section_id` to null (`on delete set null`) → they fall back to the bucket.

### Public wizard UX
- **Progress bar + step counter** ("Section 2 of N") + Back/Next, with
  required-field validation gating Next, and Submit on the final section. Fits
  the existing About → [sections] → Review → Thank-you flow.
</decisions>

<specifics>
## Specific Ideas

- Reference: Google Forms section wizard (one section per screen, Next/Back).
- Sections with **zero** questions are omitted from the wizard (no empty steps).
- The fixed "About you" (name/email) step stays first, in code, unchanged.
- Empty-section omission + auto bucket means the live form keeps working
  immediately after the migration with no admin action.
</specifics>

<canonical_refs>
## Canonical References

- Existing question model + RLS posture: `supabase/migrations/0012_questionnaire_questions.sql`
- Public form: `client/src/pages/Questionnaire.tsx`; data layer: `client/src/lib/questionnaire.ts`
- Admin question CRUD pattern to mirror for sections: `client/src/lib/admin.ts` (categories + questions hooks), `client/src/pages/admin/QuestionsList.tsx`
</canonical_refs>
