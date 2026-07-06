# Phase 10: Admin Zone-Weight Rate Slab Editor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 10-admin-zone-weight-rate-slab-editor
**Areas discussed:** Grid vs. row CRUD, Editing surface & home, Coverage gaps & validation, Save & live reflection

---

## Grid vs. Row CRUD (SC1 reconciliation)

| Option | Description | Selected |
|--------|-------------|----------|
| Edit-in-place, fixed grid | Zones & bands are structural constants; admin edits only cost + ETA in the 20 existing cells. Grid always complete → SC3 trivially satisfied. | ✓ |
| Full row CRUD | Admin can add/remove arbitrary zone×band rows; reintroduces coverage-gap risk, more UI/validation. | |

**User's choice:** Edit-in-place, fixed grid
**Notes:** Resolves the SC1 "add/edit/delete" wording as edit-only; coverage completeness becomes structural, not a UI concern.

---

## Editing Surface & Home

| Option | Description | Selected |
|--------|-------------|----------|
| Spreadsheet matrix | 5 zone rows × 4 band columns, whole grid at once, single Save. | ✓ |
| Row list (20 rows) | Flat list with inline edit (clone CategoriesList); tedious to tune a rate card. | |
| Grouped by zone | 5 collapsible zone sections × 4 bands; more clicks to see the whole picture. | |

**User's choice (layout):** Spreadsheet matrix

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling nav item | New "Rate Slabs" entry next to Delivery, own route. Clean separation of settings vs grid. | ✓ |
| Sub-tab under Delivery | Tab strip inside /admin/delivery; introduces an unused tab pattern, mixes two save models. | |

**User's choice (home):** Sibling nav item
**Notes:** Resolves Phase 9 D-01's deferred "sub-tab or sibling" question.

---

## Coverage Gaps & Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-zone ETA | One ETA min–max per zone, written to its 4 cells; matches transit reality + seed. Cost per-cell. | ✓ |
| Per-cell ETA | Independent ETA per all 20 cells; 20× the inputs, diverges from zone-based reality. | |

**User's choice (ETA scope):** Per-zone ETA

| Option | Description | Selected |
|--------|-------------|----------|
| Basic bounds | Cost integer, ETA min ≤ max, block-save + inline errors. | ✓ |
| Monotonicity warnings | Non-blocking warnings on non-monotonic rates. | |
| ₹0 confirmation | Explicit confirm when a cost is 0. | |

**User's choice (validation):** Basic bounds only
**Notes:** Monotonicity warnings and ₹0-confirm declined. Claude resolved the open cost-bound question as **≥ 1 (positive integer)** so ₹0 is impossible by construction — satisfying SC3's "no silent ₹0" without a confirm dialog. Free shipping is handled by the Phase 9 free-ship threshold, not a ₹0 slab.

---

## Save & Live Reflection

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk upsert + cache purge | Upsert all 20 rows, invalidate slab query, reuse delivery-estimate {purge:true}. | ✓ |
| Upsert changed rows only | Dirty-cell tracking + same purge; added complexity for a tiny table. | |

**User's choice:** Bulk upsert + cache purge
**Notes:** Reuses the Phase 9 D-11/D-12 purge branch verbatim; no new edge-function work expected.

---

## Claude's Discretion

- Exact route path (`/admin/rates` vs alternatives) and Lucide sidebar icon.
- Slab read hook/query key string.
- Matrix cell markup, column-header wording, currency rendering, narrow-screen behavior.
- Upper bound for `eta_max_days` and helper-text wording.
- Save-toast reuse; optional "reset to seeded defaults" affordance.

## Deferred Ideas

- Add/remove zones or weight bands (fixed 5×4 vocabulary — schema + engine change).
- Monotonicity warnings / rate-sanity linting (declined; revisit if needed).
- Per-cell ETA (declined in favor of per-zone; schema supports it later).
- Live courier API (DLVR-F1) and per-variant numeric weight (DLVR-F2) — milestone-level deferrals.
- "Reset to seeded defaults" button — optional, Claude's discretion.

**Final check-in ("ready for context / explore more"):** No response within 60s — proceeded to write CONTEXT.md using best judgment, all four areas resolved.
