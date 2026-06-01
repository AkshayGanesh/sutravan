---
phase: 04-admin-portal-catalog-content-management
plan: 02
subsystem: testing
tags: [vitest, jsdom, dompurify, heic2any, browser-image-compression, slug, xss, image-pipeline]

# Dependency graph
requires:
  - phase: 03-authentication-roles
    provides: authErrors.ts str->str error-mapper convention (mirrored by mapWriteError)
  - phase: 02-live-catalog-data-migration-public-shop-rewire
    provides: catalog.ts Storage URL helpers + format.ts pure-util convention
provides:
  - "slugify(name) pure util (D-07) — lowercase/hyphenated/punctuation-stripped slug derivation"
  - "sanitizeRichText(html) — DOMPurify allow-list + link-hardening hook for public rich-text render (D-19)"
  - "imagePipeline: assertImageAllowed guard + processImage lazy HEIC convert/compress (D-11/D-12)"
  - "mapWriteError(error) — PostgREST code -> friendly admin copy (mirrors authErrors.ts)"
  - "Vitest footing (vitest.config.ts + npm test script) for the admin write layer"
affects: [admin-lib, admin-portal, our-story-public-render, image-upload]

# Tech tracking
tech-stack:
  added: [vitest 4.1.7, jsdom 29, dompurify 3.4.7, heic2any 0.0.4, browser-image-compression 2.0.2]
  patterns: ["RED→GREEN unit suites for pure logic modules", "lazy dynamic import() to keep heavy libs out of public bundle", "per-file // @vitest-environment jsdom pragma for DOM-touching suites"]

key-files:
  created:
    - vitest.config.ts
    - client/src/lib/slug.ts
    - client/src/lib/slug.test.ts
    - client/src/lib/adminErrors.ts
    - client/src/lib/adminErrors.test.ts
    - client/src/lib/sanitizeHtml.ts
    - client/src/lib/sanitizeHtml.test.ts
    - client/src/lib/imagePipeline.ts
    - client/src/lib/imagePipeline.test.ts
  modified:
    - package.json

key-decisions:
  - "Kept heic2any as HEIC primary (heic-to documented fallback) — owner-approved at Task 1 gate"
  - "Used jsdom (not happy-dom) for the sanitizeHtml suite via a per-file @vitest-environment pragma; node env remains default for the pure suites"
  - "23505 unique-violation copy: 'That name is already in use — choose a different one.' (no verbatim UI-SPEC entry; mirrors the collision intent)"

patterns-established:
  - "Pattern 1: pure logic modules ship test-first (RED→GREEN) with a self-documenting header comment mirroring format.ts/authErrors.ts"
  - "Pattern 2: heavy image/HEIC libs are dynamically imported inside processImage, never statically at module top (bundle discipline)"
  - "Pattern 3: DOMPurify afterSanitizeAttributes hook forces rel=noopener noreferrer + target=_blank on every surviving href"

requirements-completed: [ADMIN-01, ADMIN-03, ADMIN-04, ADMIN-05]

# Metrics
duration: 8min
completed: 2026-06-01
---

# Phase 4 Plan 2: Admin Write-Layer Pure Modules Summary

**Four test-first pure logic modules (slugify, sanitizeRichText, image guard/pipeline, mapWriteError) plus a Vitest footing — the regression-prone foundation the whole admin write layer rests on.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-01T10:30:00Z
- **Completed:** 2026-06-01T10:32:30Z
- **Tasks:** 3 (Task 1 owner-approved gate, Tasks 2–3 built)
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments
- Stood up Vitest (4.1.7) + jsdom with an `@`-alias config mirroring vite.config.ts and a `"test": "vitest run"` npm script.
- `slugify` (D-07) and `mapWriteError` (PostgREST 23503/23505/network/fallback, mirroring authErrors.ts) — 8 green cases.
- `sanitizeRichText` (DOMPurify allow-list + link-hardening hook, D-19/T-04-04/T-04-05) and the `assertImageAllowed` guard + lazy `processImage` pipeline (D-11/D-12/T-04-06) — 8 green cases.
- All four suites green (16/16), `tsc` clean, and heavy HEIC/compression libs verified dynamically imported (out of the public bundle).

