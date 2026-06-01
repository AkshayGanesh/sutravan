# Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire - Research

**Researched:** 2026-06-01
**Domain:** Supabase-direct customer features (owner-scoped RLS, optimistic TanStack Query mutations, first Edge Function for Turnstile, multi-step RHF wizard, Supabase Auth self-service account management)
**Confidence:** HIGH (codebase patterns, schema, RLS) / MEDIUM (Edge Function + Turnstile + email-change UX — verified against official docs, no slopcheck available)

## Summary

This phase is frontend-heavy and builds entirely on patterns already proven in Phases 2–4. The wishlist, profile, and submission-history features are direct applications of the established `lib/*.ts` data-layer convention (`catalog.ts`/`admin.ts`/`submissions.ts`): a plain fetch/mutation function with snake→camel mapping at the boundary, wrapped in TanStack Query, with components consuming only hooks. RLS is already correct for wishlists (owner-scoped read/insert/delete in `0002`) and for submission reads (admin-or-owner SELECT). Two genuinely new things require care: (1) the **first Supabase Edge Function** to verify the Cloudflare Turnstile token server-side, and (2) the **anon-allowed INSERT RLS policy** on `customization_submissions` — the only schema/RLS gap this phase fills.

The single most consequential decision is **D-03(a) vs (b)** — whether the Edge Function verifies the Turnstile token *and* performs the insert (service-role, bypasses RLS), or verifies the token and returns success, leaving the client to insert (user/anon JWT, RLS-enforced). **Recommendation: (a) — Edge Function verifies token AND inserts, using the user's JWT (not service role) so the new INSERT RLS policy still enforces the `user_id` ownership invariant.** This keeps RLS as the real security boundary (CLAUDE.md non-negotiable), makes the Turnstile check truly mandatory (a client cannot skip it and insert directly because the INSERT policy can be written to require the function's path), and centralizes anti-abuse. See the Architecture Patterns section for the exact mechanism and a critical caveat about preventing direct-PostgREST bypass.

For account management (D-14), `supabase.auth.updateUser` handles email and password inline; the "Secure email change" Auth setting (separate from the disabled signup-confirmation) means an email change sends a confirmation link by default — the UX must surface a "check your inbox to confirm" pending state. Display-name self-update writes to `profiles.name` and is already permitted by the Phase 3 role-lock trigger (which only blocks `role` changes).

**Primary recommendation:** Add one migration (`0007`) with the anon+auth INSERT policy on `customization_submissions` (WITH CHECK enforcing `user_id = auth.uid()` for authenticated and `user_id IS NULL` for anon); build `lib/wishlist.ts` (optimistic toggle, shared `['wishlist']` cache) and `lib/profile.ts` + owner-scoped submission reads mirroring `submissions.ts`; build one Edge Function `verify-and-submit` that verifies Turnstile then inserts under the caller's JWT; use the official Cloudflare-hosted Turnstile script (lazy-loaded) rather than an npm wrapper to preserve bundle discipline.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Questionnaire — Access & Anti-abuse**
- **D-01:** Submission is anonymous-allowed (not login-gated). New INSERT policy required on `customization_submissions` (Phase 1 left this table with NO insert policy). Policy must allow both anon and authenticated inserts; WITH CHECK must enforce that an authenticated submitter can only set `user_id` to their own `auth.uid()`, and anon inserts carry `user_id = null`.
- **D-02:** For anonymous submissions, name + email are required (validated, email-format checked). Logged-in users have these supplied from their account.
- **D-03:** Spam guard is Cloudflare Turnstile on the public form. Supabase-direct → no server, so verifying the token server-side requires the project's first Supabase Edge Function (verify token → then insert). Research must confirm cleanest pattern: Edge Function verifies + inserts, vs verify-then-client-insert. Biggest new-infrastructure item.

**Questionnaire — Form Design**
- **D-04:** Field set designed fresh (not a verbatim Google Form mirror), styled to Sutravan branding (UI-SPEC defines visual contract).
- **D-05:** Captured fields: `skin_type` → dedicated column (single-select; admin renders as badge). Skin concerns (multi-select), product interest (category/type), allergies/ingredients to avoid → `payload` jsonb. Free-text message/note → dedicated `message` column. `name` + `email` → dedicated columns.
- **D-06:** Layout is a multi-step wizard (e.g. About you → Your skin → What you want → review/confirm), not single scroll.
- **D-07:** Post-submit = a thank-you confirmation step as the final wizard screen. Logged-in users see a link to `/profile`; anonymous users get a "create an account to track this" nudge.
- **D-08:** For logged-in users, name/email are prefilled and read-only (locked); `user_id` auto-set to their id. Anonymous users type name/email themselves.

**Wishlist**
- **D-09:** Heart toggle on both ProductCard and ProductDetail modal. On the card it must `stopPropagation` so it does not trigger card open-detail click.
- **D-10:** Logged-out tap on heart → prompt to sign in (toast/dialog) and route to login with `?next=` back to where they were (reuse Phase 3 `safeReturnTo()`). No anonymous-wishlist infrastructure — wishlist requires an account (RLS owner-scoped).
- **D-11:** Saved items viewed/managed on a dedicated `/wishlist` page (grid + remove + empty state), linked from Navbar.
- **D-12:** Navbar shows a heart icon + live count badge (count of saved items for logged-in users) linking to `/wishlist`.
- **D-13:** Save/remove is an instant optimistic toggle (no confirm dialog), heart state and navbar count kept in sync across card, detail modal, /wishlist page, and navbar via a shared TanStack Query cache. Removing from /wishlist is also instant (undo toast if cheap).

**Profile & Submission History**
- **D-14:** Profile supports full account management: edit display name (`profiles.name` self-update already permitted by Phase 3 role-lock trigger), change email, change password inline (`supabase.auth.updateUser`). Email change sends a confirmation email by default even with signup-confirmation OFF (governed by separate "Secure email change" Auth setting). Confirm exact UX — pending-confirmation vs immediate — and whether to surface a "check your inbox" notice.
- **D-15:** Customer's own submission history shown as a list (date + snippet) → read-only detail dialog, mirroring admin `Submissions.tsx` shape (reuse where practical). RLS already scopes rows to owner.
- **D-16:** Routing: `/profile` holds account info + submission history inline; `/wishlist` is separate. Both linked from Navbar account dropdown. All three customer routes auth-gated (logged-out → login with `?next=`).

### Claude's Discretion
- Exact wizard step grouping/order, field widgets, validation copy (within D-04/D-06 and the forthcoming UI-SPEC).
- Whether removal from `/wishlist` includes an undo toast (D-13, "if cheap").
- Internal query-key structure for the shared wishlist cache (D-13).

