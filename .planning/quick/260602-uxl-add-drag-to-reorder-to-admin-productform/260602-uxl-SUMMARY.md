---
phase: quick-260602-uxl
plan: 01
subsystem: admin-product-form
tags: [admin, ux, drag-reorder, framer-motion]
requires:
  - framer-motion (already installed, ^12.23.24)
provides:
  - Drag-to-reorder for all three admin Product-form repeatable lists (Benefits, Ingredients, Usage tips)
affects:
  - client/src/components/admin/RepeatableRows.tsx
tech-stack:
  added: []
  patterns:
    - "framer-motion Reorder.Group + Reorder.Item dragListener={false} + per-row useDragControls"
    - "stable internal numeric id identity (never index, never string value); ids never leak to parent"
key-files:
  created: []
  modified:
    - client/src/components/admin/RepeatableRows.tsx
decisions:
  - "Item identity is a monotonic numeric id minted via useRef counter, aligned 1:1 with the controlled value by position; reconciled on outside value-length change (form reset/load)."
  - "Drag is handle-only (GripVertical onPointerDown -> controls.start) so the text Input stays selectable/editable."
  - "Weight options (variants table w/ DB sort_order) intentionally OUT OF SCOPE — different editor, separate future task."
metrics:
  duration: ~6min
  completed: 2026-06-02
---

# Quick 260602-uxl: Add drag-to-reorder to admin ProductForm Summary

Drag-to-reorder (handle-only) for the admin Product form's Benefits / Ingredients / Usage-tips lists, delivered by the single centralized `RepeatableRows.tsx` using framer-motion's `Reorder` with stable internal ids — no new dependency, no DB change.

## What Was Built

`client/src/components/admin/RepeatableRows.tsx` was rewritten to wrap its rows in a `Reorder.Group` (`axis="y"`). Each row is a `Reorder.Item` with `dragListener={false}` and its own `useDragControls()`, extracted into a `RepeatableRow` child component so the hook is called once per row at the top level (never inside `.map`). A `GripVertical` ghost icon-button starts the drag via `controls.start(e)` on `onPointerDown`, so dragging never begins from the editable Input.

Identity is a stable internal numeric id minted by a `useRef` monotonic counter and held in `useState<number[]>` aligned 1:1 with the controlled `value`. Add appends an id, remove drops the id at the index, reorder permutes ids alongside strings, edit leaves ids untouched. A `useEffect` reconciles on outside `value`-length changes (form reset / loading a product) by regenerating ids. The parent contract is unchanged — `RepeatableRowsProps` is identical and `onChange` only ever emits `string[]`. `ProductForm.tsx` was not touched.

The forest-green "+ Add" accent (`variant="ghost" className="text-primary"` + `Plus`), the `space-y-2` spacing, the `<Label>{label}</Label>` header, the per-row remove `<X>` button, and all their aria-labels are preserved verbatim. A new `Reorder ${label} row N` aria-label was added on the handle.

## Verification

- `npm run check` (tsc strict) — PASS, no errors, no `any` introduced for ids.
- `npm test` (vitest) — PASS, 71/71 tests across 9 files stay green.

## Manual Verification (recommended)

In the admin Product form: drag a Benefits row by its grip handle to a new position, Save the product, then reload the edit page — confirm the new order persisted (it rides the existing product upsert as plain array order). Also confirm clicking into a row's text Input still selects/edits text without starting a drag, and that empty/duplicate rows reorder without jumping.

## Deviations from Plan

None — plan executed exactly as written.

## Follow-up

"Weight options" rows (per-product variants/SKUs, backed by the `product_variants` table with its own DB `sort_order` column) were intentionally OUT OF SCOPE. They use a different inline editor and would need DB-persisted reordering — a good candidate for a future drag-to-reorder task. Full keyboard-operable reordering was also left as a stretch goal (pointer/touch drag only); existing keyboard add/remove/edit is unchanged.

## Self-Check: PASSED

- FOUND: client/src/components/admin/RepeatableRows.tsx
- FOUND: commit 6a6446f
