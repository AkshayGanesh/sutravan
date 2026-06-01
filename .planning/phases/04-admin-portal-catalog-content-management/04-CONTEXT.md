# Phase 4: Admin Portal — Catalog & Content Management - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone's core value: a protected, **admin-only** portal where the owner manages the entire catalog and site content with **no code changes or redeploys**. This phase delivers:

1. **Product management (ADMIN-01, ADMIN-02, ADMIN-08):** create / edit / delete products (name, subtitle, category, benefits, ingredients, tips, shelf life, batch note), set/edit price, and toggle draft/published visibility — changes appear on the live public Shop without a redeploy.
2. **Product image management (ADMIN-03):** upload, replace, and remove product images stored in the `product-images` Supabase Storage bucket. Includes onboarding the scrub/cream products that were seeded with empty `images[]` in Phase 2.
3. **Category management (ADMIN-04):** create / edit / delete categories with **in-use delete protection**.
4. **Site content editing (ADMIN-05, ADMIN-06):** edit hero text, Our Story copy, contact email, and social links (Instagram, YouTube), reflected on the public site.
5. **Submissions inbox (ADMIN-07):** a read view of customer customization submissions.
6. **CR-01 RLS hardening (deferred from Phase 2, MUST land here):** tighten `products_public_read` to `using (is_active = true)` as part of the visibility-toggle work, so draft rows are never reachable via direct PostgREST.

Cross-cutting non-negotiables (for a non-technical owner): **every destructive action has a confirm dialog; every write surfaces a success/error toast.**

**Out of scope (later phases / v2):** the customer-facing native questionnaire that *fills* the inbox (Phase 5, CUST-03); wishlist / customer profile / submission history (Phase 5); image reordering & primary-image selection (v2 / ADME-01); bulk product operations (v2 / ADME-02); multiple admins / granular permissions (v2 / ADME-03); analytics (v2 / ADME-04); cart / checkout / payments (e-commerce milestone).

Covers requirements **ADMIN-01 … ADMIN-08**.

</domain>

<decisions>
## Implementation Decisions

### Portal Layout & Navigation
- **D-01:** **Sidebar dashboard.** A left sidebar with sections — **Products, Categories, Site Content, Submissions** — and the active section's UI in the main content area. Chosen for scalability and a real-admin-tool feel for a non-technical owner.
- **D-02:** **Dedicated admin chrome.** Inside `/admin`, drop the public marketing Navbar/Footer; show a slim admin header (brand + a "View site" link + logout). Signals "you're in the admin tool now" and keeps the work area focused. (The current `client/src/pages/Admin.tsx` uses the public `Layout` — it gets replaced by the admin shell.)
- **D-03:** **Responsive, laptop-first.** Design primarily for laptop/desktop (comfortable bulk editing) but keep it usable on a phone for quick edits and uploading photos taken on the phone. Not mobile-first; not desktop-only.

### Product Add/Edit Flow
- **D-04:** **Full-page form** for create/edit (navigated to from the product list or "+ New product"). Best fit for ~10 fields plus image uploads; comfortable on laptop, scrollable on phone. Not a modal/slide-over, not inline.
- **D-05:** **Product list = table with thumbnail.** Compact rows: thumbnail, name, category, price, a Published toggle (see D-12), and edit/delete actions. Dense and scannable for ~28+ products; degrades to stacked cards on mobile.
- **D-06:** **Repeatable-row inputs** for the list-valued fields (`benefits`, `ingredients`, `tips`): each item is its own input with a remove [x] and a "+ Add" button. Maps directly to how they render as bullets. (Reordering is v2 — array order is the display order, per Phase 1 D-03.)
- **D-07:** **Slug auto-generated from the product name and hidden** from the owner (no slug UI). Renaming a product does **not** move its slug or image paths (paths stay stable — `products/{slug}/{filename}`, Phase 1 D-08). Planner must define slug generation + uniqueness/collision handling (e.g. suffix on conflict).
- **D-08:** **New products start as draft / hidden.** A newly created product is not visible on the public Shop until the owner flips it to Published — lets them add photos, price, and copy first. (Ties to D-12 and the CR-01 RLS gate.)
- **D-09:** **Price input = whole rupees, blank allowed.** A number field in ₹ (no paise); leaving it blank stores `null` → renders "Price on request" on the public site (Phase 2 D-01/D-02). The existing `formatPrice()` is the single render path.

