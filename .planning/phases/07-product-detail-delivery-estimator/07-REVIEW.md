---
phase: 07-product-detail-delivery-estimator
reviewed: 2026-07-04T17:01:11Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - client/src/App.tsx
  - client/src/components/delivery/DeliveryEstimate.tsx
  - client/src/components/ProductDetail.tsx
  - client/src/delivery/DeliveryProvider.tsx
  - client/src/delivery/useDelivery.ts
  - client/src/lib/delivery.test.ts
  - client/src/lib/delivery.ts
  - client/src/lib/format.test.ts
  - client/src/lib/format.ts
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-04T17:01:11Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the product-detail delivery estimator: the Edge Function invoke wrapper +
React Query mutation (`delivery.ts`), the pincode context/provider with localStorage
persistence (`DeliveryProvider.tsx` / `useDelivery.ts`), the `formatPrice` helper
(`format.ts`), and the five-state estimate UI block (`DeliveryEstimate.tsx`) wired
into `ProductDetail.tsx`.

No security vulnerabilities or crash-class defects were found. There are no
client-side secrets (only the single-use Turnstile token and pincode are sent to the
Edge Function), all dynamic values are rendered as text (no XSS surface), and the
localStorage access is correctly try/catch-guarded. The `ProductDetail.tsx` change is
minimal (import + keyed render) and the pre-existing `instagramUrl` href is untouched
by this phase, so it is out of scope.

The findings cluster around **UI state-machine correctness** in `DeliveryEstimate.tsx`:
several state flags (`formatError`, `tokenMissing`, the persisted mutation `data`) are
never cleared on the events that logically invalidate them, so the block can display
contradictory states simultaneously (e.g. an inline "invalid pincode" error above a
stale serviceable result panel). None are blockers, but they degrade the five-state UX
the phase is specifically built to deliver.

## Warnings

### WR-01: Stale result panel renders alongside the invalid-format message

**File:** `client/src/components/delivery/DeliveryEstimate.tsx:92-95, 193`
**Issue:** `handleCheck` early-returns on an invalid pincode without calling `mutate`.
Because React Query `useMutation` only mutates its state when `mutate` is invoked, the
previous successful lookup's `data` (`result`) persists. The result gate is
`{result && !isPending && (...)}` (line 193), which stays true. So after a valid
lookup shows a serviceable panel, clearing the input (or typing a bad value) and
pressing "Check delivery" renders BOTH the "Enter a valid 6-digit pincode." message
(line 162) AND the stale delivery panel below it — two contradictory states at once.
**Fix:** Clear the prior result when entering the format-guard branch, e.g. call the
mutation's `reset` (already exposed by `useDeliveryEstimate`) before returning:
```tsx
const { data: result, isPending, error, mutate, reset } = useDeliveryEstimate();
// ...
if (!PINCODE_RE.test(destPincode)) {
  setFormatError(true);
  reset(); // drop the stale result so it doesn't render under the error
  return;
}
```

### WR-02: `formatError` never cleared on input change — stale error while correcting

**File:** `client/src/components/delivery/DeliveryEstimate.tsx:137, 84`
**Issue:** The `onChange` handler (line 137) only updates `value`; it never clears
`formatError`. Once the user submits an invalid pincode, `isInvalidFormat` stays true
and "Enter a valid 6-digit pincode." remains visible while the user is actively typing
a valid correction, until they press the button again. The message contradicts the
now-valid input.
**Fix:** Reset the format flag as the user edits:
```tsx
onChange={(e) => {
  setValue(e.target.value.replace(/\D/g, ""));
  if (formatError) setFormatError(false);
}}
```

### WR-03: `tokenMissing` message persists after verification completes

**File:** `client/src/components/delivery/DeliveryEstimate.tsx:99-103, 154-156, 167`
**Issue:** When the user presses Check before Turnstile has solved, `tokenMissing` is
set true and "Please complete the verification check and try again." renders. It is
only reset inside `handleCheck` (line 89). The `onToken` callback (line 154) that
receives the freshly solved token does not clear `tokenMissing`, so the prompt lingers
even after the widget has produced a valid token, until the user presses Check again.
**Fix:** Clear the flag when a token arrives:
```tsx
onToken={(t) => {
  tokenRef.current = t;
  setTokenMissing(false);
}}
```

