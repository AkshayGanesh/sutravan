---
phase: 05-customer-experience-wishlist-profile-native-questionnaire
plan: 03
subsystem: ui
tags: [react, react-hook-form, zod, turnstile, supabase-edge-function, wizard, questionnaire]

# Dependency graph
requires:
  - phase: 05-customer-experience-wishlist-profile-native-questionnaire
    provides: "Plan 02 — deployed verify-and-submit Edge Function (Turnstile siteverify + caller-JWT insert) + migration 0007 anon+auth INSERT RLS with the D-01 ownership WITH CHECK"
  - phase: 03-authentication-roles
    provides: "useAuth() ({ session, user, role, loading }) for name/email prefill+lock and the authenticated user_id"
  - phase: 04-admin-portal-catalog-content-management
    provides: "read-only admin submissions inbox (Submissions.tsx) that now receives real wizard rows, pretty-printing payload under a 'Details' field"
provides:
  - "Native multi-step questionnaire wizard at /questionnaire replacing the iframed Google Form (D-04/D-06) — public, anon-allowed (D-01)"
  - "questionnaire.ts — questionnaireSchema (Zod), STEP_FIELDS, the pure D-05 toSubmission(values, userId) mapper, and the submitQuestionnaire(token, submission) Edge-Function invoke wrapper"
  - "turnstile.ts — loadTurnstile() lazy CDN-script injector keeping the widget out of the main bundle"
  - "questionnaire.test.ts — 9 passing Vitest cases pinning the D-05 column-vs-payload + null-user_id + empty-message mapping"
affects: [profile, plan-05-04, customer-account, admin-submissions-inbox]

# Tech tracking
tech-stack:
  added: ["Cloudflare Turnstile (client widget, lazy CDN-loaded)"]
  patterns:
    - "camelCase wizard values -> DB row shape mapped ONCE at the data-layer boundary (toSubmission), mirroring admin.ts fromProductForm — no per-component mapping"
    - "Multi-step RHF wizard: one useForm + per-step form.trigger(STEP_FIELDS[step]) gate; Continue only advances when the current step validates"
    - "Optional/heavy third-party widget (Turnstile) lazy-injected via a CDN <script> only when the review step mounts — same code-split discipline as TipTap/HEIC"
    - "Edge-Function invoke wrapper throws on error so the page can toast; functions.invoke auto-attaches the session JWT (anon callers carry no auth header -> user_id must be null)"

key-files:
  created:
    - client/src/lib/questionnaire.ts
    - client/src/lib/questionnaire.test.ts
    - client/src/lib/turnstile.ts
  modified:
    - client/src/pages/Questionnaire.tsx

key-decisions:
  - "D-05 mapping lives in the pure toSubmission(values, userId): name/email/skin_type/message are columns; concerns/productInterest/allergies go ONLY into payload jsonb (human-readable keys, since the admin inbox JSON.stringify-renders payload). user_id = caller uid (logged-in) or null (anon, required by 0007 WITH CHECK)."
  - "D-08 prefill+lock: logged-in users get name (profile name, else email) + email read-only with 'Using your account details'; D-02 anon users type both, required + email-format validated by the schema."
  - "D-03 Turnstile is lazy-loaded only on the review step and reset after a failed submit (single-use 300s token). Site key is the PUBLIC VITE_TURNSTILE_SITE_KEY (T-05-13); the secret stays server-side (Plan 02)."
  - "D-07 thank-you finale: logged-in shows 'View my requests' -> /profile; anon shows the 'Create an account…' nudge -> /register."
  - "DEV-SETUP (not a code change): the live browser walk required allow-listing localhost on the real Cloudflare Turnstile widget (error 110200 otherwise). Real site+secret keys were kept — production posture intact. VITE_TURNSTILE_SITE_KEY lives in gitignored .env.local."

patterns-established:
  - "Multi-step form pattern: single RHF form + STEP_FIELDS grouping + per-step form.trigger() advance gate + read-back review step before submit"
  - "Customer-side boundary mapper (toSubmission) symmetric to the admin-side fromProductForm — unit-tested in isolation, side-effect free"

requirements-completed: [CUST-03]

# Metrics
duration: ~20min
completed: 2026-06-01
---

# Phase 05 Plan 03: Native Questionnaire Wizard Summary

