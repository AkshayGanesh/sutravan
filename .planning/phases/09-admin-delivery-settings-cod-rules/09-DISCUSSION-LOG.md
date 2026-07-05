# Phase 9: Admin Delivery Settings & COD Rules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 09-admin-delivery-settings-cod-rules
**Areas discussed:** Page & layout, Live preview flow, Origin validation & cache, COD & numeric inputs

---

## Page & Layout — location

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Delivery' nav page | Dedicated sidebar item + `/admin/delivery` route; separate from marketing copy; natural home for Phase 10 slab editor | ✓ |
| Fold into Site Content | Add delivery fields as sections on `/admin/content`; fewer nav items but mixes marketing + operational config | |

**User's choice:** New 'Delivery' nav page
**Notes:** Slots between Site Content and Submissions; Phase 10 slab editor can sit next to it.

## Page & Layout — grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Sectioned single form | One page, one Save, grouped fieldsets (Origin & Dispatch / COD / Free shipping); mirrors Site Content editor | ✓ |
| Per-section save | Each fieldset its own Save; more granular but diverges from single-save pattern | |

**User's choice:** Sectioned single form

---

## Live Preview — auth to Turnstile-gated edge function

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-JWT bypass | Edge fn skips Turnstile for verified admin JWT; public path unchanged; no captcha widget in admin | ✓ |
| Invisible Turnstile in admin | Load hosted-CDN Turnstile on the Delivery page; zero fn changes but adds captcha to an authed screen | |

**User's choice:** Admin-JWT bypass
**Notes:** Cleaner UX; admin-only so no bot risk.

## Live Preview — test destination pincode source

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-entered test field | "Test against" input so owner probes any real route | ✓ |
| Fixed sample pincode | Always one hardcoded destination; simpler but only proves one route | |

**User's choice:** Admin-entered test field

## Live Preview — when it fires

| Option | Description | Selected |
|--------|-------------|----------|
| On explicit Preview button | On-demand; probe before Save; no per-keystroke edge calls | ✓ |
| Automatically after Save | Runs once post-save; matches SC wording but needs a saved origin | |
| Both | Manual + auto-after-save; most reassuring, more wiring | |

**User's choice:** On explicit Preview button

## Live Preview — pre-save origin override

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only `originPincode` param | Edge fn honors a body-supplied origin only for admins; preview reflects typed (unsaved) origin | ✓ |
| Save-first, then preview | Fn reads saved origin only; require Save before Preview enabled | |

**User's choice:** Admin-only `originPincode` param

---

## Origin Validation & Cache — serviceability check

| Option | Description | Selected |
|--------|-------------|----------|
| Client query pincodes table | On change/blur, look up `pincodes` (serviceable=true); inline ✓/✗; block Save on invalid/`000000` | ✓ |
| Validate via preview call | Let the estimate call surface a bad origin; fewer parts but late feedback | |

**User's choice:** Client query pincodes table

## Origin Validation & Cache — cache interaction on settings change

| Option | Description | Selected |
|--------|-------------|----------|
| Purge cache on any settings save | Clear `delivery_estimate_cache` (service-role) after upsert so all changes appear live | ✓ |
| Rely on TTL + key miss | Do nothing; non-origin changes propagate within 24h as rows expire | |

**User's choice:** Purge cache on any settings save
**Notes:** Cache is deny-direct RLS → purge must go via service-role, not a client delete (mechanism = planner's discretion).

---

## COD & Numeric Inputs — dependent fields when COD off

| Option | Description | Selected |
|--------|-------------|----------|
| Disable (greyed, kept) | Fee/cap grey out but retain values; re-enabling restores them | ✓ |
| Hide entirely | Fee/cap disappear when COD off | |

**User's choice:** Disable (greyed, kept)

## COD & Numeric Inputs — optional/off representation

| Option | Description | Selected |
|--------|-------------|----------|
| Blank = off (empty input) | Empty cap/threshold saves null; "Leave blank to disable" | ✓ |
| Explicit enable checkbox | A checkbox gates each optional field; more explicit, more toggles | |

**User's choice:** Blank = off (empty input)

## COD & Numeric Inputs — validation bounds

| Option | Description | Selected |
|--------|-------------|----------|
| Sensible guardrails | Weight 1–2000g, lead 0–14d, fee ≥0 (req. if COD), cap/threshold >0-or-blank; reject negatives/decimals | ✓ |
| Minimal (non-negative only) | Integers ≥0, no upper bounds | |
| Let me set the bounds | User supplies specific min/max | |

**User's choice:** Sensible guardrails

---

## Claude's Discretion

- Sidebar icon, field labels, helper-text wording, section order.
- Cache-purge mechanism (edge-fn purge branch vs admin RPC vs admin-gated delete policy).
- How the admin JWT + role is verified inside the edge function.
- Whether the serviceability lookup reuses an existing `pincodes` helper.
- Save success toast (reuse existing admin pattern).

## Deferred Ideas

- Zone-weight rate slab editing → Phase 10 (DLVR-03).
- Per-zone / % COD fee, per-pincode COD, per-variant weight, live courier API, global buffer % → deferred in Phase 6.
- Cart free-shipping progress bar → out of scope; free-ship is static messaging only.
