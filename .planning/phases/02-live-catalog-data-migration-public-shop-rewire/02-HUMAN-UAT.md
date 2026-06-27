---
status: complete
phase: 02-live-catalog-data-migration-public-shop-rewire
source: [02-VERIFICATION.md]
started: 2026-05-31
updated: 2026-06-27
---

## Current Test

[testing complete]

## Tests

### 1. Home category showcase + featured grid
expected: 3 category tiles (Soaps/Scrubs/Creams) and up to 3 featured cards render from live Supabase data, with loading skeletons on first paint.
result: pass

### 2. Shop tab counts and image rendering
expected: tab counts show 28 total / 13 soap / 10 scrub / 5 cream; soap cards show Storage photos; scrub/cream show the category placeholder; "Price on request" appears on every product.
result: pass

### 3. Product detail carousel
expected: a soap product shows carousel arrows/dots (multiple images); scrub/cream show a single placeholder with no arrows/dots.
result: pass

### 4. Loading / error / retry states
expected: skeleton cards on load; on a simulated network failure an inline error with a working Retry button appears; retry recovers and renders the catalog.
result: pass

### 5. URL deep-link /shop/soap (CR-02 — fixed)
expected: navigating directly to /shop/soap activates the Soaps tab; /shop/unknowncategory falls back to All Products. Fixed in commit f368082 (seed from URL param + useEffect validation). Confirm it now works.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