### Deferred Ideas (OUT OF SCOPE)
- Admin submission status/triage (mark read/replied) — Phase 4 inbox intentionally read-only (D-17); future admin-enhancement milestone.
- Wishlist sharing / public wishlist URLs — out of scope; e-commerce-adjacent.
- Saved-questionnaire drafts / resume — keep submit one-shot.
- Cart/checkout/payments — e-commerce milestone.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUST-01 | Customer can save (wishlist) a product | `wishlists` table + owner-scoped RLS already exist (`0001`/`0002`). New `lib/wishlist.ts` optimistic insert mutation mirroring `admin.ts` mutation shape. Heart control on ProductCard/ProductDetail (D-09). |
| CUST-02 | View and manage wishlist | `useWishlist()` query (owner-scoped SELECT, already allowed) joined to products; `/wishlist` page grid + optimistic remove (D-11/D-13). Navbar count derives from same cache (D-12). |
| CUST-03 | Native questionnaire → Supabase | New INSERT RLS policy (D-01, the only schema gap) + Edge Function verifying Turnstile then inserting (D-03). Multi-step RHF wizard (D-06) writing the D-05 field map. |
| CUST-04 | Profile + own submission history | `/profile` page: `updateUser` for email/password (D-14), `profiles.name` self-update (already allowed), owner-scoped submission reads mirroring `submissions.ts` + `Submissions.tsx` detail dialog (D-15). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wishlist save/remove | API/Backend (Postgres + RLS) | Client (optimistic cache) | RLS `wishlists_owner_*` policies are the real boundary; client optimistic update is UX only. |
| Wishlist read + count | Database (RLS-scoped query) | Client (TanStack cache) | `useQuery(['wishlist'])` is single source; navbar count is a derived selector over the same cache (no separate query). |
| Heart toggle UI / sign-in prompt | Client | — | Pure UX: `stopPropagation` (D-09), logged-out → `?next=` redirect via `safeReturnTo` (D-10). |
| Questionnaire submit (anti-abuse) | API/Backend (Edge Function) | Database (INSERT RLS) | Turnstile secret must live server-side (Edge Function env), never in client. The Edge Function is the only tier that can hold the secret. |
| Submission row write | Database (RLS WITH CHECK) | Edge Function | The new INSERT policy enforces the `user_id` ownership invariant regardless of who calls — RLS is the boundary, not the function code. |
| Multi-step wizard state/validation | Client (RHF + Zod) | — | Per-step validation, prefill/lock for logged-in users (D-08) — entirely client concern. |
| Email/password change | API/Backend (Supabase Auth/GoTrue) | Client (form + pending UX) | GoTrue owns the secure-email-change flow + confirmation emails; client only calls `updateUser` and renders pending state. |
| Display-name change | Database (`profiles` self-update RLS) | Client | `profiles_self_update` already allows it; role-lock trigger only blocks `role`. |
| Submission history read | Database (admin-or-owner SELECT RLS) | Client | Existing `customization_submissions_admin_or_owner_read` already scopes rows to owner — no new policy needed for reads. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.106.2 (installed) | DB queries, Auth (`updateUser`), `functions.invoke` | Already the single client singleton (`lib/supabase.ts`). `[VERIFIED: package-lock / package.json]` |
| `@tanstack/react-query` | ^5.60.5 (installed) | Wishlist cache, optimistic mutations, submission/profile queries | Established data-layer pattern (`catalog.ts`/`admin.ts`). `[VERIFIED: package.json]` |
| `react-hook-form` | ^7.66.0 (installed) | Multi-step wizard form state | Already used in every form (Login, ProductForm). `[VERIFIED: package.json]` |
| `zod` + `@hookform/resolvers` | ^3.25.76 / ^3.10.0 (installed) | Per-step + email-format validation | Established (`loginSchema`, `ProductFormValues`). `[VERIFIED: package.json]` |
| `wouter` | ^3.3.5 (installed) | `/profile`, `/wishlist` routes; `?next=` redirects | Established router; `safeReturnTo` already built. `[VERIFIED: package.json]` |
| `date-fns` | ^3.6.0 (installed) | Submission date formatting | Already used in `Submissions.tsx` (`format(d, "PP")`). `[VERIFIED: package.json]` |
| `supabase` (CLI) | ^2.102.0 (devDep) | Edge Function scaffold/serve/deploy, `db push`, `secrets set` | Already a devDep with cached auth (see live-ops memory). `[VERIFIED: package.json]` |
| Cloudflare Turnstile (hosted script) | n/a — CDN script | Client widget for the CAPTCHA | Official Cloudflare-hosted `<script>` — zero npm dependency, best bundle discipline (matches the lazy/code-split discipline for TipTap/HEIC). `[CITED: developers.cloudflare.com/turnstile]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Deno std / Supabase Edge runtime | Deno 2 (config.toml `deno_version = 2`) | Edge Function runtime | The function runs on Deno; imports use `npm:` or `jsr:`/`https:` specifiers, NOT the client bundler. `[VERIFIED: supabase/config.toml line 384]` |
| `@marsidev/react-turnstile` | 1.5.2 | Optional React wrapper for the Turnstile widget | ONLY if a hosted-script integration proves awkward — adds an npm dep (69 KB unpacked). Prefer the hosted script. `[ASSUMED]` — see Package Legitimacy Audit. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Edge Function verifies + inserts (D-03a) | Edge Function verifies, returns OK, client inserts (D-03b) | (b) keeps the insert RLS-enforced trivially BUT the Turnstile check becomes skippable — a client can insert directly via PostgREST without ever calling the function (the INSERT policy can't see whether Turnstile passed). (a) makes the check mandatory. **Choose (a) with user JWT** — see Architecture. |
| Hosted Turnstile script (lazy) | `@marsidev/react-turnstile` npm | npm wrapper adds bundle weight + a supply-chain dependency; hosted script is what Cloudflare ships and keeps the public bundle lean (CONTEXT.md bundle-discipline note). |
| Multi-step wizard via RHF state | Separate route per step | Single RHF form with a `step` state + per-step `trigger()` validation is simpler, keeps all values in one place for the final insert, and avoids cross-route state plumbing. |
| Navbar count = separate count query | Derive from `['wishlist']` cache | A separate `select count(*)` query would desync from the optimistic toggle. Deriving count from the same cached array keeps card/modal/page/navbar in lockstep (D-13). |

**Installation:** No new npm packages required for the recommended path. The Turnstile widget loads from `https://challenges.cloudflare.com/turnstile/v0/api.js` (lazy-injected). The Edge Function is scaffolded with the already-installed CLI.

```bash
# scaffold + serve + deploy the Edge Function (CLI already a devDep)
./node_modules/.bin/supabase functions new verify-and-submit
./node_modules/.bin/supabase functions serve verify-and-submit   # local (Docker)
./node_modules/.bin/supabase functions deploy verify-and-submit --linked
# store the Turnstile secret server-side (NEVER a VITE_ var)
./node_modules/.bin/supabase secrets set TURNSTILE_SECRET_KEY=xxxxx --linked
```

**Version verification:** `@supabase/supabase-js` 2.106.2, `@tanstack/react-query` 5.60.5, `react-hook-form` 7.66.0, `zod` 3.25.76, `wouter` 3.3.5, `date-fns` 3.6.0, `supabase` CLI 2.102.0, `vitest` 4.1.7 — all confirmed present in `package.json`. `@marsidev/react-turnstile` latest 1.5.2 (modified 2026-05-05) confirmed on npm but tagged `[ASSUMED]` (slopcheck unavailable; and it is the non-recommended path).

