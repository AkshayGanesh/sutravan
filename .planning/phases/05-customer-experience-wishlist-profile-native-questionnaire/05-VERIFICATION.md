---
phase: 05-customer-experience-wishlist-profile-native-questionnaire
verified: 2026-06-01T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Logged-in customer saves and removes products from card, detail modal, and /wishlist page with navbar badge staying in sync"
    expected: "Navbar badge count updates immediately, heart fills/empties on both card and modal (shared cache), /wishlist page reflects changes without page reload"
    why_human: "Optimistic cache sync across multiple surfaces requires a live browser session; vitest cannot simulate the shared TanStack Query cache between ProductCard, ProductDetail, Navbar, and Wishlist page"
  - test: "Logged-out heart tap routes to /login?next=<current> and sign-in toast appears"
    expected: "Toast 'Sign in to save your favourites.' fires, redirect goes to /login?next=<encoded-current-path>; after login, user is returned to the original page"
    why_human: "Requires live browser session with logged-out state; safeReturnTo redirect round-trip cannot be verified without a running app"
  - test: "Questionnaire wizard validates per step before advancing"
    expected: "Empty name or invalid email blocks Continue on step 0; unselected skin type blocks Continue on step 1; step 2 fields are optional but the wizard does not advance without resolving validation errors"
    why_human: "Per-step form validation behavior (trigger + advance gate) requires live interaction with the running wizard"
  - test: "Questionnaire submission with Cloudflare Turnstile lands in admin inbox (anon and logged-in)"
    expected: "Anon submission creates a row with user_id=null, correct payload; logged-in submission creates a row with the caller's user_id; both appear in admin inbox at /admin/submissions with correct skin_type, message, and payload Details"
    why_human: "Requires live Cloudflare Turnstile widget + live Supabase — documented as human-approved in 05-02 and 05-03 SUMMARY blocking-human checkpoints"
  - test: "Profile page: name and password changes apply immediately; email change shows pending notice"
    expected: "After 'Save name' toast 'Name updated.' appears and name persists on refresh; after 'Update password' toast 'Password updated.' appears and new password works on next login; after 'Update email' the UI shows 'Check your inbox to confirm...' NOT a completion message, and current email is unchanged until link is clicked"
    why_human: "Requires live Supabase Auth (GoTrue double-confirmation for email); the pending-vs-completed distinction depends on Secure email change being ON in the live project"
  - test: "Profile submission history is owner-scoped: a different customer sees only their own requests"
    expected: "Customer A sees their submissions; Customer B (separate account) sees only their own submissions; neither can see the other's rows"
    why_human: "Cross-user RLS scoping requires two live customer accounts and a live Supabase session — confirmed in blocking-human checkpoint 05-04 Task 3 during phase execution"
  - test: "Logged-out /profile and /wishlist redirect to /login?next=<path>"
    expected: "Unauthenticated access to /profile redirects to /login?next=%2Fprofile; same for /wishlist; after login the AuthGuard's safeReturnTo delivers the user to the intended page"
    why_human: "AuthGuard redirect behavior requires a live browser session with no session cookie"
---

# Phase 5: Customer Experience Verification Report

