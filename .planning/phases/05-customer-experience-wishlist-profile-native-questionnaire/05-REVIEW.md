---
phase: 05-customer-experience-wishlist-profile-native-questionnaire
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - client/src/App.tsx
  - client/src/auth/AuthGuard.tsx
  - client/src/components/Navbar.tsx
  - client/src/components/ProductCard.tsx
  - client/src/components/ProductDetail.tsx
  - client/src/components/WishlistButton.tsx
  - client/src/lib/profile.ts
  - client/src/lib/questionnaire.test.ts
  - client/src/lib/questionnaire.ts
  - client/src/lib/submissions.test.ts
  - client/src/lib/submissions.ts
  - client/src/lib/turnstile.ts
  - client/src/lib/wishlist.test.ts
  - client/src/lib/wishlist.ts
  - client/src/pages/admin/Submissions.tsx
  - client/src/pages/Profile.tsx
  - client/src/pages/Questionnaire.tsx
  - client/src/pages/Wishlist.tsx
  - supabase/config.toml
  - supabase/functions/verify-and-submit/index.ts
  - supabase/migrations/0007_submissions_insert_policy.sql
  - supabase/tests/submissions_insert_assertions.sql
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the Phase 5 customer-experience slice: wishlist (optimistic cache),
native Turnstile-gated questionnaire (Edge Function + RLS), profile self-update
flows, and the admin/own submissions inbox. The RLS ownership invariant in
migration 0007 and the structural assertions are correct, and the Edge Function
correctly uses the caller's JWT with the anon key (never service-role) so the
`WITH CHECK` is the real gate. The open-redirect chain is ultimately safe
because `Login` re-sanitizes via `safeReturnTo`.

The one Critical concerns the Edge Function inserting an entirely
client-controlled object with no field allow-listing — RLS protects `user_id`
ownership, but every other column (including timestamps and arbitrary jsonb
size) is attacker-controlled, and a column-name mismatch surfaces a raw
Postgres error string to the client. The remaining findings are robustness and
consistency issues in the optimistic cache, the AuthGuard `next` sanitization
inconsistency, and the email-update flow.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Edge Function inserts unvalidated, fully client-controlled object

**File:** `supabase/functions/verify-and-submit/index.ts:66, 100-108`
**Issue:** After the Turnstile check passes, the function does
`.from('customization_submissions').insert(submission)` where `submission` is
the raw, unparsed JSON body from the client. There is no schema validation, no
field allow-list, and no size bound. RLS migration 0007 only constrains
`user_id` ownership — it does **not** constrain any other column. Consequences:

- An authenticated (or anon) caller can set arbitrary values on any other
  writable column the table exposes (e.g. `created_at`, `skin_type`, `name`,
  `email`, and an unbounded `payload` jsonb), independent of what the wizard
  UI collects. The server is a pure pass-through.
- The body is parsed once via `req.json()` with no type guard; a non-object
  `submission` (string/array/null) reaches PostgREST and is reflected back as a
  raw error.
- On insert error the function returns `error.message` verbatim
  (line 104) — this leaks internal Postgres/PostgREST detail (column names,
  constraint text) to any origin that can reach the function.

**Fix:** Validate and allow-list `submission` server-side before insert, and do
not echo raw DB errors. Minimal hardening:
```ts
const ALLOWED = new Set(['name', 'email', 'skin_type', 'message', 'payload', 'user_id'])
if (typeof submission !== 'object' || submission === null || Array.isArray(submission)) {
  return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: jsonHeaders })
}
const clean: Record<string, unknown> = {}
for (const k of Object.keys(submission)) {
  if (ALLOWED.has(k)) clean[k] = (submission as Record<string, unknown>)[k]
}
// optionally: enforce string types + max lengths, and bound JSON.stringify(clean.payload).length
const { error } = await supabase.from('customization_submissions').insert(clean)
if (error) {
  console.error('insert failed', error)               // log server-side only
  return new Response(JSON.stringify({ error: 'insert_failed' }), { status: 400, headers: jsonHeaders })
}
```

## Warnings

### WR-01: Turnstile token sent to siteverify without presence/type guard

