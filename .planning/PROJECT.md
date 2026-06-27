# Earthen Luxury Sutravan

## What This Is

Earthen Luxury Sutravan is a handmade luxury skincare brand (soaps, scrubs, creams)
with an existing React/Vite showcase website. This milestone turns the static,
code-managed showcase into a self-managed product: a **Supabase backend** (Postgres +
Auth + Storage) and an **admin portal** where the owner manages all catalog content
without touching code, plus **accounts** for admins and customers and a functional
**customization questionnaire** that captures customer requests. Customer-facing
e-commerce (cart, checkout, payments) is intentionally a later milestone.

## Core Value

The owner can manage the entire product catalog (products, categories, images, prices)
through an admin portal — no code changes, no redeploys.

## Requirements

### Validated

<!-- Inferred from existing codebase (see .planning/codebase/). Working and relied upon. -->

- ✓ Public showcase site with Home, Shop, Our Story, Contact, Questionnaire pages — existing
- ✓ Product browsing by category (soap / scrub / cream) with detail modal and image carousel — existing
- ✓ Responsive React 19 + Vite + Tailwind + shadcn/ui frontend — existing
- ✓ Static deployment to GitHub Pages with SPA routing — existing
- ✓ "Skin Guide" questionnaire page that embeds an external Google Form — existing (responses go to Google, not the app)

<!-- Validated in Phase 1: Supabase Foundation -->
- ✓ Supabase project wired with full schema, default-deny RLS, `is_admin()` helper, and Storage buckets — validated in Phase 1
<!-- Validated in Phase 2: Live Catalog -->
- ✓ Public Shop reads live product/category data from Supabase (replacing the static file) — validated in Phase 2 (PUB-01/PUB-02; HUMAN-UAT 5/5 passed 2026-06-27)
- ✓ Catalog (28 products / 3 categories) + soap images migrated into Supabase Postgres + Storage; static `products.ts` off the runtime path — validated in Phase 2 (DATA-03)
- ✓ Supabase-direct architecture — unused Express + Drizzle + Passport scaffolding removed — validated in Phase 1 (DATA-04)

<!-- Validated in Phase 4: Admin Portal -->
- ✓ Admin can create/edit/delete products incl. price, and changes appear live with no redeploy — validated in Phase 4 (ADMIN-01/02/08)
- ✓ Admin can upload/replace/remove product images (HEIC convert + compress) via the portal — validated in Phase 4 (ADMIN-03)
- ✓ Admin can create/edit/delete categories with in-use delete protection — validated in Phase 4 (ADMIN-04)
- ✓ Admin can edit site content (Our Story copy, hero text) and contact/social links — validated in Phase 4 (ADMIN-05/06)
- ✓ Admin can view customization submissions in an inbox; confirm dialogs + toasts on every write — validated in Phase 4 (ADMIN-07)
<!-- Validated in Phase 3: Authentication & Roles -->
- ✓ Customer can register and log in (Supabase Auth), session persists across restarts, logout from any page — validated in Phase 3 (AUTH-01/02/03)
- ✓ Admin vs customer roles distinguished and enforced server-side (DB trigger role-lock + RLS), not just in the UI — validated in Phase 3 (AUTH-04)
- ✓ Admin portal routes protected by an auth guard; first admin bootstrapped out-of-band via `scripts/promote-admin.ts` — validated in Phase 3 (AUTH-05)

<!-- Validated in Phase 5: Customer Experience -->
- ✓ Customer can save / wishlist products (heart on card + detail + /wishlist page + navbar badge, optimistic shared cache) — validated in Phase 5 (CUST-01/CUST-02)
- ✓ Native multi-step questionnaire replaces the Google Form; Turnstile-gated submissions land in the admin inbox via the verify-and-submit Edge Function under RLS ownership (migration 0007) — validated in Phase 5 (CUST-03)
- ✓ Customer profile with self-service account management (name/email/password) and owner-scoped customization history — validated in Phase 5 (CUST-04)

### Active

<!-- Next milestone. Hypotheses until shipped and validated. -->