**Phase Goal:** Logged-in customers can save products, view their profile and submission history, and submit a native questionnaire that lands in the admin inbox.
**Verified:** 2026-06-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A logged-in customer can tap a heart on a product card or detail modal and it instantly fills (saved) | VERIFIED | `WishlistButton.tsx` uses `useToggleWishlist()` with optimistic `onMutate`; wired to `ProductCard.tsx` (line 30) and `ProductDetail.tsx` (line 101); shared `['wishlist']` cache |
| 2 | A logged-out tap on the heart shows a sign-in toast and routes to /login?next=<current> via safeReturnTo | VERIFIED | `WishlistButton.tsx:44-53` — `e.stopPropagation/preventDefault`, then `toast.error("Sign in to save your favourites.")` + `navigate(/login?next=...)` via `safeReturnTo` |
| 3 | The /wishlist page lists saved products with thumbnails, prices, and a remove control, and is auth-gated | VERIFIED | `Wishlist.tsx` (131 lines) renders image/name/formatPrice/X remove; `App.tsx:57-63` wraps it in `AuthGuard` |
| 4 | The Navbar shows a heart icon with a live count badge (hidden at 0) that stays in sync | VERIFIED | `Navbar.tsx:19` imports `useWishlistCount`; line 167: `{wishlistCount > 0 && <span>...{wishlistCount}</span>}` |
| 5 | Removing an item from /wishlist or un-tapping a heart is instant (optimistic) and reconciles with server | VERIFIED | `useToggleWishlist.onMutate` (wishlist.ts:144-167) cancels queries → snapshots → setQueryData; `onSettled` invalidates; `isPending` guard on both buttons |
| 6 | D-11: Saved items page at /wishlist with grid + remove control + empty state, linked from Navbar | VERIFIED | `Wishlist.tsx` has all states; Navbar.tsx:161-173 has heart link; Navbar.tsx:192,276 has dropdown/mobile entries |
| 7 | Migration 0007 adds anon+auth INSERT policy on customization_submissions with WITH CHECK ownership invariant | VERIFIED | `0007_submissions_insert_policy.sql` — policy `customization_submissions_anon_or_owner_insert` with disjunction: `auth.uid() is null and user_id is null` OR `user_id = (select auth.uid())` |
| 8 | Edge Function verify-and-submit verifies Turnstile, inserts under caller JWT, never service-role | VERIFIED | `verify-and-submit/index.ts:83-111` — siteverify against `TURNSTILE_SECRET_KEY`; `createClient(anon_key, {Authorization: callerHeader})`; no SERVICE_ROLE reference |
| 9 | /questionnaire is a native multi-step wizard replacing the Google Form iframe | VERIFIED | `Questionnaire.tsx` — 516 lines; no `docs.google.com/forms` or `<iframe` found; has `useForm`, `trigger`, `toSubmission`, `loadTurnstile`, "Customize your blend", "Thank you" copy |
| 10 | Logged-in user sees name/email prefilled and read-only; anon user types validated name+email | VERIFIED | `Questionnaire.tsx:89-110` — `useEffect` prefills from `user.email` + profile name; fields rendered `readOnly={isLoggedIn}` with "Using your account details" helper |
| 11 | /profile is auth-gated, shows account info (name/email/password), and submission history | VERIFIED | `Profile.tsx` (468 lines) — `AccountSection` with 3 forms; `HistorySection` using `useMySubmissions()`; `App.tsx:66-71` wraps in `AuthGuard` |
| 12 | Email change shows pending notice, NOT completion toast; name/password apply immediately | VERIFIED | `profile.ts:94-113` — `EmailUpdateResult = "unchanged" | "pending"`; email toast "Check your inbox..."; password toast "Password updated." (immediate); Profile.tsx:213-217 renders pending notice |

