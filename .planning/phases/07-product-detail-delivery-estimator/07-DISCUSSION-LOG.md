# Phase 7: Product Detail Delivery Estimator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 7-product-detail-delivery-estimator
**Areas discussed:** Lookup & Turnstile, Placement, Provider scope, Result framing, Prefill behavior, Free-ship messaging

---

## Lookup & Turnstile

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit button + managed Turnstile | Pincode field + 'Check delivery' button; managed/invisible Turnstile solves on click. One deliberate action per lookup, matches Questionnaire pattern. | ✓ |
| Auto-lookup on 6th digit | Fires automatically on 6 valid digits (debounced), Turnstile invisible. Instant but risks repeated challenges/calls. | |
| Prefill + auto if pincode known | Auto-fetch if a pincode is saved, else field + button. Better once Phase 8 exists, adds state complexity now. | |

**User's choice:** Explicit button + managed Turnstile
**Notes:** Cleanest abuse story; every estimate call needs a Turnstile token, so a deliberate press avoids stray challenges.

---

## Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible, below price/variant | Distinct 'Delivery' section after price + weight selector, above Instagram CTA. Highest discoverability. | ✓ |
| Collapsible 'Check delivery' row | Compact row that expands. Leaner modal, one extra tap. | |
| Near the CTA, always visible | Beside the 'Enquire on Instagram' CTA. Competes with CTA for attention. | |

**User's choice:** Always-visible, below price/variant
**Notes:** ProductDetail is a Dialog modal, not a page; block inserts between variant selector and CTA.

---

## Provider scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full DeliveryProvider now | Complete context + localStorage + useDelivery/useDeliveryEstimate as single source of truth; Phase 8 adds only navbar UI. Matches SC5, less rework. | ✓ |
| Minimal now, expand in Phase 8 | Only what the modal needs; defer site-wide wiring. Smaller Phase 7, Phase 8 refactors. | |

**User's choice:** Full DeliveryProvider now
**Notes:** Avoids a Phase 8 refactor; mount at app root alongside AuthProvider.

---

## Result framing

| Option | Description | Selected |
|--------|-------------|----------|
| Exact ₹ + range ETA + estimate note | Exact '₹X' (engine already rounds up) + 'Estimated — final may vary' note; ETA 'X–Y working days'; COD yes/no. originConfigured=false → soft provisional banner, numbers still shown. | ✓ |
| '~₹X' approx + range ETA | '~₹X' to reinforce estimate; hide numbers when originConfigured=false. | |
| Let /gsd-ui-phase decide copy | Lock data shown, defer wording/format to UI contract. | |

**User's choice:** Exact ₹ + range ETA + estimate note
**Notes:** Show numbers even when origin unconfigured (placeholder `000000`), under a "provisional" banner until Phase 9.

---

## Prefill behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Prefill pincode, require button press | Prefill saved pincode but keep result hidden until 'Check delivery' pressed. Avoids Turnstile call on every modal open. | ✓ |
| Prefill + auto-show last result | Prefill AND show last cached result without a new call. Feels faster but shows an un-re-requested result. | |

**User's choice:** Prefill pincode, require button press
**Notes:** Consistent with the explicit-button lookup choice.

---

## Free-ship messaging

| Option | Description | Selected |
|--------|-------------|----------|
| Build it, show only when set | Wire 'Free over ₹X' static messaging now; render nothing while threshold null (until Phase 9). No rework. | ✓ |
| Defer entirely to Phase 9 | Ignore free-ship in Phase 7; Phase 9 adds setting + display. | |

**User's choice:** Build it, show only when set
**Notes:** No cart progress bar — static messaging only (no cart in v1.1).

---

## Claude's Discretion

- Exact component/file names and locations for the block, provider, and hooks.
- Exact copy wording for estimate note, provisional banner, non-serviceable, and error states (a UI-SPEC may refine — phase has UI hint).
- React-Query cache key shape / staleTime for `useDeliveryEstimate`.
- localStorage key name for the persisted pincode (stable/namespaced for Phase 8 reuse).

## Deferred Ideas

- Navbar "Deliver to [pincode]" widget + site-wide sharing UI — Phase 8.
- Profile / cross-device pincode sync (`profiles.default_pincode`) — Phase 8.
- Admin editing of origin, default weight, dispatch lead, COD rules, free-ship threshold — Phase 9.
- Zone-weight slab rate editing — Phase 10.
- Per-variant numeric weight column (accurate per-product estimates) — DLVR-F2.
- Cart-based free-shipping progress bar — no cart in v1.1.
