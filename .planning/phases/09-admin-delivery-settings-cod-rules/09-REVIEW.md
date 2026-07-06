---
phase: 09-admin-delivery-settings-cod-rules
reviewed: 2026-07-06T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - client/src/App.tsx
  - client/src/lib/admin.ts
  - client/src/lib/codRules.test.ts
  - client/src/lib/codRules.ts
  - client/src/lib/delivery.test.ts
  - client/src/lib/delivery.ts
  - client/src/lib/pincodes.test.ts
  - client/src/lib/pincodes.ts
  - client/src/lib/siteContent.ts
  - client/src/pages/admin/AdminLayout.tsx
  - client/src/pages/admin/Delivery.tsx
  - client/src/pages/admin/deliverySchema.test.ts
  - client/src/pages/admin/deliverySchema.ts
  - supabase/functions/delivery-estimate/index.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-07-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the admin delivery-settings page, the COD/pincode/delivery pure-logic
libraries and their tests, and the security-sensitive `delivery-estimate` edge
function (server-side admin detection gating Turnstile, admin origin override,
and the service-role cache-purge branch).

The security-critical paths hold up under scrutiny. Admin detection derives
`isAdmin` from a server-verified JWT (`admin.auth.getUser(jwt)` + `profiles.role`
lookup) and never from a body field; the purge branch 403s any non-admin before
touching the cache; the origin override and Turnstile-skip are both correctly
gated behind `isAdmin`; and a logged-out caller (anon key, no user) safely
defaults to non-admin. No injection, secret-leak, or authorization-bypass defect
was found in the edge function.

The defects are correctness/robustness issues concentrated in the admin UI
(`Delivery.tsx`) and one robustness gap in the edge function's timeout coverage.
No BLOCKER-level defect was proven, but four WARNINGs degrade correctness of the
preview/save UX and one weakens the DoS-timeout guarantee the function claims.

## Warnings

### WR-01: Preview line renders the live `testDest` input, not the value the estimate was computed for

**File:** `client/src/pages/admin/Delivery.tsx:113-131, 388-392`
**Issue:** `handlePreview` snapshots the origin at request time
(`setPreviewOrigin(originValue)`) but the destination is read **live** from
`testDest` state when rendering: `formatPreviewLine(previewOrigin, testDest, previewResult)`.
After a preview resolves, the owner can edit the "Test against pincode" input;
the displayed line then pairs the **new** destination string with the **old**
result object (cost/ETA/serviceability computed for the previous destination),
producing a silently incorrect estimate line. Origin was deliberately captured to
avoid exactly this class of bug; destination was missed.
**Fix:** Capture the destination alongside the origin at request time and render
from the captured copy:
```tsx
const [previewDest, setPreviewDest] = useState("");
// in handlePreview, after a successful previewDelivery(...):
setPreviewOrigin(originValue);
setPreviewDest(testDest);
setPreviewResult(result);
// in JSX:
{previewResult && !previewError && (
  <p className="text-sm">
    {formatPreviewLine(previewOrigin, previewDest, previewResult)}
  </p>
)}
```

### WR-02: Stale `serviceability` state lets Save enable/persist a mismatched or non-serviceable origin

**File:** `client/src/pages/admin/Delivery.tsx:95-111, 340`
**Issue:** `originValid` gates Save on `serviceability?.serviceable === true`, but
`serviceability` is only refreshed on the origin input's `onBlur`. `originValid`
re-tests the **current** `originValue` with the regex while reusing the **stale**
serviceability that was fetched for a *different* pincode. Sequence: owner blurs
on a serviceable pincode (serviceability=serviceable), then edits to a different
valid-format pincode that is *not* serviceable without blurring again — Save stays
enabled and `onSubmit` persists the new, unserviceable origin. Because the server
never validates origin serviceability (edge `callCourierAdapter` falls back to the
`national` zone for an origin absent from the directory and still writes cache),
the public estimator then silently serves degraded `national`-zone estimates for
every destination. The serviceability gate — the whole point of D-10 — is
defeated.
**Fix:** Invalidate `serviceability` whenever the origin value changes (so it must
be re-verified before Save re-enables), e.g. reset it in the field's `onChange`:
```tsx
{...register("originPincode", {
  onChange: () => setServiceability(null),
  onBlur: (e) => handleOriginBlur(e.target.value),
})}
```

### WR-03: Save is disabled after prefill until manual blur, and any transient lookup failure permanently blocks Save