**Score:** 12/12 truths verified

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| CUST-01 | Customer can save (wishlist) a product | SATISFIED | `WishlistButton.tsx` + `useToggleWishlist` + ProductCard/ProductDetail wiring + `wishlists` RLS |
| CUST-02 | Customer can view and manage their wishlist | SATISFIED | `/wishlist` page (Wishlist.tsx) + AuthGuard + Navbar badge + remove control |
| CUST-03 | Customer can submit a native questionnaire replacing the Google Form | SATISFIED | `Questionnaire.tsx` native wizard + `questionnaire.ts` schema + `verify-and-submit` Edge Function + migration 0007 |
| CUST-04 | Customer can view profile and history of own customization submissions | SATISFIED | `Profile.tsx` (account management + inline history) + `useMySubmissions` (owner-scoped by RLS) + `profile.ts` mutations |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/auth/AuthGuard.tsx` | Generic customer route guard | VERIFIED | 53 lines; `safeReturnTo` used (WR-02 fix confirmed); no role branch; spinner/redirect/children |
| `client/src/lib/wishlist.ts` | useWishlist/useWishlistCount/useToggleWishlist/toWishlistItem | VERIFIED | 178 lines; all exports present; optimistic cancel/snapshot/rollback/invalidate; slug-UUID duality documented |
| `client/src/lib/wishlist.test.ts` | Vitest unit tests for toWishlistItem | VERIFIED | 5 test cases: productId/slug/name/price/category mapping, null subtitle, null price, empty images |
| `client/src/components/WishlistButton.tsx` | Heart toggle with stopPropagation, 44px hit area, logged-out prompt | VERIFIED | stopPropagation + preventDefault on line 46-47; h-11 w-11 hit area; isPending guard (WR-03 fix) |
| `client/src/pages/Wishlist.tsx` | Auth-gated saved-products grid with states and optimistic remove | VERIFIED | 131 lines; loading/error/empty/populated states; X remove button with isPending guard |
| `supabase/migrations/0007_submissions_insert_policy.sql` | anon+auth INSERT policy with D-01 ownership invariant | VERIFIED | Policy `customization_submissions_anon_or_owner_insert` with exact disjunction; no blanket `using (true)`; INSERT only |
| `supabase/functions/verify-and-submit/index.ts` | Edge Function: Turnstile siteverify + caller-JWT insert | VERIFIED | 157 lines; siteverify; field allow-list (CR-01 fix); shape guard; no raw DB error reflection; no SERVICE_ROLE |
| `supabase/config.toml` | [functions.verify-and-submit] verify_jwt = false | VERIFIED | Line 375: `[functions.verify-and-submit]`; line 380: `verify_jwt = false` |
| `supabase/tests/submissions_insert_assertions.sql` | SQL harness asserting policy shape | VERIFIED | 4 invariants: policy exists, both roles, non-null with_check, non-literal-true with_check |
| `client/src/lib/questionnaire.ts` | Zod schema, toSubmission mapper, submitQuestionnaire invoke | VERIFIED | `questionnaireSchema`, `toSubmission` (D-05 boundary), `submitQuestionnaire` → `functions.invoke('verify-and-submit')`, `STEP_FIELDS` |
| `client/src/lib/questionnaire.test.ts` | Vitest tests for toSubmission D-05 mapping | VERIFIED | 9 test cases: column vs payload split, null userId, empty message, shape contract |
| `client/src/lib/turnstile.ts` | Lazy CF script loader | VERIFIED | `challenges.cloudflare.com` CDN; idempotent inject; resolves on load, rejects on error |
| `client/src/pages/Questionnaire.tsx` | Native multi-step wizard replacing Google Form iframe | VERIFIED | 516 lines; no iframe; per-step trigger; Turnstile; toSubmission; thank-you finale with correct CTAs |
| `client/src/lib/submissions.ts` | useMySubmissions + submissionSnippet added to existing file | VERIFIED | `fetchMySubmissions` + `useMySubmissions` + `submissionSnippet` exported alongside existing `useSubmissions` |
| `client/src/lib/submissions.test.ts` | Vitest tests for submissionSnippet | VERIFIED | 8 test cases: null, empty, whitespace, collapse, trim, short, truncate at 80, exact 80 |
| `client/src/lib/profile.ts` | useUpdateName, useUpdateEmail (pending), useUpdatePassword | VERIFIED | All 3 hooks; email no-op skip (WR-05 fix); "Check your inbox" toast; "Password updated." toast; "Name updated." toast |
| `client/src/pages/Profile.tsx` | Auth-gated account management + inline submission history | VERIFIED | 468 lines; AccountSection (3 forms) + HistorySection (useMySubmissions); list + read-only Dialog |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WishlistButton.tsx` | `lib/wishlist.ts` | `useToggleWishlist` + `useWishlist` | WIRED | Imported and used in handleClick; `saved` derived from `data` |
| `Navbar.tsx` | `lib/wishlist.ts` | `useWishlistCount` | WIRED | Imported line 19; used line 47, 167, 286 for badge count |
| `App.tsx` | `auth/AuthGuard.tsx` | AuthGuard wraps /wishlist and /profile routes | WIRED | Lines 59-61 (/wishlist), 68-70 (/profile) |
| `Questionnaire.tsx` | `verify-and-submit` Edge Function | `submitQuestionnaire` → `supabase.functions.invoke` | WIRED | `questionnaire.ts:112` invokes `verify-and-submit`; Questionnaire.tsx:184 calls `submitQuestionnaire` |
| `questionnaire.ts` | customization_submissions D-05 shape | `toSubmission` maps skin_type/payload correctly | WIRED | `skin_type: values.skinType`; `payload: { concerns, productInterest, allergies }` |
| `verify-and-submit/index.ts` | Cloudflare siteverify | `TURNSTILE_SECRET_KEY` env server-side | WIRED | Line 84: `fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', ...)` |
| `Profile.tsx` | `lib/submissions.ts` useMySubmissions | Owner-scoped read via existing RLS | WIRED | Imported line 43; used in HistorySection line 294 |
| `lib/profile.ts` | `supabase.auth.updateUser` / `profiles.update` | email/password via updateUser; name via profiles | WIRED | `updateUser({email})` line 101; `updateUser({password})` line 122; `profiles.update({name})` line 62 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Wishlist.tsx` | `data` (WishlistItem[]) | `useWishlist()` → `fetchWishlist()` → `supabase.from('wishlists').select(...)` joined to products | Yes — PostgREST query with join | FLOWING |
| `Questionnaire.tsx` | form submission → `submitQuestionnaire(token, submission)` | `supabase.functions.invoke('verify-and-submit', {body:{token,submission}})` → live Edge Function | Yes — real function invocation | FLOWING |
| `Profile.tsx` (HistorySection) | `data` (SubmissionRow[]) | `useMySubmissions()` → `fetchMySubmissions()` → `supabase.from('customization_submissions').select(...)` | Yes — RLS-scoped PostgREST query | FLOWING |
| `Profile.tsx` (AccountSection) | `currentName` | `useMyProfileName()` → `supabase.from('profiles').select('name').eq('id', userId)` | Yes — live profiles read | FLOWING |
| `Navbar.tsx` | `wishlistCount` | `useWishlistCount()` → `useWishlist().data?.length ?? 0` derived from shared cache | Yes — derived from same live query | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npm run check` | Exit 0 | PASS |
| All 3 unit test files pass | `npx vitest run wishlist.test.ts questionnaire.test.ts submissions.test.ts` | 22 tests, 0 failures | PASS |
| Google Form iframe fully removed | `grep -n "docs.google.com/forms\|iframe" Questionnaire.tsx` | 0 matches | PASS |
| Edge Function has no SERVICE_ROLE key | `grep -n "SERVICE_ROLE" verify-and-submit/index.ts` | 0 matches | PASS |
| AuthGuard uses safeReturnTo (WR-02 fix) | `grep -n "safeReturnTo" AuthGuard.tsx` | Line 47: `const next = safeReturnTo(location)` | PASS |
| WishlistButton guards stopPropagation + isPending | `grep -n "stopPropagation\|isPending" WishlistButton.tsx` | Both present | PASS |
| Email pending flow is NOT a completion toast | `grep -n "Check your inbox" profile.ts` | "Check your inbox to confirm your new email." | PASS |
| Field allow-list in Edge Function (CR-01 fix) | `grep -n "ALLOWED\|clean\[" verify-and-submit/index.ts` | Allow-list present lines 119-132 | PASS |

