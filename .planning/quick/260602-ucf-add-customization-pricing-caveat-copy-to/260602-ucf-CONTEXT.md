# Quick Task 260602-ucf: Customization-pricing caveat copy - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Task Boundary

Surface a short caveat that bespoke/customized products may be priced differently from the standard
catalog prices. Placement (from the validated recommendation): primary on the questionnaire (intro +
review step), secondary in the product detail modal anchored to the universal "Tell us your skin
type → questionnaire" line. NOT next to variant/SKU pricing (those are fixed catalog prices) and NOT
a global footer/banner.
</domain>

<decisions>
## Implementation Decisions

### Copy source
- STATIC hardcoded copy. No site_content key, no admin-editable field. (Rewording later = code change.)

### Exact wording (use VERBATIM, do not paraphrase)
- "🪄 Each Sutravan product is handcrafted to suit your unique skin type & concerns. As a result, pricing may vary depending on the ingredients & level of customization requested"

### Placements (3)
1. Questionnaire **intro** — under the intro paragraph in the header section
   (`Questionnaire.tsx` ~lines 207-210, below "Tell us about your skin…").
2. Questionnaire **review step** — inside the `step === REVIEW_STEP` block
   (`Questionnaire.tsx` ~line 465, after the review `<dl>`, near the final submit/Turnstile).
3. Product **detail modal** — next to the universal "Tell us your skin type — we'll customize…"
   helper line that links to the questionnaire (`ProductDetail.tsx` ~lines 262-265). This line shows
   on EVERY product (hardcoded), unlike the per-product "Customization options available" ingredient
   bullet, which is product-specific DB data and must NOT be used as the anchor.

### Claude's Discretion
- Exact styling — use the existing muted helper conventions (e.g. `text-xs text-foreground/50` /
  `text-foreground/70`) so it reads as a soft caveat, consistent with surrounding copy. Keep it
  unobtrusive (not an alarming banner).
- Whether to extract the string to a small shared constant to avoid duplicating the literal across
  the two files — fine either way; a shared const is slightly cleaner.
</decisions>

<specifics>
## Specific Ideas

- Keep the caveat AWAY from the variant/SKU price area ("From ₹…", weight pills) — those are concrete
  catalog prices and a "pricing may vary" line next to them would undermine them.
- No DB / migration / live step — pure static JSX copy. Gate with `npm run check`.
</specifics>
