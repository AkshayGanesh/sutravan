---
phase: quick-260602-vbr
plan: 01
subsystem: admin-product-editor + public-product-detail
tags: [frontend, admin, product-detail, textarea, render-normalization]
requires:
  - "@/components/ui/textarea (existing Textarea)"
  - "framer-motion Reorder/useDragControls (existing drag-to-reorder)"
provides:
  - "normalizeMultiline(s) pure render-time helper (legacy /n + \\n -> real newline)"
  - "Multi-line bullets: Textarea per row in RepeatableRows; whitespace-pre-line at 3 ProductDetail sites"
affects:
  - "client/src/components/admin/RepeatableRows.tsx (used by ProductForm — unchanged contract)"
  - "client/src/components/ProductDetail.tsx (public Benefits/Ingredients/Tips)"
tech-stack:
  added: []
  patterns:
    - "Render-time, non-destructive legacy-marker normalization (pure helper, unit-tested)"
    - "whitespace-pre-line to keep a newline inside a single <li>"
key-files:
  created:
    - client/src/lib/multiline.ts
    - client/src/lib/multiline.test.ts
  modified:
    - client/src/components/admin/RepeatableRows.tsx
    - client/src/components/ProductDetail.tsx
decisions:
  - "D-03: normalize ONLY at render (non-destructive) — no normalize-on-save path; stored data untouched"
  - "D-01: per-row control is a Textarea (rows=2), Enter inserts a newline (not intercepted)"
  - "Discretion: row container switched items-center -> items-start so handle/X top-align with a tall textarea"
metrics:
  duration: ~6min
  completed: 2026-06-02
  tasks: 2
  files: 4
---

# Quick Task 260602-vbr: Multi-line bullets in product list fields Summary

Multi-line bullets are now first-class: admins type a real line break inside a single Benefits/Ingredients/Usage-tips row via a Textarea, the public product detail renders that newline as a second line under the same bullet point, and legacy literal `/n` / `\n` markers normalize to real newlines at render time without mutating stored data.

## What Was Built

- **`client/src/lib/multiline.ts`** — pure `normalizeMultiline(s: string): string`. A single regex alternation `/\s*(?:\\n|\/n)\s*/g` matches either the backslash-n literal or the forward-slash-n literal (with optional surrounding spaces) and replaces the whole token with a single `\n`. No side effects, no imports, idempotent.
- **`client/src/lib/multiline.test.ts`** — 8 Vitest cases mirroring `slug.test.ts`: `/n` token, backslash-n token, optional-space variants (`a/nb`, `a /n b`, `a/n b`, `a /nb`), no-op when no marker, real-newline passthrough, multiple markers, and idempotency.
- **`RepeatableRows.tsx`** — per-row `<Input>` replaced with the existing `<Textarea rows={2} className="flex-1">`; `Input` import removed, `Textarea` import added. Row container `items-center` -> `items-start` so the drag handle and remove X top-align with a tall textarea. Enter is NOT intercepted (newline is the feature).
- **`ProductDetail.tsx`** — imports `normalizeMultiline` and applies it + `whitespace-pre-line` at all three render sites: Benefits (wrapped in a `<span className="whitespace-pre-line">`), Ingredients (`whitespace-pre-line` on the `<li>`), Tips (`whitespace-pre-line` on the `<li>`). Render-time only; product data never mutated.

## Preserved (zero behavior change)

- Drag-to-reorder (framer-motion `Reorder.Item dragListener={false}` + per-row `useDragControls`), the GripVertical handle (`onPointerDown` controls.start), the remove X, the "+ Add" forest-green accent (`text-primary`), all aria-labels, the stable-id reorder logic (`ids`, `mintId`, `handleReorder`, `updateRow/removeRow/addRow`), and the controlled `string[]` value/onChange contract.
- **`ProductForm.tsx` was NOT modified** — the contract is unchanged.

## Verification

- `npm run check` (tsc strict) — passes, including no unused-import error from the removed `Input`.
- `npm test` — 79 passed (71 existing + 8 new `normalizeMultiline` tests). Green.

## TDD Gate Compliance

Task 1 followed RED -> GREEN:
- RED: `test(quick-260602-vbr): add failing tests for normalizeMultiline helper` (416327e) — confirmed failing (module not found) before implementation.
- GREEN: `feat(quick-260602-vbr): add pure normalizeMultiline render-time helper` (62ed718) — all 8 tests pass.

## Deviations from Plan

None — plan executed exactly as written. (Discretion items per plan: `rows={2}` default with no auto-grow dependency, and `items-center` -> `items-start` for tidy multi-line layout.)

## Known Stubs

None.

## Commits

- 416327e: test(quick-260602-vbr): add failing tests for normalizeMultiline helper
- 62ed718: feat(quick-260602-vbr): add pure normalizeMultiline render-time helper
- c4cc445: feat(quick-260602-vbr): multi-line bullets via Textarea + whitespace-pre-line

## Self-Check: PASSED

- FOUND: client/src/lib/multiline.ts
- FOUND: client/src/lib/multiline.test.ts
- FOUND (modified): client/src/components/admin/RepeatableRows.tsx
- FOUND (modified): client/src/components/ProductDetail.tsx
- FOUND commit: 416327e
- FOUND commit: 62ed718
- FOUND commit: c4cc445
