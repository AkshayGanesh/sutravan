---
phase: 260602-ucf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/lib/copy.ts
  - client/src/pages/Questionnaire.tsx
  - client/src/components/ProductDetail.tsx
autonomous: true
requirements: [QUICK-260602-UCF]
must_haves:
  truths:
    - "The questionnaire intro shows the verbatim customization-pricing caveat as a muted line under the intro paragraph"
    - "The questionnaire review step shows the verbatim caveat as a muted note near the final submit / Turnstile"
    - "The product detail modal shows the verbatim caveat adjacent to the universal 'Tell us your skin type' questionnaire link (shown on every product)"
    - "The caveat string is identical in all three places (single source of truth, no drift)"
    - "The caveat does NOT appear next to the variant/SKU price area (weight pills, 'From ₹…')"
    - "npm run check passes (tsc strict)"
  artifacts:
    - path: "client/src/lib/copy.ts"
      provides: "Single exported CUSTOMIZATION_PRICING_CAVEAT string constant"
      contains: "CUSTOMIZATION_PRICING_CAVEAT"
    - path: "client/src/pages/Questionnaire.tsx"
      provides: "Caveat in intro section and review step"
      contains: "CUSTOMIZATION_PRICING_CAVEAT"
    - path: "client/src/components/ProductDetail.tsx"
      provides: "Caveat adjacent to the universal questionnaire link"
      contains: "CUSTOMIZATION_PRICING_CAVEAT"
  key_links:
    - from: "client/src/pages/Questionnaire.tsx"
      to: "client/src/lib/copy.ts"
      via: "import CUSTOMIZATION_PRICING_CAVEAT"
      pattern: "from \"@/lib/copy\""
    - from: "client/src/components/ProductDetail.tsx"
      to: "client/src/lib/copy.ts"
      via: "import CUSTOMIZATION_PRICING_CAVEAT"
      pattern: "from \"@/lib/copy\""
---

<objective>
Add a short, static, unobtrusive caveat that customized products may be priced
differently from the fixed catalog prices, in three user-facing locations: the
questionnaire intro, the questionnaire review step, and the product detail modal
(anchored to the universal "Tell us your skin type" questionnaire link).

Purpose: Set the right expectation before a customer submits a customization
request, without undermining the concrete catalog/variant prices shown elsewhere.

Output: One shared copy constant plus three muted caveat lines. No DB, no
migration, no admin field, no live step — pure presentational copy.
</objective>

<execution_context>
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260602-ucf-add-customization-pricing-caveat-copy-to/260602-ucf-CONTEXT.md
@client/src/pages/Questionnaire.tsx
@client/src/components/ProductDetail.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add shared caveat constant and render it in all three placements</name>
  <files>client/src/lib/copy.ts, client/src/pages/Questionnaire.tsx, client/src/components/ProductDetail.tsx</files>
  <action>
Create `client/src/lib/copy.ts` exporting a single plain string constant
`CUSTOMIZATION_PRICING_CAVEAT` with the EXACT verbatim wording from CONTEXT.md
(do NOT paraphrase, do NOT add or remove a trailing period):
"🪄 Each Sutravan product is handcrafted to suit your unique skin type & concerns. As a result, pricing may vary depending on the ingredients & level of customization requested".
Keep the file trivial — one named export, no functions, no logic.

In `client/src/pages/Questionnaire.tsx`: import the constant from `@/lib/copy`.
Add it in TWO places.
(1) Intro section: directly below the existing intro paragraph (the
`<p className="text-foreground/70 max-w-xl mx-auto">…</p>` at ~lines 207-210,
inside the `max-w-3xl` div), render a new muted `<p>` styled
`text-xs text-foreground/50 mt-3` (or `text-sm text-foreground/60` — match the
unobtrusive muted-copy convention, NOT an alarming banner) containing the
constant.
(2) Review step: inside the `step === REVIEW_STEP` block, after the review `<dl>`
closes (~line 465) and before the Turnstile `<div className="pt-2">`, render the
same muted `<p>` (e.g. `text-xs text-foreground/50`) containing the constant.
Both must reference `CUSTOMIZATION_PRICING_CAVEAT`, not a re-typed literal.

In `client/src/components/ProductDetail.tsx`: import the constant from
`@/lib/copy`. Anchor it to the UNIVERSAL questionnaire link — the
`<Link href="/questionnaire">…Tell us your skin type…</Link>` at ~lines 263-270
(this renders for every product). Add a muted `<p>` styled
`text-xs text-foreground/50` (matching the link's muted tone) immediately
after that `<Link>`, containing the constant. Do NOT anchor it to the
per-product "Customization options available" ingredient bullet, and do NOT
place it near the variant weight pills (~lines 135-152) or the
"From ₹…"/`text-xl font-semibold` price line (~lines 154-158) — those are fixed
catalog prices.

This is the QUICK-260602-UCF caveat copy task per the locked CONTEXT.md
decisions. No DB, no site_content key, no admin field.
  </action>
  <verify>
    <automated>cd /Users/akshayg/Downloads/Earthen-Luxury-Sutravan &amp;&amp; npm run check</automated>
  </verify>
  <done>
`client/src/lib/copy.ts` exports `CUSTOMIZATION_PRICING_CAVEAT` with the verbatim
string. The constant is imported and rendered as a muted line in the
Questionnaire intro section, in the Questionnaire review step, and adjacent to the
universal questionnaire link in ProductDetail. The caveat does not appear next to
variant pills or the catalog price line. `npm run check` passes with no new type
errors.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | This change adds static, hardcoded display text only. No user input is read, stored, or rendered; no new data crosses any boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260602-ucf-01 | Information Disclosure | Static caveat copy | accept | Copy is brand-approved public marketing text; reveals nothing sensitive. |
| T-260602-ucf-SC | Tampering | npm/pip/cargo installs | accept | No package installs in this plan; uses only existing deps (React, wouter). |
</threat_model>

<verification>
- `npm run check` passes (tsc strict) — the only gate; no new tests (pure presentational copy).
- Visual: caveat string is identical in all three locations (single shared constant).
- The caveat is muted (matches existing helper conventions) and not near the variant/SKU price area.
</verification>

<success_criteria>
- Verbatim caveat string lives in one shared constant (`client/src/lib/copy.ts`).
- Caveat renders in: questionnaire intro, questionnaire review step, and the
  product detail modal next to the universal questionnaire link.
- No DB, migration, admin field, or live step introduced.
- `npm run check` passes.
</success_criteria>

<output>
Create `.planning/quick/260602-ucf-add-customization-pricing-caveat-copy-to/260602-ucf-SUMMARY.md` when done
</output>
