# Requirements: Earthen Luxury Sutravan — Admin CMS + Supabase Backend

**Defined:** 2026-05-31
**Core Value:** The owner can manage the entire product catalog (products, categories, images, prices) through an admin portal — no code changes, no redeploys.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase. E-commerce is explicitly deferred.

### Backend & Data Foundation

- [ ] **DATA-01**: App is wired to a Supabase project via environment-based config (anon key in client)
- [ ] **DATA-02**: Postgres schema exists for products, categories, site content, customization submissions, profiles, and wishlists, with Row Level Security enabled on every table
- [ ] **DATA-03**: The 68 existing hardcoded products, categories, and soap images are migrated into Supabase via a one-time seed (run with the service-role key locally, never shipped)
- [ ] **DATA-04**: The unused Express + Drizzle backend scaffolding is removed

### Authentication & Access Control

- [ ] **AUTH-01**: Customer can register with email and password
- [ ] **AUTH-02**: User can log in and stay logged in across browser sessions
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: Admin vs customer roles are stored server-side (in profiles) and enforced via RLS so only admins can write catalog/content data
- [ ] **AUTH-05**: Admin portal routes are protected — non-admins cannot reach or use them

### Admin Portal — Content Management

- [ ] **ADMIN-01**: Admin can create, edit, and delete products (name, subtitle, category, benefits, ingredients, tips, shelf life, batch note)
- [ ] **ADMIN-02**: Admin can set and edit each product's price
- [ ] **ADMIN-03**: Admin can upload, replace, and remove product images stored in Supabase Storage
- [ ] **ADMIN-04**: Admin can create, edit, and delete categories
- [ ] **ADMIN-05**: Admin can edit site content (Our Story page copy, homepage hero text)
- [ ] **ADMIN-06**: Admin can edit contact details and social links (Instagram, YouTube, email)
- [ ] **ADMIN-07**: Admin can view customer customization submissions in an inbox
- [ ] **ADMIN-08**: Admin can toggle a product's visibility (draft vs published) so unfinished products stay hidden from the public site

### Customer Experience

- [ ] **CUST-01**: Customer can save (wishlist) a product
- [ ] **CUST-02**: Customer can view and manage their wishlist
- [ ] **CUST-03**: Customer can submit a native customization questionnaire (replacing the embedded Google Form) that is saved to Supabase
- [ ] **CUST-04**: Customer can view their profile and the history of their own customization submissions

### Public Site

- [ ] **PUB-01**: Public Shop reads live products and categories from Supabase instead of the static data file
- [ ] **PUB-02**: Product detail view renders from Supabase data (only published products shown)

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
| DATA-01 | TBD | Pending |
| DATA-02 | TBD | Pending |
| DATA-03 | TBD | Pending |
| DATA-04 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| AUTH-05 | TBD | Pending |
| ADMIN-01 | TBD | Pending |
| ADMIN-02 | TBD | Pending |
| ADMIN-03 | TBD | Pending |
| ADMIN-04 | TBD | Pending |
| ADMIN-05 | TBD | Pending |
| ADMIN-06 | TBD | Pending |
| ADMIN-07 | TBD | Pending |
| ADMIN-08 | TBD | Pending |
| CUST-01 | TBD | Pending |
| CUST-02 | TBD | Pending |
| CUST-03 | TBD | Pending |
| CUST-04 | TBD | Pending |
| PUB-01 | TBD | Pending |
| PUB-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 23 ⚠️

## Open Questions (resolve during phase discussion/planning)

1. **First admin bootstrap** — manually flip a user's role to admin in the Supabase dashboard (recommended) vs seed a designated admin.
2. **Scrub/cream images** — no repo images exist; owner uploads them via the portal after launch.
3. **Email confirmation** — on (safer) vs off (smoother onboarding) for v1.

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after initial definition*