### Image Upload UX (flagged in roadmap as needing careful design)
- **D-10:** **Drag-drop + click-to-pick, multiple at once.** A drop zone that also opens a file picker; supports several files in one go; shows thumbnails of uploaded images with a remove [x] per image. (Reorder / primary-pick is v2 / ADME-01.)
- **D-11:** **Auto-convert & shrink before upload.** Accept JPEG / PNG / WebP / **HEIC**; convert HEIC→JPEG and downscale/compress large phone photos in the browser before upload, so the owner can pick a photo straight off their phone and it "just works" and the public Shop stays fast. **VERIFY (researcher):** browser-side HEIC conversion + image compression library choice and feasibility for a static SPA (e.g. `heic2any` + `browser-image-compression`), bundle-size cost, and fallback when conversion fails (clear error toast). Resolve uploaded files to Storage paths via the existing `products/{slug}/{filename}` convention and resolve display via `getPublicUrl` (never hand-built — Phase 2 D-04).
- **D-12:** **Upload guardrails:** enforce a max file size (reject oversized files *before* processing — e.g. >10MB), show per-image upload progress/spinner, and toast success/failure. (Exact size cap and post-shrink target are planner/researcher discretion.)

### Draft / Published Visibility
- **D-13:** **Visibility control in two places:** a quick **Published toggle in the product list** (one-click show/hide) AND a field in the edit form. New products default to draft (D-08).
- **D-14:** **CR-01 RLS hardening lands with this work (LOCKED, must-do):** add a migration tightening `products_public_read` (currently `using (true)` in `supabase/migrations/0002_rls_policies.sql`) to `using (is_active = true)`, so draft rows are unreachable via direct PostgREST, not just filtered query-side in `catalog.ts`. Source: `.planning/phases/02-.../02-REVIEW.md`. Confirm the admin read path still sees drafts (admin policies already allow admin reads).

### Category Management
- **D-15:** **Block delete when a category is in use,** with a clear message: "This category has N products — move or delete them first." Relies on the existing `category_id` FK constraint (Phase 1 D-04) as the real protection; the UI surfaces a friendly error rather than reassigning or hiding. (No category visibility field is added.)
- **D-16:** **Editable category fields: name + display order** (the order categories appear in the shop tabs). Slug is auto-derived and hidden, like products (D-07). No category description field this phase (nothing renders one today).

### Submissions Inbox
- **D-17:** **Read-only list + detail view this phase.** List submissions (name, date, snippet), newest-first, with a detail view to read the full request. **No status/"mark handled" column** is added (that would need a schema change; deferred). The screen will have no data until Phase 5 ships the native questionnaire that writes to `customization_submissions` — that's expected; the inbox is ready for it. Reads rely on the existing admin-read RLS on `customization_submissions` (Phase 1 D-12).

