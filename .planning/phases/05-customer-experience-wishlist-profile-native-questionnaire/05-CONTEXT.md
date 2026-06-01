# Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Logged-in customers get account value before checkout exists: save/manage products (wishlist), a profile page with their own customization-submission history, and a **native multi-step questionnaire** that replaces the embedded Google Form and writes to `customization_submissions` (already surfaced in the Phase 4 admin inbox).

Requirements: **CUST-01** (save a product), **CUST-02** (view/manage wishlist), **CUST-03** (native questionnaire → Supabase), **CUST-04** (profile + own submission history).

**Not in this phase:** cart/checkout/payments (deferred to e-commerce milestone); admin-side submission status/triage (Phase 4 inbox is read-only by decision D-17); image reorder/bulk ops (deferred to v2).

</domain>

<decisions>
## Implementation Decisions

### Questionnaire — Access & Anti-abuse
- **D-01:** Submission is **anonymous-allowed**, not login-gated. A new INSERT policy is required on `customization_submissions` (Phase 1 deliberately left this table with NO insert policy — RESEARCH A5). The policy must allow both anon and authenticated inserts, and **WITH CHECK must enforce that an authenticated submitter can only set `user_id` to their own `auth.uid()`** (and that anon inserts carry `user_id = null`) — satisfies CUST-04's "no user can insert rows scoped to another user."
- **D-02:** For **anonymous** submissions, **name + email are required** (validated, email-format checked) so the owner can reply. Logged-in users have these supplied from their account.
- **D-03:** Spam guard is **Cloudflare Turnstile (CAPTCHA)** on the public form. ⚠️ Since the project is Supabase-direct with **no server/Express layer**, verifying the Turnstile token server-side will require the project's **first Supabase Edge Function** (verify token → then insert). Research must confirm the cleanest pattern: Edge Function that verifies + inserts, vs. verify-then-client-insert. This is the single biggest new-infrastructure item in the phase.

### Questionnaire — Form Design
- **D-04:** Field set is **designed fresh** (not a verbatim Google Form mirror), styled to **conform to Sutravan branding** (this phase has a UI hint → a UI-SPEC will define the visual contract).
- **D-05:** Captured fields:
  - `skin_type` → dedicated column (single-select; admin inbox renders it as a badge).
  - **Skin concerns** (multi-select), **product interest** (category/type), **allergies / ingredients to avoid** → stored in the `payload` jsonb (admin inbox already pretty-prints `payload`).
  - Free-text **message/note** → dedicated `message` column.
  - `name` + `email` → dedicated columns.
- **D-06:** Layout is a **multi-step wizard** (e.g. About you → Your skin → What you want → review/confirm), not a single scroll page.
- **D-07:** **Post-submit = a thank-you confirmation step** as the final wizard screen. Logged-in users see a link to their submission history (`/profile`); anonymous users get a "create an account to track this" nudge.
- **D-08:** For **logged-in** users, name/email are **prefilled and shown read-only (locked)**, and `user_id` is auto-set to their id so the submission appears in their history. Anonymous users type name/email themselves.

### Wishlist
- **D-09:** Save/wishlist control (heart toggle) appears on **both ProductCard and the ProductDetail modal**. On the card it must `stopPropagation` so it does not trigger the card's open-detail click.
- **D-10:** Logged-out tap on the heart → **prompt to sign in** (toast/dialog) and route to login with `?next=` back to where they were (reuse the Phase 3 `safeReturnTo()` open-redirect sanitizer). No anonymous-wishlist infrastructure — wishlist requires an account (RLS is owner-scoped).
- **D-11:** Saved items are viewed/managed on a **dedicated `/wishlist` page** (grid of saved products + remove control + empty state), linked from the Navbar.
- **D-12:** Navbar shows a **heart icon + live count badge** (count of saved items for logged-in users) linking to `/wishlist`.
- **D-13:** Save/remove is an **instant optimistic toggle (no confirm dialog)**, with heart state and the navbar count **kept in sync across card, detail modal, /wishlist page, and navbar** via a shared TanStack Query cache. Removing from `/wishlist` is also instant (undo toast if cheap to add).

### Profile & Submission History
- **D-14:** Profile supports **full account management**: edit display name (`profiles.name` self-update is already permitted by the Phase 3 role-lock trigger), **change email**, and **change password inline** (`supabase.auth.updateUser`). ⚠️ Email change sends a confirmation email by default even with signup-confirmation OFF (governed by the separate "Secure email change" Auth setting). Research/plan must confirm the exact UX — pending-confirmation state vs immediate — and whether to surface a "check your inbox" notice.
- **D-15:** The customer's **own submission history** is shown as a **list (date + snippet) → read-only detail dialog**, mirroring the admin `Submissions.tsx` component shape (reuse where practical). RLS already scopes rows to the owner.
- **D-16:** Routing: **`/profile`** holds account info **+ submission history inline**; **`/wishlist`** is a separate page. Both linked from the Navbar account dropdown. All three customer routes are auth-gated (logged-out → login with `?next=`).

