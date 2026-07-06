# Requirements: Earthen Luxury Sutravan — v1.1 Delivery Estimator

**Defined:** 2026-06-27
**Core Value:** A customer can enter their pincode and see a trustworthy estimated shipping cost, delivery ETA, and COD availability for a product — before any cart or checkout exists.

## v1.1 Requirements

Requirements for the Delivery Estimator milestone. Each maps to a roadmap phase.

### Admin Configuration

- [x] **DLVR-01**: Admin can set and edit the origin (dispatch) pincode, with validation and a live preview on save
- [x] **DLVR-02**: Admin can set a default fallback product weight (grams) and the dispatch lead time (working days)
- [ ] **DLVR-03**: Admin can manage zone-weight rate slabs — estimated cost and ETA range per shipping zone × weight band
- [x] **DLVR-04**: Admin can configure COD rules (availability toggle, optional COD fee, optional order-value cap) and an optional free-shipping threshold

### Delivery Estimate

- [x] **DLVR-05**: Customer can enter a 6-digit destination pincode and receive serviceability, an estimated shipping cost (INR), an estimated delivery ETA range, and COD availability
- [x] **DLVR-06**: The estimator handles all states clearly — invalid pincode format, non-serviceable pincode, fetch failure with retry, and loading
- [x] **DLVR-07**: Every estimate is prominently labeled as an estimate (not a guaranteed charge), shown as a range where appropriate

### Placement & Persistence

- [x] **DLVR-08**: The product detail page shows a delivery estimator for that product (using the product's weight, falling back to the admin default)
- [x] **DLVR-09**: A global navbar "Deliver to [pincode]" widget lets the customer set/change their pincode, persisted in localStorage and shared with the product-detail estimator site-wide
- [x] **DLVR-10**: A logged-in customer's chosen pincode is saved to their profile and restored across devices/sessions

## Future Requirements

Deferred to a later release. Tracked but not in this roadmap.

### Live Courier Integration

- **DLVR-F1**: Live courier/aggregator (Shiprocket) rates/ETA/COD wired behind the same estimate interface, with the zone-weight table as automatic fallback (requires courier account + KYC)
- **DLVR-F2**: Per-variant numeric weight (`weight_g`) for product-accurate estimates instead of the single default fallback
- **DLVR-F3**: City/state echo from pincode and concrete calendar delivery-date range

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cart-level aggregated shipping | No cart/checkout exists; estimates are per-product this milestone |
| Real shipment creation / order placement | Belongs to the e-commerce milestone |
| Shipment tracking / tracking webhooks | No orders to track; out of scope pre-checkout |
| Customer address book | Only a pincode is needed for an estimate |
| Multi-courier selection matrix | Single estimate is sufficient for a small brand pre-checkout |
| Free-shipping progress bar | Requires a cart total; only static threshold messaging is in scope |
| Live courier API this milestone | Avoids KYC/onboarding on the critical path; zone-weight table ships now, API swaps in later (DLVR-F1) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DLVR-01 | Phase 9 — Admin Delivery Settings & COD Rules | Complete |
| DLVR-02 | Phase 9 — Admin Delivery Settings & COD Rules | Complete |
| DLVR-03 | Phase 10 — Admin Zone-Weight Rate Slab Editor | Pending |
| DLVR-04 | Phase 9 — Admin Delivery Settings & COD Rules | Complete |
| DLVR-05 | Phase 6 — Estimate Engine (Schema, Settings & Edge Function) | Complete |
| DLVR-06 | Phase 7 — Product Detail Delivery Estimator | Complete |
| DLVR-07 | Phase 7 — Product Detail Delivery Estimator | Complete |
| DLVR-08 | Phase 7 — Product Detail Delivery Estimator | Complete |
| DLVR-09 | Phase 8 — Site-Wide Pincode (Navbar Widget & Profile Persistence) | Complete |
| DLVR-10 | Phase 8 — Site-Wide Pincode (Navbar Widget & Profile Persistence) | Complete |

**Coverage:**

- v1.1 requirements: 10 total
- Mapped to phases: 10 ✓
- Unmapped: 0 ✓

**Per-phase coverage:**

- Phase 6 — Estimate Engine: DLVR-05 (1)
- Phase 7 — Product Detail Estimator: DLVR-06, DLVR-07, DLVR-08 (3)
- Phase 8 — Site-Wide Pincode: DLVR-09, DLVR-10 (2)
- Phase 9 — Admin Delivery Settings & COD Rules: DLVR-01, DLVR-02, DLVR-04 (3)
- Phase 10 — Admin Zone-Weight Rate Slab Editor: DLVR-03 (1)

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after roadmap creation (Phases 6–10 mapped, 100% coverage)*