**File:** `supabase/functions/verify-and-submit/index.ts:66-87`
**Issue:** `token` is destructured from the body and forwarded to siteverify
with no check that it is a non-empty string. Cloudflare returns
`success: false` for a missing/empty/invalid token, so the happy path is safe,
but a missing `token` (e.g. `undefined`) still triggers a full outbound
siteverify round-trip, and the verify fetch itself is unguarded — if the
siteverify call throws (network), it falls into the outer `catch` and returns a
generic `bad_request`, masking a "human verification temporarily unavailable"
condition as a client error.
**Fix:** Early-return 400 when `typeof token !== 'string' || token.length === 0`,
and wrap the siteverify fetch so a transport failure returns a distinct
`captcha_unavailable`/`503` rather than the generic 400.

### WR-02: AuthGuard builds `?next=` with a weaker sanitizer than the documented one

**File:** `client/src/auth/AuthGuard.tsx:43-44`
**Issue:** The guard's own JSDoc says the remembered value is "an internal
leading-slash path only," but the implementation only checks
`location.startsWith("/")`. That accepts protocol-relative paths like
`//evil.com`, which `safeReturnTo` (the audited sanitizer in `Login.tsx:44`)
explicitly rejects. The open redirect is ultimately neutralized because
`Login.onSubmit` re-runs `safeReturnTo(next)` before navigating, so this is not
exploitable today — but it relies on a second component remembering to
re-sanitize, and `WishlistButton.tsx:51` correctly uses `safeReturnTo(location)`
for the identical purpose. The two call sites should be consistent.
**Fix:** Use the shared sanitizer here too:
```ts
import { safeReturnTo } from "@/pages/Login";
// ...
const next = safeReturnTo(location);
return <Redirect to={`/login?next=${encodeURIComponent(next)}`} />;
```

### WR-03: Optimistic wishlist toggle has no in-flight guard (double-click races)

**File:** `client/src/lib/wishlist.ts:115-177`; `client/src/components/WishlistButton.tsx:54`; `client/src/pages/Wishlist.tsx:97-103`
**Issue:** `handleClick`/remove buttons call `toggle.mutate(...)` with no guard
against a mutation already in flight. A fast double-tap on the heart fires two
mutations with the same `saved` snapshot: two inserts (the DB likely has a
unique constraint so the second 400s and rolls the optimistic state back via
`onError`, producing a confusing flash), or insert-then-insert / remove races
where `onMutate`'s `prev` snapshot from the second call captures the
already-mutated optimistic list, so an `onError` rollback restores the wrong
baseline.
**Fix:** Disable the toggle while pending (`disabled={toggle.isPending}` on the
button) or short-circuit in the handler when `toggle.isPending`.

### WR-04: `resolveProductId().single()` throws an opaque error when slug is unknown

**File:** `client/src/lib/wishlist.ts:91-99, 121, 130`
**Issue:** `resolveProductId` uses `.single()`, which errors if the slug
matches zero rows (e.g. a product was deleted/renamed in admin while the card
still shows the old slug). On the insert path this surfaces through
`mapWriteError` as a generic toast, but the optimistic stub was already
appended in `onMutate` and is only reconciled on `onSettled` invalidate — the
user briefly sees a "saved" heart that then vanishes. On the un-cached delete
path the same throw blocks removal entirely.
**Fix:** Use `.maybeSingle()` and throw a typed "product not found" the UI can
message specifically, or resolve the UUID before the optimistic update so the
stub is never shown for an unresolvable slug.

### WR-05: Profile email/name forms can submit a value identical to the current one

**File:** `client/src/lib/profile.ts:79-89`; `client/src/pages/Profile.tsx:184-219`
**Issue:** `useUpdateEmail` calls `supabase.auth.updateUser({ email })`
unconditionally. The email form is seeded with `user.email`, so a user who
clicks "Update email" without changing anything triggers a GoTrue email-change
flow for the same address and shows the "check your inbox to confirm" pending
notice — a confusing no-op that consumes the rate-limited confirmation-email
budget (`config.toml` `email_sent = 2`/hour). Same class of issue for the name
form re-saving an unchanged name.
**Fix:** Skip the mutation when the submitted value equals the current value
(`if (email === user.email) return;`) and surface a "no change" message, or
disable submit until the field is dirty (`!emailForm.formState.isDirty`).

