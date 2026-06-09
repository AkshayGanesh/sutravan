---
phase: 260602-ucf
plan: 01
subsystem: customer-facing-copy
tags: [copy, questionnaire, product-detail, static]
requires: []
provides:
  - CUSTOMIZATION_PRICING_CAVEAT shared copy constant
affects:
  - client/src/pages/Questionnaire.tsx
  - client/src/components/ProductDetail.tsx
tech-stack:
  added: []
  patterns:
    - "Shared static UI copy constant in client/src/lib/copy.ts (single source of truth, no drift)"
key-files:
  created:
    - client/src/lib/copy.ts
  modified:
    - client/src/pages/Questionnaire.tsx
    - client/src/components/ProductDetail.tsx
decisions:
  - "Extracted the caveat to a shared constant (CUSTOMIZATION_PRICING_CAVEAT) so the verbatim wording lives once and cannot drift across the three placements"
  - "Used text-xs text-foreground/50 muted styling to match existing helper copy conventions (not an alarming banner)"
  - "Anchored ProductDetail caveat to the universal /questionnaire link (renders on every product), NOT the per-product ingredient bullet or the variant/price area"
metrics:
  duration: ~3min
  completed: 2026-06-02
---

# Quick Task 260602-ucf: Customization-pricing caveat copy Summary

Added a static, muted caveat — "🪄 Each Sutravan product is handcrafted to suit your unique skin type & concerns. As a result, pricing may vary depending on the ingredients & level of customization requested" — sourced from one shared constant and rendered in the questionnaire intro, the questionnaire review step, and the product detail modal next to the universal questionnaire link.

## What Was Built

- **`client/src/lib/copy.ts`** (new): exports a single `CUSTOMIZATION_PRICING_CAVEAT` string constant with the verbatim brand-approved wording. Trivial file — one named export, no logic.
- **`client/src/pages/Questionnaire.tsx`**: imports the constant and renders it in two places:
  1. Intro section — muted `<p className="text-xs text-foreground/50 mt-3 max-w-xl mx-auto">` directly below the intro paragraph.
  2. Review step — muted `<p className="text-xs text-foreground/50">` after the review `<dl>` and before the Turnstile widget.
- **`client/src/components/ProductDetail.tsx`**: imports the constant and renders a muted `<p className="text-xs text-foreground/50 mt-2 text-center">` immediately after the universal "Tell us your skin type" questionnaire `<Link>` (shown on every product).

All three render the same imported constant — no re-typed literals, so the wording cannot drift.

## Placement Verification

- Caveat is NOT placed next to the variant weight pills (~lines 135-152) or the catalog price line (~lines 154-158). Those remain concrete fixed prices.
- Caveat is anchored to the universal questionnaire link, NOT the per-product "Customization options available" ingredient bullet.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run check` (tsc strict) passes with no errors.

## Commits

- `f78af54`: feat(quick-260602-ucf): add customization-pricing caveat copy

## Self-Check: PASSED

- FOUND: client/src/lib/copy.ts
- FOUND: commit f78af54
- Questionnaire.tsx references CUSTOMIZATION_PRICING_CAVEAT (1 import + 2 renders)
- ProductDetail.tsx references CUSTOMIZATION_PRICING_CAVEAT (1 import + 1 render)
