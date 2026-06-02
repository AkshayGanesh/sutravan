---
phase: quick-260602-vbr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/lib/multiline.ts
  - client/src/lib/multiline.test.ts
  - client/src/components/admin/RepeatableRows.tsx
  - client/src/components/ProductDetail.tsx
autonomous: true
requirements: [VBR-01]
must_haves:
  truths:
    - "Admin can type a line break inside a single Benefits/Ingredients/Usage-tips row (Enter inserts a newline, not a new bullet)"
    - "Public product detail renders a newline inside one bullet as a second line under the same bullet point (single <li>)"
    - "Legacy literal '/n' and '\\n' (backslash-n) markers in existing data display as real line breaks without mutating stored data"
    - "Drag-to-reorder, remove (X), '+ Add', and aria-labels in RepeatableRows still work after the Input->Textarea swap"
    - "npm run check (tsc strict) and npm test (existing 71 tests + new normalize tests) stay green"
  artifacts:
    - path: "client/src/lib/multiline.ts"
      provides: "Pure normalizeMultiline(s) helper converting literal /n and \\n tokens to real newlines"
      exports: ["normalizeMultiline"]
    - path: "client/src/lib/multiline.test.ts"
      provides: "Vitest unit tests for normalizeMultiline (token variants, no-op, real-newline passthrough)"
    - path: "client/src/components/admin/RepeatableRows.tsx"
      provides: "Per-row editor using Textarea (was Input), all reorder/remove/add affordances preserved"
      contains: "Textarea"
    - path: "client/src/components/ProductDetail.tsx"
      provides: "Three render sites apply normalizeMultiline + whitespace-pre-line"
      contains: "whitespace-pre-line"
  key_links:
    - from: "client/src/components/ProductDetail.tsx"
      to: "client/src/lib/multiline.ts"
      via: "import { normalizeMultiline }"
      pattern: "normalizeMultiline"
    - from: "client/src/components/admin/RepeatableRows.tsx"
      to: "@/components/ui/textarea"
      via: "import { Textarea }"
      pattern: "Textarea"
---

<objective>
Support a line break WITHIN a single Benefits/Ingredients/Usage-tips bullet (not a new bullet).

- Admin enters it via a multi-line Textarea per row (real newline on Enter).
- Public ProductDetail renders the newline inside the same `<li>` via `whitespace-pre-line`.
- Legacy literal `/n` and `\n` (backslash-n) markers typed by the owner normalize to real
  line breaks at render time (non-destructive — stored data is NOT mutated).

Purpose: The owner already hacked literal "/n" into ingredients to fake a break; this makes
multi-line bullets first-class while keeping existing data displaying correctly.

Output: A unit-tested pure `normalizeMultiline` helper, an Input->Textarea swap in
RepeatableRows (all reorder/remove/add affordances preserved), and three updated render sites
in ProductDetail.

Frontend-only. NO new npm dependency, NO DB/migration/live step — text columns already store
the strings (including newlines), which persist via the existing product upsert.
</objective>

<execution_context>
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260602-vbr-support-multi-line-bullets-in-product-be/260602-vbr-CONTEXT.md