**File:** `client/src/pages/admin/Delivery.tsx:76-98, 100-111, 340, 350-354`
**Issue:** On load, `serviceability` starts `null` and no serviceability check is
triggered for the prefilled origin, so even a valid, already-serviceable saved
origin leaves Save disabled with the misleading helper text "Set a real,
serviceable 6-digit origin pincode to enable saving." Compounding this,
`checkServiceable` swallows lookup errors and returns
`{ known:false, serviceable:false }` on any network/RLS failure — so a transient
failure sets `serviceability.serviceable === false` and blocks Save indefinitely
with no error surfaced to the owner.
**Fix:** Run the serviceability check once after prefill resolves (call
`handleOriginBlur(keyValue(data,"delivery_origin_pincode"))` in the prefill
`useEffect`), and distinguish a lookup *error* from a genuine non-serviceable
result so a transient failure does not hard-block Save (e.g. surface a retry
state rather than folding the error into `serviceable:false`).

### WR-04: Turnstile siteverify fetch is not bounded by the request timeout

**File:** `supabase/functions/delivery-estimate/index.ts:427-451`
**Issue:** The header comment and inline note (SC3 / Pitfall 7) claim "Bound all
upstream work with an AbortController timeout so a hung dependency cannot stall
the request." But the `AbortController` + `setTimeout(..., 8000)` are created
**after** the Turnstile `fetch` to `challenges.cloudflare.com/.../siteverify`, and
that fetch passes no `signal`. A hung/slow Cloudflare siteverify call therefore
has no timeout and can stall the request for the full public (non-admin) path —
precisely the DoS vector the timeout was meant to close.
**Fix:** Create the `AbortController`/timeout before the Turnstile call and pass
`signal: ac.signal` to the siteverify `fetch` (or wrap it in its own timeout), so
every outbound dependency is bounded.

## Info

### IN-01: Client vs. server COD-default divergence contradicts the "identical tolerance" contract

**File:** `client/src/lib/codRules.ts:29-42`, `client/src/lib/siteContent.ts:41`, `supabase/functions/delivery-estimate/index.ts:215-225`
**Issue:** `codRules.ts` documents parse tolerance as "deliberately IDENTICAL" to
the edge function, but the defaults diverge: (a) when the `delivery_cod_rules`
key is absent, the client fallback `SITE_CONTENT_DEFAULTS.delivery_cod_rules`
resolves COD **enabled:true** while the edge `readSettings` absent-default is
`{ enabled: false }`; (b) client `parseCodRules` coerces a missing `fee` to `0`,
edge leaves `fee` `undefined`. Both are inert today because migration 0014 seeds
the key and `fee` is unused in the server compute, but the divergence is a latent
trap if the seed row is ever missing.
**Fix:** Align the two absent-key defaults (both COD-off, or both COD-on) and
normalize `fee` identically, or soften the "identical" comment to state the fee
field is server-unused.

### IN-02: `delivery_free_ship_threshold` is read but never applied to any estimate

**File:** `supabase/functions/delivery-estimate/index.ts:227-240`, `client/src/pages/admin/Delivery.tsx:164-168, 313-338`
**Issue:** `readSettings` parses `freeShipThreshold` into `DeliverySettings`, but
`callCourierAdapter` never consults it — the returned `cost` never reflects free
shipping. Meanwhile the admin page copy states "Set your shipping origin, parcel
defaults, cash-on-delivery rules and free-shipping threshold. Changes apply to
delivery estimates immediately." An owner setting a threshold will see no effect
on estimates (the estimate has no order value to compare against), which is
misleading.
**Fix:** Either wire the threshold into the estimate (once an order value is
available) or adjust the admin copy to clarify the threshold is stored for a
later milestone and does not alter the per-pincode estimate.

### IN-03: Redundant re-parse in `onSubmit`

**File:** `client/src/pages/admin/Delivery.tsx:133-135`
**Issue:** `onSubmit` receives values already validated by the `zodResolver`, then
calls `deliverySchema.parse(values)` again. The comment justifies it as recovering
the output type, but it re-runs the full schema (including `superRefine`) on every
save for a typing convenience.
**Fix:** Type the handler with `z.output<typeof deliverySchema>` (or
`DeliveryValues`) and drop the second `parse`, since the resolver guarantees the
values are already parsed.

### IN-04: Preview failure always shows generic retry copy, even for a server-side format rejection

**File:** `client/src/pages/admin/Delivery.tsx:113-131`
**Issue:** `handlePreview` catches all `previewDelivery` errors into a single
generic message ("Couldn't fetch a preview. Try again."), discarding the
`EstimateError.code`. A `bad_request`/`invalid-format` outcome (server-side format
re-validation) is indistinguishable from a transient `retry`, so the owner gets
retry guidance for an input that will never succeed on retry.
**Fix:** Branch on the caught `EstimateError.code` and show the invalid-format
guidance for `"invalid-format"` versus the retry copy for `"retry"`.

---

_Reviewed: 2026-07-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
