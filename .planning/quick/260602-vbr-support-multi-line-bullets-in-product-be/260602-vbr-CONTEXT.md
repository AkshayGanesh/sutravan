# Quick Task 260602-vbr: Multi-line bullets in product list fields - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Task Boundary

A single Benefits / Ingredients / Usage-tips bullet may need a second line that belongs to the SAME
bullet (not a new bullet). Today the admin row is a single-line input, so the owner hacked a literal
"/n" into an ingredient to fake a break. Add real support: admin can enter a line break within one
bullet, and the public product detail renders it as a second line under the same bullet point.
</domain>

<decisions>
## Implementation Decisions

### Input method
- Multi-line **textarea** per row (replace the single-line `<Input>` in RepeatableRows with the
  existing `@/components/ui/textarea` Textarea, auto-growing / sensible default rows). Admin presses
  Enter for a line break within the same bullet. Real `\n` newline stored in the string[] value.

### Render
- Public detail (ProductDetail.tsx) renders Benefits, Ingredients, and Usage tips with newlines
  preserved INSIDE one bullet — apply `whitespace-pre-line` to the text so `\n` shows as a line break
  while staying a single `<li>`.

### Backward-compat (legacy data)
- Existing rows contain a literal "/n" (and possibly "\n" backslash-n) typed by the owner. Normalize
  these literal markers to a real newline on render (shared pure helper), so current products show
  correctly without manual data fixes.

### Claude's Discretion
- Textarea sizing (rows=2 default + auto-grow vs fixed) — pick a tidy default consistent with the form.
- Whether to ALSO normalize markers on save (one-time) vs only on render — render-time normalization is
  sufficient and non-destructive; prefer that.
- Exact helper location (e.g. a small `lib/multiline.ts` or extend `lib/copy.ts`) + a unit test.
</decisions>

<specifics>
## Specific Ideas

- RepeatableRows.tsx was JUST given drag-to-reorder (framer-motion Reorder + per-row child with
  useDragControls + stable internal ids). Switching Input → Textarea MUST preserve: the drag handle,
  remove (X), "+ Add", aria-labels, and the stable-id reorder logic. In a textarea, Enter should
  create a newline (that is the feature) — do NOT intercept Enter; the drag handle stays the drag
  trigger (drag is already handle-only via dragListener={false}).
- Three render sites in ProductDetail.tsx: Benefits (~174-197, text `{b}` after an icon span — wrap in
  a span with whitespace-pre-line), Ingredients (~207-214, `{ing}` in a `::before`-bulleted `<li>`),
  Usage tips (~225, `{tip}`). Apply the normalize helper + whitespace-pre-line at all three.
- No DB / migration / live step — text columns already store the strings; newlines persist via the
  existing product upsert. Gate: `npm run check` + `npm test`.
</specifics>
