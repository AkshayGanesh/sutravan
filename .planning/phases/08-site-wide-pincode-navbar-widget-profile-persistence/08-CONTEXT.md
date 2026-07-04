# Phase 8: Site-Wide Pincode — Navbar Widget & Profile Persistence - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

> **Note on decision provenance:** The user was away when these decisions were
> finalized, so D-01…D-10 are Claude's best-judgment defaults grounded in the
> ROADMAP success criteria, the Phase 7 foundation, and standard e-commerce
> conventions. They are sensible and reversible — the user may edit this file
> before planning. Each carries its rationale so a downstream override is easy.

<domain>
## Phase Boundary

A global **"Deliver to [pincode]" navbar widget** (pill + popover input) lets the
customer set or change their pincode **from any page**. The choice flows through
the **existing site-wide `DeliveryProvider`** (built in Phase 7) as the single
source of truth, persists in **localStorage**, and — for a **logged-in customer**
— syncs to **`profiles.default_pincode`** so it restores across devices and
sessions. An anonymous visitor falls back to localStorage only.

**In scope:**
- The navbar pill + popover pincode input (desktop + mobile), format-validated.
- Extending `DeliveryProvider` to read/write `profiles.default_pincode` and run a
  login-time merge between the localStorage value and the profile value.
- Wiring the widget so setting the pincode anywhere updates the Phase 7 product
  detail estimator (and vice versa) — one shared context, no re-entry.

**Out of scope (other phases / deferred):**
- The `DeliveryProvider` / `useDelivery` / localStorage layer itself — **already
  built in Phase 7 (D-11)**; Phase 8 only adds the navbar UI + profile sync on top.
- The `delivery-estimate` Edge Function, serviceability, cost/ETA/COD compute — the
  navbar widget does **not** call it (Phase 6/7 own that; see D-05).
- Admin editing of origin pincode, default weight, COD rules, free-ship threshold
  (Phase 9); the zone-weight slab editor (Phase 10); per-variant weight (DLVR-F2).

</domain>

<decisions>
## Implementation Decisions

