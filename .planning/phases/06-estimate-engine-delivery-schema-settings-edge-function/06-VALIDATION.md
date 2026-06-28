---
phase: 6
slug: estimate-engine-delivery-schema-settings-edge-function
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `06-RESEARCH.md` § "Validation Architecture". This repo has
> **no unit-test framework** (verified) — validation runs through node verify
> scripts (`node --env-file=.env.seed.local scripts/*.ts`) + `supabase functions
> invoke` smoke tests against the live project.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — node service-role scripts + `supabase functions invoke` (no jest/vitest in repo) |
| **Config file** | none |
| **Quick run command** | `node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` (DB/RLS/seed assertions) |
| **Full suite command** | `echo y \| ./node_modules/.bin/supabase db push --linked` → `node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` → `node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts` (+ `SMOKE_COMPUTE=1` under the Turnstile test-secret swap) |
| **Estimated runtime** | ~30 seconds (network round-trips to live Supabase) |

---

## Sampling Rate

- **After every task commit:** Run the relevant verify script (`verify-delivery-seed.ts` for Plans 01/02, `verify-delivery-estimate.ts` for Plan 03).
- **After every plan wave:** Wave 1 → `db push --linked` + `verify-delivery-seed.ts` (PINCODES_OPTIONAL); Wave 2 → `verify-delivery-seed.ts` full gate; Wave 3 → `verify-delivery-estimate.ts` (token-free + compute under test secret).
- **Before `/gsd-verify-work`:** All 5 ROADMAP success criteria smoke-tested green.
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

> Each task ties to one of the 5 ROADMAP success criteria via a named assertion in
> `scripts/verify-delivery-seed.ts` or `scripts/verify-delivery-estimate.ts`
> (RESEARCH § Validation Architecture). SC = ROADMAP success criterion.

| Task ID | Plan | Wave | Requirement | SC | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|----|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DLVR-05 | SC4, SC5 | T-6-01 | Cache table deny-direct (RLS enabled, zero policies); pincodes/profiles schema correct | static | `grep` gate: `0017` has no `create policy`; `0015`/`0018` shapes present | ✅ this task | ⬜ pending |
| 06-01-02 | 01 | 1 | DLVR-05 | SC5 | T-6-02 | 5 settings keys + 20-row monotonic slab grid; verify harness scaffolded | static + scaffold | `grep -c` 5 keys / 20 slab rows; `verify-delivery-seed.ts` created | ✅ this task | ⬜ pending |
| 06-01-03 | 01 | 1 | DLVR-05 | SC4, SC5 | T-6-01 | Live schema applied + idempotent; deny-direct cache + slab/settings/profiles proven | integration (seed) | `echo y \| supabase db push --linked` → `PINCODES_OPTIONAL=1 node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` | ✅ W0 (06-01-02) | ⬜ pending |
| 06-02-01 | 02 | 2 | DLVR-05 | SC5 | T-6-12 | Source dataset acquired (human-action; no automated fetch) | manual gate | `test -f scripts/data/pincodes-raw.csv && wc -l > 100000` | n/a (input) | ⬜ pending |
| 06-02-02 | 02 | 2 | DLVR-05 | SC5 | T-6-04 | Normalized NDJSON: dedupe + is_metro/is_remote + canonical state (no `&`) | static + data assert | `node scripts/transform-pincodes.ts` → 15k-21k lines, no `&` state, metro+remote present | ✅ this task | ⬜ pending |
| 06-02-03 | 02 | 2 | DLVR-05 | SC5 | T-6-03 | ~19.5k pincodes seeded idempotently via service-role chunked upsert | integration (seed) | `node --env-file=.env.seed.local scripts/seed-pincodes.ts` → `node --env-file=.env.seed.local scripts/verify-delivery-seed.ts` (full gate, pincodes ≥ 15000) | ✅ W0 (06-01-02) | ⬜ pending |
| 06-03-01 | 03 | 3 | DLVR-05 | SC1, SC2 | T-6-09, T-6-10 | Validate-before-compute; origin-relative slab estimate behind callCourierAdapter; cache guarded by originConfigured | static | `grep` gate: regex before `siteverify`; callCourierAdapter/deriveZone/roundUpTo10/AbortController; reads pincodes/slabs/cache/site_content; no `VITE_` | ✅ this task | ⬜ pending |
| 06-03-02 | 03 | 3 | DLVR-05 | SC1 | T-6-06 | verify_jwt=false registration; function deployed live | config + deploy | `grep verify_jwt=false` + `supabase functions deploy delivery-estimate` | ✅ this task | ⬜ pending |
| 06-03-03 | 03 | 3 | DLVR-05 | SC1, SC2, SC3, SC4 | T-6-05, T-6-06, T-6-07, T-6-08, T-6-01 | Bad-format→400; no-secret bundle; bad Origin not echoed; deny-direct cache; (compute) serviceable integer cost + non-serviceable + cache hit | smoke + RLS probe | `node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts` (token-free) + `SMOKE_COMPUTE=1` under test-secret swap | ✅ this task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-delivery-seed.ts` — SC4 (deny-direct cache anon probe) + SC5 assertions (5 settings keys, slabs=20 + monotonic, profiles.default_pincode, pincodes ≥ 15000 with skippable `PINCODES_OPTIONAL`). Created in **06-01-02**, consumed by 06-01-03 + 06-02-03.
- [ ] `scripts/verify-delivery-estimate.ts` — smoke assertions for SC1/SC2/SC3/SC4 (serviceable estimate, invalid/non-serviceable rejection, CORS/no-secret posture, cache hit). Created in **06-03-03**.
- [ ] `scripts/transform-pincodes.ts` + `scripts/data/pincodes.ndjson` — dataset transform (06-02-02); `scripts/seed-pincodes.ts` loader (06-02-03).

*Repo has no test framework; the verify scripts ARE the automated coverage.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| India Post dataset acquisition | DLVR-05 / SC5 | One-time human download from data.gov.in (no automated fetch — RESEARCH Open Question 3) | Download All-India Pincode Directory CSV (dataset 6818292) → save `scripts/data/pincodes-raw.csv`; Claude runs the transform |
| Compute-path Turnstile-gated smoke | DLVR-05 / SC1, SC2, SC4 | The deployed function requires a passing Turnstile token; safe procedure swaps to Cloudflare's test secret then restores the real one | Set `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`, run `SMOKE_COMPUTE=1 node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts`, then restore the real secret (06-03-03 `<human-check>`) |

---

## Validation Sign-Off

- [x] All tasks map to a verify-script assertion or Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has an `<automated>` command)
- [x] Wave 0 covers the verify scripts + seed loader
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
