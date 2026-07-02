# Phase 7: Product Detail Delivery Estimator - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The product detail view — a shadcn **Dialog modal** (`client/src/components/ProductDetail.tsx`),
NOT a standalone page — gains a per-product **delivery estimate block**. The
customer enters a 6-digit pincode and sees estimated shipping cost (integer ₹),
an ETA range in working days, and COD yes/no for that product. Every UX state is
handled (loading, invalid-format, non-serviceable, fetch-failure-with-retry) and
the result is prominently framed as an **estimate, not a guaranteed charge**.

A shared **`DeliveryProvider` + `useDelivery` + `useDeliveryEstimate`** client
layer (mirroring `AuthProvider` and the `catalog.ts`/React-Query patterns) backs
the block, and the entered pincode persists in **localStorage** so it survives a
reload.

**In scope:** the estimate block UI inside the ProductDetail modal; the full
site-wide `DeliveryProvider`/hooks/localStorage layer; wiring to the deployed
`delivery-estimate` Edge Function via a Turnstile-gated invoke.

**Out of scope (other phases):** the navbar "Deliver to [pincode]" widget +
profile/cross-device sync (Phase 8); admin editing of origin pincode, default
weight, COD rules, free-ship threshold (Phase 9); the zone-weight slab editor
(Phase 10). Phase 7 consumes the Phase 6 engine + seeded defaults as-is; it does
not build any admin form or change the Edge Function contract.

</domain>

<decisions>
## Implementation Decisions

### Lookup Trigger & Turnstile
- **D-01:** **Explicit button + managed Turnstile.** The block is a pincode input
  field plus a **"Check delivery"** button. A managed/invisible Turnstile widget is
  mounted in the block and solves on click, producing the `token` the Edge Function
  requires. One deliberate action per lookup — cleanest abuse story, and reuses the
  existing hosted-CDN Turnstile loader pattern from `Questionnaire.tsx` /
  `TurnstileWidget.tsx` (see `turnstile-no-npm-wrapper.md` — never add the npm wrapper).
- **D-02:** **No auto-fire on the 6th digit.** Validation of the `/^\d{6}$/` format is
  inline/instant, but the network call only happens on the explicit button press.

### Placement & Disclosure
- **D-03:** **Always-visible, below the price/variant selector.** A distinct
  "Delivery" section renders inline after the price + weight-variant selector and
  above the "Enquire on Instagram" CTA. Always shown (no collapse) for maximum
  discoverability.

### Result Framing (SC4 / DLVR-07)
- **D-04:** **Cost = exact `₹X`** (the engine already rounds up to ₹10 — UI adds only
  the `₹` prefix + thousands separators, NO rounding in UI per Phase 6 D-13), shown
  with an inline **"Estimated — final may vary"** note.
- **D-05:** **ETA = "X–Y working days"** range (the engine returns `etaDays:{min,max}`
  already including dispatch lead). Framed as working days excluding
  weekends/holidays, anchored to IST.
- **D-06:** **COD** shown as a clear **yes/no line** driven by `codAvailable`.
- **D-07:** **Unconfigured origin (`originConfigured: false`, i.e. placeholder
  `000000` until Phase 9):** STILL display the computed numbers, but surface a soft
  **"estimates are provisional"** banner/note. Do not hide the estimate — the numbers
  aid testing now and the banner sets expectations until Phase 9 sets the real origin.

### Prefill / Re-open Behavior
- **D-08:** **Prefill the saved pincode, require a fresh button press.** On modal
  open, the saved pincode (from `DeliveryProvider`/localStorage) prefills the field,
  but the **result stays hidden until the customer presses "Check delivery" again** —
  so no Turnstile call fires on every modal open. Consistent with D-01.
- **D-09:** **Note — the estimate is currently identical across all products.** Because
  no product carries a numeric weight (Phase 6 D-10), every lookup uses the same 250g
  fallback, so cost/ETA are the same for every product at a given pincode. The block is
  still built per-product (correct once DLVR-F2 adds per-variant weight); the cache key
  `(origin, dest, 250-band)` naturally dedupes.

### Weight Handling (SC2)
- **D-10:** **Client omits `weightG`** (or sends nothing) — the Edge Function then
  falls back to `delivery_default_weight_g` (250g) server-side. The free-text variant
  label ("70gm") is **NEVER** parsed for grams (Phase 6 D-10 / Pitfall 9). "Uses the
  product's weight where available" resolves to "always the admin default" until a real
  weight column exists (DLVR-F2, deferred).