### WR-04: Serviceable result with `cost === null` renders "Price on request"

**File:** `client/src/components/delivery/DeliveryEstimate.tsx:209-211`
**Issue:** The delivery cost is rendered with the product `formatPrice` helper, whose
null-branch copy is "Price on request" (`format.ts:12`). `DeliveryEstimateResult.cost`
is typed `number | null` (`delivery.ts:25`). If the Edge Function ever returns a
serviceable pincode with `cost: null` (e.g. a future free-delivery / not-yet-priced
case), the panel displays "Price on request" as the delivery charge — semantically
wrong copy for shipping, and misleading next to the "Estimated — final delivery charge
may vary." disclaimer.
**Fix:** Guard the cost line on a non-null cost (mirroring the `etaDays` guard on line
217), or use delivery-specific fallback copy rather than the product `formatPrice`
null branch. E.g. `{result.cost != null && (<span>{formatPrice(result.cost)}</span>)}`.

### WR-05: Consumed Turnstile token not cleared on widget reset — "Try again" can replay a spent token

**File:** `client/src/components/delivery/DeliveryEstimate.tsx:109-117, 154-156`
**Issue:** After every settled invoke, `onSettled` calls `turnstileRef.current?.reset()`
to issue a fresh single-use token. But `tokenRef.current` still holds the just-consumed
token until Turnstile asynchronously solves the new challenge and fires `onToken`. If
the user presses "Try again" in the window before the new token is solved, `handleCheck`
reads the stale consumed token (line 98), passes the `if (!token)` guard, and invokes
with a spent token → server `captcha_failed` → another retry error. The retry path can
loop on a timing race.
**Fix:** Null out the token ref at reset time so a premature retry hits the
`tokenMissing` guard instead of replaying a spent token:
```tsx
onSettled: () => {
  tokenRef.current = null;
  turnstileRef.current?.reset();
},
```

### WR-06: Edge Function response consumed via unchecked `as` cast — no shape validation

**File:** `client/src/lib/delivery.ts:83`
**Issue:** On the success branch, `return data as DeliveryEstimateResult` trusts the
invoke payload with a bare type assertion and no runtime validation. If `data` is null
or an unexpected shape (a real possibility across an HTTP boundary / function version
skew), `result.serviceable` is `undefined` (falsy), silently routing the user to the
non-serviceable "we don't deliver to this pincode yet" line instead of an error — a
misleading outcome from what is actually a malformed response. The codebase already
uses Zod elsewhere; the boundary here is unvalidated.
**Fix:** Validate the payload before returning (Zod `safeParse`, or at minimum a
`typeof data.serviceable === "boolean"` check), throwing `EstimateError("retry")` on a
malformed body so it surfaces as the retriable failure state rather than a false
"not serviceable".

## Info

### IN-01: Non-serviceable pincode is persisted as the site-wide "deliver to" value

**File:** `client/src/components/delivery/DeliveryEstimate.tsx:108`
**Issue:** `onSuccess: () => setPincode(destPincode)` persists the pincode to
localStorage for any successful invoke, including a `serviceable: false` response.
Phase 8's navbar widget reads the same key (D-11), so it would surface a pincode the
brand does not deliver to as the customer's saved destination.
**Fix:** Consider persisting only on `result.serviceable`, or confirm with the D-11
spec that persisting non-serviceable pincodes is intended.

### IN-02: `estimateDelivery` can return null on a `{ data: null, error: null }` response

**File:** `client/src/lib/delivery.ts:69-83`
**Issue:** If the invoke resolves with neither `data` nor `error`, the function returns
`null` (cast to the result type). Downstream `{result && ...}` treats it as "no result
yet" with no error and no pending state — a silent dead-end for the user. Low
likelihood, but overlaps with WR-06's fix (validating the success payload closes this
gap too).
**Fix:** Fold into the WR-06 validation: treat a null/invalid `data` on the success
branch as `EstimateError("retry")`.

---

_Reviewed: 2026-07-04T17:01:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