# The shared row editor — Input->Textarea swap target (preserve all drag/remove/add logic)
@client/src/components/admin/RepeatableRows.tsx
# Existing Textarea to use
@client/src/components/ui/textarea.tsx
# Three public render sites (Benefits ~174-197, Ingredients ~207-214, Tips ~225)
@client/src/components/ProductDetail.tsx
# Pure-helper test style to mirror
@client/src/lib/slug.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure normalizeMultiline helper + unit test (test-first)</name>
  <files>client/src/lib/multiline.ts, client/src/lib/multiline.test.ts</files>
  <behavior>
    normalizeMultiline(s: string): string — pure, render-time only (D-03 legacy normalization).
    - Converts the literal token `/n` (forward-slash n) — with optional surrounding spaces — to a real newline `\n`. e.g. "Rose oil /n Calming" -> "Rose oil\nCalming".
    - Converts the literal token `\n` (backslash + the letter n, i.e. two source chars) — with optional surrounding spaces — to a real newline `\n`. e.g. "Rose oil \\n Calming" -> "Rose oil\nCalming".
    - No-op when no marker is present: "Plain ingredient" -> "Plain ingredient" (returned unchanged).
    - Real newline passthrough: a string that already contains a real "\n" keeps it (and any literal markers elsewhere still convert).
    - Multiple markers in one string all convert.
    - Optional-space trimming around the marker: "a/nb", "a /n b", "a/n b" all collapse to "a\nb" (a single newline, no stray surrounding spaces left behind by the marker).
    - Idempotent: running it twice yields the same result as once.
    NOTE on token precedence: the backslash-n token `\n` contains the forward-slash-n shape only as the trailing `n`; write the regex so both literal forms are matched as whole tokens (e.g. match `\\n` and `/n` via a single alternation) — do NOT leave a dangling backslash or a leftover slash after replacement.
  </behavior>
  <action>Create client/src/lib/multiline.ts exporting a single pure named function `normalizeMultiline(s: string): string` per D-03. Implement with one String.prototype.replace over a regex alternation that matches either the backslash-n literal or the forward-slash-n literal, each allowing optional surrounding whitespace, replacing the whole match with a single "\n". Mirror the existing small-lib style (no side effects, no imports beyond what's needed; see client/src/lib/slug.ts shape). Then create client/src/lib/multiline.test.ts mirroring client/src/lib/slug.test.ts (vitest: import { describe, it, expect }; import { normalizeMultiline } from "@/lib/multiline"). Write the tests FIRST covering every case in <behavior>: /n token, backslash-n token, optional-space variants (a/nb, a /n b, a/n b), no-op when no marker, real-newline passthrough, multiple markers in one string, and idempotency. Run the test and confirm it fails (RED) before implementing, then make it pass (GREEN). Do NOT add any normalize-on-save path — render-time only, non-destructive, per D-03 discretion.</action>
  <verify>
    <automated>cd /Users/akshayg/Downloads/Earthen-Luxury-Sutravan && npm test -- multiline</automated>
  </verify>
  <done>client/src/lib/multiline.ts exports normalizeMultiline; all new cases in multiline.test.ts pass; no stray slash/backslash left after conversion; helper is pure (no I/O, no mutation of any external state).</done>
</task>

<task type="auto">
  <name>Task 2: Textarea swap in RepeatableRows + whitespace-pre-line render at three ProductDetail sites</name>
  <files>client/src/components/admin/RepeatableRows.tsx, client/src/components/ProductDetail.tsx</files>
  <action>Per D-01 (admin input -> Textarea): In client/src/components/admin/RepeatableRows.tsx, in the RepeatableRow child component, replace the per-row `<Input>` (currently the editable control, value/onChange) with the existing `@/components/ui/textarea` Textarea. Update the import (remove the now-unused `Input` import from "@/components/ui/input"; add `import { Textarea } from "@/components/ui/textarea"`). Give the Textarea a tidy default `rows={2}` and keep `className="flex-1"` (D-03 discretion: rows=2 is the sensible default; auto-grow optional — do not add a dependency for it). Preserve EXACTLY, with zero behavior change: the GripVertical drag handle Button (onPointerDown={(e) => controls.start(e)}, aria-label `Reorder ${label} row ${index + 1}`), the remove X Button (onClick={onRemove}, aria-label `Remove ${label} row ${index + 1}`), the "+ Add" Button (forest-green accent via className="text-primary"), the Reorder.Item dragListener={false} + useDragControls per-row child structure, and the stable-id reorder logic (ids state, mintId, handleReorder, updateRow/removeRow/addRow). Do NOT intercept the Textarea's Enter key — Enter inserting a newline IS the feature. Keep the controlled string[] value/onChange contract unchanged (onEdit still emits e.target.value) so ProductForm.tsx needs NO edits. Align the row container so a multi-line textarea looks sane next to the handle/remove buttons (e.g. switch the row's `items-center` to `items-start` if the buttons should top-align with a tall textarea — Claude's discretion for tidy layout).

Per D-02 + D-03 (public render): In client/src/components/ProductDetail.tsx, add `import { normalizeMultiline } from "@/lib/multiline"` and apply it + `whitespace-pre-line` at all three render sites so a `\n` shows as a line break while the item stays a single `<li>`. (1) Benefits (~174-197): the text `{b}` sits inline after the heart-icon span — wrap it as `<span className="whitespace-pre-line">{normalizeMultiline(b)}</span>` and keep the flex layout sane for multi-line (the `<li>` already uses `flex items-start gap-2`, which top-aligns the icon — good). (2) Ingredients (~207-214): change `{ing}` to `{normalizeMultiline(ing)}` and add `whitespace-pre-line` to the existing `<li>` className (the bullet `::before` stays on the first line). (3) Tips (~225): change `{tip}` to `{normalizeMultiline(tip)}` and add `whitespace-pre-line` to the existing `<li>` className. Render-time only — do NOT mutate product data anywhere.</action>
  <verify>
    <automated>cd /Users/akshayg/Downloads/Earthen-Luxury-Sutravan && npm run check && npm test</automated>
  </verify>
  <done>RepeatableRows uses Textarea (Input import gone), rows={2}, Enter not intercepted; drag handle, remove X, + Add, all aria-labels, and stable-id reorder logic intact; string[] value/onChange contract unchanged (ProductForm.tsx not modified). ProductDetail imports normalizeMultiline and applies it + whitespace-pre-line at all three sites (Benefits via wrapping span, Ingredients + Tips on the <li>). `npm run check` passes (tsc strict) and `npm test` is green (existing 71 + new multiline tests).</done>
</task>

</tasks>

<verification>
- `npm run check` passes (TypeScript strict, no unused-import errors from the removed `Input`).
- `npm test` green: existing 71 tests + new multiline normalize tests.
- Manual sanity (executor self-check, not a checkpoint): in the admin product form a repeatable row is a 2-line textarea; pressing Enter adds a newline within the row (not a new bullet); drag handle still reorders, X removes, "+ Add" adds. On a public product, a bullet containing a real newline OR a legacy "/n" / "\n" marker renders as a second line under the same bullet point.
</verification>

<success_criteria>
- A line break within a single Benefits/Ingredients/Usage-tips bullet is enterable in admin (Textarea, Enter = newline) and renders as a second line inside the same `<li>` on the public product detail (whitespace-pre-line), across all three lists.
- Legacy literal `/n` and `\n` (backslash-n) markers in existing data display as real line breaks at render time, with stored data untouched.
- RepeatableRows keeps drag-to-reorder, remove, "+ Add", aria-labels, stable-id reorder logic, and the string[] value/onChange contract (ProductForm.tsx unchanged).
- No new npm dependency, no DB/migration/live step.
- `npm run check` + `npm test` both pass.
</success_criteria>

<output>
Create `.planning/quick/260602-vbr-support-multi-line-bullets-in-product-be/260602-vbr-SUMMARY.md` when done.
</output>
