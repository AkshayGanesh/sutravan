---
phase: 6
slug: estimate-engine-delivery-schema-settings-edge-function
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `06-RESEARCH.md` § "Validation Architecture". This repo has
> **no unit-test framework** (verified) — validation runs through node verify
> scripts + `supabase functions invoke` smoke tests against the live project.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — node scripts + `supabase functions invoke` (no jest/vitest in repo) |
| **Config file** | none |
| **Quick run command** | `npm run check` (tsc typecheck) |
| **Full suite command** | `node scripts/verify-delivery-estimate.mjs` (planner-defined verify script hitting deployed function) |
| **Estimated runtime** | ~30 seconds (network round-trips to live Supabase) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run the delivery-estimate verify script (post-deploy waves only)
- **Before `/gsd-verify-work`:** All 5 ROADMAP success criteria smoke-tested green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Planner fills this map. Each row ties a task to one of the 5 ROADMAP success
> criteria via the verify script's named assertions (see RESEARCH § Validation Architecture).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | DLVR-05 | T-6-01 / — | {expected secure behavior or "N/A"} | smoke | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-delivery-estimate.mjs` — smoke assertions for all 5 success criteria (serviceable estimate, non-serviceable/invalid-pincode rejection, CORS/secret posture, cache hit within TTL, seeded-defaults-return-real-estimate)
- [ ] `scripts/seed-pincodes.mjs` + `scripts/data/pincodes.ndjson` — pincode dataset loader (service-role)

*Repo has no test framework; the verify script IS the automated coverage.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| India Post dataset acquisition | DLVR-05 | One-time human download/transform from data.gov.in (no automated fetch) | Download All-India Pincode Directory CSV, run transform per RESEARCH § Pincode Seed Strategy, commit `pincodes.ndjson` |
| Deny-direct RLS on `delivery_estimate_cache` | DLVR-05 | Negative RLS test requires anon client attempting direct write | With anon key, attempt `insert`/`select` on `delivery_estimate_cache` → expect 0 rows / permission denied |

---

## Validation Sign-Off

- [ ] All tasks map to a verify-script assertion or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the verify script + seed loader
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills the map)

**Approval:** pending
