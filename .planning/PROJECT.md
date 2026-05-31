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

### Active

<!-- This milestone. Hypotheses until shipped and validated. -->

**Backend & Data**
- [ ] Replace hardcoded `client/src/data/products.ts` with products stored in Supabase Postgres
- [ ] Store categories in Supabase (replacing the literal `'soap' | 'scrub' | 'cream'` type)
- [ ] Move product images from repo glob-imports into Supabase Storage
- [ ] Drop the unused Express + Drizzle scaffolding (Supabase-direct architecture)

**Auth**
- [ ] Admin can log in to a protected admin portal (Supabase Auth)
- [ ] Customer can register and log in (Supabase Auth)
- [ ] Admin vs customer roles are distinguished and enforced

**Admin Portal — Content Management**
- [ ] Admin can create, edit, and delete products (name, description, category, price, images)
- [ ] Admin can set/edit product price (currently blank for all products)
- [ ] Admin can upload and replace product images via the portal
- [ ] Admin can create, edit, and delete categories
- [ ] Admin can edit contact details and social links (Instagram, YouTube, email)
- [ ] Admin can edit site content (Our Story page copy, homepage hero text)
- [ ] Admin can view customization submissions in an inbox

**Customer Side**
- [ ] Replace the embedded Google Form with a native questionnaire that submits to Supabase
- [ ] Customer can save / wishlist products to revisit later
- [ ] Customer has a profile and can view their own inquiry / customization history

**Public Site**
- [ ] Public Shop reads live product/category data from Supabase (instead of static file)

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- Cart / add-to-cart — deferred to e-commerce milestone (can't sell before catalog is manageable)
- Order page & checkout flow — deferred to e-commerce milestone
- Razorpay / payment integration — deferred to e-commerce milestone
- Keeping the Express server — replaced by Supabase-direct architecture

## Context

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
| Supabase as backend | User choice; gives Postgres + Auth + Storage + auto API in one managed service | — Pending |
| Supabase-direct (drop Express) | Existing Express was never wired up; removing it cuts maintenance and hosting | — Pending |
| Admin + customer accounts now | User wants customers to register early and have inquiry history, even before checkout | — Pending |
| Product images → Supabase Storage | Replaces fragile repo glob-imports; enables image management in the portal | — Pending |
| E-commerce deferred to later milestone | Catalog management must exist before selling; keeps this build focused | — Pending |
| Site content (Story, hero) editable in portal | Owner wants full content control, not just catalog | — Pending |
| Customer wishlist included this build | Gives customer accounts immediate value before checkout exists | — Pending |
| Native questionnaire replaces Google Form | Capture submissions in-app so admin sees them and customers get history | — Pending |
| Access control via Supabase RLS | Client-side route guards aren't real security for a public SPA | — Pending |

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
*Last updated: 2026-05-31 after initialization*