## Package Legitimacy Audit

> No new **client** npm packages are required for the recommended path. The only candidate package is the optional Turnstile React wrapper.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@marsidev/react-turnstile` | npm | active (modified 2026-05-05) | (not measured) | github.com/marsidev/react-turnstile | unavailable | Flagged `[ASSUMED]` — OPTIONAL only; planner must add `checkpoint:human-verify` before install IF the hosted-script path is rejected |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck could not be installed at research time. The one optional package above is tagged `[ASSUMED]`. The recommended implementation uses NO new client package (Cloudflare hosted script + already-installed deps), so the planner should not need this checkpoint unless it deviates from the recommended path.*

## Architecture Patterns

### System Architecture Diagram

```
WISHLIST (CUST-01/02) — RLS-enforced, optimistic UI
  ProductCard / ProductDetail / /wishlist / Navbar badge
        │ (all read the SAME ['wishlist'] cache)
        ▼
  useWishlist() ── useQuery(['wishlist']) ──► supabase.from('wishlists').select(... products(...))
  useToggleWishlist() ── useMutation
        │   onMutate: cancelQueries → snapshot → setQueryData(optimistic) 
        │   onError:  rollback to snapshot + toast
        │   onSettled:invalidateQueries(['wishlist'])
        ▼
  Postgres `wishlists`  ◄── RLS wishlists_owner_{read,insert,delete} (auth.uid()=user_id)

QUESTIONNAIRE (CUST-03) — anti-abuse via first Edge Function
  Native multi-step wizard (RHF + Zod, D-06)
        │ collect: name,email,skin_type,message + payload{concerns,interest,allergies}
        │ + Turnstile token (widget lazy-loaded from CF CDN)
        ▼
  supabase.functions.invoke('verify-and-submit', { body })   ← sends user JWT (if logged in) in Authorization
        ▼
  Edge Function (Deno):
    1. CORS preflight (OPTIONS → corsHeaders)
    2. POST https://challenges.cloudflare.com/turnstile/v0/siteverify
         { secret: env.TURNSTILE_SECRET_KEY, response: token }  → { success }
    3. if !success → 400
    4. createClient(SUPABASE_URL, ANON, { global:{ headers:{ Authorization: req auth }}})
         .from('customization_submissions').insert({ ...fields, user_id })
        ▼
  Postgres `customization_submissions`
        ◄── NEW INSERT RLS policy (D-01): WITH CHECK
              authenticated → user_id = auth.uid()
              anon          → user_id IS NULL
        ▼
  Admin inbox (Phase 4 Submissions.tsx) reads via existing admin-or-owner SELECT

PROFILE (CUST-04) — self-service account mgmt
  /profile page
   ├─ display name  → supabase.from('profiles').update({name}) [profiles_self_update RLS]
   ├─ change email  → supabase.auth.updateUser({email}) → CONFIRMATION email (Secure email change) → pending UX
   ├─ change pass   → supabase.auth.updateUser({password}) → immediate
   └─ own submissions → useMySubmissions() useQuery (admin-or-owner SELECT scopes to me)
                         → list (date+snippet) → read-only detail Dialog (mirror Submissions.tsx)
```

### Recommended Project Structure
```
client/src/
├── lib/
│   ├── wishlist.ts        # useWishlist + useToggleWishlist (optimistic), snake→camel boundary
│   ├── profile.ts         # useUpdateName / useUpdateEmail / useUpdatePassword wrappers (or inline in page)
│   └── submissions.ts     # EXTEND: add useMySubmissions() (owner-scoped) alongside admin useSubmissions()
├── pages/
│   ├── Wishlist.tsx       # auth-gated grid + optimistic remove + empty state
│   ├── Profile.tsx        # account mgmt + inline submission history
│   └── Questionnaire.tsx  # REPLACE iframe with native multi-step wizard
├── components/
│   ├── WishlistButton.tsx # heart toggle (used by ProductCard + ProductDetail), stopPropagation
│   ├── AuthGuard.tsx      # NEW generic customer route guard (or reuse AdminGuard shape sans role check)
│   └── questionnaire/     # wizard step components (discretion)
supabase/
├── migrations/
│   └── 0007_submissions_insert_policy.sql   # the ONE schema/RLS gap (D-01)
├── functions/
│   └── verify-and-submit/index.ts           # first Edge Function (D-03)
└── tests/
    └── submissions_insert_assertions.sql    # extend the existing SQL assertion harness
```

### Pattern 1: Anon-allowed INSERT RLS policy (D-01) — the only schema gap
**What:** A new migration `0007` adds the INSERT policy that `0002` deliberately omitted, following the exact `(select auth.uid())` + WITH CHECK idiom already in the file.
**When to use:** Always — this is the gate that makes CUST-03 possible and enforces CUST-04's "no user can insert rows scoped to another user."

```sql
-- 0007_submissions_insert_policy.sql  [CITED: extends supabase/migrations/0002_rls_policies.sql idiom]
-- Allow BOTH anon and authenticated to submit the questionnaire.
-- WITH CHECK is the ownership invariant (D-01 / CUST-04):
--   authenticated submitter may ONLY set user_id = their own auth.uid()
--   anon submitter MUST carry user_id = null (they have no auth.uid())
create policy "customization_submissions_anon_or_owner_insert"
  on public.customization_submissions for insert
  to anon, authenticated
  with check (
    -- anon path: no JWT → auth.uid() is null → row must have null user_id
    ((select auth.uid()) is null and user_id is null)
    -- authenticated path: row's user_id must equal the caller's uid
    or ((select auth.uid()) is not null and user_id = (select auth.uid()))
  );
