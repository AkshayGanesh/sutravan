# Feature Research

**Domain:** Admin CMS + customer-account layer for a small-business skincare catalog (Supabase backend; React/Vite SPA frontend)
**Researched:** 2026-05-31
**Confidence:** HIGH (domain is well-trodden CRUD/CMS/auth territory; Supabase capabilities for RLS roles, Storage, and image transforms are verified against current Supabase docs and training)

> Scope reminder: this milestone adds **catalog/content management, admin + customer auth, wishlist, customer profile/history, and a native customization questionnaire**. All e-commerce (cart, checkout, payments) is an **anti-feature this milestone** — see that section. The owner is **non-technical**, so "good" is defined by how forgiving and self-explanatory the admin UX is, not by feature count.

## What "Good" Looks Like for a Non-Technical Small-Business Owner

A useful lens that shapes every table-stakes call below. The owner is not a developer; they are a brand owner who will edit products from a phone or a laptop, occasionally, often in a hurry. "Good" means:

1. **No code, no redeploy, no jargon.** Every catalog/content change happens in the portal and is live immediately (or after one obvious "Publish"/"Save" click). No Markdown, no HTML, no Git, no "merge."
2. **Hard to break, easy to undo.** Destructive actions confirm. Deletes are recoverable or soft (a product is hidden, not vaporized). Validation catches mistakes (empty name, price as text) before save, with plain-language errors.
3. **Image upload that "just works."** Drag-and-drop or file-picker, accepts phone photos (HEIC/JPEG/PNG), shows a thumbnail preview, doesn't choke on a 6 MB image. The owner never thinks about file paths, buckets, or URLs.
4. **WYSIWYG-ish content editing.** Editing the Our Story copy or hero text should look close to how it appears on the site, not a raw text box full of tags.
5. **Obvious "what do I do next."** Empty states tell the owner what to do ("No products yet — add your first product"). Save gives a clear success toast.
6. **One mental model.** Products, categories, content, inbox all live behind one login with one consistent layout.