### Site Content Editing
- **D-18:** **Scope = required set only:** hero title / subtitle / CTA text, Our Story body copy, contact email, Instagram URL, YouTube URL. Other site copy stays in code this phase. Stored as `site_content` key/value rows (Phase 1; keys like `hero_title`, `our_story_body`, `instagram_url`). Planner defines the exact key set and seeds initial values from the current hardcoded strings.
- **D-19:** **Our Story body uses a rich text editor** (bold, italics, links, lists). **VERIFY/design (researcher):** rich-text editor choice for a React/Vite SPA, what's stored in `site_content.value` (sanitized HTML vs markdown), and **safe rendering on the public Our Story page** (sanitize/escape — even though content is admin-authored, avoid an XSS foothold). All other content fields (hero strings, email, social URLs) are plain inputs with appropriate validation (email format, URL format).
- **D-20:** **Single source of truth, updates everywhere.** The email and social links are currently hardcoded and duplicated across `Navbar.tsx`, `Footer.tsx`, `Contact.tsx`, `ProductDetail.tsx`, and `Shop.tsx`. Rewire all of them (and `Hero.tsx`, `OurStory.tsx` for their copy) to read from a single `site_content`-backed source so an edit updates every location together. Public reads should follow the established TanStack Query data-layer pattern (mirroring `catalog.ts`) with a sensible fallback if a key is missing/unloaded.

### Claude's / Researcher's / Planner's Discretion
- Exact admin route structure under `/admin/*` (e.g. `/admin/products`, `/admin/products/new`, `/admin/categories`, `/admin/content`, `/admin/submissions`), file/folder layout under `client/src/`, and the admin shell/sidebar component shape.
- The write data-layer: whether admin writes go through an extension of `catalog.ts` or a new `lib/admin.ts`; TanStack Query mutation + cache-invalidation design so the public Shop reflects changes; snake_case↔camelCase mapping reuse.
- Form library/validation (react-hook-form + Zod already in use), the slug-generation util and collision strategy, skeleton/empty/error visuals, confirm-dialog component (shadcn `AlertDialog`), and toast wording.
- Image pipeline specifics: library selection (HEIC convert + compress), max-size cap, post-shrink dimensions/quality, replace/remove mechanics against Storage, and orphaned-file cleanup on product/image delete.
- Rich-text editor selection, stored format, and the sanitizer for public rendering (D-19).
- `site_content` key naming, seed/migration of initial values from current hardcoded strings, and the public read/fallback helper (D-18/D-20).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 4: Admin Portal — Catalog & Content Management" — goal, 5 success criteria, the image-upload-UX note, and the **CR-01 RLS deferred-from-Phase-2 note** (must land this phase with the visibility toggle).
- `.planning/REQUIREMENTS.md` — **ADMIN-01 … ADMIN-08** (this phase) and the traceability table.
- `.planning/PROJECT.md` §Constraints, §Key Decisions — Supabase-direct, anon key + RLS, "admin-only actions enforced server-side via RLS, not just hidden in the UI," static SPA on GitHub Pages, site content editable in the portal.

