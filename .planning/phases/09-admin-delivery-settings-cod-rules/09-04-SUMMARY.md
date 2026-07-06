---
phase: 09-admin-delivery-settings-cod-rules
plan: 04
type: summary
wave: 3
requirements: [DLVR-01, DLVR-02, DLVR-04]
status: complete
---

# Plan 09-04 Summary — Deploy delivery-estimate + end-of-phase live UAT

BLOCKING-HUMAN gate. The owner (who holds the Supabase credentials) ran the deploy
and exercised the live UAT loop; the agent has no creds and cannot deploy or verify
the live function. This SUMMARY records the confirmed outcomes.

## Task 1 — Deploy (owner-run)

- **Command:** `supabase functions deploy delivery-estimate` (no `--linked`)
- **Result:** ✓ Owner confirmed deploy reported success against ref `wfbnrcnmpcqzeyjlfflv`.
- **Secrets/migrations:** None required — `TURNSTILE_SECRET_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` already present and unchanged; values-only phase (no new
  keys, tables, or migrations).

The Phase-9 `delivery-estimate` function (09-02 admin branch + cache purge) is now live.

## Task 2 — Live UAT sign-off

Owner signed off: **"Phase 9 SC1–SC5 verified live"** — all scenarios pass.

| # | Scenario | SC / D-ref | Result |
|---|----------|-----------|--------|
| a | Admin preview: typed (unsaved) origin, no Turnstile challenge | SC1 / D-07, D-08 | ✓ PASS |
| b | Public path unchanged: token-less anon call → `captcha_failed` | D-07 | ✓ PASS |
| c | Origin gate: 000000/non-serviceable → ✗ Save disabled; serviceable → ✓ enabled | SC1 / D-10 | ✓ PASS |
| d | Cache purge: change COD fee, Save → live estimate updates immediately (no 24h TTL) | SC5 / D-11 | ✓ PASS |
| e | Default weight + dispatch lead → live estimate cost/ETA reflect new values | SC2 | ✓ PASS |
| f | COD toggle off → estimator shows unavailable; back on → fee/cap retained | SC3 / D-13 | ✓ PASS |
| g | Free-ship threshold set → static "free over ₹X"; cleared → messaging gone | SC4 / D-14, D-19 | ✓ PASS |

## Success criteria

- ✓ SC1 — admin sets/edits origin with validation + live preview (no Turnstile, honors typed origin)
- ✓ SC2 — default weight + dispatch lead flow into live estimates
- ✓ SC3 — COD toggle/fee/cap reflected in the customer estimator
- ✓ SC4 — free-ship threshold surfaces static "free over ₹X"
- ✓ SC5 — all settings ride site_content + cache purge → live with no redeploy
- ✓ Public Turnstile path unchanged (token-less anon still `captcha_failed`)

## Self-Check: PASSED