The codebase is already aligned with this: shadcn/ui (Radix) gives you accessible Dialog, Sheet, Select, Tabs, Toast, Alert-Dialog primitives, and `react-hook-form` + Zod is already a dependency — so form validation and confirm-dialogs are nearly free. Lean on these rather than building bespoke admin widgets.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the CMS/account system feel broken or unfinished for its stated purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Admin login (email/password) to a protected portal** | A CMS without auth is not a CMS | LOW | Supabase Auth email+password. The portal is admin-only; a single owner account is fine to start. |
| **Role distinction: admin vs customer, enforced in DB** | Customers must never reach admin actions | MEDIUM | Use a `role` on a `profiles` table (or `app_metadata`/custom claim) + **RLS policies**. Client route guards are UX-only; the real gate is RLS. PROJECT.md explicitly requires this. |
| **Role-gated admin routes (UI guard)** | Non-admins shouldn't see admin screens | LOW | Wouter route wrapper that checks session + role; redirect to login/home otherwise. Pairs with RLS (defense in depth). |
| **Product CRUD (name, description, category, price, images)** | This is the Core Value | MEDIUM | List + create + edit + delete. Reuse existing `Product` shape from `data/products.ts` so the public Shop swaps cleanly. Price must finally be a real, editable value (currently empty strings). |
| **Set/edit product price** | Prices can't be shown today; central to the milestone | LOW | Store as integer minor units (paise) or `numeric`; render formatted. Avoid float arithmetic. |
| **Category CRUD** | Replaces the hardcoded `'soap'\|'scrub'\|'cream'` union | MEDIUM | Products reference category by FK. Must handle "category in use" on delete (block or reassign) — see PITFALLS dependency note. |
| **Image upload + replace + delete via portal** | Owner can't touch the repo | MEDIUM-HIGH | Supabase Storage bucket; upload from admin, store path/URL on product, support multiple images per product (existing UI has a carousel). Drag-drop + preview + progress. Validate type/size. |
| **Public Shop reads live data from Supabase** | The whole point — changes appear without redeploy | MEDIUM | Swap static import for a TanStack Query fetch (already wired). Public read via anon key + permissive SELECT RLS. Must not regress existing UX (loading/empty/error states). |
| **Site-content editing: Our Story copy, homepage hero text** | Owner wants full content control, not just catalog | MEDIUM | A small `site_content` key/value (or singleton-row) table. Keep field set explicit and named ("hero_heading", "hero_subtext", "story_body") — not a generic page builder. |
| **Contact details + social links editing (Instagram, YouTube, email)** | These are hardcoded in Navbar/Footer/Shop today | LOW | Same `site_content`/`settings` mechanism. High value, trivial cost. |
| **Admin inbox for form submissions (questionnaire/inquiries)** | Submissions currently vanish into a Google Form / Instagram DMs | MEDIUM | List view of submissions, detail view, read/unread (or "new/handled") status. This is what makes the native questionnaire worth building. |
| **Native customization questionnaire → Supabase** | Replaces disconnected Google Form | MEDIUM | Multi-field form (skin type, concerns, product interest, free-text request, contact). `react-hook-form` + Zod already present. Writes a row; surfaces in admin inbox; appears in customer history. |
| **Customer registration + login** | Required for wishlist + history to mean anything | LOW-MEDIUM | Supabase Auth. Include email verification or at least password reset (table-stakes for any real account). |
| **Customer wishlist (save/unsave products)** | Promised immediate value of accounts pre-checkout | MEDIUM | Join table `wishlists(user_id, product_id)`; RLS so users see only their own. Toggle heart on product card/detail; a "Saved" page. |
| **Customer profile + own inquiry/customization history** | Accounts feel empty without it | MEDIUM | Read-only-ish profile (name, email, maybe phone) + a list of that customer's questionnaire submissions, RLS-scoped to `user_id`. |
| **Password reset / forgot password** | Users will forget; without it accounts strand | LOW | Supabase Auth built-in flow. Cheap, expected, easy to forget to build. |
| **Confirm-before-delete + clear save feedback** | Non-technical owner safety net | LOW | shadcn `AlertDialog` for destructive ops; `useToast` (already present) for success/error. Treat as a requirement, not polish. |
| **Loading / empty / error states (admin + public)** | A blank screen reads as "broken" | LOW | Especially empty states with next-step guidance for the non-technical owner. |

### Differentiators (Competitive Advantage)

Not required to be a usable system, but high-leverage given the brand positioning and the non-technical owner. Pick a few; do not build all.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Product visibility toggle (draft/published) + soft delete** | Owner can stage a product or pull one without deleting; protects against accidents | LOW-MEDIUM | An `is_published`/`status` column + a `deleted_at`. Public query filters to published & not-deleted. Big safety/flexibility win for tiny cost. Strongly recommended to fold into table-stakes Product CRUD. |
| **Image transformations / on-the-fly resizing** | Phone photos render fast without the owner resizing anything | LOW | Supabase Storage supports image transformation via URL params (`?width=&quality=`) on the render endpoint. Lets you serve thumbnails + hero sizes from one upload. Verify it's enabled on the project's plan. |
| **Drag-to-reorder products / images** | Owner controls merchandising order and primary image | MEDIUM | A `sort_order` column. The primary-image choice especially matters for the carousel. |
| **Inbox status workflow (new → in progress → done) + notes** | Turns the inbox into a lightweight CRM for custom orders | LOW-MEDIUM | A status enum + optional internal note field. Makes the customization business actually manageable. |
| **Email notification to owner on new submission** | Owner doesn't have to poll the inbox | MEDIUM | Supabase Database Webhook / Edge Function → email (Resend/SMTP). Adds an external dependency; keep optional. |
| **"Featured products" flag managed in portal** | Replaces hardcoded `getFeaturedProducts()` for the homepage | LOW | A boolean column; homepage queries featured. Directly removes a current code dependency. |
| **Rich-but-bounded content editing (simple WYSIWYG for Story)** | Owner formats paragraphs/headings without HTML | MEDIUM | A lightweight editor (e.g., a minimal TipTap setup) storing sanitized HTML or structured blocks. Bound it — do not become a page builder. |
| **Bulk image upload per product** | Faster catalog setup for 68 existing products | LOW-MEDIUM | Multi-file picker into one product's gallery. |
| **Wishlist → "request this" shortcut** | Bridges wishlist to the questionnaire pre-checkout | LOW | Pre-fills the customization form with the saved product; increases inquiry conversion before e-commerce exists. |