## Task Commits

1. **Task 1: [GATE] verify [ASSUMED] packages** — owner-approved by orchestrator (not re-run). dompurify 3.4.7, browser-image-compression 2.0.2, heic2any 0.0.4, heic-to 1.5.2, @tiptap/react 3.24.0, @tiptap/starter-kit 3.24.0 confirmed legitimate (cure53/DOMPurify, Donaldcwl, alexcorvi, hoppergee, ueberdosis/tiptap), versions match, no postinstall scripts. heic2any kept as HEIC primary.
2. **Task 2: Vitest footing + slug.ts + adminErrors.ts** — `64d9418` (feat, RED→GREEN)
3. **Task 3: sanitizeHtml.ts + imagePipeline.ts guard** — `bf75973` (feat, RED→GREEN)

**Plan metadata:** (final docs commit)

_TDD tasks combined RED + GREEN into one commit each (test files + implementation staged together)._

## Files Created/Modified
- `vitest.config.ts` - Vitest config: node env default, `@`→client/src alias, `client/src/**/*.test.ts` include glob.
- `client/src/lib/slug.ts` - `slugify(name)` pure util (D-07).
- `client/src/lib/slug.test.ts` - 4 cases (simple, ampersand/punctuation, whitespace collapse, repeated separators).
- `client/src/lib/adminErrors.ts` - `mapWriteError(error)` PostgREST-code→friendly copy.
- `client/src/lib/adminErrors.test.ts` - 4 cases (23503, 23505, network, fallback).
- `client/src/lib/sanitizeHtml.ts` - `sanitizeRichText(html)` DOMPurify allow-list + afterSanitizeAttributes link-hardening hook.
- `client/src/lib/sanitizeHtml.test.ts` - 4 cases (script strip, onerror strip, formatting kept, link hardened); jsdom pragma.
- `client/src/lib/imagePipeline.ts` - `assertImageAllowed`/`processImage`, `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES`; heic2any + browser-image-compression lazy-imported.
- `client/src/lib/imagePipeline.test.ts` - 4 guard cases (constants, >10MB reject, bad MIME reject, accept jpeg/png/webp/heic).
- `package.json` - Added `"test"` script + vitest/jsdom devDeps (commit also captured the owner-approved image/rich-text dependency additions already present in the working tree).

## Decisions Made
- heic2any remains the HEIC primary; heic-to is the documented fallback (owner-approved at the Task 1 gate).
- jsdom over happy-dom for the DOM-touching sanitizeHtml suite, opted in per-file via `// @vitest-environment jsdom` so the pure suites stay on the fast `node` env.
- 23505 collision copy authored as "That name is already in use — choose a different one." (no verbatim UI-SPEC string for this case; carries the collision intent the plan requires).

## Deviations from Plan
None - plan executed exactly as written. (Task 2 install resolved `vitest` to 4.1.7 and `jsdom` to 29; the plan named the libs without pinning versions, so this is not a deviation.)

## Issues Encountered
None. The `package.json` Edit initially failed because `npm install` had rewritten the file mid-task; re-read and re-applied — no impact on output.

## Known Stubs
None. All four modules are fully implemented and exercised by tests. `processImage`'s convert/compress path is intentionally not invoked in tests (per plan — guard-only testing); the dynamic-import wiring is verified by grep + tsc.

## Threat Flags
None new. The plan's threat register (T-04-04/05/06) is fully mitigated and tested: XSS strip, link hardening, and the pre-conversion size/MIME guard.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03's `lib/admin.ts` can consume `slugify` and `mapWriteError` directly.
- Plan 07's public Our Story render can consume `sanitizeRichText`.
- The image upload UI can consume `assertImageAllowed` + `processImage`.
- `npm test` now provides an automated regression signal beyond `tsc`.

## Self-Check: PASSED

All 9 created files present, package.json modified, both task commits (`64d9418`, `bf75973`) in history. `npx vitest run` → 4 suites / 16 tests green; `npm run check` → exit 0.

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*