### Foundation this phase builds on (LOCKED — read before planning)
- `.planning/phases/01-supabase-foundation-schema-rls-storage/01-CONTEXT.md` — the schema/storage/RLS contract: **D-01** (UUID pk + unique slug; upsert on slug), **D-02** (nullable INR `numeric(10,2)` price), **D-03** (`images text[]` of Storage paths; array order = display order; reorder is v2), **D-04** (`category_id` FK = the in-use delete protection for D-15), **D-07** (`product-images` + `site-content` buckets), **D-08** (`products/{slug}/{filename}` path convention), **D-09** (buckets public-read / admin-write), **D-11** (all 6 tables + columns: `site_content` key/value, `customization_submissions` fields), **D-12** (RLS posture: admin-only writes, admin read on submissions).
- `.planning/phases/02-live-catalog-data-migration-public-shop-rewire/02-CONTEXT.md` — public read-path contract this portal must not regress: **D-01/D-02** (price display + `formatPrice`), **D-03/D-04** (empty-images placeholder + `getPublicUrl` resolution), **D-08** (Home featured = first-published-per-category).
- `.planning/phases/03-authentication-roles/03-CONTEXT.md` — the auth/guard layer the portal lives behind: **D-11/D-12** (AdminGuard redirects + loading gate), **D-14** (inline errors + Sonner success toasts — the model for D-12's write toasts).
- `supabase/migrations/0001_init_schema.sql` — live columns the admin writes/reads: `products` (slug, name, subtitle, category_id, price, benefits[], ingredients[], tips[], shelf_life, batch_note, images[], is_active), `categories` (name, slug, sort_order), `site_content` (key/value), `customization_submissions` (name, email, skin_type, message, payload, created_at), and `private.is_admin()`.
- `supabase/migrations/0002_rls_policies.sql` — the admin-only write policies the portal relies on, and **`products_public_read` (currently `using (true)`)** — the D-14 / CR-01 tightening target.
- `supabase/migrations/0003_storage_buckets.sql` — `product-images` (+ `site-content`) buckets and their public-read / admin-write policies on `storage.objects` that image uploads (D-10..D-12) write through.
- `.planning/phases/02-live-catalog-data-migration-public-shop-rewire/02-REVIEW.md` — the CR-01 finding source (D-14).

### Existing frontend integration points
- `client/src/pages/Admin.tsx` — the empty protected shell to **replace** with the admin dashboard (D-01/D-02).
- `client/src/auth/AdminGuard.tsx`, `client/src/auth/AuthProvider.tsx`, `client/src/auth/useAuth.ts` — the auth/guard layer the portal renders inside; admin writes use this authenticated session.
- `client/src/lib/catalog.ts` — the public read layer (`toProduct`/`toCategory`, `productImageUrls`, `getPublicUrl`); the write layer must keep this shape compatible and invalidate its queries so the public Shop updates live.
- `client/src/lib/format.ts` (`formatPrice`), `client/src/lib/supabase.ts`, `client/src/lib/queryClient.ts` — price formatting, client singleton, and QueryClient to reuse.
- `client/src/App.tsx` — Wouter routing; add the `/admin/*` sub-routes (already behind `AdminGuard`); note `import.meta.env.BASE_URL` GitHub Pages sub-path.
- Content rewire targets (D-18/D-20): `client/src/components/Hero.tsx`, `client/src/pages/OurStory.tsx`, `client/src/components/Navbar.tsx`, `client/src/components/Footer.tsx`, `client/src/pages/Contact.tsx`, `client/src/components/ProductDetail.tsx`, `client/src/pages/Shop.tsx` (hardcoded hero copy, Our Story copy, `EMAIL`, `INSTAGRAM_URL`, `YOUTUBE_URL`).
- `client/src/components/ui/*` — shadcn primitives to reuse: `AlertDialog` (confirm dialogs), `Table`, `Switch`/`Toggle` (Published), `Input`/`Textarea`/`Select`/`Button`/`Card`, `toaster`/Sonner (write toasts).

### Codebase maps
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md` — file layout & naming (PascalCase components, camelCase utils/hooks).
- `.planning/codebase/INTEGRATIONS.md` — env vars, Supabase/auth/Storage wiring, deploy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`catalog.ts` read layer** (`toProduct`/`toCategory`, `productImageUrls`, `getPublicUrl`) — admin writes must round-trip through the same camelCase shape; reuse its mapping and image-URL resolution.
- **`formatPrice()`** (`client/src/lib/format.ts`) — already the single price render path (₹ whole rupees, null → "Price on request"); the admin price field (D-09) feeds it.
- **Auth/guard layer** (`AdminGuard` / `AuthProvider` / `useAuth`, Phase 3) — the portal renders inside it; admin writes ride the authenticated session that RLS recognizes as admin.
- **react-hook-form + Zod + @hookform/resolvers** — for the product/category/content forms and inline validation (mirrors the Phase 3 auth forms).
- **Sonner / `@/components/ui/toaster`** — the success/error toast surface for every write (D-12 cross-cutting; Phase 3 D-14 pattern).
- **shadcn primitives** — `AlertDialog` (confirm dialogs — D-12 cross-cutting), `Table`, `Switch`, `Input`/`Textarea`/`Select`/`Card`/`Button` for the dashboard.
- **TanStack Query** (`queryClient.ts`) — mutations + cache invalidation so public Shop reflects admin edits without redeploy.

### Established Patterns
- **Supabase-direct, RLS-is-the-real-security** — the portal is the *write* client; admin-only enforcement already lives in migration 0002's policies + `is_admin()`. The UI is convenience, not the boundary.
- **Versioned migrations** (`supabase/migrations/*.sql`, `supabase db push`, non-recursive / locked `search_path` conventions) — the CR-01 RLS tightening (D-14) and any new columns/keys ship as a **new numbered migration (0005+)**.
- **Storage paths, not URLs, on rows** (Phase 1 D-03/D-08) — uploads write to `products/{slug}/{filename}`; display always via `getPublicUrl`.
- **snake_case↔camelCase mapping at the data-layer boundary, once** (Phase 2) — writes map camelCase→snake_case symmetrically.
- **GitHub Pages sub-path base** (`import.meta.env.BASE_URL`) — all admin routes must be base-aware.
- **No tests exist** — verify manually (create draft → not on public Shop; publish → appears; upload HEIC → renders; edit email → updates Navbar+Footer+Contact; delete in-use category → blocked).

### Integration Points
- New admin shell + sidebar replacing `Admin.tsx`; new `/admin/*` sub-routes in `App.tsx` (under `AdminGuard`).
- New admin write data-layer (extend `catalog.ts` or new `lib/admin.ts`) — product/category/content CRUD + image upload/remove against Storage, with query invalidation.
- New `site_content`-backed public read helper + rewire of the hardcoded copy/email/social-link sites (D-20).
- New migration(s): CR-01 `products_public_read` → `using (is_active = true)` (D-14); seed initial `site_content` values from current hardcoded strings (D-18).
- Image pipeline module (HEIC convert + compress + size guard) — new dependency, needs research (D-11).

</code_context>

<specifics>
## Specific Ideas

- Strong, consistent preference (carried from Phases 1–3) for the **clean/correct/secure** option: server-side RLS as the real boundary, the CR-01 hardening done properly with the visibility toggle rather than relying on query-side filtering, safe rendering of admin-authored rich text.
- The owner is **non-technical** — the portal must be forgiving: confirm dialogs on every destructive action, a toast on every write, auto/hidden slugs, "it just works" phone-photo uploads (HEIC + auto-shrink), and blank-price = "Price on request" rather than errors.
- Onboarding moment: scrub & cream products were seeded with empty images in Phase 2; a natural first task in the portal is uploading their photos. Planner should consider surfacing which products are missing imagery.
- Edits must reflect on the **live public site without a redeploy** — the whole point of the milestone; mutation→cache-invalidation wiring is essential, not optional.

</specifics>

<deferred>
## Deferred Ideas

- **Image reordering / primary-image selection** — v2 / ADME-01. Array order is display order for now (Phase 1 D-03).
- **Bulk product operations** — v2 / ADME-02.
- **Multiple admins / granular permissions** — v2 / ADME-03; single owner-admin via the Phase 3 bootstrap script suffices.
- **Analytics dashboard** — v2 / ADME-04.
- **Submissions "mark as read/handled" status** — would need a schema column; deferred. Inbox is read-only list + detail this phase (D-17).
- **Category description / category visibility field** — nothing renders these today; not added (D-15/D-16).
- **Admin-controlled "featured" product flag** — deferred in Phase 2; Home stays first-published-per-category (Phase 2 D-08).
- **Editing hero/Our Story imagery and all remaining site copy** — only the required text/links set is editable this phase (D-18); broader content editing (and the `site-content` bucket for editable imagery) is a future enhancement.
- **The customer-facing native questionnaire** that fills the inbox — Phase 5 (CUST-03).

None of the above were folded — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Admin Portal — Catalog & Content Management*
*Context gathered: 2026-06-01*