### Anti-Features (Commonly Requested, Often Problematic)

Documented to prevent scope creep. The e-commerce cluster is explicitly out per PROJECT.md.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Cart / add-to-cart** | "It's a shop" | Out of scope this milestone; pulls in inventory, pricing edge cases, sessions | Defer to e-commerce milestone. Catalog + wishlist + inquiry cover pre-sale needs now. |
| **Checkout flow** | Natural next step | Requires cart, addresses, tax/shipping, order state machine | Deferred. Don't model `orders` yet — premature schema. |
| **Razorpay / payment integration** | "We need to get paid" | Requires server-side secret handling, webhooks, refunds, reconciliation — incompatible with the current static-SPA + anon-key model | Deferred. Note: payments will likely force introducing Edge Functions later; keep that out of this milestone's schema. |
| **Generic drag-and-drop page builder / CMS** | "Full control over every page" | Massive complexity; non-technical owner will break layouts; brand consistency suffers | Named, bounded content fields (hero_heading, story_body, etc.). Designer-set layout, owner edits copy + images only. |
| **Arbitrary custom fields / dynamic product schema** | "What if we add a new attribute later?" | Turns a simple catalog into a schema-builder; query/UI complexity explodes | Fixed, well-chosen product columns now; add a column via migration if a real need appears. |
| **Granular admin roles/permissions (editor vs admin vs super-admin)** | "Different staff, different access" | There is effectively one owner; RBAC matrices are overkill and a known source of RLS bugs | Single `admin` role now. Add finer roles only when a second staff member with distinct needs actually exists. |
| **Real-time collaborative admin editing** | "Live updates are cool" | No concurrent editors at this scale; adds subscription complexity | Standard request/response CRUD with optimistic UI via TanStack Query. |
| **Social login (Google/Apple) for customers** | "Frictionless signup" | Adds OAuth config/redirect complexity for marginal benefit at this audience size | Email/password + password reset now; add OAuth later if signup friction proves real. |
| **Product reviews / ratings / UGC** | "Builds trust" | Moderation burden, spam, and it's a content-management distraction pre-sale | Defer. Curated testimonials as editable site content if social proof is needed now. |
| **Analytics dashboard inside the admin** | "Owner wants insights" | Building charts is a project unto itself; data is thin pre-sale | Use Supabase dashboard / a simple inbox count. Real analytics after there's commerce data. |
| **Self-serve customer profile photo / heavy account settings** | "Full account page" | Storage + moderation + little value pre-checkout | Minimal profile (name, contact, history) only. |

## Feature Dependencies

```
Supabase project + schema (products, categories, profiles, site_content,
        wishlists, submissions) + Storage bucket
    └──requires──> RLS policies (public read; admin write; per-user rows)
            │
            ├──> Admin auth (login) ──> Role gating (admin) ──> Admin Product CRUD
            │                                              ├──> Category CRUD
            │                                              ├──> Image upload/manage ──requires──> Storage bucket
            │                                              ├──> Site-content + contact/social editing
            │                                              └──> Admin inbox ──reads──> Questionnaire submissions
            │
            ├──> Public Shop reads live data ──requires──> Product/Category data in DB
            │                                         (──enhances──> by published/visibility flag)
            │
            └──> Customer auth (register/login + reset)
                        ├──> Wishlist (per-user rows, RLS)
                        ├──> Customer profile + history (per-user rows, RLS)
                        └──> Native questionnaire (writes submission)
                                    ├──enhances──> Admin inbox (gives it content)
                                    └──enhances──> Customer history (shows own submissions)

Wishlist ──enhances──> Questionnaire (prefill "request this product")
Categories ──blocks-delete-of──> in-use Categories (referential integrity)
```

### Dependency Notes

