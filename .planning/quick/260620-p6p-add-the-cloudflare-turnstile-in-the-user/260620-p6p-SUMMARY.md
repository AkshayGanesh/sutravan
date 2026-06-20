---
phase: quick-260620-p6p
plan: 01
subsystem: auth
tags: [turnstile, captcha, bot-protection, supabase-auth, security]
requires:
  - VITE_TURNSTILE_SITE_KEY (already present in deploy.yml + .env.local)
  - Supabase Bot Protection enabled with Turnstile SECRET key (owner setup)
provides:
  - Reusable TurnstileWidget for unauthenticated auth surfaces
  - captchaToken wired into Login, Register, and Reset REQUEST auth calls
affects:
  - client/src/pages/Login.tsx
  - client/src/pages/Register.tsx
  - client/src/pages/ResetPassword.tsx
tech-stack:
  added:
    - "@marsidev/react-turnstile@^1.5.3"
  patterns:
    - "forwardRef + useImperativeHandle to expose reset() to parent forms"
    - "dev-bypass token when VITE_TURNSTILE_SITE_KEY is absent (local dev)"
key-files:
  created:
    - client/src/components/auth/TurnstileWidget.tsx
  modified:
    - package.json
    - package-lock.json
    - client/src/pages/Login.tsx
    - client/src/pages/Register.tsx
    - client/src/pages/ResetPassword.tsx
decisions:
  - "captchaToken state is string | null; coerced to undefined at each auth call via `captchaToken ?? undefined` to satisfy supabase-js `captchaToken?: string` type"
  - "RECOVERY set-new-password (updateUser) intentionally left captcha-free — runs on an already-authenticated recovery session (D-2)"
  - "Dev-bypass emits a one-time placeholder token so submit stays usable locally; real enforcement is server-side in Supabase only"
metrics:
  duration: ~12min
  completed: 2026-06-20
  tasks: 3
  files: 6
---

# Phase quick-260620-p6p Plan 01: Cloudflare Turnstile in Auth Pages Summary

Added Cloudflare Turnstile bot-protection to the three unauthenticated auth surfaces (Login, Register, Reset-password REQUEST) via Supabase's native CAPTCHA path — a reusable `TurnstileWidget` renders the challenge, captures a token, and passes it as `options.captchaToken` to each `supabase.auth.*` call; the RECOVERY set-new-password sub-form is left untouched.

## What Was Built

- **`client/src/components/auth/TurnstileWidget.tsx`** — a `forwardRef` component wrapping `@marsidev/react-turnstile`. Reads the PUBLIC site key from `VITE_TURNSTILE_SITE_KEY`, exposes an `onToken(token | null)` callback and a `reset()` handle via `useImperativeHandle`. Wires `onSuccess → onToken(token)`, `onError`/`onExpire → onToken(null)`. When the site key is absent it renders a muted dev note and emits a one-time `"dev-bypass"` token so local dev stays submittable.
- **Login / Register / Reset REQUEST** — each now holds a `captchaToken` state + a `turnstileRef`, renders `<TurnstileWidget>` in the existing `space-y-5` flow above the form-level error/submit, gates the submit button with `disabled={... || !captchaToken}`, passes `captchaToken` into its auth call, and resets the widget + clears the token on every failure/expiry path (and on Reset's stay-on-page success).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Verify @marsidev/react-turnstile legitimacy | (pre-cleared by orchestrator) | — |
| 2 | Install package + create TurnstileWidget | 8380ac7 | package.json, package-lock.json, client/src/components/auth/TurnstileWidget.tsx |
| 3 | Wire captchaToken into Login, Register, Reset REQUEST | 9dd626b | client/src/pages/Login.tsx, client/src/pages/Register.tsx, client/src/pages/ResetPassword.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking type error] captchaToken null→undefined coercion at auth call sites**
- **Found during:** Task 3 (`npm run check`)
- **Issue:** supabase-js types `captchaToken` as `string | undefined`, but the component's token state is `string | null`. Passing `{ captchaToken }` directly produced TS2322 in all three pages, failing `npm run check` (a hard constraint).
- **Fix:** Coerced via `captchaToken ?? undefined` at each call site. The submit gate already guarantees a non-null token at call time, so this is purely a type-shape adaptation with no runtime behavior change.
- **Files modified:** client/src/pages/Login.tsx, client/src/pages/Register.tsx, client/src/pages/ResetPassword.tsx
- **Commit:** 9dd626b
- **Side effect on plan verify grep:** The plan's Task 3 `<automated>` check greps for the literal `options: { data: { name }, captchaToken }` in Register. After this fix the line reads `options: { data: { name }, captchaToken: captchaToken ?? undefined }`, so that exact-string grep no longer matches. The intent it guards (captchaToken present in signUp options, name metadata preserved) is fully satisfied — confirmed by `grep -q "captchaToken"` and manual review. All other Task 2/Task 3 grep assertions pass.

