---
phase: 5
slug: customer-experience-wishlist-profile-native-questionnaire
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-02
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Threat register authored at plan time across all four plans (05-01..05-04 `<threat_model>`);
execution summaries confirm "no security surface beyond the plan's threat_model was introduced,"
with several mitigations verified live during execution. Code-evidence spot-check (2026-06-02)
confirmed the key controls exist in the implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser client → Supabase PostgREST (`wishlists`) | Untrusted anon/auth key crosses; RLS on `wishlists` is the only gate. | user_id, product_id |
| logged-out heart tap → `?next=` redirect | Untrusted current-location string feeds the login redirect. | return path (untrusted) |
| browser → Edge Function (`verify-and-submit`) | Untrusted submission body + Turnstile token; function holds the only server-side secret. | submission payload, Turnstile token |
| Edge Function → PostgREST (`customization_submissions` INSERT) | Insert crosses under caller JWT; RLS WITH CHECK (0007) is the ownership gate. | user_id, payload |
| browser → PostgREST direct (`customization_submissions` INSERT) | Function bypassable; 0007 still scopes `user_id`, Turnstile skippable on this path. | user_id, payload |
| browser → `profiles` UPDATE | Untrusted name update; RLS + role-lock trigger gate it. | name (role change blocked) |
| browser → GoTrue `updateUser` (email/password) | Credential change handled by Supabase Auth, not app code. | email, password (TLS) |
| browser → `customization_submissions` SELECT (own history) | RLS admin-or-owner SELECT scopes rows to the caller. | own submission rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | `wishlists` SELECT (cross-user read) | mitigate | `wishlists_owner_read` RLS `(select auth.uid()) = user_id` (0002); no service-role path in `useWishlist`. | closed |
| T-05-02 | Tampering / Elevation | `wishlists` INSERT (forge `user_id`) | mitigate | `wishlists_owner_insert` WITH CHECK `(select auth.uid()) = user_id` (0002) rejects forged ids server-side. | closed |
| T-05-03 | Open Redirect | logged-out heart prompt + AuthGuard `?next=` | mitigate | Audited `safeReturnTo()` (`Login.tsx:44`) — internal leading-slash paths only; `//`/`://` → `/`. Reused by `WishlistButton`. | closed |
| T-05-04 | Spoofing | UI heart "saved" state | accept | Optimistic UI is cosmetic; authoritative state is the RLS-scoped `['wishlist']` query reconciled on `onSettled`. | closed |
| T-05-05 | Tampering / Elevation | `customization_submissions` INSERT (forge `user_id`) | mitigate | 0007 WITH CHECK (auth → `user_id = auth.uid()`, anon → `user_id is null`); insert under caller JWT. Verified live (Task 3.6). | closed |
| T-05-06 | Tampering | Edge Function insert path | mitigate | Function uses caller `Authorization` header, NOT service role — confirmed `grep SERVICE_ROLE` empty in `supabase/functions`. | closed |
| T-05-07 | Spoofing / DoS (spam) | Turnstile verification | mitigate | Token verified server-side via `siteverify` (`index.ts:84`); secret in function env only; invalid → 400, no insert. | closed |
| T-05-08 | Spoofing / DoS (spam) | Direct-PostgREST insert bypassing function | accept | Small handmade brand, no payments: residual risk accepted — every row stays `user_id`-correct (RLS holds). Documented in function header; revisit if spam appears. | closed |
| T-05-09 | Information Disclosure | Turnstile secret exposure | mitigate | `TURNSTILE_SECRET_KEY` via `Deno.env.get` (function env, set via `supabase secrets`); never `VITE_`/bundled. | closed |
| T-05-10 | CORS misconfig | Edge Function response headers | mitigate | `Access-Control-Allow-Origin` restricted to `https://sutravan.in` + localhost dev, never `'*'` (`index.ts:37,45,47`); OPTIONS handled. | closed |
| T-05-SC | Supply Chain / Tampering | Edge Function deps | mitigate | Function imports only `jsr:@supabase/supabase-js@2` (first-party); no new npm client package. No `[ASSUMED]`/`[SUS]` installs. | closed |
| T-05-11 | Tampering | logged-in `user_id` on submit | mitigate | Client passes `user.id` but authoritative gate is 0007 WITH CHECK under caller JWT (T-05-05); tampered id rejected server-side. | closed |
| T-05-12 | Spoofing / DoS | bot spam on public form | mitigate | Turnstile widget on review step + server-side `siteverify`; single-use 300s token reset after failure. | closed |
| T-05-13 | Information Disclosure | Turnstile site key in client | accept | `VITE_TURNSTILE_SITE_KEY` is the PUBLIC site key (safe to bundle); secret stays server-side (T-05-09). | closed |
| T-05-14 | Tampering (XSS via payload) | admin inbox rendering of payload | accept | Payload rendered as `JSON.stringify(...)` text inside `<pre>` (`Submissions.tsx:251`, `Profile.tsx:438`) — no eval/HTML. Zod-shaped validation. | closed |
| T-05-15 | Information Disclosure | `/profile` submission history (cross-user read) | mitigate | `useMySubmissions` rides `customization_submissions_admin_or_owner_read` RLS — non-admin gets only own rows. Verified live (Task 3.5). | closed |
| T-05-16 | Elevation | `profiles` self-update (escalate role via name form) | mitigate | Name form sends only `{ name }`; `enforce_profile_role_lock` BEFORE UPDATE trigger (0004) blocks any role change. No role field in form. | closed |
| T-05-17 | Spoofing (account takeover via email change) | email change flow | mitigate | "Secure email change" ON → GoTrue double-confirmation; UI shows pending notice; address unchanged until link clicked. No app-side bypass. | closed |
| T-05-18 | Open Redirect | logged-out `/profile` → AuthGuard `?next=` | mitigate | AuthGuard reuses `safeReturnTo` (`AuthGuard.tsx:5,47`) — `?next=/profile` internal leading-slash; scheme/`//` rejected. | closed |
| T-05-19 | Information Disclosure | password field handling | accept | Password sent directly to GoTrue over TLS via `updateUser`; never stored/logged client-side. No app-side crypto. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-04 | Optimistic heart UI is cosmetic only; RLS-scoped query is authoritative — a faked client state cannot persist an unauthorized row. | Plan author (05-01) | 2026-06-02 |
| AR-05-02 | T-05-08 | Direct-PostgREST insert can skip Turnstile, but every row stays `user_id`-correct via 0007 RLS; no payments, small brand. Documented in function header; revisit if spam appears. | Plan author (05-02, Open Question 1) | 2026-06-02 |
| AR-05-03 | T-05-13 | `VITE_TURNSTILE_SITE_KEY` is Cloudflare's public site key — safe to bundle; the secret stays server-side. | Plan author (05-03) | 2026-06-02 |
| AR-05-04 | T-05-14 | Admin inbox renders payload as `JSON.stringify` text in `<pre>` — structured values cannot execute; Zod-shaped validation upstream. | Plan author (05-03) | 2026-06-02 |
| AR-05-05 | T-05-19 | Password sent directly to GoTrue over TLS; never stored or logged client-side — no app-side crypto surface. | Plan author (05-04) | 2026-06-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-02 | 20 | 20 | 0 | /gsd-secure-phase (orchestrator, short-circuit: register authored at plan time, code-evidence spot-check) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-02
