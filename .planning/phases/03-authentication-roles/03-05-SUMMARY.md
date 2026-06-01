---
phase: 03-authentication-roles
plan: 05
subsystem: auth
tags: [supabase, auth, password-reset, implicit-flow, wouter, react-hook-form, zod, github-pages]

requires:
  - phase: 03-authentication-roles
    provides: "Hosted Site URL https://sutravan.in + exact /reset-password in the Redirect allowlist (03-01); useAuth/<AuthProvider> onAuthStateChange already mounted + mapAuthError from @/lib/authErrors (03-02); /login 'Forgot password?' link + Login form shell + safeReturnTo (03-03); /admin/* routes + base prop (03-04)"
provides:
  - "Route /reset-password -> ResetPassword page (two-step implicit-flow reset)"
  - "Request mode: supabase.auth.resetPasswordForEmail(email, { redirectTo }) with a base-aware redirectTo built from BASE_URL + window.location.origin"
  - "Recovery mode: PASSWORD_RECOVERY event -> set-new-password form -> supabase.auth.updateUser({ password }) -> token stripped from URL via history.replaceState"
affects: []

tech-stack:
  added: []
  patterns:
    - "Two-step page driven by local recoveryMode state: same Layout+Card chrome, two RHF+Zod forms toggled by the PASSWORD_RECOVERY auth event"
    - "Base-aware redirectTo = new URL(BASE_URL.replace(/\\/$/,'') + '/reset-password', window.location.origin) — same base mechanism as App.tsx's Wouter base prop, so it resolves to the hosted allowlist entry in prod and to the dev origin locally"
    - "Recovery token cleared from history via history.replaceState(null,'',pathname) after a successful updateUser (anti-lingering-token)"

key-files:
  created:
    - client/src/pages/ResetPassword.tsx
  modified:
    - client/src/App.tsx

key-decisions:
  - "redirectTo built base-aware from import.meta.env.BASE_URL + window.location.origin (NOT hardcoded) so local dev and the production custom domain both work; in production it resolves to the exact hosted allowlist entry https://sutravan.in/reset-password (Plan 01, Pitfall 1)"
  - "Request-success copy is non-committal ('If an account exists, a reset link has been sent') to avoid email enumeration (D-14 / T-3-06)"
  - "New-password form requires confirm-password match (Zod refine) on top of the D-07 min-6 rule"
  - "No createClient option overrides — detectSessionInUrl + implicit flow are supabase-js defaults; no hash router introduced (path-based Wouter + 404.html fallback preserved — T-3-16 / RESEARCH Pattern 4)"

requirements-completed: [AUTH-02]

duration: ~3min
completed: 2026-06-01
---

# Phase 3 Plan 05: Password Reset Round-Trip Summary

**A two-step `/reset-password` page completes the only email-dependent auth flow this phase keeps: request mode calls `resetPasswordForEmail` with a base-aware `redirectTo` matching the hosted allowlist, and recovery mode — triggered by the `PASSWORD_RECOVERY` event after the emailed link returns — renders a set-new-password form that calls `updateUser({ password })` and then strips the recovery token from the URL.**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-06-01
- **Tasks:** 2 (both autonomous)
- **Files:** 2 (1 created, 1 modified)

## Accomplishments

- **ResetPassword page** (`client/src/pages/ResetPassword.tsx`, default-export `ResetPassword`) in the `<Layout>` + Card chrome, mirroring the `Login.tsx` form shell (RHF + `zodResolver`, inline `FormMessage` per field, a form-level `<p role="alert">` for mapped errors, radix `useToast()` for success — NOT Sonner).
  - **Request mode** (default): single email field (Zod valid-email). Submits `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. On success a non-enumerating toast ("If an account exists, a reset link has been sent" — D-14); errors mapped via `mapAuthError` (covers the 2/hr rate-limit message, Pitfall 5).
  - **Recovery mode**: a `useEffect` subscribes to `supabase.auth.onAuthStateChange` and flips `recoveryMode` on the `PASSWORD_RECOVERY` event (supabase-js auto-parses the `#access_token=...&type=recovery` hash via the default `detectSessionInUrl`). Renders a new-password form (Zod min 6 — D-07, plus a confirm-password match `refine`) that calls `supabase.auth.updateUser({ password })`, then `history.replaceState(null, '', window.location.pathname)` to strip the token (T-3-14), toasts success, and navigates to `/login`. Subscription is cleaned up on unmount.
  - No hash router; no extra `createClient` options.
