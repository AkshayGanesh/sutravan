---
phase: 2
slug: live-catalog-data-migration-public-shop-rewire
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (no jest/vitest/pytest) — `tsc` is the only automated gate; see Wave 0 |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript type-check) |
| **Full suite command** | `npm run check && bash scripts/check-no-secret.sh` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && bash scripts/check-no-secret.sh`
- **Before `/gsd-verify-work`:** `tsc` green, seed idempotent (28 products / 3 categories on two consecutive runs), anon read passes, manual UX parity walk-through
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-seed-count | seed | — | DATA-03 | — | Seed inserts 28 products + 3 categories, idempotent (upsert on slug) | integration (live) | `node --env-file=.env.seed.local scripts/seed.ts && node --env-file=.env.seed.local scripts/verify-seed.ts` | ❌ W0 (add `scripts/verify-seed.ts`) | ⬜ pending |
| 2-no-secret | seed | — | DATA-03 | T-key-leak | No service_role key in client bundle | smoke | `bash scripts/check-no-secret.sh` | ✅ (Phase 1) | ⬜ pending |
| 2-anon-read | rewire | — | DATA-03 | — | Anon key can read seeded products/categories | integration (live) | `node scripts/verify-skeleton.ts` | ✅ (Phase 1) | ⬜ pending |
| 2-types | rewire | — | PUB-01 | — | Shop/Home/ProductGrid/ProductCard/ProductDetail read live data; types compile | unit (type) | `npm run check` | ✅ (tsc) | ⬜ pending |
| 2-states | rewire | — | PUB-01 | — | Loading (skeleton) / empty / error+retry states render | manual | visual check in `npm run dev` | manual-only | ⬜ pending |
| 2-published | rewire | — | PUB-02 | T-draft-leak | Only `is_active = true` products shown to public | integration (live) | `scripts/verify-seed.ts` flips one row to `is_active=false` and asserts it is absent from an anon select | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-seed.ts` — asserts post-seed counts (28 products / 3 categories), idempotency on re-run, and that an `is_active=false` row is hidden from an anonymous select (covers DATA-03 + PUB-02 automatically)
- [ ] No unit-test framework — component loading/empty/error states are **manual-only** this phase (acceptable; "No tests exist" per CONTEXT). Do NOT scope adding vitest here unless the planner chooses to.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Loading skeleton cards (D-05), inline error + Retry (D-06), empty-state copy (D-07) | PUB-01 | No component test harness exists project-wide | Run `npm run dev`; throttle/block the Supabase request to observe loading then error+retry; verify skeleton matches grid layout (no shift) |
| UX parity vs static catalog (no regression) | PUB-01, PUB-02 | Subjective visual parity; CONTEXT says verify parity manually against the static catalog | Compare Shop/Home/Detail against the prior static render — same products, categories, ordering, "Price on request", category placeholders for empty images |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`scripts/verify-seed.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