**The Google Form iframe is gone: /questionnaire is now a branded native multi-step RHF+Zod wizard — per-step validation, name/email prefilled+locked for logged-in users (D-08) and required+email-validated for anon (D-02), a lazy Cloudflare Turnstile on the review step (D-03), submission through Plan 02's verify-and-submit Edge Function under the caller's JWT, and a thank-you finale with the right CTA (D-07). Submissions map to the D-05 shape (skin_type/message as columns; concerns/productInterest/allergies in payload) and were proven live to land in the Phase-4 admin inbox for both anon (user_id=null) and logged-in (caller user_id) paths. This completes the FRONTEND half of CUST-03; with Plan 02's backend, CUST-03 is now fully delivered.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3 (2 auto + 1 blocking-human checkpoint, all complete & approved)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- **questionnaire.ts data layer** — `questionnaireSchema` (Zod; name/email required + email-format, skinType required, concerns array, message optional), `STEP_FIELDS` step grouping, the pure `toSubmission(values, userId)` D-05 mapper (columns vs payload, null/own user_id, empty-message coercion), and `submitQuestionnaire(token, submission)` that invokes `verify-and-submit` and throws on error.
- **questionnaire.test.ts** — 9 Vitest cases passing (9/9): skinType→`skin_type`, message→`message`, concerns/productInterest/allergies under `payload` (NOT columns), `user_id` null vs caller id, undefined message → `''`.
- **turnstile.ts** — `loadTurnstile()` injects `https://challenges.cloudflare.com/turnstile/v0/api.js` once (guarded by a script id), resolves on load / rejects on error — widget stays out of the main bundle. Ambient `window.turnstile` typing for render/reset/getResponse/remove.
- **Questionnaire.tsx** — full native wizard inside `Layout`: serif "Customize your blend" header, "Step n of total" eyebrow, steps About you / Your skin / What you're looking for / Review & send; per-step `form.trigger(STEP_FIELDS[step])` advance gate + Back; D-08 prefill+lock for logged-in / D-02 validated input for anon; lazy Turnstile + token capture + reset-after-fail on review; submit via `toSubmission` + `submitQuestionnaire`; D-07 thank-you finale (logged-in → /profile, anon → /register). The Google Form iframe is fully removed.
- **Live round-trip proven (Task 3, blocking-human, APPROVED):** anon + logged-in submissions both land correct rows in the Phase-4 admin inbox; per-step validation blocks bad input; the Turnstile-fail path inserts nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD): questionnaire schema + D-05 mapper + invoke wrapper + turnstile loader (+ unit tests)** - `af201f7` (feat)
2. **Task 2: Native multi-step wizard Questionnaire.tsx (prefill/lock, per-step validation, Turnstile, thank-you)** - `1f44e59` (feat)
3. **Task 3: [BLOCKING-HUMAN] Verify end-to-end submission (anon + logged-in) lands in the admin inbox** - no code commit (live browser walk: anon + logged-in round-trips + Turnstile-fail no-insert proof); outcomes recorded below.

**Plan metadata:** see the `docs(05-03)` commit carrying this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified
- `client/src/lib/questionnaire.ts` - Zod schema, `QuestionnaireValues`, `STEP_FIELDS`, the pure D-05 `toSubmission` mapper, and the `submitQuestionnaire` Edge-Function invoke wrapper (created).
- `client/src/lib/questionnaire.test.ts` - 9 Vitest cases pinning the D-05 column-vs-payload + null-user_id + empty-message mapping (created, 9/9 passing).
- `client/src/lib/turnstile.ts` - `loadTurnstile()` lazy CDN-script injector + ambient `window.turnstile` typing (created).
- `client/src/pages/Questionnaire.tsx` - native multi-step wizard replacing the iframed Google Form (modified/replaced).

## Decisions Made
- **D-05 mapping at the boundary:** `toSubmission` is the single, pure, unit-tested place where camelCase wizard values become the snake/payload DB row — symmetric to `admin.ts` `fromProductForm`. `skin_type`/`message` are columns; concerns/productInterest/allergies live only in `payload` with human-readable keys (the admin inbox `JSON.stringify`-renders payload).
- **D-08 / D-02 dual identity handling:** one schema serves both — logged-in users get name/email prefilled (name from profile, else email) and read-only ("Using your account details"); anon users type them with required + email-format validation.
- **D-03 lazy Turnstile + token hygiene:** the widget loads only on the review step and is reset after a failed submit (single-use, 300s). The site key is the public `VITE_TURNSTILE_SITE_KEY`; the secret stays server-side in the Edge Function (Plan 02).
- **D-07 thank-you CTA branches on auth:** logged-in → "View my requests" (/profile); anon → "Create an account…" nudge (/register).

