---
quick_id: 260620-pt8
slug: fix-skin-guide-edit-question-modal-re-re
status: complete
date: 2026-06-20
---

# Quick Task 260620-pt8 — Summary

## What was fixed

The admin Skin Guide edit/add-question modal
(`client/src/pages/admin/QuestionsList.tsx`):
- lost input focus after the first keystroke (whole modal remounted), and
- did not persist on the first Save click.

## Root cause

`QuestionFormDialog` was a component **defined inside** `QuestionsList` and
mounted as `<QuestionFormDialog />`. Every parent render produced a new function
identity, so React unmounted/remounted the entire dialog. `form.watch("fieldType")`
(RHF `watch`) re-renders the host on **every** field change, so the first
keystroke triggered a remount → focus loss and a swallowed first Save click.

## Change

`client/src/pages/admin/QuestionsList.tsx`:
1. `form.watch("fieldType")` → `useWatch({ control, name })` (no root re-render per keystroke).
2. `QuestionFormDialog` renamed to `renderQuestionFormDialog` and rendered by
   **calling** it (`{renderQuestionFormDialog()}`) at its 3 sites instead of
   mounting it as a component, so React reconciles the `<Dialog>` in place. The
   function uses no hooks, so a plain call is safe. (Function declaration is
   hoisted, so call-before-definition in the error branch is fine.)

## Verification

- `npm run check` (tsc) passes.
- Playwright MCP against the live admin (logged in):
  - Edited "Skin type", typed `Skin type (test edit)` character-by-character
    (`pressSequentially`) — focus retained, full string entered.
  - Clicked Save **once** → "Question saved." toast, dialog closed, list row
    updated to "Skin type (test edit)".
  - Restored the label back to "Skin type" (live test data cleaned up).
