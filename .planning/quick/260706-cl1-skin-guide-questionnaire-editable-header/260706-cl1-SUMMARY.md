---
phase: quick-260706-cl1
plan: 01
subsystem: content-management
tags: [site-content, questionnaire, admin, D-20]
requires:
  - useSiteContent / SITE_CONTENT_DEFAULTS (siteContent.ts)
  - useSaveSiteContent (admin.ts)
  - CUSTOMIZATION_PRICING_CAVEAT (copy.ts)
provides:
  - 5 editable questionnaire_* site_content keys (title, subtitle, caveat, thankyou_title, thankyou_body)
affects:
  - client/src/pages/Questionnaire.tsx (public Skin Guide)
  - client/src/pages/admin/SiteContent.tsx (admin editor)
tech-stack:
  added: []
  patterns: [key/value site_content upsert, D-20 mandatory fallback]
key-files:
  created: []
  modified:
    - client/src/lib/siteContent.ts
    - client/src/pages/Questionnaire.tsx
    - client/src/pages/admin/SiteContent.tsx
decisions:
  - caveat default sourced from the imported CUSTOMIZATION_PRICING_CAVEAT (one source of truth; ProductDetail still reads it from copy.ts)
metrics:
  duration: ~8min
  completed: 2026-07-06
---

# Phase quick-260706-cl1 Plan 01: Skin Guide Editable Header/Thank-you Summary

Made the /questionnaire intro title, subtext and pricing caveat plus the post-submit
thank-you title and message admin-editable via the existing /admin/content page — 5 new
`site_content` keys wired through defaults → public consumers → admin editor, no new DB
table, migration, admin route or npm dependency.

## What Was Done (Task 1 — committed 45be6b9)

**STEP 1 — client/src/lib/siteContent.ts**
- Imported `CUSTOMIZATION_PRICING_CAVEAT` from `./copy`.
- Appended a "Questionnaire / Skin Guide" comment group with 5 keys to
  `SITE_CONTENT_DEFAULTS`: `questionnaire_title`, `questionnaire_subtitle`,
  `questionnaire_caveat` (= the imported constant), `questionnaire_thankyou_title`,
  `questionnaire_thankyou_body`.

**STEP 2 — client/src/pages/Questionnaire.tsx**
- Swapped the `CUSTOMIZATION_PRICING_CAVEAT` import for
  `import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent"`
  (the caveat constant was only used at the two lines now replaced, so the import is gone).
- `Intro()` now calls `useSiteContent()` and renders title/subtitle/caveat via
  `data?.key ?? SITE_CONTENT_DEFAULTS.key` (D-20). Intro renders in all
  loading/error/empty/form states, so the fallback covers any pre-load flash.
- `QuestionnaireForm` added `const { data: content } = useSiteContent();` and now
  renders the thank-you `h2`/`p` and the Review-step caveat from `content?.key ?? default`.
- The conditional `isLoggedIn` login/account CTA under the thank-you message is untouched
  (stays code-managed per locked scope).

**STEP 3 — client/src/pages/admin/SiteContent.tsx**
- Added the 5 keys to `contentSchema` (title + thank-you title as `Input`/min(1);
  subtitle, caveat, thank-you body as textareas/min(1)) with friendly messages.
- Added the 5 keys to `useForm` defaultValues, the `reset()` prefill (`valueFor(...)`),
  and the `onSubmit` `save.mutate({...})` payload (reuses `useSaveSiteContent` upsert +
  `['siteContent']` invalidation — no admin.ts change).
- Added a new `<fieldset>` titled "Skin Guide" (5 fields) after "Contact & social",
  before the Save button, mirroring the Homepage-hero fieldset markup. Tweaked the page
  intro `<p>` to mention the Skin Guide is editable.

## Verification

- `npm run check` (tsc) passes for all changed files. Only the 3 pre-existing,
  out-of-scope errors remain in `scripts/transform-pincodes.ts` (known/ignored).
- Post-commit deletion check: no files deleted.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Task 2 — checkpoint:human-verify (NOT automated — awaiting owner)

The end-to-end admin→public round-trip must be confirmed live by a human (no redeploy):

1. Open `/questionnaire` — confirm the intro title ("Customize your blend"), subtext and
   the caveat small-print render as before (defaults, no blank flash).
2. Log in as admin, open `/admin/content` — confirm a new **"Skin Guide"** section shows
   5 fields prefilled with current values (intro heading, intro subtext, pricing caveat,
   thank-you heading, thank-you message).
3. Change each of the 5 fields to a clearly different test value and click Save (expect the
   "Site content updated." toast).
4. Return to `/questionnaire` — confirm the intro title/subtext/caveat now show the edited
   values, and the Review-step caveat matches (no redeploy / no hard refresh beyond cache
   invalidation).
5. Complete/submit the questionnaire (or reach the thank-you step) — confirm the thank-you
   heading and message show the edited values, and the login/account CTA under it still
   appears based on login state (intentionally NOT editable).
6. Confirm nothing else regressed (wizard steps, progress bar, Turnstile).

Resume signal: type "approved" or describe what did not match.

## Self-Check: PASSED

- client/src/lib/siteContent.ts — FOUND (modified)
- client/src/pages/Questionnaire.tsx — FOUND (modified)
- client/src/pages/admin/SiteContent.tsx — FOUND (modified)
- Commit 45be6b9 — FOUND