### DeliveryProvider Scope
- **D-11:** **Build the FULL `DeliveryProvider` now.** Phase 7 lands the complete
  context (chosen pincode state + localStorage persistence) + `useDelivery` (read/set
  pincode) + `useDeliveryEstimate` (Turnstile-gated invoke of `delivery-estimate`,
  React-Query-cached) as the single site-wide source of truth. Phase 8 adds only the
  navbar UI on top — no refactor of this layer. Mount `DeliveryProvider` at the app root
  (alongside `AuthProvider`).

### Free-Ship Messaging
- **D-12:** **Build the "Free over ₹X" static messaging now, render only when set.**
  The `delivery_free_ship_threshold` site_content key is seeded off/null until Phase 9,
  so nothing renders today — but the display path is wired so Phase 9 adds the value with
  no Phase 7 rework. No cart progress bar (there is no cart in v1.1).

### Every-State Handling (SC3 / DLVR-06)
- **D-13:** Four distinct states, each visually clear: (a) **loading skeleton** during
  the invoke; (b) **invalid pincode format** — inline field error, no network call;
  (c) **non-serviceable** pincode — clean "we don't deliver here yet" message from the
  `serviceable:false` result; (d) **fetch failure** — error message with a **retry**
  affordance (re-press). Map function error codes: `bad_request` (400) → treat as invalid
  format, `captcha_failed` (400) → retry, network/timeout/5xx → retry.

### Claude's Discretion
- Exact component file names/locations for the block, provider, and hooks (follow
  existing conventions — `client/src/delivery/` or `client/src/components/` + `lib/`,
  PascalCase components, `use*` hooks).
- Exact copy wording for the estimate note, provisional banner, non-serviceable, and
  error states (a UI-SPEC via `/gsd-ui-phase` may refine these — this phase has a
  **UI hint: yes**).
- React-Query cache key shape and staleTime for `useDeliveryEstimate` (mirror
  `siteContent.ts` / `catalog.ts` conventions).
- localStorage key name for the persisted pincode (keep it namespaced/stable so Phase 8
  reads the same key).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 7: Product Detail Delivery Estimator" — goal, 5 success
  criteria, and the v1.1 milestone scope guardrail (zone-weight table is the ONLY rate
  source; live courier API DLVR-F1 and per-variant weight DLVR-F2 are deferred).
- `.planning/REQUIREMENTS.md` — DLVR-06 (all states handled), DLVR-07 (labeled as
  estimate), DLVR-08 (product-detail estimator w/ weight fallback) — the three
  requirements this phase delivers.

### Upstream phase (the engine this phase consumes)
- `.planning/phases/06-estimate-engine-delivery-schema-settings-edge-function/06-CONTEXT.md`
  — the LOCKED engine decisions: rounded-integer cost (D-11/D-13), 250g fallback + no
  label parsing (D-10), placeholder origin `000000` → Phase 9 (D-18), normalized
  `{ serviceable, cost, etaDays, codAvailable }` contract (D-03), Turnstile posture (D-21).
- `supabase/functions/delivery-estimate/index.ts` — the DEPLOYED contract this phase
  calls. Request body `{ token, destPincode, weightG? }`; validates `/^\d{6}$/` before
  compute; requires a valid Turnstile `token` (`captcha_failed` 400 otherwise); response
  `{ serviceable, cost, etaDays:{min,max}|null, codAvailable, originConfigured, zone }`
  (`zone` is internal — do not surface it).

### Codebase patterns to clone
- `client/src/auth/AuthProvider.tsx` — the exact context/provider shape to mirror for
  `DeliveryProvider` (createContext + typed value + `useX` hook that throws outside
  provider; mounted at app root).
- `client/src/lib/questionnaire.ts` (`submitQuestionnaire` + `supabase.functions.invoke`)
  and `client/src/pages/Questionnaire.tsx` / `client/src/components/auth/TurnstileWidget.tsx`
  + `client/src/lib/turnstile.ts` — the EXACT Turnstile-token → Edge-Function-invoke
  pattern to reuse for `useDeliveryEstimate`.