```

**Verification:** A logged-in customer cannot insert a row with someone else's `user_id` (WITH CHECK rejects). An anon insert with a non-null `user_id` is rejected. An anon insert with `user_id = null` succeeds. Confirm via the SQL-assertion + manual-with-anon-key pattern documented in the live-ops memory.

### Pattern 2: Edge Function verifies Turnstile AND inserts under the CALLER'S JWT (D-03a)
**What:** One Edge Function that (1) verifies the Turnstile token with Cloudflare, then (2) inserts the submission using a Supabase client scoped to the caller's `Authorization` header — so the new INSERT RLS policy (Pattern 1) still enforces the `user_id` invariant. **Do NOT use the service-role key for the insert** — that would bypass RLS and break the ownership guarantee.
**When to use:** This is the recommended D-03(a) implementation.

```ts
// supabase/functions/verify-and-submit/index.ts
// [CITED: supabase.com/docs/guides/functions/auth + /cors; developers.cloudflare.com/turnstile/get-started/server-side-validation]
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  // Restrict to the GitHub Pages origin in production (not '*') — [CITED: functions/cors]
  'Access-Control-Allow-Origin': '*', // planner: set to the exact site origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, submission } = await req.json()

    // 1. Verify Turnstile token server-side (secret never leaves the function)
    const verify = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
          response: token,
          // optional: remoteip: req.headers.get('x-forwarded-for')
        }),
      },
    )
    const outcome = await verify.json()
    if (!outcome.success) {
      return new Response(JSON.stringify({ error: 'captcha_failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Insert under the CALLER'S JWT so RLS (Pattern 1) enforces user_id ownership.
    //    For anon submitters there is no Authorization header → RLS treats it as anon
    //    → the row must carry user_id = null (the client must NOT send a user_id for anon).
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { error } = await supabase
      .from('customization_submissions')
      .insert(submission)   // submission.user_id must be null for anon, or omitted (DB default null)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Built-in env vars available in deployed functions:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-injected. `TURNSTILE_SECRET_KEY` is set via `supabase secrets set`. `[CITED: supabase.com/docs/guides/functions/auth]` Note: newer docs show a `withSupabase`/`@supabase/server` helper, but the classic `Deno.serve` + `createClient` pattern above is the broadly-documented, version-stable form and matches the installed CLI (2.102).

**verify_jwt setting (CRITICAL):** By default a deployed function has `verify_jwt = true`, which **rejects requests without a valid JWT** — that would block anonymous submitters (D-01). For this function, set `verify_jwt = false` (so anon can call it) in `supabase/config.toml` under a `[functions.verify-and-submit]` block (or via the deploy `--no-verify-jwt` flag), and do the auth handling inside the function as above. Turnstile + the INSERT RLS policy are the real gates; JWT verification at the platform edge must be off to permit anon. `[CITED: supabase.com/docs/guides/functions/auth]`

**The bypass caveat (must address in plan):** Choosing (a) makes the Turnstile check effective ONLY if a client cannot bypass the function and insert directly via PostgREST. With Pattern 1's policy, a logged-in or anon client *can* still call `supabase.from('customization_submissions').insert(...)` directly and satisfy the WITH CHECK without ever passing Turnstile. To make Turnstile mandatory, the plan must close the direct path — the cleanest option: **the public INSERT policy should NOT grant insert to `anon`/`authenticated` for the direct PostgREST path; instead grant insert only to the function's effective role.** Practical mechanism for a Supabase-direct project: keep the user-JWT insert (so RLS still scopes `user_id`) but add a guard the direct client cannot forge — e.g. require a column/claim only the function sets, OR accept that with (a)+user-JWT the residual risk is "spam without Turnstile is still owner-scoped and rate-limitable." **Decision needed (Open Question 1).** If the project wants Turnstile to be strictly unbypassable, the alternative is (a) with the **service-role insert inside the function** (bypasses RLS) PLUS *no* anon/auth INSERT policy at all (so the ONLY insert path is the function) — but then the `user_id` ownership invariant must be enforced *in function code* (set `user_id` from the verified JWT, never from the client body) rather than by RLS. This is the only way to make Turnstile truly mandatory; flag for the user.

### Pattern 3: Optimistic wishlist toggle with shared cache (D-13)
**What:** A single `['wishlist']` query holds the user's saved products; the toggle mutation does cancel→snapshot→optimistic-update→rollback-on-error→invalidate-on-settled. Card, modal, page, and navbar count all read this one cache.
**When to use:** Every wishlist save/remove.

```ts
// client/src/lib/wishlist.ts  [CITED: tanstack.com/query optimistic-updates; mirrors lib/catalog.ts + lib/admin.ts]
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

const WISHLIST_KEY = ['wishlist'] as const

export interface WishlistItem { productId: string; /* + joined product fields, snake→camel */ }

async function fetchWishlist(): Promise<WishlistItem[]> {
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_id, products(slug, name, subtitle, price, images, categories(slug))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(/* snake→camel at the boundary, reuse productImageUrls */)
}

export function useWishlist() {
  // gate on auth at the caller: only enabled when session exists (RLS scopes anyway)
  return useQuery({ queryKey: WISHLIST_KEY, queryFn: fetchWishlist })
}

// Derived count for the navbar — NO separate query (D-13 sync invariant)
export function useWishlistCount() {
  const { data } = useWishlist()
  return data?.length ?? 0
}

export function useToggleWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, saved }: { productId: string; saved: boolean }) => {
      if (saved) {
        const { error } = await supabase.from('wishlists').delete().eq('product_id', productId)
        if (error) throw error
      } else {
        const { data: u } = await supabase.auth.getUser()
        const { error } = await supabase.from('wishlists')
          .insert({ user_id: u.user!.id, product_id: productId })  // RLS WITH CHECK enforces ownership
        if (error) throw error
      }
    },
    onMutate: async ({ productId, saved }) => {
      await qc.cancelQueries({ queryKey: WISHLIST_KEY })
      const prev = qc.getQueryData<WishlistItem[]>(WISHLIST_KEY)
      qc.setQueryData<WishlistItem[]>(WISHLIST_KEY, (old = []) =>
        saved ? old.filter((i) => i.productId !== productId)
              : [...old, { productId } as WishlistItem])
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(WISHLIST_KEY, ctx.prev) /* + toast */ },
    onSettled: () => qc.invalidateQueries({ queryKey: WISHLIST_KEY }),
  })
}
```

**Note on `staleTime: Infinity`:** the global queryClient sets `staleTime: Infinity` + `refetchOnWindowFocus: false` (`queryClient.ts`), so the wishlist will NOT refetch on its own — `invalidateQueries` in `onSettled` is what reconciles the optimistic state with the server. This matches the `admin.ts` invalidation invariant.

### Pattern 4: Multi-step RHF wizard with per-step validation + prefill/lock (D-06/D-08)
**What:** A single `useForm` instance; a `step` state; advance only after `trigger(currentStepFields)` passes; final step submits the whole form. Logged-in users get name/email from `useAuth()`, set as `defaultValues` and rendered `readOnly`/`disabled`; anon users type them (required + email-format, D-02). Final step = thank-you screen (D-07).
**When to use:** The questionnaire.

```ts
// [CITED: react-hook-form.com — useForm trigger() for partial validation]
const form = useForm<QuestionnaireValues>({
  resolver: zodResolver(schema),
  defaultValues: isLoggedIn
    ? { name: profile.name ?? '', email: user.email ?? '', /* locked */ ... }
    : { name: '', email: '', ... },
})
const STEP_FIELDS: Record<number, (keyof QuestionnaireValues)[]> = {
  0: ['name', 'email'],          // About you (locked if logged in)
  1: ['skinType', 'concerns'],   // Your skin
  2: ['productInterest', 'allergies', 'message'], // What you want
}
async function next() {
  const ok = await form.trigger(STEP_FIELDS[step])
  if (ok) setStep((s) => s + 1)
}
// On final submit, map to the D-05 shape then invoke the Edge Function:
//   { name, email, skin_type, message,
//     payload: { concerns, productInterest, allergies },
//     user_id: isLoggedIn ? user.id : null }
```

**Field → schema map (D-05) — bind exactly:**
| Wizard field | DB destination |
|---|---|
| name | `name` column |
| email | `email` column |
| skin type (single-select) | `skin_type` column (admin renders as Badge) |
| message/note (free text) | `message` column |
| skin concerns (multi) | `payload.concerns` (jsonb) |
| product interest | `payload.productInterest` (jsonb) |
| allergies/avoid | `payload.allergies` (jsonb) |

The admin `Submissions.tsx` pretty-prints `payload` via `JSON.stringify(payload, null, 2)` under a "Details" field — so any jsonb keys render automatically. Use human-readable keys.

### Pattern 5: `updateUser` for email (pending) and password (immediate) (D-14)
**What:** `supabase.auth.updateUser({ email })` triggers GoTrue's email-change flow; with "Secure email change" ON (the default), a confirmation link is sent (to both old and new addresses) and the email does NOT change until confirmed — so the UX must show a "check your inbox to confirm the change" pending notice, not a success-complete state. `supabase.auth.updateUser({ password })` applies immediately (toast success). Display name is a `profiles` update, not `updateUser`.
**When to use:** Profile account-management section.

```ts
// [CITED: supabase.com/docs/reference/javascript/auth-updateuser + guides/auth/general-configuration]
// Email change — pending confirmation (Secure email change ON by default)
const { error } = await supabase.auth.updateUser({ email })
// if !error → toast "Check your inbox to confirm your new email." (NOT "email changed")

// Password change — immediate
const { error } = await supabase.auth.updateUser({ password })
// if !error → toast "Password updated."

// Display name — profiles self-update (role-lock trigger blocks ONLY role)
await supabase.from('profiles').update({ name }).eq('id', user.id)
```

**UX confirmation:** The "Confirm email" signup setting being OFF (Phase 3 D-01) does NOT disable the email-change confirmation — that is governed by the separate **"Secure email change"** Auth setting. Plan should keep Secure email change ON (safer) and render the pending-confirmation notice; the email-change redirect lands on a route the SPA handles (account for the GitHub Pages base + 404.html SPA fallback, same as Phase 3 reset-password). `[CITED: github.com/orgs/supabase/discussions/42520]`

### Pattern 6: Auth-gated customer routes (D-16) — generalize the AdminGuard shape
**What:** A guard that, while `loading`, shows a spinner; if no session, redirects to `/login?next=<current>` (using the same `encodeURIComponent(location)` + `safeReturnTo` consumption Login already does); otherwise renders children. No role check (customers are the audience).
**When to use:** `/profile`, `/wishlist`, and the heart logged-out prompt (D-10).

```tsx
// Mirror AdminGuard.tsx exactly, minus the role !== 'admin' branch.
if (loading) return <Spinner/>
if (!session) return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />
return <>{children}</>
```

### Anti-Patterns to Avoid
- **Inserting the submission with the service-role key while ALSO keeping an anon/auth INSERT policy** — you get neither guarantee: the function bypasses RLS (so `user_id` ownership is unenforced) AND the client can still bypass the function. Pick one coherent model (Pattern 2 + Open Question 1).
- **Putting the Turnstile SECRET key anywhere client-side** (`VITE_` var, bundle, repo) — it must live only in the Edge Function via `supabase secrets set`. The site key is public (fine in client); the secret is not.
- **A separate `count(*)` query for the navbar badge** — desyncs from the optimistic toggle. Derive from the `['wishlist']` cache (D-13).
- **Forgetting `e.stopPropagation()` on the card heart** — the click bubbles to the card's `onSelect` and opens the detail modal (D-09 explicit requirement).
- **Treating an email change as immediately complete** — with Secure email change the address is unchanged until confirmed; a "success, email updated" toast is wrong (D-14).
- **Eagerly bundling the Turnstile widget SDK** — lazy-inject the CF script on the questionnaire route only (bundle discipline, matches TipTap/HEIC handling).
- **Querying Supabase directly from a component** — all DB access goes through `lib/*.ts` hooks (CLAUDE.md + Phase 2/4 convention).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CAPTCHA / bot detection | A custom challenge or honeypot only | Cloudflare Turnstile + server-side siteverify | Hand-rolled spam guards are trivially defeated; Turnstile is the chosen, managed solution (D-03). |
| Token verification transport | A custom proxy server | Supabase Edge Function | No Express layer exists; the Edge Function is the sanctioned serverless path. |
| Optimistic cache + rollback | Manual `useState` mirrors across 4 components | TanStack Query `onMutate`/`onError`/`onSettled` on one shared key | A single cache is the only way to keep card/modal/page/navbar in sync (D-13). |
| Email-change confirmation flow | A custom verify-email pipeline | `supabase.auth.updateUser` + GoTrue Secure email change | GoTrue owns secure double-confirmation; reimplementing it is an auth-security footgun. |
| Open-redirect-safe return URL | New sanitizer | Existing `safeReturnTo()` (Login.tsx) | Already built, audited (Phase 3 Pitfall 6). |
| Image URL resolution for wishlist cards | Hand-built Storage URLs | `productImageUrls()` from `catalog.ts` | Filenames carry spaces/parens; `getPublicUrl` encodes them (Phase 2 Pitfall 3). |
| Submission detail UI | New component | Reuse `Submissions.tsx` shape/Field component | D-15 says mirror it; the payload pretty-print and Badge rendering already exist. |

**Key insight:** Almost everything in this phase is a re-application of an existing, audited pattern. The genuinely new code is one migration, one Edge Function, and one optimistic-mutation hook — everything else is composition of Phase 2–4 building blocks.

## Common Pitfalls

### Pitfall 1: `verify_jwt = true` blocks anonymous questionnaire submissions
**What goes wrong:** The deployed Edge Function rejects all calls without a valid JWT, so anonymous submitters (D-01) get 401 before the function body runs.
**Why it happens:** `verify_jwt` defaults to true on deployed functions.
**How to avoid:** Add `[functions.verify-and-submit] verify_jwt = false` to `config.toml` (or deploy `--no-verify-jwt`). Do auth handling inside the function; Turnstile + INSERT RLS are the real gates.
**Warning signs:** Anonymous submit returns 401; logged-in submit works.

### Pitfall 2: CORS wildcard / missing OPTIONS preflight
**What goes wrong:** Browser blocks the `functions.invoke` call with a CORS error; preflight `OPTIONS` returns 404/405.
**Why it happens:** The function doesn't handle `OPTIONS` or omits `Access-Control-Allow-*` headers.
**How to avoid:** Return `new Response('ok', { headers: corsHeaders })` for `OPTIONS`; include `corsHeaders` on every response. Restrict `Access-Control-Allow-Origin` to the GitHub Pages site origin in production. `[CITED: functions/cors]`
**Warning signs:** "blocked by CORS policy" in the browser console; works in curl but not the SPA.

### Pitfall 3: Turnstile token reuse / expiry
**What goes wrong:** Resubmitting (e.g. validation error then retry) fails because the token was already consumed or expired.
**Why it happens:** Tokens are single-use and valid for 300s. `[CITED: developers.cloudflare.com/turnstile]`
**How to avoid:** Reset the widget (request a fresh token) after a failed submit and on the final review step right before invoking; don't capture the token early in the wizard.
**Warning signs:** `error-codes: ["timeout-or-duplicate"]` from siteverify.

### Pitfall 4: Service-role insert silently bypasses the ownership invariant
**What goes wrong:** If the function inserts with the service-role key, RLS WITH CHECK never runs, so a malformed `user_id` from the client body would be persisted as-is.
**Why it happens:** Service role bypasses all RLS.
**How to avoid:** Either insert under the caller's JWT (Pattern 2, RLS enforces) OR, if using service role, set `user_id` in function code from the verified JWT and NEVER from the client body. Decide per Open Question 1.
**Warning signs:** A submission row with a `user_id` that doesn't match its submitter.

### Pitfall 5: Email-change UX shows false success
**What goes wrong:** User sees "email updated" but their login email is unchanged (still pending confirmation), causing confusion / lockout fears.
**Why it happens:** Secure email change requires confirmation; `updateUser` returns without error before confirmation.
**How to avoid:** On a successful `updateUser({email})` with no error, show "Check your inbox to confirm" — not a completion toast. Optionally surface that the change is pending until confirmed.
**Warning signs:** Support questions like "I changed my email but can't log in with it."

### Pitfall 6: Wishlist count flashes / desyncs on navigation
**What goes wrong:** Navbar badge and `/wishlist` page disagree after a toggle.
**Why it happens:** Two separate queries, or a count query that isn't optimistically updated.
**How to avoid:** Single `['wishlist']` cache; navbar count derives from it (Pattern 3). `staleTime: Infinity` means `invalidateQueries` in `onSettled` is the reconciliation point.
**Warning signs:** Badge shows N, page shows N±1.

### Pitfall 7: Heart click opens the product modal
**What goes wrong:** Tapping the heart on a card also fires the card's `onSelect`.
**Why it happens:** Click bubbles up to the card's `onClick`/`onKeyDown`.
**How to avoid:** `e.stopPropagation()` (and `e.preventDefault()` for keyboard) in the heart handler (D-09).
**Warning signs:** Every save also opens ProductDetail.

## Runtime State Inventory

> This phase is primarily additive (new tables already exist; new code, one policy, one function). It replaces the iframed Google Form. The relevant non-file state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `customization_submissions` and `wishlists` tables already exist (0001), currently empty. No data migration — the questionnaire starts writing fresh rows. The old Google Form holds historical responses in Google's backend (NOT in Supabase). | None for Supabase. Owner may optionally export old Google Form responses manually — out of scope. |
| Live service config | Cloudflare Turnstile widget (sitekey/secret) must be created in the Cloudflare dashboard — config lives in Cloudflare, not git. Supabase "Secure email change" + Site URL/redirect allowlist live in the Supabase dashboard (Site URL already configured in Phase 3 for reset-password). New: a `/profile` email-change redirect URL may need adding to the redirect allowlist. | Create Turnstile widget (dashboard); confirm email-change redirect URL is allowlisted (dashboard). |
| OS-registered state | None. | None — verified: static SPA + serverless, no OS-level registrations. |
| Secrets/env vars | NEW server-side secret `TURNSTILE_SECRET_KEY` via `supabase secrets set` (Edge Function env only, never `VITE_`). NEW public `VITE_TURNSTILE_SITE_KEY` for the client widget (public, safe to bundle). Existing `.env.local` (anon), `.env.seed.local`/`.env.promote.local` (service role) unchanged. | Set the two new vars; document in env notes. |
| Build artifacts | The Edge Function deploys separately from the SPA build (`supabase functions deploy`) — it is NOT part of the Vite/GitHub Pages build. The deploy step is a new, separate operation. | Add Edge Function deploy to the release runbook (manual or CI). |

## Code Examples

### Owner-scoped submission history (extend `lib/submissions.ts`) (CUST-04 / D-15)
```ts
// [CITED: mirrors existing fetchSubmissions in lib/submissions.ts]
// RLS customization_submissions_admin_or_owner_read already scopes rows to the
// owner, so a plain select returns ONLY the caller's rows for a customer.
async function fetchMySubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('customization_submissions')
    .select('id, name, email, skin_type, message, payload, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SubmissionRow[]
}
export function useMySubmissions() {
  return useQuery({ queryKey: ['my-submissions'], queryFn: fetchMySubmissions })
}
// Reuse the displayName/formatDate/snippet/Field helpers + detail Dialog from
// pages/admin/Submissions.tsx for the read-only customer detail view (D-15).
```

### Invoking the Edge Function from the wizard (CUST-03)
```ts
// [CITED: supabase.com/docs/guides/functions — functions.invoke sends the session JWT automatically]
const { data, error } = await supabase.functions.invoke('verify-and-submit', {
  body: {
    token: turnstileToken,                 // from the widget
    submission: {
      name, email, skin_type, message,
      payload: { concerns, productInterest, allergies },
      user_id: session ? session.user.id : null,  // anon → null (RLS requires it)
    },
  },
})
if (error) { /* toast.error('Could not submit, please try again') */ }
else { /* advance to the thank-you step (D-07) */ }
```

### Lazy-load the Turnstile widget script (bundle discipline)
```ts
// [CITED: developers.cloudflare.com/turnstile — explicit/implicit rendering via api.js]
// Inject only on the questionnaire route; the site key is public (VITE_ is fine).
function loadTurnstile(): Promise<void> {
  if (document.getElementById('cf-turnstile-script')) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.id = 'cf-turnstile-script'
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true; s.defer = true
    s.onload = () => res(); s.onerror = () => rej(new Error('turnstile load failed'))
    document.head.appendChild(s)
  })
}
// Then render <div class="cf-turnstile" data-sitekey={VITE_TURNSTILE_SITE_KEY}
//   data-callback={...} /> and read the token from the callback (or window.turnstile.getResponse()).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Embedded Google Form (iframe) | Native multi-step wizard → Supabase | This phase | Submissions land in the existing admin inbox; owner self-manages; no third-party form. |
| reCAPTCHA | Cloudflare Turnstile | ~2023 onward | Privacy-friendly, no Google account; siteverify is the standard server check. `[CITED: developers.cloudflare.com/turnstile]` |
| `Deno.serve` + manual `createClient` (still valid) | Newer `withSupabase`/`@supabase/server` helper appears in latest docs | 2025–2026 | The classic pattern remains documented and works with CLI 2.102; prefer it for version stability. Flag if the planner wants the newer helper. |

**Deprecated/outdated:**
- Manual reCAPTCHA integration — superseded by Turnstile for this project (D-03).
- The iframed Google Form (`Questionnaire.tsx`) — replaced entirely this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@marsidev/react-turnstile` 1.5.2 is legitimate (slopcheck unavailable) | Standard Stack | LOW — it's the non-recommended optional path; recommended path uses no npm package. |
| A2 | The classic `Deno.serve`+`createClient` Edge Function pattern works with CLI 2.102 / `@supabase/supabase-js` 2.x | Pattern 2 | MEDIUM — newer docs show `withSupabase`; if the runtime requires the new helper, swap imports. Verify on first `functions serve`. |
| A3 | Built-in env vars `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected into deployed functions | Pattern 2 | LOW — long-standing Supabase behavior; one doc variant lists newer key names. Confirm at deploy. |
| A4 | "Secure email change" is ON by default and independent of the disabled signup "Confirm email" | Pattern 5 / D-14 | MEDIUM — drives the pending-vs-immediate UX. Verify the exact toggle state in the project's Auth settings before building the UX copy. |
| A5 | The user-JWT insert in the Edge Function preserves RLS enforcement while service-role bypasses it | Pattern 2 / Pitfall 4 | HIGH if wrong — it's the crux of D-03(a). Verified against official auth docs (MEDIUM-HIGH confidence); confirm with a manual RLS test (anon key + forged user_id rejected). |
| A6 | A direct PostgREST insert can bypass the function under Pattern 1's policy | Pattern 2 bypass caveat | HIGH — determines whether Turnstile is truly mandatory. This is Open Question 1; needs a user decision. |

## Open Questions

1. **Should Turnstile be strictly unbypassable, or is owner-scoped+rate-limited spam acceptable?**
   - What we know: With the user-JWT insert + anon/auth INSERT policy (Pattern 1+2), a client can still insert directly via PostgREST without calling the function, so Turnstile is *not* strictly mandatory — but every row is still `user_id`-correct (RLS holds).
   - What's unclear: Whether the brand needs Turnstile to be unbypassable. Making it unbypassable requires the service-role-insert-only model (no public INSERT policy; function sets `user_id` from the verified JWT).
   - Recommendation: For a small handmade brand with no payments, start with Pattern 1+2 (RLS-correct, Turnstile on the UI path, accept residual direct-insert risk). If spam appears, switch to service-role-only. Surface this tradeoff to the user in discuss/plan.

2. **Anonymous submitters and submission history.**
   - What we know: D-07 nudges anon users to "create an account to track this." An anon row has `user_id = null`, so it can never be linked to a later account.
   - What's unclear: Whether the owner expects any way to associate a later signup with a prior anon submission (e.g. by email). Probably out of scope.
   - Recommendation: Treat anon submissions as unlinkable (the nudge is forward-looking only). Confirm no email-based backfill is expected.

3. **Edge Function deployment in CI vs manual.**
   - What we know: The SPA deploys via GitHub Actions to Pages; the Edge Function deploys separately via the CLI (cached auth locally).
   - What's unclear: Whether to add `supabase functions deploy` to CI or keep it a manual runbook step.
   - Recommendation: Manual deploy initially (one function, infrequent changes); document in the runbook. CI integration is a later hardening.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `supabase` CLI | Edge Function scaffold/serve/deploy, `db push`, `secrets set` | ✓ (devDep, cached auth) | 2.102.0 | — |
| Docker | `supabase functions serve` / `supabase start` (local Edge Function dev) | ✗ (not verified on this machine) | — | Develop against the linked remote; deploy + test on the live project (matches Phase 4 live-RLS testing approach). |
| Deno | Edge Function runtime | provided by Supabase Edge runtime (config.toml `deno_version = 2`) | 2 | — |
| Cloudflare Turnstile account | Sitekey/secret for the widget + siteverify | ✗ (must be created in CF dashboard) | — | None — required for D-03. Use CF test keys for local dev (always-pass sitekey). |
| Live Supabase project (linked) | Migration push, function deploy, RLS verification | ✓ (`wfbnrcnmpcqzeyjlfflv`, linked, cached auth) | — | — |
| `psql` direct | SQL assertion harness | ✗ (no password in pooler-url per live-ops memory) | — | Run assertions via the CLI / SQL editor; or use the documented service-role PostgREST pattern for RLS proofs. |

**Missing dependencies with no fallback:**
- Cloudflare Turnstile account/widget — must be created before D-03 can be built/tested (use CF test keys for local).

**Missing dependencies with fallback:**
- Docker for local Edge Function serving — fall back to deploying to the linked remote and testing live (consistent with the project's existing live-testing approach).
- Direct `psql` — fall back to CLI/SQL-editor execution of the assertion harness.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 (unit) + SQL assertion harness (RLS/DB invariants) |
| Config file | `vitest.config.ts` (present); SQL harness in `supabase/tests/*.sql` |
| Quick run command | `npm test` (→ `vitest run`) for a targeted file |
| Full suite command | `npm test` (all `*.test.ts`) + run the SQL assertion files against the live project |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUST-01 | Logged-in user can save a product; row created with own user_id | unit (mapping/optimistic) + manual (RLS) | `npm test client/src/lib/wishlist.test.ts` | ❌ Wave 0 |
| CUST-01 | Anon/forged user_id insert rejected by RLS | SQL assertion + manual (anon key) | `psql ... -f supabase/tests/submissions_insert_assertions.sql` (extend) / live anon test | ❌ Wave 0 |
| CUST-02 | Wishlist read returns only own rows; remove is optimistic+reconciled | unit + manual | `npm test client/src/lib/wishlist.test.ts` | ❌ Wave 0 |
| CUST-03 | Anon insert with user_id=null succeeds; authenticated must set own uid | SQL assertion (structure) + manual (functional, anon + customer JWT) | extend `supabase/tests/*.sql`; manual per live-ops pattern | ❌ Wave 0 |
| CUST-03 | Turnstile failure → function returns 400, no row inserted | manual (Edge Function, CF test keys) | invoke with bad token; assert no row | manual-only |
| CUST-03 | Field→column/payload mapping correct (D-05) | unit (the map function) | `npm test client/src/lib/questionnaire.test.ts` | ❌ Wave 0 |
| CUST-04 | Own submission history shows only caller's rows | unit (mapping) + manual (RLS) | `npm test client/src/lib/submissions.test.ts` (extend) | partial (submissions.ts exists, no test) |
| CUST-04 | Email change shows pending state; password change immediate | manual-only | n/a (GoTrue email flow) | manual-only |
| CUST-04 | Display-name self-update succeeds; role change still blocked | manual (reuses Phase 3 role-lock proof) | live | covered by 0004 assertions |

### Sampling Rate
- **Per task commit:** `npm test <touched test file>` (quick) + `npm run check` (tsc strict).
- **Per wave merge:** `npm test` (full vitest) + run the relevant SQL assertion file against the live project after any `db push`.
- **Phase gate:** Full vitest green + SQL assertions green + the manual RLS/Edge-Function/email-change checks performed and recorded (mirrors Phase 3/4 manual-functional approach for things impractical to simulate in psql).

### Wave 0 Gaps
- [ ] `client/src/lib/wishlist.test.ts` — covers CUST-01/02 (snake→camel mapping, optimistic toggle logic if extracted)
- [ ] `client/src/lib/questionnaire.test.ts` — covers CUST-03 field→column/payload mapping (D-05)
- [ ] `supabase/tests/submissions_insert_assertions.sql` — covers CUST-03 INSERT policy structure + the WITH CHECK ownership invariant (extend the existing harness)
- [ ] Manual test script/checklist for: anon vs authenticated insert (live, anon key), Turnstile-fail path (CF test keys), email-change pending UX, direct-PostgREST bypass check (Open Question 1)
- [ ] Framework install: none — Vitest 4.1.7 already configured.

*Existing `submissions.ts` has no unit test; extend it for the owner-scoped read mapping if logic is added.*

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth/GoTrue; `updateUser` for credential change; existing `useAuth` session handling. |
| V3 Session Management | yes (no new code) | Supabase-managed sessions (localStorage + auto-refresh, Phase 3 D-13). No new session logic. |
| V4 Access Control | yes (CRITICAL) | RLS is the boundary: `wishlists_owner_*` (existing) + NEW `customization_submissions` INSERT WITH CHECK enforcing `user_id` ownership (D-01). UI guards are UX only. |
| V5 Input Validation | yes | Zod per-step validation + email-format (D-02); jsonb payload is structured by the client schema; the admin renders payload as text (no eval). |
| V6 Cryptography | no (none hand-rolled) | All token/secret handling delegated to GoTrue + Cloudflare; Turnstile secret stored via `supabase secrets`. |
| V13 API / Web Service (Edge Function) | yes | CORS restricted to site origin; `verify_jwt` posture deliberate; Turnstile siteverify server-side; secret never client-side. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user submission insert (set someone else's `user_id`) | Tampering / Elevation | INSERT RLS WITH CHECK `user_id = auth.uid()` (D-01); for service-role path, set `user_id` from verified JWT in function code. |
| Turnstile secret exposure | Information Disclosure | Secret only in Edge Function env (`supabase secrets set`); site key is public. |
| Turnstile bypass (direct PostgREST insert) | Spoofing / DoS (spam) | Open Question 1 — service-role-only insert model if strict mandate required; else accept owner-scoped, rate-limitable risk. |
| Token replay | Spoofing | Single-use, 300s tokens; reset widget per submit (Pitfall 3). |
| Open redirect via `?next=` | — | Existing `safeReturnTo()` sanitizer (D-10/D-16). |
| Email-change account takeover | Spoofing | Keep "Secure email change" ON (double confirmation); render pending UX (D-14). |
| Cross-user wishlist read | Information Disclosure | `wishlists_owner_read` RLS (existing). |
| CORS misconfiguration on Edge Function | — | Restrict `Access-Control-Allow-Origin` to the GitHub Pages origin (Pitfall 2). |

`security_block_on: high` — the cross-user insert invariant (V4) and the Turnstile-bypass decision (Open Question 1) are the high-severity items the plan must explicitly resolve and verify.

## Project Constraints (from CLAUDE.md)

- **Supabase-direct, no Express/server layer** — the Edge Function is the only server-side compute; it is NOT a revived API layer.
- **TypeScript strict** (`tsconfig` `strict: true`) — verify with `npm run check`.
- **Data layer in `lib/*.ts`** with snake→camel mapping at the boundary; components consume hooks only, never query Supabase directly.
- **RLS is the security boundary** — UI guards (AuthGuard/AdminGuard) are UX only; never rely on client checks for access control.
- **Heavy/optional deps lazy/code-split** out of the public bundle (TipTap, HEIC precedent) — apply to the Turnstile widget.
- **Versioned migrations** (`supabase/migrations/*.sql`, next number after `0006` → `0007`), following the non-recursive / locked-`search_path` / `(select auth.uid())` conventions in 0001/0002/0004.
- **Anon key + RLS** is the public-client security model; secrets (service role, Turnstile secret) never `VITE_`-prefixed, never bundled.
- **Naming:** PascalCase components, camelCase utils/hooks, default-export components, named-export utils/types.
- **GitHub Pages sub-path base** (`import.meta.env.BASE_URL`) — every route/redirect must be base-aware (relevant for the email-change redirect).
- **GSD workflow enforcement** — edits go through a GSD command.

## Sources

### Primary (HIGH confidence)
- Codebase: `supabase/migrations/0001`,`0002`,`0004`; `client/src/lib/{catalog,admin,submissions,supabase,queryClient}.ts`; `client/src/auth/{AuthProvider,useAuth,AdminGuard}.tsx`; `client/src/pages/{Login,Questionnaire}.tsx`, `pages/admin/Submissions.tsx`; `client/src/components/{ProductCard,ProductDetail,Navbar}.tsx`; `supabase/config.toml`; `supabase/tests/*.sql`; `package.json`; live-ops memory.
- [Cloudflare Turnstile — Server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) — siteverify endpoint, params, single-use/300s constraints.
- [Supabase Edge Functions — Quickstart](https://supabase.com/docs/guides/functions/quickstart) — scaffold/serve/deploy/invoke commands, project structure.
- [Supabase Edge Functions — Auth/RLS](https://supabase.com/docs/guides/functions/auth) — user-JWT vs service-role client, env vars, verify_jwt.
- [Supabase Edge Functions — CORS](https://supabase.com/docs/guides/functions/cors) — corsHeaders + OPTIONS preflight pattern.
- [Supabase JS — auth.updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser) — email/password update API.

### Secondary (MEDIUM confidence)
- [Supabase General configuration / Secure email change](https://supabase.com/docs/guides/auth/general-configuration) — double-confirmation behavior.
- [GitHub Discussion #42520 — Secure Email Change UX](https://github.com/orgs/supabase/discussions/42520) — pending-state detection.
- [GitHub Discussion #15631 — authorize user AND bypass RLS in Edge Functions](https://github.com/orgs/supabase/discussions/15631) — JWT vs service-role tradeoff.
- [TanStack Query — Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) — cancel/snapshot/rollback pattern.

### Tertiary (LOW confidence)
- npm registry metadata for `@marsidev/react-turnstile` 1.5.2 (existence only; not verified via slopcheck) — optional path only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core deps already installed and in use; only the Turnstile client integration is new (hosted script, no dep).
- Architecture (wishlist/profile/history): HIGH — direct re-application of audited Phase 2–4 patterns + existing RLS.
- RLS INSERT policy (D-01): HIGH — extends the exact documented idiom already in `0002`/`0004`.
- Edge Function + Turnstile (D-03): MEDIUM — pattern verified against official docs; not yet built locally; `withSupabase` vs classic-pattern and verify_jwt posture need a first-run confirmation. The (a)/(b) bypass tradeoff is a real open decision.
- Email-change UX (D-14): MEDIUM — behavior documented; exact Auth-setting state should be confirmed in the dashboard.
- Pitfalls: HIGH for the codebase-derived ones; MEDIUM for the Edge Function ones (doc-derived).

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable codebase; Supabase Edge Function docs are moving — re-verify the `withSupabase` vs classic pattern and verify_jwt config if building >30 days out).
