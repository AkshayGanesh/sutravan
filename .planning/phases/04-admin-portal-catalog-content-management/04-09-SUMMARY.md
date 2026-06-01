---
phase: 04-admin-portal-catalog-content-management
plan: 09
subsystem: ui
tags: [react, supabase-storage, heic2any, browser-image-compression, image-upload, admin, dropzone]

# Dependency graph
requires:
  - phase: 04-admin-portal-catalog-content-management
    provides: "Plan 02 imagePipeline (assertImageAllowed + lazy HEIC convert + compress → processImage), Plan 03 Storage helpers (uploadProductImage/removeProductImages/getPublicUrl), Plan 04 ConfirmDialog + ImageDropzone stub, Plan 05 ProductForm slot passing slug={slugify(name)}"
provides:
  - "Full product-image dropzone: drag-drop + click-to-pick, size/type guard → HEIC convert → compress → Storage upload → path management, with per-image progress, replace, confirm-remove (orphan cleanup), and all error states"
  - "Completes the product form vertical slice and the image-onboarding moment for scrub/cream products seeded with empty images in Phase 2"
affects: [public-shop-image-render, future-ecommerce-catalog, customer-product-detail]

# Tech tracking
tech-stack:
  added: []  # heic2any + browser-image-compression were installed in Plan 02; consumed here only
  patterns:
    - "Per-file async pipeline: assertImageAllowed (reject before CPU) → processImage (try/catch, no stuck spinner) → uploadProductImage → onChange path append"
    - "In-session vs saved image distinction: in-session removal is local; saved-image removal routes through ConfirmDialog + removeProductImages for orphan cleanup"
    - "Create-flow uploads land directly in products/{slugify(name)}/ — no temp folder, no rewrite (D-07/D-08)"
    - "heic2any kept lazy inside processImage so it never enters the public main chunk"

key-files:
  created: []
  modified:
    - client/src/components/admin/ImageDropzone.tsx

key-decisions:
  - "Slug during product create is name-derived (slugify(watch('name'))) and passed by ProductForm — uploads land in the product's permanent folder on first drop; no deferral or temp-folder branch"
  - "Empty-name edge guarded: when slug is falsy the dropzone is disabled with 'Name the product first to add photos.' hint rather than attempting a folderless upload"
  - "heic2any/browser-image-compression remain lazy-loaded inside processImage so they code-split into admin-only chunks, out of the public/main bundle"

patterns-established:
  - "Reject-before-process: assertImageAllowed runs before any conversion CPU to avoid DoS on oversized photos (T-04-25)"
  - "No dead spinners: every processImage/upload await is wrapped so a failure clears the pending tile and shows a fallback toast"

requirements-completed: [ADMIN-03]

# Metrics
duration: ~30min (incl. manual verification)
completed: 2026-06-01
---

# Phase 04 Plan 09: Product Image Dropzone Summary

**Full drag-drop product-image dropzone — phone HEIC photos convert + compress in-browser, upload to the Supabase `product-images` Storage bucket, render on the public Shop via getPublicUrl, with per-image progress, replace, confirm-remove (orphan cleanup), and every guard/conversion error state.**

## Performance

- **Duration:** ~30 min (implementation + manual end-to-end verification)
- **Started:** 2026-06-01T~19:30Z
- **Completed:** 2026-06-01T19:41Z (impl) + manual approval
- **Tasks:** 2 (1 auto implementation, 1 blocking human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Replaced the Plan-04 `ImageDropzone` stub with the real component, keeping the exact `{ value, onChange, slug }` prop shape so ProductForm needed no change.
- Wired the full per-file pipeline: `assertImageAllowed` guard (reject >10MB / unsupported BEFORE processing) → `processImage` (lazy HEIC convert + compress → JPEG) in try/catch → `uploadProductImage(slug, blob, filename)` → `onChange([...value, path])`.
- Drag-drop AND click-to-pick, multiple files at once, per-image spinner/progress, "Converting…" HEIC state, 96px thumbnails resolved via `getPublicUrl`/`productImageUrls` (no hand-built URLs).
- Replace/remove: in-session images removed locally; saved images routed through `ConfirmDialog` + `removeProductImages` so no orphaned Storage objects remain.
- Create-flow: uploads land in `products/{slugify(name)}/` on first drop; blank name disables the zone with the "Name the product first to add photos." hint.

## Task Commits

1. **Task 1: ImageDropzone — drag-drop + pipeline + Storage upload + progress + states** — `5b24624` (feat)
2. **Task 2: Verify image slice end-to-end** — blocking human-verify checkpoint, APPROVED via manual browser walk (no code commit; STATE checkpoint-pause recorded in `90cab80`)

**Plan metadata:** this docs commit (summary + tracking)

## Files Created/Modified
- `client/src/components/admin/ImageDropzone.tsx` (273 lines) — Full image dropzone: size/type guard → HEIC convert → compress → Storage upload → path management, with progress, replace, confirm-remove, and all error states.

## Decisions Made
- **Slug on create is name-derived and never deferred.** ProductForm passes `slug={slugify(watch('name'))}`, so uploads during create land in `products/{slug}/` — the product's permanent folder (D-07/D-08). No temp folder, no rewrite on save.
- **Empty-name guard** disables the dropzone with a hint rather than attempting a folderless upload.
- **heic2any kept lazy** inside `processImage` (Plan 02) so it code-splits into admin-only chunks, out of the public/main bundle.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification

### Automated (PASS)
- `npm run check` exits 0.
- `npm run build` succeeds; `heic2any` (~1.35 MB) + `browser-image-compression` are code-split into admin-only chunks and are NOT present in the public main chunk.
- Plan greps all PASS: `processImage`, `uploadProductImage`, `removeProductImages`, `ConfirmDialog`, `getPublicUrl`/`productImageUrls` present; no static `import heic2any` in ImageDropzone.tsx.

### Manual (APPROVED)
- HEIC phone photo converts + compresses and renders on the public Shop via getPublicUrl (compressed, not the original multi-MB file).
- JPEG and PNG uploads also render.
- `>10MB` file and `.txt` rejected by the guard before processing with the exact UI-SPEC toasts.
- Create-flow: uploads land in `products/{slugify(name)}/`; blank name shows the name-required disabled state.
- Replace/remove route through ConfirmDialog + removeProductImages with no orphaned Storage objects.

## User Setup Required
None - no external service configuration required (Supabase Storage bucket + policies provisioned in Plans 01–03).

## Next Phase Readiness
- This is the FINAL plan of Phase 04 (9/9). The admin portal catalog + content management milestone is complete: categories, products, images, content, auth/roles, and the customization questionnaire are all owner-managed.
- The product vertical slice is fully wired end-to-end; the public Shop reads images from Supabase Storage.
- No blockers for the next milestone (customer-facing e-commerce: cart/checkout/payments).

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*

## Self-Check: PASSED
- FOUND: client/src/components/admin/ImageDropzone.tsx
- FOUND: commit 5b24624
