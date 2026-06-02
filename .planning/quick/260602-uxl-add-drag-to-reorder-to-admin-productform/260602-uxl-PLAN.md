---
phase: quick-260602-uxl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/components/admin/RepeatableRows.tsx
autonomous: true
requirements: [UXL-REORDER-01]
must_haves:
  truths:
    - "In the admin Product form, each Benefits/Ingredients/Usage-tips row shows a drag handle and can be reordered by dragging that handle"
    - "Dragging only starts from the handle — clicking into the text Input still lets the owner select/edit text without triggering a drag"
    - "Reordering produces the new order in the controlled value (parent only ever receives string[]), so the order persists on Save via the existing product upsert"
    - "Per-row edit, per-row remove (X), and '+ Add' all still work exactly as before, including the forest-green '+ Add' accent"
    - "Empty and duplicate row strings reorder correctly without rows jumping or swapping (identity is a stable internal id, not the string value)"
  artifacts:
    - path: "client/src/components/admin/RepeatableRows.tsx"
      provides: "Drag-to-reorder repeatable rows with stable internal ids, handle-only drag, unchanged edit/remove/add"
      contains: "Reorder.Group"
  key_links:
    - from: "client/src/components/admin/RepeatableRows.tsx"
      to: "framer-motion Reorder"
      via: "Reorder.Group + Reorder.Item dragListener={false} + useDragControls"
      pattern: "Reorder\\.(Group|Item)"
    - from: "client/src/components/admin/RepeatableRows.tsx"
      to: "RHF FormField onChange (parent contract)"
      via: "onChange(orderedStrings) — always emits string[]"
      pattern: "onChange\\("
---

<objective>
Add drag-to-reorder to the admin Product form's repeatable list sections (Benefits,
Ingredients, Usage tips). All three lists are rendered by ONE component
(`client/src/components/admin/RepeatableRows.tsx`), so the change is centralized there
and all three gain reordering at once.

Purpose: The owner can curate the display order of product benefits/ingredients/tips
without deleting and re-adding rows. Order is just array order, which already persists
via the existing product upsert — no DB change.

Output: Updated `RepeatableRows.tsx` using framer-motion's `Reorder` (already a
dependency — `framer-motion ^12.23.24`). No new npm dependency, no migration, no live step.
</objective>

<execution_context>
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@client/src/components/admin/RepeatableRows.tsx
@client/src/pages/admin/ProductForm.tsx

# Current contract (do not break):
# - RepeatableRowsProps: { value: string[]; onChange: (v: string[]) => void; label: string; addLabel?: string }
# - Used 3x in ProductForm.tsx (~lines 437-484) via RHF FormField for benefits / ingredients / tips.
#   field.value (string[]) -> value, field.onChange -> onChange. Parent must ONLY ever see string[].
# - Existing affordances to preserve verbatim:
#   * remove: <Button variant="ghost" size="icon" aria-label={`Remove ${label} row ${index + 1}`}> with <X className="size-4" />
#   * add: <Button variant="ghost" className="text-primary"> with <Plus className="size-4" /> (forest-green "+ Add" accent)
# - framer-motion Reorder + useDragControls confirmed exported from "framer-motion".
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add drag-to-reorder (handle-only, stable ids) to RepeatableRows</name>
  <files>client/src/components/admin/RepeatableRows.tsx</files>
  <action>
Rewrite the row list in `RepeatableRows.tsx` to use framer-motion's `Reorder` while keeping
the exact same public contract (`value: string[]` + `onChange: (v: string[]) => void`) and
keeping per-row edit, per-row remove, and "+ Add" working unchanged.

Stable identity (the critical part): row strings can be EMPTY or DUPLICATE, so the string
value MUST NOT be the Reorder item identity, and the array index MUST NOT be used either
(the current `key={index}` is exactly the identity bug to fix). Maintain a parallel array of
stable numeric ids INTERNAL to the component:
  - Use a `useRef` monotonic counter to mint new ids, and `useState<number[]>` (or a row-object
    array of `{ id, value }`) to hold ids aligned 1:1 with `value`.
  - On add: append one new id; on remove(index): drop the id at that index; on reorder: reorder
    ids alongside values; on edit(index): leave ids untouched.
  - Reconcile with the controlled `value` prop changing from OUTSIDE (form reset / loading an
    existing product): in a `useEffect` (or render-time reconcile) detect a length/identity
    mismatch between the internal ids and the incoming `value` and regenerate ids to match the
    new length. Keep this bookkeeping fully internal — never leak ids to the parent.
  - Always emit `onChange(orderedStrings)` so the parent (RHF) only ever receives `string[]`.

