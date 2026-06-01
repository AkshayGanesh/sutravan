---
phase: 04-admin-portal-catalog-content-management
plan: 05
subsystem: ui
tags: [react, react-hook-form, zod, shadcn, sonner, wouter, admin, products, crud]

# Dependency graph
requires:
  - phase: 04-admin-portal-catalog-content-management (04-03)
    provides: lib/admin.ts hooks (useAdminProducts/useUpsertProduct/useToggleProductActive/useDeleteProduct) + RLS-enforced writes + cache invalidation + ProductFormValues type
  - phase: 04-admin-portal-catalog-content-management (04-04)
    provides: AdminLayout shell + /admin/* routes + ConfirmDialog + stub ImageDropzone/RepeatableRows + Sonner Toaster
  - phase: 04-admin-portal-catalog-content-management (04-01)
    provides: CR-01 products_public_read RLS policy (is_active=true) — keeps drafts off the public Shop
provides:
  - Full-page ProductForm (RHF+Zod create/edit) with all catalog fields, blank-allowed whole-rupee price, draft-default Published switch, and the name-derived-slug ImageDropzone slot
  - ProductsList (table + 48px thumbnail + "No photo" badge + one-click optimistic Published toggle + edit/delete-with-confirm + loading/empty/error states)
  - The product-management vertical slice proven live: admin write → Supabase + RLS → public Shop reflects every change with no redeploy
affects: [04-06, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first replacement: each Wave-3 plan swaps exactly one Plan-04 stub section page (here ProductsList + ProductForm) with no App.tsx edits"
    - "ProductForm mirrors Login.tsx as the canonical RHF+zodResolver form (FormField render-prop per field, inline FormMessage errors, submit Button disabled+spinner)"
    - "Create-flow image folder slug derived as slugify(watch('name')) so the dropzone targets the product's permanent products/{slug}/ folder before first save (D-07)"

key-files:
  created: []
  modified:
    - client/src/pages/admin/ProductForm.tsx
    - client/src/pages/admin/ProductsList.tsx

key-decisions:
  - "Blank price → null via z.preprocess ('' → null, strings → number; non-negative integer when present); formatPrice renders null as 'Price on request' (D-09)"
  - "isActive defaults to false on create (draft-by-default, D-08); edit prefills from useAdminProducts (drafts editable) and never changes the slug on rename (D-07)"
  - "ImageDropzone rendered as the Plan-04 stub at this wave but already passed slug={slug ?? slugify(watch('name'))} so Plan 09's upload pipeline lands files in the permanent folder"

patterns-established:
  - "Vertical-slice verification: prove the admin write through to the public Shop read (create-draft-hidden → publish-live → edit → delete), not just unit-level form behavior"
  - "Optimistic Published toggle (flip in UI, revert + toast on error) wired through the lib/admin.ts hook, never a local UI-only hide"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-08]

# Metrics
duration: ~40min
completed: 2026-06-01
---

# Phase 04 Plan 05: Product Slice Summary

**Full product CRUD for the admin portal — RHF+Zod create/edit form with blank-allowed price and draft-default visibility, plus a table list with one-click optimistic publish/edit/delete — proven live end-to-end through Supabase RLS to the public Shop with no redeploy.**

## Performance

- **Duration:** ~40 min (across original execution + checkpoint resume)
- **Tasks:** 3 (2 auto-implemented + 1 blocking human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- ProductForm: full-page react-hook-form + zodResolver create/edit with name/subtitle/category(Select from useCategories)/benefits/ingredients/tips(RepeatableRows)/shelfLife/batchNote/price/isActive, blank price → null, draft-default, and the name-derived-slug ImageDropzone slot
- ProductsList: shadcn Table from useAdminProducts (incl. drafts) with 48px thumbnail + "No photo" onboarding badge, optimistic Published toggle via useToggleProductActive, edit + ConfirmDialog-gated delete via useDeleteProduct, and full loading (≥4 skeleton rows) / inline-error+Retry / empty states
- Verified the whole vertical slice live: create draft (hidden on /shop via CR-01) → publish (live, "Price on request" for blank price) → edit (set rupee price, slug unchanged) → delete (gone from list + /shop)

## Task Commits

Each task was committed atomically:

1. **Task 1: ProductForm — full-page RHF+Zod create/edit** — `275e8af` (feat)
2. **Task 2: ProductsList — table + publish toggle + edit/delete + states** — `7e57f69` (feat)
3. **Task 3: Verify the product slice end-to-end** — checkpoint:human-verify (blocking), APPROVED via manual browser walk (no code commit)

**Plan metadata:** this SUMMARY + STATE/ROADMAP tracking commit (docs)

## Files Created/Modified

- `client/src/pages/admin/ProductForm.tsx` (434 lines) — Full-page RHF+Zod product create/edit form; route `:slug` decides create vs edit; consumes useUpsertProduct + useCategories; renders RepeatableRows and the slug-wired ImageDropzone
- `client/src/pages/admin/ProductsList.tsx` (327 lines) — Product table list; consumes useAdminProducts/useToggleProductActive/useDeleteProduct; thumbnail + "No photo" badge, optimistic publish toggle, ConfirmDialog delete, loading/error/empty states

## Verification Results

**Automated (PASS):**

- `npm run check` exits 0 (re-confirmed at checkpoint resume)
- `npm run build` succeeds
- Task 1 grep chain: `useUpsertProduct` + `zodResolver` + `RepeatableRows` + `ImageDropzone` + `slugify` all present in ProductForm.tsx
- Task 2 grep chain: `useAdminProducts` + `useToggleProductActive` + `useDeleteProduct` + `ConfirmDialog` + `refetch` all present in ProductsList.tsx

**Manual browser walk (APPROVED by user):**

- Create draft → product appears in admin list as Draft and is ABSENT from public /shop (draft-by-default D-08 + CR-01 RLS)
- Publish toggle ON → product appears live on /shop with no redeploy; blank price renders "Price on request" (null → formatPrice)
- Edit → set a whole-rupee price, Save changes → /shop reflects ₹<price>; slug unchanged on rename (D-07)
- Delete (confirm-gated) → removed from both the admin list and /shop
- Every write surfaced a Sonner toast
- Image upload itself was OUT OF SCOPE here (dropzone is the Plan-04 stub; full pipeline lands in Plan 09 Task 2)

## Decisions Made

- Blank price → null via `z.preprocess` ('' → null, strings → number; validated non-negative integer when present); single render path is `formatPrice` (D-09)
- `isActive` defaults to false on create (draft-by-default, D-08); edit prefills from `useAdminProducts` (drafts editable) and never mutates the slug on rename (D-07)
- ImageDropzone stays the Plan-04 stub at this wave but is already passed `slug={slug ?? slugify(watch('name'))}` so the Plan-09 upload pipeline targets the product's permanent `products/{slug}/` folder

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Verified

- **T-04-13 (Information Disclosure — new product visibility):** New products default `is_active=false` (D-08) AND CR-01 makes drafts unreachable via raw anon PostgREST — confirmed in the manual walk (draft absent from /shop)
- **T-04-14 (Tampering / Input Validation — product form fields):** Zod schema enforces name/category required and coerces price to non-negative integer or null; RLS `is_admin()` is the real boundary regardless of client validation
- **T-04-15 (Tampering — orphaned images on delete):** `useDeleteProduct` (Plan 03) removes the row's storage image paths on delete

## Issues Encountered

None — planned work; the plan paused at its designed blocking human-verify checkpoint (Task 3) for the manual browser walk, which the user approved.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- The product-management headline capability (ADMIN-01/02/08) is complete and proven live end-to-end.
- Plan 09 (Wave 4) extends ProductForm with the full ImageDropzone upload pipeline; the slug-wiring it relies on is already in place.
- Remaining Wave-3 plans (04-06 categories, 04-08 submissions) are independent page files and unaffected.

## Known Stubs

- `ImageDropzone` in ProductForm renders the Plan-04 stub (empty state + thumbnails only). This is intentional and scoped: the full drag-drop/HEIC-convert/compress/upload pipeline is built and verified in **Plan 09 Task 2 (ADMIN-03)**. The form already passes the real `slug` prop so the upload lands in the permanent folder once Plan 09 wires it.

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*

## Self-Check: PASSED