## Deviations from Plan

None — plan executed exactly as written. (Tasks 1 & 2 met all acceptance-criteria greps and `npm run check` / `npm run build` / `npm test` gates on the first pass; Task 3 was a human verification gate, not implementation.)

## Issues Encountered

**Dev-setup note (environment, not a code change):** The live browser walk against the *real* Cloudflare Turnstile widget initially returned widget error `110200` because `localhost` was not an allowed hostname on the production Turnstile widget. Resolved by allow-listing `localhost` on the Cloudflare widget for the dev session — the real site key and the server-side real secret key were kept unchanged (production security posture intact). `VITE_TURNSTILE_SITE_KEY` is supplied via the gitignored `.env.local`. No source change resulted from this; recorded for reproducibility of future local verification.

## Live Verification Results (Task 3, blocking-human — APPROVED)

- **Anon submission:** row inserted with `user_id = null` and the typed name/email/skin_type/message; concerns/productInterest/allergies appear under the payload "Details" pretty-print in the Phase-4 admin inbox. ✓
- **Logged-in submission:** name/email prefilled + read-only; the row carries the caller's `user_id`; the thank-you screen offers "View my requests" → /profile. ✓
- **Per-step validation:** Continue is blocked until each step validates; an invalid email surfaces "Enter a valid email address." ✓
- **Turnstile-fail no-insert:** an invalid/failed Turnstile token inserts nothing — proven via a live `curl` with the real secret earlier this session (HTTP 400 `captcha_failed`, no row), consistent with Plan 02's server-side siteverify gate. ✓

## Known Stubs
None. The wizard is fully wired end-to-end: schema → pure mapper → Edge Function → owner-scoped insert → admin inbox, with every step proven live.

## Threat Flags
None — no security surface beyond the plan's `<threat_model>` was introduced. The client passes `user.id` for logged-in users but the authoritative gate is Plan 02's 0007 WITH CHECK enforced server-side under the caller's JWT (T-05-11). The Turnstile site key is the public key (T-05-13); the secret stays server-side. The admin inbox renders `payload` as text via `JSON.stringify` inside a `<pre>` (T-05-14).

## User Setup Required
None new for this plan beyond what Plan 02 recorded. The PUBLIC `VITE_TURNSTILE_SITE_KEY` is consumed by the client widget here and is supplied via the gitignored client env (`.env.local` for dev; the deploy env for production). For local end-to-end testing against the real widget, `localhost` must be in the Turnstile widget's allowed hostnames (see Issues Encountered).

## Next Phase Readiness
- **CUST-03 is now fully delivered** (backend Plan 02 + frontend Plan 03): the native wizard replaces the Google Form, verifies Turnstile, and lands owner-scoped rows in the admin inbox.
- **Plan 05-04 (Profile)** is the only remaining plan in Phase 5. The thank-you "View my requests" CTA already points at `/profile`, which 05-04 will build (owner-scoped submission history reading the same `customization_submissions` rows this wizard writes).

## Self-Check: PASSED

- Created files exist on disk: `client/src/lib/questionnaire.ts`, `client/src/lib/questionnaire.test.ts`, `client/src/lib/turnstile.ts` — all FOUND. `client/src/pages/Questionnaire.tsx` (modified) FOUND.
- Commits exist in git log: `af201f7` (Task 1, feat), `1f44e59` (Task 2, feat) — both FOUND.
- Gates green: `npm run check` + `npm run build` pass; `npm test` questionnaire suite 9/9.
- Live verification (Task 3): anon (user_id=null) + logged-in (caller user_id) rows land in the admin inbox with correct payload; per-step validation blocks bad input; Turnstile-fail inserts nothing — APPROVED by the human.

---
*Phase: 05-customer-experience-wishlist-profile-native-questionnaire*
*Completed: 2026-06-01*