---

### Probe Execution

Step 7c does not apply: no `scripts/*/tests/probe-*.sh` files exist in this project and the phase is a UI/Supabase slice with a live-only backend (Cloudflare + Supabase Auth). Live proofs were performed by the human during the blocking-human checkpoints in 05-02 Task 3 and 05-03 Task 3.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Questionnaire.tsx` | 267, 292, 392, 410, 427 | `placeholder="..."` | Info | HTML form placeholder attributes — not stub code; these are legitimate UX copy for input fields. Not a code smell. |
| `lib/wishlist.ts` | 49 | "placeholder" in comment | Info | Comment describes the image placeholder behavior — legitimate product feature. Not a stub. |
| `lib/wishlist.ts` | 51 | `toWishlistItem(row: any)` | Info | Opts out of strict typing at the PostgREST join boundary (IN-02 from code review). Not a runtime issue; strict-mode passes because `any` is legal. Accepted. |
| `lib/profile.ts` | 67 | `invalidateQueries({ queryKey: ["my-profile-name"] })` | Info | Broad prefix invalidation instead of exact key (IN-05 from code review). Functionally correct; minor cache efficiency issue. |

No TBD/FIXME/XXX markers found. No `return null` stubs. No hardcoded empty data in rendering paths. No unresolved debt markers.

---

### Human Verification Required

The phase has 7 live-interaction items that cannot be verified programmatically. The following blocking-human checkpoints were completed during phase execution and approved by the human (per the context provided):

- 05-02 Task 3: D-01 RLS proofs A/B/C/D all PASS live; Turnstile-fail → 400 captcha_failed no row — APPROVED
- 05-03 Task 3: Anon + logged-in submissions land in admin inbox with correct user_id + payload; per-step validation; thank-you — APPROVED
- 05-04 Task 3: Name/password immediate, email PENDING, owner-scoped history, logged-out /profile redirect — APPROVED

The items below remain as human verification because they are inherently live-only behaviors that no automated check can substitute. These do NOT re-require the blocking-human walks already approved — they are recorded for audit completeness and for any future verifier who needs to re-run the gate:

### 1. Wishlist heart sync across all surfaces

**Test:** Log in as a customer. Save a product via the card heart, confirm the navbar badge increments. Open the same product in the detail modal, confirm the heart is filled. Visit /wishlist, confirm the tile appears. Remove from /wishlist, confirm badge decrements and card heart empties.
**Expected:** All four surfaces (card, modal, /wishlist, navbar) read the same `['wishlist']` cache and update together without page reload.
**Why human:** Shared optimistic TanStack Query cache sync across multiple mounted components requires a live browser session.

### 2. Logged-out heart tap redirect

**Test:** While logged out, tap a heart on any product card or in the detail modal.
**Expected:** Toast "Sign in to save your favourites." fires; browser navigates to /login?next=<encoded-current-path>; after login the user is returned to the page they came from.
**Why human:** Requires a browser session with no active cookie; redirect round-trip involves Wouter navigation and a real auth flow.

### 3. Questionnaire per-step validation blocks advancement

**Test:** On /questionnaire step 0, click Continue with an empty name or invalid email.
**Expected:** Form validation error appears ("Please add your name so we can reply." / "Enter a valid email address."); step does not advance.
**Why human:** React Hook Form trigger behavior + UI validation error rendering requires live browser interaction.

### 4. End-to-end questionnaire submission lands in admin inbox

**Test:** Complete the wizard (anon and logged-in) with a real Turnstile challenge, submit, check admin inbox at /admin/submissions.
**Expected:** Anon row has user_id=null; logged-in row has the caller's user_id; both show correct skin_type, message, and payload Details. Turnstile-fail path (tampered/empty token) produces 400 captcha_failed with no row.
**Why human:** Requires live Cloudflare Turnstile widget + live Supabase. Approved in 05-02 and 05-03 blocking-human checkpoints this session.

### 5. Profile email change pending flow

**Test:** Log in, go to /profile, change email to a new address, click "Update email".
**Expected:** UI shows "Check your inbox to confirm your new email. Your current email stays active until you click the confirmation link." — NOT a "Email changed" success message. Current login email is still the old one.
**Why human:** GoTrue Secure email change ON must be verified against the live auth configuration; client-side toast text is visible but the actual auth state requires a real Supabase session.

### 6. Profile submission history is owner-scoped

**Test:** Log in as Customer A with existing submissions; log in as Customer B; compare /profile histories.
**Expected:** Customer B sees only their own submissions; Customer A's rows are not visible to B. Logged-out /profile redirects to /login?next=/profile.
**Why human:** Cross-user RLS verification requires two live customer accounts.

### 7. Name and password update immediately

**Test:** Log in, go to /profile. Edit display name → "Save name." Change password → "Update password." Log out and back in with new password.
**Expected:** "Name updated." toast appears; name persists on refresh. "Password updated." toast; new password works immediately on re-login.
**Why human:** Persistent writes to live Supabase + GoTrue require a running app session.

---

### Gaps Summary

No gaps were found. All 12 must-have truths are verified with substantive, wired, and data-flowing artifacts. The code review findings (CR-01, WR-02, WR-03, WR-05) cited in the context as FIXED this session are confirmed fixed in the actual codebase:

- CR-01 (field allow-list + shape guard + no raw DB error): `verify-and-submit/index.ts:69-79` (shape guard), lines 119-132 (ALLOWED set + clean object), lines 138-141 (generic error, no reflection).
- WR-02 (AuthGuard safeReturnTo): `AuthGuard.tsx:5,47` — `safeReturnTo` imported and used.
- WR-03 (in-flight guard): `WishlistButton.tsx:57,65` and `Wishlist.tsx:97,102` — `isPending` checks present.
- WR-05 (no-op email skip): `profile.ts:98-99` — case-insensitive trim comparison; returns `"unchanged"` before calling `updateUser`.

WR-04 (resolveProductId slug mismatch) and Info findings (IN-01 through IN-05) remain open and are acceptable per the code review's own classification.

---

_Verified: 2026-06-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