### Claude's Discretion
- Exact wizard step grouping/order, field widgets, and validation copy (within D-04/D-06 and the forthcoming UI-SPEC).
- Whether removal from `/wishlist` includes an undo toast (D-13, "if cheap").
- Internal query-key structure for the shared wishlist cache (D-13).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & RLS (the binding contract for this phase)
- `supabase/migrations/0001_init_schema.sql` — defines `customization_submissions` (id, user_id nullable FK→auth.users ON DELETE SET NULL, name, email, skin_type, message, payload jsonb, created_at) and `wishlists` (composite PK `(user_id, product_id)`, both FKs cascade). The native form and wishlist write against these exact shapes.
- `supabase/migrations/0002_rls_policies.sql` — `wishlists` owner-scoped read/insert/delete already exist; `customization_submissions` has **admin-or-owner SELECT only and NO INSERT policy** — the Phase 5 INSERT policy (D-01) is the gap to fill. Follow the existing `(select auth.uid()) = user_id` + `WITH CHECK` idiom here.

### Prior-phase context to honor
- `.planning/phases/03-authentication-roles/03-CONTEXT.md` — `useAuth()` returns `{ session, user, role, loading, signOut }`; `safeReturnTo()` is the single open-redirect sanitizer; auth UX is gate-behind-loading (D-12). Reuse for D-10/D-16 redirects.
- `.planning/phases/04-admin-portal-catalog-content-management/04-CONTEXT.md` — established admin patterns (ConfirmDialog, Sonner toasts, RHF+Zod forms, mandatory cache invalidation, loading=skeleton / error=inline+Retry / empty-state). The customer features should match these conventions.

### Reusable code (see code_context below)
- `client/src/pages/admin/Submissions.tsx` — shape to mirror for the customer's own submission history (D-15).
- `client/src/lib/submissions.ts` — existing submissions read hook/type (`SubmissionRow`); extend or parallel for owner-scoped reads.
- `client/src/components/ProductCard.tsx`, `client/src/components/ProductDetail.tsx` — heart placement targets (D-09).
- `client/src/components/Navbar.tsx` — account dropdown already reserved for "Phase 5 Wishlist/Profile items"; navbar count badge target (D-12).

No external ADRs beyond the migrations and prior CONTEXT files — requirements fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/submissions.ts` + `Submissions.tsx`**: existing admin-side submissions read + list/detail-dialog UI — directly reusable shape for CUST-04 history (D-15); the admin already renders `name/email/skin_type/message/payload`.
- **`lib/catalog.ts`**: snake→camel mapping + TanStack Query + `getPublicUrl` image helper patterns — the model for a new `lib/wishlist.ts` data layer.
- **`useAuth()` + `safeReturnTo()`** (Phase 3): session/role + sanitized return-to redirects for auth-gating `/profile` and `/wishlist` and the logged-out heart prompt (D-10).
- **ConfirmDialog, Sonner Toaster, RHF+Zod, formatPrice** (Phase 4): consistent destructive-action, toast, form, and price-render primitives.
- **Navbar account dropdown** already has a Phase-5 placeholder comment for wishlist/profile entries.

### Established Patterns
- Data layer in `lib/*.ts` with snake→camel mapping at the boundary; components consume only hooks (never query Supabase directly).
- States: loading = skeleton mirroring real layout; error = inline message + Retry calling `refetch()`; empty = explicit empty-state component.
- Server-side security is RLS; client guards (AdminGuard / route gating) are UX only.
- Heavy/optional deps are lazy/code-split out of the public bundle (e.g. TipTap, HEIC libs) — apply the same discipline to any Turnstile SDK.

### Integration Points
- New **INSERT RLS policy** on `customization_submissions` via a new versioned migration (next number after `0006`).
- New **Supabase Edge Function** for Turnstile verification (D-03) — first in the project; sits outside the static SPA, deployed separately.
- New routes `/profile` and `/wishlist` in `client/src/App.tsx` (auth-gated), wired into Navbar.
- Replace `client/src/pages/Questionnaire.tsx` (currently an iframed Google Form) with the native wizard.
- Navbar heart + count badge subscribes to the wishlist query cache.

</code_context>

<specifics>
## Specific Ideas

- Questionnaire styled to **Sutravan branding** (multi-step wizard with a thank-you finale) — the UI-SPEC should define this; reference the existing site's serif/earthy aesthetic (Hero, OurStory, existing Questionnaire header copy).
- Submission-history detail view should feel like the admin one but customer-friendly (no admin chrome).

</specifics>

<deferred>
## Deferred Ideas

- **Admin submission status/triage** (mark read/replied) — Phase 4 inbox is intentionally read-only (D-17); belongs to a future admin-enhancement milestone.
- **Wishlist sharing / public wishlist URLs** — not raised but out of scope; e-commerce-adjacent.
- **Saved-questionnaire drafts / resume** — not requested; keep submit one-shot.

None of the discussion strayed outside the CUST-01..04 phase scope.

</deferred>

---

*Phase: 5-Customer Experience — Wishlist, Profile & Native Questionnaire*
*Context gathered: 2026-06-01*