## Verification

- `npm run check` — PASS (clean `tsc`, no errors)
- `npm run build` — PASS (Vite bundle includes the new dependency; built in ~2.8s)
- `grep captchaToken` present in Login, Register, ResetPassword — PASS (Reset count = 3)
- RECOVERY `updateUser({ password })` call has NO captchaToken — confirmed captcha-free
- TurnstileWidget references `@marsidev/react-turnstile` and `VITE_TURNSTILE_SITE_KEY` — PASS

## Owner Setup Required (surfaced from plan user_setup)

Native CAPTCHA enforcement only activates once the owner enables it in Supabase:
- **Supabase Dashboard → Authentication → Attack Protection → Bot Protection (CAPTCHA)** → provider = Cloudflare Turnstile → paste the Turnstile **SECRET** key (owner already holds it).

Until then the widget renders and submits work (tokens are accepted but not enforced). Once enabled, every unauthenticated auth request must carry a token — which all three forms now supply. The Turnstile SECRET key never enters the repo or client bundle (only the PUBLIC `VITE_TURNSTILE_SITE_KEY` is referenced client-side).

## Known Stubs

None — the dev-bypass branch is an intentional, documented local-dev affordance, not a stub. Real enforcement lives server-side in Supabase and is unaffected by client behavior.

## Self-Check: PASSED

- FOUND: client/src/components/auth/TurnstileWidget.tsx
- FOUND: commit 8380ac7
- FOUND: commit 9dd626b

## Post-Merge Orchestrator Fix (commit a24e232)

The executor's `npm run check` passed inside its isolated worktree, but the build
**regressed on `main`** once merged. Root cause: the project **already ships a
Cloudflare Turnstile integration** — `client/src/lib/turnstile.ts` (hosted-CDN
`loadTurnstile()` loader) used by `Questionnaire.tsx`. That file declares an
ambient `Window.turnstile` type and its header explicitly states the Turnstile
path **mandates no new client packages**. Adding `@marsidev/react-turnstile`
augmented `window.turnstile` globally, which:
- collided with the ambient declaration → `TS2717` in `turnstile.ts:43`, and
- broke `Questionnaire.tsx:174`'s `render()` return-type assignment.

**Fix:** rewrote `TurnstileWidget.tsx` to use the existing `loadTurnstile()` +
`window.turnstile.render/reset/remove` pattern (same as the questionnaire),
preserving the public `TurnstileWidgetHandle.reset()` + `onToken` interface so
the three auth pages needed **no changes**. Removed the `@marsidev/react-turnstile`
dependency from `package.json`/lockfile.

**Verified on `main`:** `npm run check` PASS · `npm run build` PASS ·
`scripts/check-no-secret.sh` PASS · `TURNSTILE_SECRET` not referenced client-side.

Lesson: the locked decision allowed "npm wrapper OR direct-script"; the direct-script
path was the correct (and already-established) choice for this repo — the wrapper
conflicts with the existing convention.
