# Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 6-estimate-engine-delivery-schema-settings-edge-function
**Areas discussed:** Zone model & seed rates, COD rules shape, Weight fallback & rounding, Pincode dataset & serviceability

---

## Zone model & seed rates

| Option | Description | Selected |
|--------|-------------|----------|
| 5 zones | Local · Regional · Metro · National · Remote | ✓ |
| 3 zones | Local · National · Remote (coarser) | |
| 4 zones | Drops the Metro tier | |

| Option | Description | Selected |
|--------|-------------|----------|
| 4 bands | 0–250 / 251–500 / 501–1000 / 1001–2000 g | ✓ |
| 3 bands | 0–500 / 501–1000 / 1001–2000 g | |
| Per-500g steps | More granular, more cells | |

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher-placeholder rates | Seed sensible D2C placeholders, tune in Phase 10 | ✓ |
| I'll provide my rates now | Owner gives the real grid | |
| You decide the full grid | Claude commits specific defensible numbers | |

| Option | Description | Selected |
|--------|-------------|----------|
| Standard ramp | Local 1–2 · Regional 2–4 · Metro 3–5 · National 4–7 · Remote 6–10 | ✓ |
| Faster ramp | Optimistic express times | |
| I'll specify per zone | Owner gives exact ranges | |

**User's choice:** 5 zones, 4 weight bands, researcher-placeholder rates, standard ETA ramp.
**Notes:** Rates are explicit placeholders — owner replaces with real courier rates in Phase 10's slab editor (no redeploy).

---

## COD rules shape

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed flat fee | Single admin-set ₹ amount (seed ₹30) | ✓ |
| Percentage of order | % of order value — little gain with no cart in v1.1 | |
| No COD fee for now | Available but free; fee field defaulted 0 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Cap field, seeded generous | Optional cap, seed ₹5000 | ✓ |
| No cap | COD regardless of value | |

| Option | Description | Selected |
|--------|-------------|----------|
| Global toggle | One admin on/off flag everywhere | ✓ |
| Per-zone | COD on/off per zone | |
| Per-pincode | cod_available flag per pincode — no data to seed | |

**User's choice:** Flat fee (seed ₹30), optional cap seeded ₹5000, global toggle.
**Notes:** India Post dataset carries no COD info, so per-pincode COD would be guesswork — global toggle is the honest MVP.

---

## Weight fallback & rounding

| Option | Description | Selected |
|--------|-------------|----------|
| 250g | Jar + packaging; slightly conservative | ✓ |
| 150g | Single soap; risks under-quoting | |
| 500g | Generous; may over-quote | |

| Option | Description | Selected |
|--------|-------------|----------|
| Round UP to nearest ₹10 | Clean ceiling numbers | ✓ |
| Round UP to nearest ₹1 | Integer but ragged | |
| Round UP to nearest ₹5 | Middle ground | |

| Option | Description | Selected |
|--------|-------------|----------|
| No separate buffer | Slab value is the estimate; round-up is the cushion | ✓ |
| Configurable % buffer field | Admin buffer %, adds a site_content key | |

| Option | Description | Selected |
|--------|-------------|----------|
| Engine returns rounded integer | One source of truth; cache stores final number | ✓ |
| UI rounds | Risks drift between surfaces | |

**User's choice:** 250g fallback, round up to nearest ₹10, no buffer, engine rounds.
**Notes:** No numeric weight column — `product_variants.label` is never parsed (Pitfall 9).

---

## Pincode dataset & serviceability

| Option | Description | Selected |
|--------|-------------|----------|
| Full India Post ~19k set | data.gov.in directory; membership = serviceable | ✓ |
| Curated metro/Tier-1 subset | Smaller; false negatives for small towns | |
| Prefix-range table | Tiny; weak validation | |

| Option | Description | Selected |
|--------|-------------|----------|
| Derive relative to origin | state/region/metro/remote flags per row; engine computes zone vs origin | ✓ |
| Static zone column per pincode | Fixed zone; breaks if origin changes | |
| First-digit-only mapping | Very coarse | |

| Option | Description | Selected |
|--------|-------------|----------|
| Membership = serviceable + flag column | `serviceable` boolean (default true) for future deactivation | ✓ |
| Membership only | No way to switch a pincode off without deleting | |

**User's choice:** Full ~19k set, zone derived relative to configurable origin, membership + serviceable boolean.
**Notes:** Origin-relative zoning keeps estimates correct when the dispatch pincode changes (Pitfall 10).

---

## Closing decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Seed a clearly-fake origin placeholder (000000) | Forces real config in Phase 9 | ✓ |
| Type real pincode now | Accurate from day one | |

**User's choice:** Seed placeholder `000000`; configure real origin in Phase 9.

## Claude's Discretion

- Exact placeholder ₹ grid values (internally consistent, monotonic).
- `delivery_cod_rules` jsonb field shape, adjacency/metro classification logic, column names, migration numbering (continue from 0013).
- Cache TTL seeded at 24h; `delivery_dispatch_lead_days` seeded 1; free-ship threshold seeded off/null (folded defaults, not separately balloted).

## Deferred Ideas

- Per-pincode COD serviceability (needs courier feed).
- Per-variant numeric weight column (DLVR-F2).
- Live courier API (Shiprocket / DLVR-F1) behind `callCourierAdapter()`.
- Per-zone or % COD fee model.
- Configurable global buffer % site_content key.
