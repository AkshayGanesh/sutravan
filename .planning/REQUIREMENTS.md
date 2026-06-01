# Requirements: Earthen Luxury Sutravan — Admin CMS + Supabase Backend

**Defined:** 2026-05-31
**Core Value:** The owner can manage the entire product catalog (products, categories, images, prices) through an admin portal — no code changes, no redeploys.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase. E-commerce is explicitly deferred.

### Backend & Data Foundation

- [ ] **DATA-01**: App is wired to a Supabase project via environment-based config (anon key in client)
- [ ] **DATA-02**: Postgres schema exists for products, categories, site content, customization submissions, profiles, and wishlists, with Row Level Security enabled on every table
- [x] **DATA-03**: The 68 existing hardcoded products, categories, and soap images are migrated into Supabase via a one-time seed (run with the service-role key locally, never shipped)
- [ ] **DATA-04**: The unused Express + Drizzle backend scaffolding is removed

### Authentication & Access Control

- [x] **AUTH-01**: Customer can register with email and password
- [x] **AUTH-02**: User can log in and stay logged in across browser sessions
- [x] **AUTH-03**: User can log out from any page
- [x] **AUTH-04**: Admin vs customer roles are stored server-side (in profiles) and enforced via RLS so only admins can write catalog/content data
- [x] **AUTH-05**: Admin portal routes are protected — non-admins cannot reach or use them

### Admin Portal — Content Management

- [x] **ADMIN-01**: Admin can create, edit, and delete products (name, subtitle, category, benefits, ingredients, tips, shelf life, batch note)
- [x] **ADMIN-02**: Admin can set and edit each product's price
- [x] **ADMIN-03**: Admin can upload, replace, and remove product images stored in Supabase Storage
- [x] **ADMIN-04**: Admin can create, edit, and delete categories
- [x] **ADMIN-05**: Admin can edit site content (Our Story page copy, homepage hero text)
- [x] **ADMIN-06**: Admin can edit contact details and social links (Instagram, YouTube, email)
- [ ] **ADMIN-07**: Admin can view customer customization submissions in an inbox
- [x] **ADMIN-08**: Admin can toggle a product's visibility (draft vs published) so unfinished products stay hidden from the public site

### Customer Experience

- [ ] **CUST-01**: Customer can save (wishlist) a product
- [ ] **CUST-02**: Customer can view and manage their wishlist
- [ ] **CUST-03**: Customer can submit a native customization questionnaire (replacing the embedded Google Form) that is saved to Supabase
- [ ] **CUST-04**: Customer can view their profile and the history of their own customization submissions

### Public Site

- [x] **PUB-01**: Public Shop reads live products and categories from Supabase instead of the static data file
- [x] **PUB-02**: Product detail view renders from Supabase data (only published products shown)

## v2 Requirements

Deferred to future releases. Tracked but not in this roadmap.

### E-commerce

- **ECOM-01**: Customer can add products to a cart
- **ECOM-02**: Customer can place an order via a checkout flow
- **ECOM-03**: Payments via Razorpay
- **ECOM-04**: Inventory / stock tracking

### Admin Enhancements

- **ADME-01**: Image reordering and primary-image selection
- **ADME-02**: Bulk product operations
- **ADME-03**: Multiple admin users with granular permissions
- **ADME-04**: Analytics dashboard

## Out of Scope

Explicitly excluded for this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cart / add-to-cart | E-commerce milestone — catalog management must exist before selling |
| Checkout / orders | E-commerce milestone |
| Razorpay / payments | E-commerce milestone |
| Inventory / stock tracking | Not needed until selling |
| Multiple admin roles/permissions | Single owner-admin is sufficient for v1 |
| Analytics dashboard | Not core to self-management |
| Keeping the Express server | Replaced by Supabase-direct architecture |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 2 | Complete |
| DATA-04 | Phase 1 | Pending |
| AUTH-01 | Phase 3 | DB foundation (03-01: signup trigger creates customer profile); register UI pending (03-03) |
| AUTH-02 | Phase 3 | Complete |
| AUTH-03 | Phase 3 | Complete |
| AUTH-04 | Phase 3 | Complete (03-01: role server-side in profiles; role-lock trigger + RLS enforce admin-only writes) |
| AUTH-05 | Phase 3 | Complete |
| ADMIN-01 | Phase 4 | Complete |
| ADMIN-02 | Phase 4 | Complete |
| ADMIN-03 | Phase 4 | Complete |
| ADMIN-04 | Phase 4 | Complete |
| ADMIN-05 | Phase 4 | Complete |
| ADMIN-06 | Phase 4 | Complete |
| ADMIN-07 | Phase 4 | Pending |
| ADMIN-08 | Phase 4 | Complete |
| CUST-01 | Phase 5 | Pending |
| CUST-02 | Phase 5 | Pending |
| CUST-03 | Phase 5 | Pending |
| CUST-04 | Phase 5 | Pending |
| PUB-01 | Phase 2 | Complete |
| PUB-02 | Phase 2 | Complete |

**Coverage:**

- v1 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0

**By phase:**

- Phase 1 (Supabase Foundation): DATA-01, DATA-02, DATA-04 (3)
- Phase 2 (Live Catalog): DATA-03, PUB-01, PUB-02 (3)
- Phase 3 (Authentication & Roles): AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05 (5)
- Phase 4 (Admin Portal): ADMIN-01..ADMIN-08 (8)
- Phase 5 (Customer Experience): CUST-01, CUST-02, CUST-03, CUST-04 (4)

## Open Questions (resolve during phase discussion/planning)

1. **First admin bootstrap** (Phase 3) — manually flip a user's role to admin in the Supabase dashboard (recommended) vs seed a designated admin.
2. **Scrub/cream images** (Phase 2 → Phase 4) — no repo images exist; seeded with empty `images[]` in Phase 2; owner uploads them via the portal in Phase 4.
3. **Email confirmation** (Phase 3) — on (safer) vs off (smoother onboarding) for v1.

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after roadmap creation (traceability mapped, 23/23 covered)*