- `client/src/lib/catalog.ts` + `client/src/lib/siteContent.ts` — React-Query fetch/hook
  conventions (query keys, mappers) to mirror for the estimate hook and any site_content
  reads (free-ship threshold, COD copy).
- `client/src/components/ProductDetail.tsx` — the modal the block is inserted into
  (price line ~L195, variant selector, Instagram CTA); insert the Delivery section
  between the variant selector and the CTA.

### Live-ops / infra
- Memory `turnstile-no-npm-wrapper.md` — reuse the hosted-CDN `loadTurnstile()` loader;
  never add `@marsidev/react-turnstile` (global type collision).
- Memory `supabase-live-ops.md` — only relevant if the Edge Function needs a redeploy
  (it should NOT — Phase 7 consumes it as-is).

[No standalone ADR/SPEC docs exist for this phase — requirements fully captured in the
decisions above + the Phase 6 context + the deployed function contract.]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthProvider.tsx`: direct structural template for `DeliveryProvider` (context +
  provider + `useDelivery` hook). Mount alongside it at the app root.
- Turnstile stack (`turnstile.ts` loader, `TurnstileWidget.tsx`, the
  `submitQuestionnaire` invoke) → clone for the Turnstile-gated `useDeliveryEstimate`.
- `siteContent.ts` / `catalog.ts` React-Query patterns → the estimate hook + free-ship
  threshold read ride these conventions (`['siteContent']` key already exists).
- `formatPrice` (`client/src/lib/format.ts`) → `₹` + thousands-separator formatting;
  do NOT re-round (engine already rounded).

### Established Patterns
- Edge Function invoked via `supabase.functions.invoke("<fn>", { body })` with a
  Turnstile `token` in the body (questionnaire pattern) — `useDeliveryEstimate` mirrors
  this exactly, swapping in `delivery-estimate` and `{ token, destPincode }`.
- ProductDetail is a controlled `Dialog` (open/onClose props from the grid); the block
  lives inside `DialogContent`, resets with the product via the existing `useEffect`.
- Provider-at-root + `useX()`-throws-outside-provider convention from `AuthProvider`.

### Integration Points
- `DeliveryProvider` mounts at the app root (`client/src/App.tsx` / `main.tsx`) so the
  same pincode/context is available to Phase 8's navbar widget with no refactor.
- localStorage key (Claude's discretion, but stable/namespaced) is the shared handoff to
  Phase 8; `profiles.default_pincode` column already exists (Phase 6) but is written/read
  by Phase 8, NOT Phase 7.
- The block reads `codAvailable`/`cost`/`etaDays`/`originConfigured` straight from the
  function response; `site_content` free-ship threshold read is additive.

</code_context>

<specifics>
## Specific Ideas

- The estimate must read as an **estimate, not a promise**: exact `₹X` (engine-rounded)
  with an inline "Estimated — final may vary" note, ETA as an "X–Y working days" range,
  COD a clear yes/no.
- Until Phase 9 configures the real dispatch origin, numbers still show but under a soft
  "estimates are provisional" banner (origin is the fake `000000` placeholder) — better
  than hiding the feature or showing plausible-but-wrong numbers with no caveat.
- Because all products share the 250g fallback weight, the per-product estimate is
  currently identical everywhere — acceptable; the per-product wiring is correct for the
  future DLVR-F2 weight column.

</specifics>

<deferred>
## Deferred Ideas

- **Navbar "Deliver to [pincode]" widget + cross-modal/site-wide sharing UI** — Phase 8
  (the `DeliveryProvider` built here is the foundation it plugs into).
- **Profile / cross-device pincode sync** (`profiles.default_pincode`) — Phase 8.
- **Admin editing** of origin pincode, default weight, dispatch lead, COD rules, and the
  free-ship threshold value — Phase 9.
- **Zone-weight slab rate editing** — Phase 10.
- **Per-variant numeric weight column** (real per-product weight → accurate per-product
  estimates) — DLVR-F2, post-launch.
- **Cart-based free-shipping progress bar** — no cart exists in v1.1; only static
  "free over ₹X" messaging is in scope (and only once Phase 9 sets the threshold).

None of the above were pulled into scope — discussion stayed within the Phase 7 boundary.

</deferred>

---

*Phase: 7-product-detail-delivery-estimator*
*Context gathered: 2026-07-02*
