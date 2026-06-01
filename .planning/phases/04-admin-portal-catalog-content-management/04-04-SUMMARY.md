---
phase: 04-admin-portal-catalog-content-management
plan: 04
subsystem: ui
tags: [react, wouter, shadcn, sonner, admin, routing]

# Dependency graph
requires:
  - phase: 04-admin-portal-catalog-content-management (04-02)
    provides: AdminGuard + useAuth().signOut for admin-only route protection
provides:
  - AdminLayout shell (sidebar nav + slim header with View site + logout)
  - Four stub section pages (ProductsList, CategoriesList, SiteContent, Submissions) + ProductForm route
  - Reusable ConfirmDialog (shadcn AlertDialog, destructive confirm)
  - Stub ImageDropzone + RepeatableRows components for Wave-3 feature plans to replace
  - /admin/* nested routes wired behind AdminGuard with active-item highlighting
  - Sonner Toaster mounted for admin write success/error toasts
affects: [04-05, 04-06, 04-07, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first admin shell: every /admin/* route + stub section page wired here so Wave-3 plans each replace exactly one section page with no App.tsx edits"
    - "AdminLayout drops public Navbar/Footer; admin chrome is fully separate from marketing layout"
    - "ConfirmDialog as the single destructive-confirm primitive (D-12 cross-cutting)"

key-files:
  created:
    - client/src/pages/admin/AdminLayout.tsx
    - client/src/pages/admin/ProductsList.tsx
    - client/src/pages/admin/ProductForm.tsx
    - client/src/pages/admin/CategoriesList.tsx
    - client/src/pages/admin/SiteContent.tsx
    - client/src/pages/admin/Submissions.tsx
    - client/src/components/admin/ConfirmDialog.tsx
    - client/src/components/admin/ImageDropzone.tsx
    - client/src/components/admin/RepeatableRows.tsx
  modified:
    - client/src/App.tsx

key-decisions:
  - "Mounted Sonner Toaster in App.tsx (inside the app provider tree) rather than main.tsx — single global mount, co-located with the existing shadcn Toaster"
  - "Left client/src/pages/Admin.tsx in place as unreferenced dead code; deletion is out of scope for this plan"
  - "ImageDropzone and RepeatableRows shipped as thin stubs so Wave-3 feature plans replace them without touching the shell"

patterns-established:
  - "Interface-first wiring: all routes + stub pages exist before features, enabling parallel Wave-3 execution with zero App.tsx churn"
  - "Admin chrome separated from public Layout (no Navbar/Footer leakage into /admin)"

requirements-completed: [ADMIN-01, ADMIN-04, ADMIN-05, ADMIN-07]

# Metrics
duration: ~35min (across checkpoint pause)
completed: 2026-06-01
---

# Phase 4 Plan 4: Admin Shell + /admin/* Routing Summary

**AdminLayout shell (sidebar + slim header) wiring all /admin/* routes behind AdminGuard, with reusable ConfirmDialog, stub feature components, and a mounted Sonner Toaster.**

## Performance

- **Duration:** ~35 min (spanning a blocking human-verify checkpoint)
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- AdminLayout chrome: sidebar (Products / Categories / Site Content / Submissions) + slim header (brand wordmark, "View site" link to /, logout calling useAuth().signOut)
- All /admin/* routes wired behind AdminGuard with active-item highlighting; four stub section pages + ProductForm route
- ConfirmDialog reusable destructive-confirm primitive (shadcn AlertDialog) plus stub ImageDropzone/RepeatableRows for Wave-3
- Sonner Toaster mounted so admin writes can surface success/error toasts

## Task Commits

Each task was committed atomically:

1. **Task 1: ConfirmDialog + stub ImageDropzone + stub RepeatableRows** - `d601a48` (feat)
2. **Task 2: AdminLayout chrome + four stub section pages** - `6c3f3b2` (feat)
3. **Task 3: Wire /admin/* routes behind AdminGuard + mount Sonner Toaster** - `8bdb12e` (feat)

## Files Created/Modified
- `client/src/pages/admin/AdminLayout.tsx` - Admin chrome: sidebar nav + slim header (View site + logout)
- `client/src/pages/admin/ProductsList.tsx` - Stub products section page (replaced by Wave-3 feature plan)
- `client/src/pages/admin/ProductForm.tsx` - Stub product form route
- `client/src/pages/admin/CategoriesList.tsx` - Stub categories section page
- `client/src/pages/admin/SiteContent.tsx` - Stub site content section page
- `client/src/pages/admin/Submissions.tsx` - Stub submissions section page
- `client/src/components/admin/ConfirmDialog.tsx` - Reusable AlertDialog destructive-confirm wrapper (D-12)
- `client/src/components/admin/ImageDropzone.tsx` - Stub image dropzone for Wave-3 replacement
- `client/src/components/admin/RepeatableRows.tsx` - Stub repeatable rows for Wave-3 replacement
- `client/src/App.tsx` - /admin/* nested routes under AdminGuard pointing at AdminLayout + section pages; Sonner Toaster mount

## Verification Results

### Automated assertions (all PASS)
- `grep AdminLayout` present in App.tsx route wiring — PASS
- Route paths `/admin/products`, `/admin/categories`, `/admin/content`, `/admin/submissions` all wired — PASS
- Sonner Toaster mounted (App.tsx imports `Toaster as SonnerToaster` from `@/components/ui/sonner` and renders `<SonnerToaster />`) — PASS
- Placeholder `Admin.tsx` import removed from the route tree — PASS
- `npm run check` (tsc) — exit 0, type-clean
- `npm run build` (vite) — succeeded

### Manual browser walk (APPROVED by user)
- Admin shell renders the sidebar + slim header (NOT the public Navbar/Footer) — confirmed
- All four sections navigate with active-item highlight — confirmed
- "View site" link and logout button work — confirmed
- Non-admin is redirected by AdminGuard — confirmed

## Decisions Made
- Mounted the Sonner Toaster in App.tsx (single global mount, co-located with the existing shadcn Toaster) rather than main.tsx as the plan suggested — same outcome, one global mount inside the provider tree.
- `client/src/pages/Admin.tsx` is now unreferenced dead code; deletion deferred (out of scope for this plan).

## Deviations from Plan

### Minor location adjustment

**1. [Rule 3 - Blocking/placement] Sonner Toaster mounted in App.tsx rather than main.tsx**
- **Found during:** Task 3 (route wiring + Toaster mount)
- **Issue:** Plan listed `main.tsx` as a modified file for the Toaster mount, but the app's provider/router tree lives in App.tsx where the existing shadcn Toaster is already mounted.
- **Fix:** Mounted `<SonnerToaster />` in App.tsx alongside the existing `<Toaster />`, giving a single global mount inside the provider tree.
- **Files modified:** client/src/App.tsx
- **Verification:** grep confirms import + render; `npm run check` exit 0; manual walk surfaced toasts correctly.
- **Committed in:** `8bdb12e` (Task 3 commit)

---

**Total deviations:** 1 (placement adjustment, no functional change)
**Impact on plan:** No scope creep. The Toaster is mounted once globally as intended; only its file location differs from the plan's suggestion.

## Issues Encountered
None — all three tasks executed as planned; the plan paused at the Task 3 blocking human-verify checkpoint and resumed after user approval.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Admin shell + all /admin/* routes are wired interface-first; the four Wave-3 feature plans (04-05/06/07/08-09) each replace exactly one stub section page with no App.tsx edits and no route conflicts.
- Stub ImageDropzone and RepeatableRows are ready to be replaced by feature plans.
- Note: `client/src/pages/Admin.tsx` remains as unreferenced dead code — a future cleanup may delete it.

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*

## Self-Check: PASSED
- Commits verified present: d601a48, 6c3f3b2, 8bdb12e (all FOUND via git log)
- Created files verified on disk: AdminLayout.tsx, ProductsList.tsx, ProductForm.tsx, CategoriesList.tsx, SiteContent.tsx, Submissions.tsx, ConfirmDialog.tsx, ImageDropzone.tsx, RepeatableRows.tsx
- `npm run check` exit 0