- **App.tsx** — imported `ResetPassword` from `@/pages/ResetPassword` and added `<Route path="/reset-password" component={ResetPassword} />` above the catch-all `<Route component={NotFound} />`. `/login`, `/register`, `/admin/*` and the Wouter `base` prop left untouched.

## redirectTo value built (confirm vs Plan 01 hosted allowlist)

`buildResetRedirect()` returns:

```
new URL(import.meta.env.BASE_URL.replace(/\/$/, "") + "/reset-password", window.location.origin).toString()
```

- **Production** (deployed build base `/`, origin `https://sutravan.in`) → resolves to **`https://sutravan.in/reset-password`** — an EXACT match for the Plan 01 hosted Redirect allowlist entry (03-01-SUMMARY "Hosted Auth Config" table). Pitfall 1 satisfied.
- **Local dev** (origin `http://127.0.0.1:3200` or `:3000`) → resolves to `http://127.0.0.1:<port>/reset-password`, which Plan 01 added to `additional_redirect_urls` for local parity.

## Task Commits

1. **Task 1: ResetPassword two-step implicit-flow reset** — `d6b6829` (feat)
2. **Task 2: wire /reset-password route in App.tsx** — `13bf2d3` (feat)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

- `client/src/pages/ResetPassword.tsx` (created) — two-step reset page: `resetPasswordForEmail` request + `PASSWORD_RECOVERY`/`updateUser` recovery + token cleanup.
- `client/src/App.tsx` (modified) — `/reset-password` route added above the catch-all; base prop and prior routes intact.

## Threat Model Coverage

| Threat ID | Disposition | How handled |
|-----------|-------------|-------------|
| T-3-04 | mitigate | `redirectTo` built from `window.location.origin` + `BASE_URL`; resolves to the exact hosted allowlist entry in prod (no attacker-controlled host). |
| T-3-14 | mitigate | `history.replaceState` strips the recovery token from the URL/history after `updateUser`. |
| T-3-06 | mitigate | Request-success copy is generic ("if an account exists…") — no email enumeration. |
| T-3-15 | accept | 2/hr built-in rate limit mapped to friendly copy; owner-only volume is far under it. |
| T-3-16 | mitigate | Path-based Wouter router + 404.html fallback kept; no hash router introduced. |
| T-3-SC | accept | No new package installs — all deps pre-existing. |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. `npm run check` exited 0 after both tasks; `npm run build` exited 0 after Task 2 (only the pre-existing >500 kB chunk-size advisory, unrelated to this plan). All grep gates passed.

## Manual Verification (D-02 reset round-trip) — deferred to end-of-phase

Per `config.json` `human_verify_mode: end-of-phase` and VALIDATION.md, the live reset round-trip runs at the phase verify gate (built-in email ≤2/hr — space out attempts). Pending check:
1. From `/login` click "Forgot password?" → request a reset for the owner email → receive the email → click the link → lands on `/reset-password` (under BASE_URL, via the 404.html SPA fallback) → page switches to the new-password form (PASSWORD_RECOVERY fired, token parsed from the hash) → set a new password → the URL no longer shows the token → log in with the new password successfully.

Requires Plan 01's hosted Site URL/redirect allowlist live (confirmed live in 03-01-SUMMARY).

## Next Phase Readiness

- The password-reset round-trip is the last auth vertical slice owned by this phase; only Plan 06 (admin bootstrap) remains in the wave plan. No downstream slice depends on this plan's artifacts.

## Self-Check: PASSED

- `client/src/pages/ResetPassword.tsx` — FOUND
- `client/src/App.tsx` reset-password route — FOUND
- Commit `d6b6829` — FOUND
- Commit `13bf2d3` — FOUND

---
*Phase: 03-authentication-roles*
*Completed: 2026-06-01*