(None yet — v1.0 shipped all planned requirements. Next milestone is e-commerce: cart / checkout / payments. Run `/gsd-new-milestone` to define fresh requirements.)

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- Cart / add-to-cart — deferred to e-commerce milestone (can't sell before catalog is manageable)
- Order page & checkout flow — deferred to e-commerce milestone
- Razorpay / payment integration — deferred to e-commerce milestone
- Keeping the Express server — replaced by Supabase-direct architecture

## Context

**Shipped v1.0 (2026-06-27)** — all five phases complete (25 plans). Supabase foundation, live catalog / public shop rewire, authentication & roles, admin portal (catalog & content management), and customer experience (wishlist, profile, native questionnaire). The milestone goal is delivered: the owner self-manages the entire catalog and site content via the admin portal with no code changes or redeploys, and customers can register, wishlist, manage a profile, and submit native customization requests that land in the admin inbox. Milestone audit (2026-06-02) `tech_debt`: 23/23 requirements, 5/5 phases, 23/23 integration, 2/2 E2E flows — no hard gaps, two defense-in-depth warnings (AUTH-05 guard pattern, PUB-01 import indirection). Human UAT closed for Phase 2 (5/5); Phases 1/3/5 UAT + all VERIFICATION human sign-offs deferred at close (see STATE.md Deferred Items). Beyond the planned scope, 11 owner-requested quick tasks shipped (out-of-stock toggle, admin notifications, patch-test note, product variants/SKUs, Turnstile on auth, Skin Guide sections, etc.). Next: the e-commerce milestone (cart / checkout / payments) — run `/gsd-new-milestone`.

**Current state (from codebase map):**
- Frontend is mature: React 19, Vite 7, Tailwind 4, shadcn/ui, Wouter routing, TanStack Query already wired in `client/src/lib/queryClient.ts`.
- Products are hardcoded in `client/src/data/products.ts` (68 products, all with empty `price`), with images eagerly glob-imported from `client/src/assets/images/products/Soap/<id>/`.
- Backend (`server/`) is scaffolding only: `server/routes.ts` is a stub, `server/storage.ts` is in-memory, Drizzle/Postgres configured but never connected. Passport installed but unconfigured.
- Product inquiries currently route to Instagram DMs (handle hardcoded in `Shop.tsx` and `ProductDetail.tsx`); the "Skin Guide" questionnaire (`client/src/pages/Questionnaire.tsx`) is an embedded Google Form whose responses never reach the app.
- Deploys as static SPA to GitHub Pages via `.github/workflows/deploy.yml`.
- No tests anywhere.

**Why now:** Every product or content change today requires a code edit and redeploy. Prices can't be shown because they live as empty strings in code. Customization requests vanish into a disconnected Google Form with no record in the app. A real backend + admin portal removes the developer from the loop and sets the foundation for selling later.

## Constraints

- **Tech stack**: Supabase (Postgres + Auth + Storage) as the backend — user-chosen. Keep the existing React/Vite/Tailwind/shadcn frontend.
- **Architecture**: Supabase-direct — frontend talks to Supabase via its client; no custom Express API layer.
- **Compatibility**: Public Shop must keep working (read from Supabase) without regressing the existing UX.
- **Deployment**: Frontend can remain a static SPA (GitHub Pages) since Supabase is hosted separately. Secrets (Supabase keys) handled appropriately for a public client (anon key + Row Level Security).
- **Security**: Admin-only actions must be enforced server-side via Supabase RLS, not just hidden in the UI.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase as backend | User choice; gives Postgres + Auth + Storage + auto API in one managed service | ✓ Good (v1.0) — Postgres + Auth + Storage + Edge Functions all in production |
| Supabase-direct (drop Express) | Existing Express was never wired up; removing it cuts maintenance and hosting | ✓ Good (v1.0, Phase 1) — dead stack removed, app builds clean |
| Admin + customer accounts now | User wants customers to register early and have inquiry history, even before checkout | ✓ Validated (Phase 3) |
| Product images → Supabase Storage | Replaces fragile repo glob-imports; enables image management in the portal | ✓ Good (v1.0, Phase 4) — HEIC convert+compress upload pipeline live |
| E-commerce deferred to later milestone | Catalog management must exist before selling; keeps this build focused | ✓ Good (v1.0) — catalog management shipped first, e-commerce is next milestone |
| Site content (Story, hero) editable in portal | Owner wants full content control, not just catalog | ✓ Good (v1.0, Phase 4) — 7 public surfaces read editable site_content |
| Customer wishlist included this build | Gives customer accounts immediate value before checkout exists | ✓ Good (v1.0, Phase 5) — per-user RLS-scoped wishlist live |
| Native questionnaire replaces Google Form | Capture submissions in-app so admin sees them and customers get history | ✓ Good (v1.0, Phase 5) — Turnstile-gated wizard + Edge Function, rows in admin inbox |
| Access control via Supabase RLS | Client-side route guards aren't real security for a public SPA | ✓ Validated (Phase 3) — role-lock trigger + RLS enforce server-side; AdminGuard is UX only |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-27 after v1.0 milestone*
