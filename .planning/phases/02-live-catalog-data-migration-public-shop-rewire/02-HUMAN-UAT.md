---
status: partial
phase: 02-live-catalog-data-migration-public-shop-rewire
source: [02-VERIFICATION.md]
started: 2026-05-31
updated: 2026-05-31
---

## Current Test

[awaiting human testing]

## Tests

### 1. Home category showcase + featured grid
expected: 3 category tiles (Soaps/Scrubs/Creams) and up to 3 featured cards render from live Supabase data, with loading skeletons on first paint.
result: [pending]

### 2. Shop tab counts and image rendering
expected: tab counts show 28 total / 13 soap / 10 scrub / 5 cream; soap cards show Storage photos; scrub/cream show the category placeholder; "Price on request" appears on every product.
result: [pending]

### 3. Product detail carousel
expected: a soap product shows carousel arrows/dots (multiple images); scrub/cream show a single placeholder with no arrows/dots.
result: [pending]

### 4. Loading / error / retry states
expected: skeleton cards on load; on a simulated network failure an inline error with a working Retry button appears; retry recovers and renders the catalog.
result: [pending]

### 5. URL deep-link /shop/soap (CR-02)
expected: navigating directly to /shop/soap activates the Soaps tab. NOTE: verifier flagged this as a regression — currently lands on "All Products". Confirm behavior and whether the fix is acceptable.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
