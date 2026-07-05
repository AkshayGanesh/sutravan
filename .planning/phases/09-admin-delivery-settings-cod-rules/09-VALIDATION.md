---
phase: 9
slug: admin-delivery-settings-cod-rules
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 09-RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.7 |
| **Config file** | none — Vite-integrated; tests colocated as `*.test.ts` |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>` + `npm run check` (tsc)
- **After every plan wave:** Run `npm test` (full vitest suite) + `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Task IDs are indicative — the planner assigns final IDs. Map keyed by success criterion.

| SC | Requirement | Behavior | Test Type | Automated Command | File Exists |
|----|-------------|----------|-----------|-------------------|-------------|
| SC1 | DLVR-01 | Origin Zod: 6-digit, `000000` rejected, invalid rejected | unit | `npx vitest run client/src/pages/admin/deliverySchema.test.ts` | ❌ W0 |
| SC1 | DLVR-01 | `previewDelivery` sends `{originPincode,destPincode}`, no token | unit | `npx vitest run client/src/lib/delivery.test.ts` | ⚠️ extend existing |
| SC1 | DLVR-01 | Preview string "From X to Y: ₹X, A–B working days" + COD | unit (formatter) | `npx vitest run client/src/pages/admin/deliverySchema.test.ts` | ❌ W0 |
| SC2 | DLVR-02 | Weight int 1–2000, lead int 0–14; decimals/negatives rejected | unit | `npx vitest run client/src/pages/admin/deliverySchema.test.ts` | ❌ W0 |
| SC2 | DLVR-02 | Lead flows into live eta | manual/live UAT | human UAT | n/a |
| SC3 | DLVR-04 | COD JSON round-trip `{enabled,fee,valueCap}`, malformed→off, blank cap→null | unit (codec) | `npx vitest run client/src/lib/codRules.test.ts` | ❌ W0 |
| SC3 | DLVR-04 | Customer estimator reflects COD change after save+purge | manual/live UAT | human UAT | n/a |
| SC4 | DLVR-04 | Free-ship threshold blank→null; static "free over ₹X" | unit + manual | `npx vitest run` + human UAT | ❌ W0 / manual |
| SC5 | DLVR-01/02/04 | Save upserts `site_content` + invalidates `['siteContent']` + purges cache; edit appears live | integration/live UAT | human UAT (edit → save → re-estimate cached route) | n/a |
| — | DLVR-01 | `checkServiceable` maps known/serviceable/label | unit (mock supabase) | `npx vitest run client/src/lib/pincodes.test.ts` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/src/pages/admin/deliverySchema.test.ts` — Zod bounds D-15 (int/min/max, blank→null, `000000` reject, COD-fee-required-when-enabled) — covers SC1/SC2/SC4
- [ ] `client/src/lib/codRules.test.ts` — pure parse/stringify codec for `delivery_cod_rules` (round-trip, malformed→off, blank cap→null) — covers SC3
- [ ] `client/src/lib/pincodes.test.ts` — `checkServiceable` mapping (known/unknown/serviceable/label) — covers D-09
- [ ] Extend `client/src/lib/delivery.test.ts` — `previewDelivery` sends `{originPincode,destPincode}` with no token; error mapping reused

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edge-function admin branch: admin call skips Turnstile, honors `originPincode` | DLVR-01 | Deno function — not in the vitest tree; no in-repo function harness | Live UAT: from `/admin/delivery`, click Preview with a typed (unsaved) origin → estimate returns without a Turnstile challenge and reflects the typed origin |
| Public Turnstile path unchanged | DLVR-01 (security) | Deno function; live-only | Live UAT: a token-less anon `delivery-estimate` call still returns `captcha_failed` |
| Cache purge on save (SC5) | DLVR-01/02/04 | Requires the deployed function + live cache rows | Live UAT: change COD fee → Save → re-estimate a previously-cached route → new fee appears immediately (not after 24h TTL) |
| Lead/weight flow into live estimates | DLVR-02 | Requires deployed function + live settings | Live UAT: change weight/lead → Save → estimate reflects new values |

*Edge-function logic is the one area without automated in-repo coverage (Deno runtime, no function test harness) — validated by live human UAT, consistent with how the Phase 6 function and `verify-and-submit` were verified. The live function redeploy + purge is BLOCKING-HUMAN (agent has no Supabase creds; see `supabase-live-ops` memory).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (edge-function branch is manual-only, documented above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-05 (plan-checker verification passed; wave_0_complete flips true after Wave 0 executes)
