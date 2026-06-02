---
phase: quick-260602-u0q
plan: 01
subsystem: public-frontend
tags: [questionnaire, product-detail, routing, wouter]
requires:
  - "/questionnaire SPA route (Wouter Route in App.tsx)"
  - "ProductDetail onClose prop"
provides:
  - "One-click path from product detail modal into the Skin Guide questionnaire"
affects:
  - client/src/components/ProductDetail.tsx
tech-stack:
  added: []
  patterns:
    - "Wouter Link with onClick cleanup (mirrors Navbar mobile-menu onClose pattern)"
key-files:
  created: []
  modified:
    - client/src/components/ProductDetail.tsx
decisions:
  - "Used internal Wouter Link href=\"/questionnaire\" (not absolute https URL) so App-level WouterRouter base applies the GitHub Pages base path in dev and prod"
  - "onClick={onClose} closes the Radix Dialog on navigation since Wouter navigation does not auto-close the modal"
metrics:
  duration: ~2min
  completed: 2026-06-02
---

# Quick Task 260602-u0q: Link the "Tell us your skin type" note to the questionnaire — Summary

Turned the static "Tell us your skin type — we'll customize the formulation for you." helper line in the product detail modal into a keyboard-focusable Wouter `Link` to `/questionnaire` that closes the modal on click.

## What Was Done

- Added `import { Link } from "wouter";` to `ProductDetail.tsx` (mirrors Navbar's import).
- Replaced the static `<p>` helper line with a Wouter `<Link href="/questionnaire" onClick={onClose}>` rendering the same text/HTML entities.
- Styling: kept the muted centered helper look (`block text-center text-xs text-foreground/50 mt-3`) and added the codebase's standard link affordance (`underline underline-offset-2 hover:text-secondary transition-colors`).
- Internal routing only — no hardcoded absolute `https://sutravan.in/...` URL, so the App-level `<WouterRouter base=...>` continues to apply the GitHub Pages base path correctly.

## Verification

- `npm run check` (tsc strict) — passed, no new type errors.
- grep gates — `from "wouter"`, `href="/questionnaire"`, `onClick={onClose}` all present; no `sutravan.in/questionnaire` hardcoded URL.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- 5d3a251: feat(quick-260602-u0q): link skin-type helper to questionnaire

## Self-Check: PASSED

- FOUND: client/src/components/ProductDetail.tsx
- FOUND: commit 5d3a251