Reorder wiring:
  - Wrap rows in `Reorder.Group` with `axis="y"`, `values={...}` (the ordered ids or row objects),
    and `onReorder={...}` that maps the new id order back to the corresponding strings and calls
    `onChange(orderedStrings)` (and updates internal id state).
  - Each row is a `Reorder.Item` with `value={id}` (or the row object) and `dragListener={false}`,
    using a per-row `const controls = useDragControls()`. Because each row needs its own
    controls hook, extract the row into a child component (e.g. `RepeatableRow`) so the hook is
    called once per row at the top level of that child (do NOT call hooks inside `.map`).
  - Render a dedicated drag HANDLE (lucide `GripVertical`) as a ghost icon-button mirroring the
    existing X remove button (`variant="ghost" size="icon"`, muted look, `cursor-grab`). On the
    handle, call `controls.start(e)` from `onPointerDown` so dragging starts only from the handle —
    NOT from the editable Input (dragging the whole row would fight text selection).
  - Keep the existing `<Input value={row} onChange={...} className="flex-1" />` and the existing
    remove `<Button ...><X /></Button>` inside each row, behaviorally unchanged.

Accessibility / styling:
  - Handle gets `type="button"`, `aria-label={`Reorder ${label} row ${index + 1}`}`, and is
    focusable (it is a Button, so already focusable); keep `cursor-grab`.
  - Preserve the forest-green "+ Add" accent (`variant="ghost" className="text-primary"` + `Plus`),
    spacing (`space-y-2`), and the `<Label>{label}</Label>` header exactly.
  - Do NOT regress keyboard-operable add/remove/edit. Full keyboard reordering is a stretch goal —
    pointer/touch drag only is acceptable for this task.

Imports: add `Reorder`, `useDragControls` from "framer-motion"; add `GripVertical` to the existing
lucide import; add `useRef`, `useState`, `useEffect` from "react" as needed. Do NOT add any new
npm dependency. Do NOT change `RepeatableRowsProps`. Do NOT touch ProductForm.tsx (the contract is
unchanged). Weight options rows are OUT OF SCOPE (different inline editor backed by the variants
table with its own DB `sort_order`).
  </action>
  <verify>
    <automated>npm run check && npm test</automated>
  </verify>
  <done>
`npm run check` (tsc strict) passes and `npm test` (existing vitest suite) stays green.
`RepeatableRows.tsx` renders a `Reorder.Group` of `Reorder.Item` rows with `dragListener={false}`,
each row uses `useDragControls()` and a `GripVertical` handle that starts the drag via
`controls.start`, identity is a stable internal id (not index, not string value), edit/remove/add
and the forest-green "+ Add" accent are unchanged, and the component still only emits `string[]`
to `onChange`.
  </done>
</task>

</tasks>

<verification>
- `npm run check` passes (TypeScript strict, no `any` introduced for ids).
- `npm test` passes (existing vitest suite green; RepeatableRows has no unit test today — a small
  reorder/add/remove logic test is OPTIONAL, not required).
- Reorder item identity is a stable internal id; reordering a list containing empty AND duplicate
  strings does not cause rows to jump/swap.
- Drag starts only from the `GripVertical` handle; clicking into the Input lets the owner select/edit
  text without starting a drag.
- Per-row edit, per-row remove (X with its aria-label), and "+ Add" (forest-green) all work as before.
- Parent (ProductForm RHF FormField) is untouched and still receives only `string[]`.
</verification>

<success_criteria>
- All three admin Product-form lists (Benefits, Ingredients, Usage tips) support drag-to-reorder via
  a per-row handle, delivered by the single centralized `RepeatableRows.tsx`.
- New order persists on Save through the existing product upsert (no DB/migration/live step).
- No new npm dependency (framer-motion `Reorder` used).
- No regression to existing add/remove/edit/keyboard behavior or brand styling.
</success_criteria>

<output>
Create `.planning/quick/260602-uxl-add-drag-to-reorder-to-admin-productform/260602-uxl-SUMMARY.md` when done.
In the SUMMARY, include:
- Manual verification note: drag a Benefits row to a new position, Save the product, reload — confirm
  the order persisted.
- Follow-up note: "Weight options" rows (variants table, DB `sort_order`) were intentionally OUT OF
  SCOPE and are a candidate for a future drag-to-reorder task with DB persistence.
</output>