- **Everything write-related requires Auth + RLS first.** RLS is the actual security boundary (PROJECT.md constraint: a public SPA's anon key is exposed). Schema + RLS policies should land before any admin write feature; otherwise you either ship insecurely or rework policies later.
- **Admin Product CRUD requires Categories and the Storage bucket.** A product needs a category FK and an image location. Sequence: categories + bucket → product CRUD → image management. (Bootstrapping note: you can seed one default category to avoid a chicken-and-egg first run.)
- **Public Shop live-read requires the products/categories tables to exist and be populated** — i.e., migration of the 68 existing products happens before or with the Shop cutover, or the Shop shows empty.
- **Admin inbox requires the native questionnaire** to produce rows; building the inbox before the form gives an empty screen. Build the form + submission table, then the inbox over it.
- **Customer history and wishlist both require customer auth** and per-user RLS (`user_id = auth.uid()`). They are independent of each other and can be built in parallel once auth exists.
- **Category delete conflicts with products referencing it.** Decide policy up front: block delete while in use (simplest, safest for non-technical owner) vs. reassign-then-delete. Do not silently cascade-delete products.
- **Image management conflicts with raw "delete product" if storage cleanup is ignored** — deleting a product should also remove (or orphan-clean) its Storage objects, or storage bloats. Plan an explicit cleanup path.
- **Wishlist enhances the questionnaire** (prefill), but is not required by it — keep the link optional so neither blocks the other.

## MVP Definition

### Launch With (v1) — the milestone's must-haves

- [ ] Supabase schema + RLS (products, categories, profiles/role, site_content, wishlists, submissions) + Storage bucket — everything depends on it
- [ ] Admin login + admin-role gating (UI guard + RLS) — security boundary
- [ ] Product CRUD with real, editable price, **including a published/visibility flag + soft delete** — Core Value, with the cheap safety net for a non-technical owner
- [ ] Category CRUD with in-use delete protection — replaces hardcoded union
- [ ] Image upload / replace / delete (multiple per product) with preview + type/size validation — owner out of the repo
- [ ] Public Shop reads live Supabase data without UX regression (loading/empty/error states) — proves the no-redeploy promise
- [ ] Site-content editing (hero text, Our Story copy) + contact/social links — owner content control
- [ ] Native customization questionnaire → Supabase
- [ ] Admin inbox listing submissions with read/handled status
- [ ] Customer register/login + password reset
- [ ] Wishlist (save/unsave + Saved page)
- [ ] Customer profile + own submission history
- [ ] Confirm-on-delete + success/error toasts everywhere (cross-cutting, non-negotiable for this owner)

### Add After Validation (v1.x) — once core works and the owner is using it

- [ ] Image transformations (serve thumbnail + hero from one upload) — trigger: page-weight/perf complaints or slow phone uploads
- [ ] Drag-to-reorder products & images + choose primary image — trigger: owner asks to control merchandising order
- [ ] "Featured products" flag managed in portal — trigger: owner wants to change homepage features
- [ ] Inbox status workflow + internal notes — trigger: volume of custom requests makes read/unread insufficient
- [ ] Email notification to owner on new submission — trigger: owner forgets to check the inbox
- [ ] Bulk image upload per product — trigger: pain during initial 68-product backfill
- [ ] Wishlist → "request this" prefill — trigger: inquiries are a goal and conversion is low

### Future Consideration (v2+) — defer until commerce milestone or real demand

- [ ] Rich WYSIWYG for Story content — defer; bounded named fields suffice until owner needs real formatting
- [ ] Cart / checkout / Razorpay — explicitly the next milestone
- [ ] Order management, inventory/stock tracking — depends on commerce
- [ ] Multi-admin roles/permissions — defer until a second distinct staff role exists
- [ ] Social login, reviews/ratings, in-admin analytics — defer until a demonstrated need

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Schema + RLS + Storage bucket | HIGH | MEDIUM | P1 |
| Admin login + role gating | HIGH | MEDIUM | P1 |
| Product CRUD (+ price, + published flag, + soft delete) | HIGH | MEDIUM | P1 |
| Category CRUD (+ in-use protection) | HIGH | MEDIUM | P1 |
| Image upload/replace/delete | HIGH | MEDIUM-HIGH | P1 |
| Public Shop live-read (no regression) | HIGH | MEDIUM | P1 |
| Site-content + contact/social editing | HIGH | MEDIUM | P1 |
| Native questionnaire → Supabase | HIGH | MEDIUM | P1 |
| Admin inbox (read/handled) | HIGH | MEDIUM | P1 |
| Customer register/login + reset | HIGH | LOW-MEDIUM | P1 |
| Wishlist | MEDIUM-HIGH | MEDIUM | P1 |
| Customer profile + history | MEDIUM | MEDIUM | P1 |
| Confirm-delete + toasts (cross-cutting) | HIGH | LOW | P1 |
| Image transformations | MEDIUM | LOW | P2 |
| Drag-to-reorder + primary image | MEDIUM | MEDIUM | P2 |
| Featured-products flag | MEDIUM | LOW | P2 |
| Inbox status workflow + notes | MEDIUM | LOW-MEDIUM | P2 |
| Email-on-submission | MEDIUM | MEDIUM | P2 |
| Bulk image upload | MEDIUM | LOW-MEDIUM | P2 |
| Wishlist → request prefill | MEDIUM | LOW | P2 |
| Rich WYSIWYG content | LOW-MEDIUM | MEDIUM | P3 |
| Cart / checkout / payments | HIGH (later) | HIGH | P3 (next milestone) |
| Multi-admin RBAC | LOW | MEDIUM | P3 |
| Reviews / analytics / social login | LOW | MEDIUM-HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone's launch
- P2: Should have; add after core validates
- P3: Defer (mostly the e-commerce milestone or demand-driven)

## Competitor / Reference Feature Analysis

Reference points for "what a small-brand catalog admin + accounts layer normally provides," to calibrate expectations. Our build deliberately omits the commerce half.

| Feature | Shopify (hosted commerce) | WordPress + WooCommerce | Headless CMS (e.g. Sanity/Strapi) | Our Approach |
|---------|---------------------------|--------------------------|-----------------------------------|--------------|
| Product/category CRUD | Full, polished | Full | Schema-defined | Focused CRUD on a fixed product shape via Supabase + shadcn forms |
| Image management | DAM with variants | Media library | Asset pipeline w/ transforms | Supabase Storage; transforms in v1.x |
| Content editing | Theme + sections editor | Block editor (Gutenberg) | Structured content | Bounded named fields (no page builder) |
| Customer accounts | Built-in | Built-in | N/A (content only) | Supabase Auth (customers + single admin) |
| Wishlist | App/plugin | Plugin | N/A | First-class, per-user, RLS-scoped |
| Inquiry/lead inbox | Apps | Contact-form plugins | N/A | Native submissions table + admin inbox |
| Checkout/payments | Core | Core | N/A | **Excluded this milestone** (next) |
| Roles/permissions | Staff roles | User roles | Roles | Single admin role now |
| Non-technical friendliness | High | Medium | Low-Medium | Target: high (confirm dialogs, previews, plain errors, empty-state guidance) |

Takeaway: the off-the-shelf options bundle commerce + heavy CMS; our value is a **lean, brand-controlled catalog + lightweight CRM/accounts** on the existing React frontend, without inheriting that bulk — and without building commerce before the catalog is manageable.

## Sources

- `.planning/PROJECT.md` — milestone scope, constraints, key decisions (Supabase-direct, RLS, deferred e-commerce) [HIGH]
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` — existing pages/components, static product data, hardcoded category union, Instagram/Google-Form inquiry routing, shadcn/ui + react-hook-form + TanStack Query availability [HIGH]
- Supabase capabilities (Auth email/password + reset, Postgres RLS for role gating and per-user row access, Storage buckets, Storage image transformation via URL params, Database Webhooks/Edge Functions for notifications) — verified against current Supabase documentation and consistent with training [HIGH]
- Domain conventions for small-business CMS + customer-account layers (table-stakes CRUD/auth/wishlist/inbox patterns; page-builder and RBAC over-engineering as common anti-features) [MEDIUM — synthesized from established patterns]

---
*Feature research for: admin CMS + customer-account layer on a Supabase-backed skincare catalog*
*Researched: 2026-05-31*