### WR-06: Anon submitter's stale Turnstile token never re-validated client-side after expiry

**File:** `client/src/pages/Questionnaire.tsx:170-194`
**Issue:** `handleSubmit` reads `turnstileToken.current` once. Turnstile tokens
are single-use and expire (~300s); the `expired-callback` nulls the ref, so an
expired token is caught by the `if (!token)` guard. But after a *successful*
submit the user can navigate Back from the thank-you step is not possible
(THANKYOU_STEP has no back), so that's fine — however on a *failed* submit
`resetTurnstile()` resets the widget but the user may submit again before the
new callback fires, sending a now-consumed/!ready token; the server rejects
with `captcha_failed` but the client toast says "check your connection," which
misattributes the failure.
**Fix:** Distinguish the Edge Function's `captcha_failed` 400 from a transport
error in `submitQuestionnaire` (inspect the error/response body) and show the
human-verification copy in that case; gate the submit button until
`turnstileToken.current` is non-null.

## Info

### IN-01: Edge Function `corsHeadersFor` falls back to production origin for disallowed origins

**File:** `supabase/functions/verify-and-submit/index.ts:42-53`
**Issue:** A request from a non-allow-listed origin still receives
`Access-Control-Allow-Origin: https://sutravan.in`. This is harmless (the
browser will block the cross-origin read because the echoed origin won't match
the requester), but returning no ACAO header (or a deliberately invalid one)
for disallowed origins is clearer intent.
**Fix:** When `origin` is non-null and not allow-listed, omit
`Access-Control-Allow-Origin` entirely rather than substituting the prod origin.

### IN-02: `toWishlistItem` typed `any` defeats the strict-mode contract

**File:** `client/src/lib/wishlist.ts:51`
**Issue:** `export function toWishlistItem(row: any)` opts out of type checking
at the PostgREST boundary in a `strict: true` project; a shape drift in the
`.select(...)` join (e.g. `categories` returned as an array) would not be caught
at compile time and would throw at `product.categories?.slug` only at runtime.
**Fix:** Type the row with a narrow interface matching the select projection
(`{ products: { id: string; slug: string; ...; categories: { slug: string } | null } }`).

### IN-03: Dead/decorative table row referencing `COLUMN_COUNT`

**File:** `client/src/pages/admin/Submissions.tsx:34, 179-182`
**Issue:** A `hidden`, `aria-hidden` `<TableRow>` exists solely so the
`COLUMN_COUNT` constant "documents the column set." This is dead markup added to
justify an otherwise-unused constant; the comment even says so.
**Fix:** Remove the constant and the hidden row, or use `COLUMN_COUNT` in a real
`colSpan` (e.g. an empty/loading state) instead of decorative markup.

### IN-04: Duplicated `displayName`/`formatDate`/`Field` helpers across two pages

**File:** `client/src/pages/Profile.tsx:57-77`; `client/src/pages/admin/Submissions.tsx:37-45, 128-137`
**Issue:** `displayName`, `formatDate`, and the `Field` row component are
copy-pasted between the customer history and the admin inbox. `submissionSnippet`
was correctly extracted to `lib/submissions.ts`; these three were not, so a
formatting change must be made in two places.
**Fix:** Move `displayName`/`formatDate` into `lib/submissions.ts` next to
`submissionSnippet`, and lift the shared `Field` into a small shared component.

### IN-05: `useUpdateName` invalidates the broad `["my-profile-name"]` prefix

**File:** `client/src/lib/profile.ts:67`
**Issue:** The mutation invalidates `["my-profile-name"]` without the `userId`
segment used in the query key (`["my-profile-name", userId]`). React Query
prefix-matches so this works, but it also invalidates every user's cached name
if more than one were ever present. Minor; included for precision since the
query key is parameterized.
**Fix:** Invalidate the exact key: `qc.invalidateQueries({ queryKey: ["my-profile-name", userId] })`.

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
