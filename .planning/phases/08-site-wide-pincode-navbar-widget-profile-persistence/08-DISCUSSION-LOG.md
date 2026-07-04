# Phase 8: Site-Wide Pincode — Navbar Widget & Profile Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 8-site-wide-pincode-navbar-widget-profile-persistence
**Areas discussed:** Login conflict resolution, Anonymous→profile adoption, Navbar input scope, Mobile placement + sync failure

> **Provenance:** The user was away at the selection prompt (no response after the
> question was presented). Claude proceeded with best-judgment defaults grounded in
> the ROADMAP success criteria, the Phase 7 foundation, and standard e-commerce
> conventions. Each decision below records the option chosen and why; the user may
> override any of them by editing CONTEXT.md before planning.

---

## Login conflict resolution (profile vs. local differ)

| Option | Description | Selected |
|--------|-------------|----------|
| Profile wins | On login, a non-null `profiles.default_pincode` overwrites context + localStorage | ✓ |
| Local wins | The device's just-set localStorage value keeps priority over the saved profile | |
| Most-recent wins | Compare timestamps; newer value wins (requires storing a timestamp) | |

**Chosen:** Profile wins (D-01).
**Notes:** SC4 literally requires "restored on a fresh login from another device/session,"
which only holds if the account value is authoritative on login. "Most-recent" adds a
timestamp mechanism for a marginal benefit; rejected as over-engineering for v1.1.

---

## Anonymous → profile adoption (profile empty, local set)

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt local into empty profile | If profile pincode is null at login, push localStorage value up to the profile | ✓ |
| Leave profile empty until next change | Only write the profile when the user explicitly changes the pincode post-login | |

**Chosen:** Adopt (D-02).
**Notes:** A first-time customer who typed a pincode while anonymous shouldn't lose it on
sign-up. Combined merge rule: `profile-if-set, else adopt-local, else nothing`.

---

## Navbar input scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pure setter (format-only, no network) | Validate `/^\d{6}$/` and call `setPincode`; no Turnstile, no estimate | ✓ |
| Setter + serviceability check | Also hit the Edge Function on set to confirm delivery is available | |

**Chosen:** Pure setter (D-05).
**Notes:** Setting a delivery *location* should be one-tap and captcha-free; firing an
estimate on every location change would burn the Turnstile/rate budget. Serviceability +
cost/ETA/COD remain the product-page estimator's job (Phase 7), which re-reads the same
shared context.

---

## Mobile placement + sync failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Compact top-bar pill (both breakpoints) + silent sync-fail | Pill reachable on every page/breakpoint; background profile-write failure degrades silently to localStorage | ✓ |
| Hamburger-only on mobile | Widget lives inside the mobile Sheet, not the top bar | |
| Toast on sync failure | Surface an error toast when the profile write fails | |

**Chosen:** Top-bar pill (both) + silent degrade (D-07, D-08).
**Notes:** "Set from anywhere" argues against hiding the widget behind the hamburger.
Exact placement/whether it also appears in the Sheet is deferred to `/gsd-ui-phase`
(UI hint: yes). The profile write is a best-effort side-effect — the pincode keeps
working locally on failure, so no alarming toast fires (mirrors the existing
try/catch-around-storage posture in `DeliveryProvider`).

---

## Claude's Discretion

- Exact navbar component filename and whether the popover uses the shadcn `Popover` primitive.
- Whether the login-merge read reuses a `lib/delivery.ts` helper / React-Query hook vs. a
  direct `supabase.from("profiles")` call in the provider effect (AuthProvider does the latter).
- Pill/popover copy, iconography, spacing — refined by `/gsd-ui-phase`.
- Optional equality guard to skip a redundant profile write when the value is unchanged.

## Deferred Ideas

- Serviceability check / estimate from the navbar (kept on the product page).
- Admin editing of delivery settings (Phase 9); zone-weight slab editor (Phase 10).
- Per-variant numeric weight (DLVR-F2, post-launch).
- Multiple saved delivery pincodes / address book (future checkout concern).
