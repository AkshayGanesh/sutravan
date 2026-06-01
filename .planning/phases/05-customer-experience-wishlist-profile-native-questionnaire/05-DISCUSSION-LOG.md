# Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 5-Customer Experience — Wishlist, Profile & Native Questionnaire
**Areas discussed:** Questionnaire access, Questionnaire form design, Wishlist interaction, Profile & history page, Post-submit behavior, Questionnaire prefill, Wishlist navbar cue, Wishlist remove UX

---

## Questionnaire access

| Option | Description | Selected |
|--------|-------------|----------|
| Login required | Only logged-in customers submit; cleanest RLS (WITH CHECK user_id=auth.uid()) | |
| Anyone (anon allowed) | Anon visitors can submit (user_id null); needs an anon INSERT policy + spam guard | ✓ |

**User's choice:** Anyone (anon allowed)
**Notes:** Wider funnel chosen. Drives the missing INSERT policy on customization_submissions; authenticated inserts must still be constrained to own user_id.

### Anon contact fields

| Option | Description | Selected |
|--------|-------------|----------|
| Name + email required | Validated; logged-in users prefilled | ✓ |
| Email required, name optional | Lower friction | |
| All optional | Lowest friction, risk of unactionable requests | |

**User's choice:** Name + email required

### Spam guard

| Option | Description | Selected |
|--------|-------------|----------|
| Honeypot + basic validation | Lightweight, no deps | |
| CAPTCHA (Turnstile) | Stronger; adds dependency + key + server verify | ✓ |
| No guard for now | RLS + validation only | |

**User's choice:** CAPTCHA (Cloudflare Turnstile)
**Notes:** Flagged — Supabase-direct (no server) means token verification likely needs the project's first Supabase Edge Function. Research to confirm pattern.

---

## Questionnaire form design

| Option | Description | Selected |
|--------|-------------|----------|
| Skin type | skin_type column (select) | ✓ |
| Skin concerns | multi-select → payload | ✓ |
| Product interest | category/type → payload | ✓ |
| Allergies / ingredients to avoid | sensitivities → payload | ✓ |

**User's choice:** All four (plus name/email + free-text message)

### Source & layout

| Option | Description | Selected |
|--------|-------------|----------|
| Design fresh | Clean field set, not a verbatim mirror | ✓ (on-brand) |
| Mirror Google Form | Replicate existing wording (needs paste) | |
| Single page | One scrollable page | |
| Multi-step wizard | Stepped flow | ✓ |

**User's choice:** Design fresh but conform to Sutravan branding; multi-step wizard
**Notes:** Phase has a UI hint → UI-SPEC will define the visual contract.

---

## Wishlist interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Card + detail modal | Heart on ProductCard (stopPropagation) AND in ProductDetail | ✓ |
| Detail modal only | Heart only in detail | |
| Card only | Heart only on grid card | |

**User's choice:** Card + detail modal

### Logged-out behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt to sign in | Toast/dialog → login with ?next= | ✓ |
| Hide for logged-out | Heart only renders for logged-in | |

**User's choice:** Prompt to sign in

### Where viewed

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /wishlist page | Standalone grid page | ✓ |
| Section in profile page | Tab within profile | |

**User's choice:** Dedicated /wishlist page

---

## Profile & history page

| Option | Description | Selected |
|--------|-------------|----------|
| View + edit name, view email | Minimal + password-reset link | |
| View only | No editing | |
| Full account management | Edit name, change email, change password inline | ✓ |

**User's choice:** Full account management
**Notes:** Flagged — inline email change sends confirmation by default ("Secure email change" setting); UX to be confirmed in planning.

### History display

| Option | Description | Selected |
|--------|-------------|----------|
| List + detail dialog | Mirrors admin Submissions.tsx | ✓ |
| Simple list only | Date + snippet inline | |

**User's choice:** List + detail dialog

### Routing

| Option | Description | Selected |
|--------|-------------|----------|
| /profile (history inline), /wishlist separate | Two routes | ✓ |
| Separate /profile, /history, /wishlist | Three routes | |

**User's choice:** /profile with history inline, /wishlist separate

---

## Post-submit behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Thank-you step + history link | Confirmation wizard screen; logged-in → history, anon → sign-up nudge | ✓ |
| Toast + redirect home | Success toast → homepage | |
| Inline success, stay on page | Replace form with inline message | |

**User's choice:** Thank-you step + history link

---

## Questionnaire prefill

| Option | Description | Selected |
|--------|-------------|----------|
| Prefill, editable, auto user_id | Prefilled but editable | |
| Prefill, locked | Read-only name/email, auto user_id | ✓ |

**User's choice:** Prefill, locked

---

## Wishlist navbar cue

| Option | Description | Selected |
|--------|-------------|----------|
| Heart icon + count badge | Navbar heart with live count → /wishlist | ✓ |
| Dropdown item only | Plain link in account dropdown | |

**User's choice:** Heart icon + count badge

---

## Wishlist remove UX

| Option | Description | Selected |
|--------|-------------|----------|
| Instant toggle + live sync | Optimistic, no confirm, synced across surfaces | ✓ |
| Instant toggle, confirm on wishlist page | Confirm only when removing on /wishlist | |

**User's choice:** Instant toggle + live sync

---

## Claude's Discretion

- Exact wizard step grouping/order, field widgets, validation copy (within branding + UI-SPEC).
- Whether `/wishlist` removal shows an undo toast.
- Internal query-key structure for the shared wishlist cache.

## Deferred Ideas

- Admin submission status/triage — Phase 4 inbox stays read-only (D-17); future admin-enhancement milestone.
- Wishlist sharing / public wishlist URLs — out of scope.
- Saved-questionnaire drafts / resume — keep submit one-shot.
