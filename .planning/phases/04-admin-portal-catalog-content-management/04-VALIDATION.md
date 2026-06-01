---
phase: 04
slug: admin-portal-catalog-content-management
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (adopted — Plan 02 installs + configures it for the 4 pure functions) |
| **Config file** | `vitest.config.ts` (created in Plan 02, `@`→client/src alias, jsdom env for sanitizeHtml) |
| **Quick run command** | `npm run check` (tsc) — always-available signal after every task commit |
| **Full suite command** | `npx vitest run` (unit) + the manual verification checklist |
| **Estimated runtime** | ~5 seconds (unit) + manual passes |

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` command (see Per-Task Verification Map below) — at minimum `npm run check`.
- **After every plan wave:** Run `npx vitest run` (unit) + the relevant manual checks for the wave's slices.
- **Before `/gsd-verify-work`:** `npx vitest run` green + `npm run check` green + manual verification checklist complete.
- **Max feedback latency:** ~30 seconds (type-check) / ~5s (unit).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | ADMIN-08 | T-04-01 (CR-01) | products_public_read tightened to is_active=true (draft isolation) | unit (file+grep) | `test -f supabase/migrations/0005_cr01_products_public_read.sql && grep -q 'using (is_active = true)' …` | migration 0005 | ✅ green |
| 04-01-T2 | 04-01 | 1 | ADMIN-05/06 | T-04-02 | idempotent site_content seed (hero/our_story/instagram keys) | unit (file+grep) | `test -f supabase/migrations/0006_seed_site_content.sql && grep -q 'on conflict (key) do nothing' …` | migration 0006 | ✅ green |
| 04-01-T3 | 04-01 | 1 | ADMIN-08 / D-14 | T-04-01 | [BLOCKING] push 0005+0006 live; draft row unreachable via raw PostgREST | manual | live push + raw PostgREST select returns no draft (Manual-Only row) | n/a (DB) | ⬜ pending |
| 04-02-T1 | 04-02 | 1 | ADMIN-03/05 | T-04-SC | [GATE] verify [ASSUMED] image/rich-text packages before install | checkpoint:human-verify (blocking) | manual slopcheck + npmjs.com confirm (gate) | n/a | ⬜ pending |
| 04-02-T2 | 04-02 | 1 | ADMIN-01 | T-04-03 | slug generation + collision suffix; admin error mapping (RED→GREEN) | unit (vitest) | `npx vitest run client/src/lib/slug.test.ts client/src/lib/adminErrors.test.ts && npm run check` | slug.ts, adminErrors.ts | ✅ green |
| 04-02-T3 | 04-02 | 1 | ADMIN-03/19 | T-04-18 | sanitizeRichText strips `<script>`; imagePipeline size/type guard | unit (vitest, jsdom) | `npx vitest run client/src/lib/sanitizeHtml.test.ts client/src/lib/imagePipeline.test.ts && npm run check` | sanitizeHtml.ts, imagePipeline.ts | ✅ green |
| 04-03-T1 | 04-03 | 2 | ADMIN-01/02/03 | T-04-04 | fromProductForm mapping symmetry, slug collision, image path builder | unit (vitest) | `npx vitest run client/src/lib/admin.test.ts && npm run check` | admin.ts, admin.test.ts | ✅ green |
| 04-03-T2 | 04-03 | 2 | ADMIN-01/02/04 | T-04-05 | CRUD mutation hooks with mandatory cache invalidation (≥6 invalidations) | unit (grep-count) | `npm run check && grep -c "invalidateQueries" client/src/lib/admin.ts … [ "$n" -ge 6 ]` | admin.ts | ✅ green |
| 04-03-T3 | 04-03 | 2 | ADMIN-05/06 | T-04-21 | siteContent read hook + SITE_CONTENT_DEFAULTS fallback (['siteContent'] key) | unit (grep) | `npm run check && grep -q "SITE_CONTENT_DEFAULTS" … && grep -q "queryKey: \['siteContent'\]" …` | siteContent.ts | ✅ green |
| 04-04-T1 | 04-04 | 2 | cross-cutting | T-04-SC | ConfirmDialog (destructive) + stub ImageDropzone/RepeatableRows exist | unit (file+check) | `npm run check && test -f …/ConfirmDialog.tsx && test -f …/ImageDropzone.tsx && test -f …/RepeatableRows.tsx` | 3 components | ✅ green |
| 04-04-T2 | 04-04 | 2 | ADMIN-01/04/05/07 | T-04-11 | AdminLayout chrome (4 nav items, signOut) + 5 stub pages | unit (file+grep) | `npm run check && test -f …/AdminLayout.tsx && for f in …; do test -f …; done && grep -q "signOut" …` | AdminLayout + 5 pages | ✅ green |
| 04-04-T3 | 04-04 | 2 | ADMIN-01 | T-04-11 | /admin/* routes wrapped in AdminGuard+AdminLayout; Sonner Toaster mounted; placeholder removed | checkpoint:human-verify (blocking) — AUTOMATED route/Toaster greps + manual nav | `npm run check && grep -q "AdminLayout" client/src/App.tsx && grep -q "/admin/products" … && grep -q "/admin/content" … && { grep -q "Toaster" App.tsx \|\| grep -q "Toaster" main.tsx; } && ! grep -q "import Admin from" client/src/App.tsx` | App.tsx, main.tsx | ⬜ pending |
| 04-05-T1 | 04-05 | 3 | ADMIN-01/02/08 | T-04-14 | ProductForm RHF+Zod (price null, draft default, slug={slugify(name)} on image slot) | unit (grep) | `npm run check && grep -q "useUpsertProduct" … && grep -q "zodResolver" … && grep -q "RepeatableRows" … && grep -q "ImageDropzone" … && grep -q "slugify" client/src/pages/admin/ProductForm.tsx` | ProductForm.tsx | ⬜ pending |
| 04-05-T2 | 04-05 | 3 | ADMIN-01/08 | T-04-13 | ProductsList table + Published toggle + delete + states + No-photo badge | unit (grep) | `npm run check && grep -q "useAdminProducts" … && grep -q "useToggleProductActive" … && grep -q "useDeleteProduct" … && grep -q "ConfirmDialog" … && grep -q "refetch" …` | ProductsList.tsx | ⬜ pending |
| 04-05-T3 | 04-05 | 3 | ADMIN-08 | T-04-13 | create-draft hidden → publish live → edit price → delete (image upload OUT of scope here, see 04-09) | checkpoint:human-verify (blocking) | `npm run check && npm run build` + Manual-Only draft/publish row | n/a (live) | ⬜ pending |
| 04-06-T1 | 04-06 | 3 | ADMIN-04 | T-04-16 | CategoriesList list/create/edit + in-use-protected delete (no slug UI) | unit (grep) | `npm run check && grep -q "useAdminCategories" … && grep -q "useUpsertCategory" … && grep -q "useDeleteCategory" … && grep -q "ConfirmDialog" … && ! grep -qi "slug" client/src/pages/admin/CategoriesList.tsx` | CategoriesList.tsx | ⬜ pending |
| 04-06-T2 | 04-06 | 3 | ADMIN-04 | T-04-16 | create order → Shop tabs reorder; in-use delete blocked with friendly message | checkpoint:human-verify (blocking) | `npm run build` + Manual-Only in-use-delete row | n/a (live) | ⬜ pending |
| 04-07-T1 | 04-07 | 3 | ADMIN-05/06 | T-04-18 | RichTextEditor (lazy TipTap) + SiteContent editor (7 keys, Zod email/url) | unit (grep) | `npm run check && grep -q "useSaveSiteContent" … && grep -q "RichTextEditor" … && grep -q "lazy(" … && grep -q "@tiptap/react" …/RichTextEditor.tsx` | SiteContent.tsx, RichTextEditor.tsx | ⬜ pending |
| 04-07-T2 | 04-07 | 3 | ADMIN-05/06 / D-20 | T-04-18/19/21 | ALL 7 public files rewired to useSiteContent; OurStory via sanitizeRichText; no hardcoded consts | unit (per-file grep) | `npm run check && grep -q "useSiteContent" {Footer,Navbar,Contact,ProductDetail,Shop,Hero} && grep -q "sanitizeRichText" OurStory && ! grep -q "const YOUTUBE_URL" Footer …` | 7 public files | ⬜ pending |
| 04-07-T3 | 04-07 | 3 | ADMIN-05/06 | T-04-18/21 | email/social/hero/Our Story edit propagates live; `<script>` probe inert; fallback holds; TipTap code-split | checkpoint:human-verify (blocking) | `npm run check && npm run build` (TipTap out of public chunk) + Manual-Only propagation + XSS-probe rows | n/a (live) | ⬜ pending |
| 04-08-T1 | 04-08 | 3 | ADMIN-07 | T-04-22 | useSubmissions read hook + inbox list/detail/empty state | unit (grep) | `npm run check && grep -q "useSubmissions" … && grep -q "customization_submissions" client/src/lib/submissions.ts && grep -q "created_at" … && grep -q "No submissions yet" …` | Submissions.tsx, submissions.ts | ⬜ pending |
| 04-08-T2 | 04-08 | 3 | ADMIN-07 | T-04-22 | empty state now; manually-inserted test row renders newest-first; detail opens | checkpoint:human-verify (blocking) | `npm run build` + Manual-Only submissions row | n/a (live) | ⬜ pending |
| 04-09-T1 | 04-09 | 4 | ADMIN-03 | T-04-24/25/26 | ImageDropzone full pipeline: guard→HEIC convert→compress→upload→path mgmt; create-flow slug; no static heic2any | unit (grep) | `npm run check && grep -q "processImage" … && grep -q "uploadProductImage" … && grep -q "removeProductImages" … && grep -q "ConfirmDialog" … && grep -q "getPublicUrl\|productImageUrls" … && ! grep -q "import heic2any" …` | ImageDropzone.tsx | ⬜ pending |
| 04-09-T2 | 04-09 | 4 | ADMIN-03 | T-04-24/25/26 | HEIC upload renders on Shop; create-flow upload lands in products/{slugify(name)}/; replace/remove no orphans | checkpoint:human-verify (blocking) | `npm run check && npm run build` (heic2any code-split) + Manual-Only HEIC/orphan rows | n/a (live) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*"✅ green" marks tasks whose automated command is fully static-checkable today (file/grep/type-check on artifacts the plan produces). "⬜ pending" marks tasks whose artifacts are created during execution or that include a blocking human-verify / live-DB / live-Storage step — their automated portion runs at commit time.*

---

## Wave 0 Requirements

- [x] Decided: ADOPT vitest for the 4 pure functions (slug generation, snake↔camel/admin-error mapping, image-size guard, HTML sanitizer wrapper). Manual-only is NOT used for these.
- [x] Plan 02 Task 2 installs vitest + writes `vitest.config.ts` (`@` alias) and stubs `slug.test.ts` / `adminErrors.test.ts`.
- [x] Plan 02 Task 3 installs jsdom and writes `sanitizeHtml.test.ts` (strips `<script>`) + `imagePipeline.test.ts` (guard-only, convert mocked).
- [x] Plan 03 Task 1 adds `admin.test.ts` (mapping symmetry + slug collision + image-path builder).

*Wave 0 is complete in-plan: Plan 02 (Wave 1) is the Wave-0 footing — it installs/configures vitest and lands all four pure-function suites before any consumer (Plan 03 / Plan 07) depends on them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Draft product hidden from public Shop, published product appears | ADMIN-08 | Requires live Supabase + public route render | Create product → confirm absent on `/shop`; flip Published → confirm appears, no redeploy (04-05-T3) |
| HEIC phone photo uploads and renders; create-flow upload lands in products/{slugify(name)}/ | ADMIN-03 | Browser-only image pipeline + Storage round-trip | Upload a HEIC file → converts → thumbnail shows → public Shop renders via `getPublicUrl`; drop during create → folder = slugify(name) (04-09-T2) |
| Replace/remove image; no orphans | ADMIN-03 | Storage object lifecycle | Replace image → old gone from bucket; delete product → folder empty (04-09-T2) |
| Site-content edit propagates to all locations | ADMIN-05/06 | Cross-component live read | Edit email → confirm Navbar + Footer + Contact + ProductDetail + Shop update together (04-07-T3) |
| Rich text renders safely (XSS probe inert) + TipTap code-split | ADMIN-05/D-19 | Live render + bundle inspection | `<script>` in our_story_body does not execute on /our-story; TipTap not in public chunk (04-07-T3) |
| In-use category delete is blocked | ADMIN-04 | FK-constraint-driven UX | Delete a category with products → friendly block message, no orphaned rows (04-06-T2) |
| CR-01 RLS: draft row unreachable via raw PostgREST | ADMIN-08 / D-14 | Security boundary, server-side | Direct PostgREST query without `is_active` filter returns no draft rows after migration 0005 (04-01-T3) |
| Submissions inbox renders newest-first | ADMIN-07 | Needs a test row (Phase 5 populates it) | Insert test row → appears newest-first; detail opens; empty state otherwise (04-08-T2) |
| Confirm dialog on every destructive action; toast on every write | cross-cutting | UX assertion | Each delete prompts AlertDialog; each create/edit/delete/upload fires a Sonner toast (all human-verify checkpoints) |

*Every ADMIN-xx requirement maps to at least one automated unit/grep check above OR a Manual-Only row.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (unit/grep/file/type-check) or a blocking human-verify with an automated portion or a Manual-Only row
- [x] Sampling continuity: type-check after every commit; unit suite after every wave; no silent gaps
- [x] Wave 0 decision recorded (vitest ADOPTED; Plan 02 is the footing)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 30s (type-check) / ~5s (unit)
- [x] `nyquist_compliant: true` set in frontmatter (per-task map complete)

**Approval:** ready for execution
</content>