### Profile ↔ localStorage merge on login (DLVR-10) — the core decision
- **D-01: Profile value wins when it is set.** On login / session-restore, if
  `profiles.default_pincode` is non-null, it becomes the authoritative pincode:
  write it into context **and** localStorage (so the device now mirrors the
  account). This directly satisfies SC4 ("restored on a fresh login from another
  device/session") — the account is the durable cross-device source of truth.
- **D-02: Adopt the local pincode into an empty profile.** If the logged-in user's
  `profiles.default_pincode` is **null** but localStorage has a value (they set it
  while anonymous, then logged in), **push localStorage → profile** so their
  session choice becomes their saved default. Combined rule:
  `profile-if-set, else adopt-local, else nothing`.
- **D-03: Write-through on every set while logged in.** `setPincode` for a
  logged-in user updates context + localStorage (as today) **and** fires a
  best-effort `profiles.update({ default_pincode })` for the caller's own row.
  No debounce — pincode changes are infrequent and deliberate.
- **D-04: Logout does NOT clear the local pincode.** The localStorage value is
  device-local convenience and survives logout; the next login re-runs the D-01/D-02
  merge. (Only a deliberate change replaces it.)

### Navbar widget behavior
- **D-05: The widget is a pure pincode *setter* — format-only, no network.** The
  popover validates `/^\d{6}$/` inline (mirroring Phase 7 D-02) and, on a valid
  submit, calls `setPincode` and closes. It does **NOT** invoke `delivery-estimate`,
  run serviceability, or mount Turnstile. Rationale: setting a delivery *location*
  should be frictionless (no captcha), and firing an estimate on every location
  change would burn the Turnstile/rate budget. Serviceability + cost/ETA/COD
  feedback surfaces where it belongs — the Phase 7 product-detail estimator, which
  re-reads the same shared pincode.
- **D-06: Empty state = a clear "set your pincode" prompt.** When `pincode` is null,
  the pill invites input (e.g. "Deliver to —" / "Set pincode"); once set it shows
  the value (e.g. "Deliver to 110001"). Exact copy is UI-SPEC's call (UI hint: yes).
- **D-07: Reachable on both desktop and mobile.** A compact pill sits in the navbar
  right-cluster (near the social/account icons) on desktop; on mobile it stays a
  compact top-bar pill so "set from anywhere" holds. Exact placement / whether it
  also appears inside the hamburger sheet is a **UI-SPEC decision** — the behavioral
  requirement is only that it is reachable from every page on every breakpoint.

### Sync failure handling
- **D-08: Silent degrade to localStorage on profile-write failure.** The background
  `profiles.update` is best-effort: if it fails (network/RLS/offline), the pincode
  still works this session/device via localStorage + context, and **no error toast
  fires**. This mirrors the existing try/catch-around-storage posture in
  `DeliveryProvider`. (Contrast: `lib/profile.ts` mutations DO toast — but those are
  explicit "Save" actions on the Profile page; here the pincode set is the primary
  action and profile sync is a silent side-effect.)

### Provider extension shape
- **D-09: Extend the existing `DeliveryProvider`, do not add a second provider.**
  It already sits **inside** `AuthProvider` in `App.tsx`, so it can consume
  `useAuth()` for `user`/`loading`. Add: (a) an effect keyed on `user?.id` that runs
  the D-01/D-02 login merge once auth `loading` is false (never clobber during the
  auth-loading window), and (b) the write-through in `setPincode` (D-03). Keep the
  public context shape `{ pincode, setPincode }` unchanged so Phase 7's
  `DeliveryEstimate` consumer needs zero changes.

### Claude's Discretion
- Exact navbar component file (e.g. `client/src/components/delivery/DeliveryPincode*.tsx`)
  and whether the popover uses the shadcn `Popover` primitive — follow existing
  conventions (`DeliveryEstimate.tsx` lives in `components/delivery/`).
- Whether the profile read on login reuses a small `lib/delivery.ts` helper or a
  React-Query hook vs. a direct `supabase.from("profiles")` call inside the provider
  effect (AuthProvider already does the latter for `role`).
- Exact pill/popover copy, iconography, and spacing — refined by `/gsd-ui-phase`.
- Whether to prevent a redundant profile write when the merged value already equals
  the profile value (a cheap equality guard, like `useUpdateEmail`'s `unchanged`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 8: Site-Wide Pincode — Navbar Widget & Profile
  Persistence" — goal + 4 success criteria (SC2 = one shared source of truth across
  navbar ↔ estimator; SC4 = profile save + cross-device restore).
- `.planning/REQUIREMENTS.md` — DLVR-09 (global navbar widget, localStorage, shared
  with estimator) and DLVR-10 (profile save + cross-device restore) — the two
  requirements this phase delivers.

### Upstream phase (the foundation this phase builds on)
- `.planning/phases/07-product-detail-delivery-estimator/07-CONTEXT.md` — Phase 7
  D-11 built the FULL `DeliveryProvider`; Phase 8 "adds only the navbar UI on top —
  no refactor of this layer." The stable localStorage key handoff is documented there.
- `client/src/delivery/DeliveryProvider.tsx` — the EXISTING provider Phase 8 extends:
  `DeliveryContextValue { pincode, setPincode }`, `DELIVERY_PINCODE_KEY =
  "sutravan.delivery.pincode"`, try/catch-wrapped storage access, lazy-init from
  storage. Mounted INSIDE `AuthProvider` in `App.tsx` (L151→L155) so `useAuth()` is
  available.
- `client/src/delivery/useDelivery.ts` — the `useDelivery()` consumer hook (throws
  outside provider). The navbar widget calls this.
- `client/src/components/delivery/DeliveryEstimate.tsx` — the Phase 7 estimator that
  already consumes the same context; its behavior must not regress (SC2 two-way sync).

### Codebase patterns to clone
- `client/src/auth/AuthProvider.tsx` — the exact `supabase.from("profiles").select().
  eq("id", userId).single()` read + effect-keyed-on-`user?.id` + `loading`-gating
  pattern to mirror for the login-merge read (avoid deciding during the auth-loading
  window — see AuthProvider's `resolvedFor` race note).
- `client/src/lib/profile.ts` — the `profiles.update({...}).eq("id", userId)` mutation
  shape (RLS-scoped to the caller's own row; the Phase-3 role-lock trigger only blocks
  `role`, so a `default_pincode` self-update is allowed). Also the `unchanged`
  short-circuit pattern (`useUpdateEmail`) if a write-skip guard is wanted (D-09).
- `client/src/components/Navbar.tsx` — the right-cluster (`flex items-center
  space-x-3`, L87) holds the social/wishlist/account icons + hamburger `Sheet`; the
  pill lands here on desktop. Mobile menu is the `Sheet` at L214+.
- `client/src/components/ui/popover.tsx` (if present) — shadcn popover primitive for
  the input affordance.

### Live-ops / infra
- Memory `supabase-live-ops.md` — only if a migration is needed. **It should NOT be**
  — `profiles.default_pincode` already exists (Phase 6). No schema change in Phase 8.

[No standalone ADR/SPEC docs exist for this phase — requirements are fully captured
in the decisions above + the Phase 7 context + the deployed provider layer. A
`/gsd-ui-phase` UI-SPEC is expected (UI hint: yes) to lock the pill/popover visuals.]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DeliveryProvider.tsx` / `useDelivery.ts`: the exact context Phase 8 extends and
  consumes — zero new provider needed (D-09).
- `AuthProvider.tsx`: template for the profile read effect (keyed on `user?.id`,
  gated on `loading`) and the `supabase.from("profiles")` query shape.
- `lib/profile.ts` (`useUpdateName`): template for the RLS-scoped `profiles.update`
  write-through, including error posture and the `unchanged` equality-guard idea.
- `Navbar.tsx` right-cluster + `Sheet`: the mount points for the pill (desktop +
  mobile).

### Established Patterns
- Provider-at-root, `useX()`-throws-outside-provider (AuthProvider / useDelivery).
- Effect keyed on `user?.id` for per-user server reads, with `loading` gating to
  avoid deciding during the auth-resolution race (AuthProvider `resolvedFor`).
- localStorage access always try/catch-wrapped so blocked storage degrades to null
  (DeliveryProvider) — the profile write inherits the same silent-degrade posture (D-08).
- RLS scopes `profiles` reads/writes to the caller's own row; the role-lock trigger
  blocks only `role`, so `default_pincode` self-updates are safe.

### Integration Points
- `DeliveryProvider` already mounts inside `AuthProvider` → `useAuth()` is available
  with NO reorder needed. The login-merge effect and write-through both live in the
  provider so every consumer (navbar pill + Phase 7 estimator) sees one value (SC2).
- The navbar pill is a new consumer of `useDelivery()`; the Phase 7 estimator is an
  existing consumer — both stay in sync automatically through shared context.
- `profiles.default_pincode` column exists (Phase 6) — read on login, written on set.

</code_context>

<specifics>
## Specific Ideas

- The widget is a **location setter, not an estimator** — deliberately no Turnstile /
  no network on the navbar (D-05). Estimates remain a product-page concern so setting
  "where" stays a one-tap, zero-friction action.
- Cross-device restore (SC4) is achieved by making the **profile the winner** on login
  (D-01) while still **adopting** an anonymous choice into an empty profile (D-02) — so
  a first-time customer never loses the pincode they just typed, and a returning one
  always gets their saved location.
- Profile sync is a **silent background side-effect** (D-08): the pincode must keep
  working locally even when the profile write can't reach the server.

</specifics>

<deferred>
## Deferred Ideas

- **Serviceability check / estimate from the navbar** — intentionally NOT here (D-05);
  estimates live on the product page (Phase 7). Could revisit as a "quick check" UX
  later, but out of scope for DLVR-09/10.
- **Admin editing** of origin pincode, default weight, dispatch lead, COD rules,
  free-ship threshold — Phase 9.
- **Zone-weight slab rate editing** — Phase 10.
- **Per-variant numeric weight** (accurate per-product estimates) — DLVR-F2, post-launch.
- **A dedicated "delivery addresses" book / multiple saved pincodes** — v1.1 stores a
  single `default_pincode`; multi-address is a future e-commerce/checkout concern.

None of the above were pulled into scope — discussion stayed within the Phase 8 boundary.

</deferred>

---

*Phase: 8-site-wide-pincode-navbar-widget-profile-persistence*
*Context gathered: 2026-07-04*
