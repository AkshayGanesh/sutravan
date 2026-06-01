---
phase: 05
slug: customer-experience-wishlist-profile-native-questionnaire
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
audited: 2026-06-02
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 (`vitest.config.ts` present) — adopted during execution; the 2026-06-01 draft predated it |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run check` (TypeScript strict typecheck) |
| **Full suite command** | `npm test` (vitest run) then `npm run check && npm run build` |
| **Estimated runtime** | ~1s for unit suite; ~30s typecheck+build |

*Unit tests cover pure boundary-mapper logic. Server-enforced security behaviors (RLS WITH CHECK, owner-scoped reads, Turnstile, GoTrue email change) are validated against live Supabase — see supabase-live-ops memory & RESEARCH.md.*

---

## Sampling Rate

- **After every task commit:** Run `npm run check` (+ `npm test` for touched lib helpers)
- **After every plan wave:** Run `npm test && npm run check && npm run build`
- **Before `/gsd-verify-work`:** Full unit suite green + typecheck + build green; RLS/Edge-Function behaviors verified against live Supabase
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Plan | Requirement | Behavior | Test Type | Test File / Command | Status |
|------|-------------|----------|-----------|---------------------|--------|
| 05-01 | CUST-01, CUST-02 | `toWishlistItem` maps product → wishlist item (UUID, slug, price null, placeholder images, null subtitle→"") | unit | `client/src/lib/wishlist.test.ts` · `npm test` | ✅ green (5) |
| 05-01 | CUST-01, CUST-02 | Wishlist owner-scoped read — user A cannot read user B's rows | manual-live | RLS `wishlists_owner_read` (0002) — see Manual-Only | ✅ verified live |
| 05-02/03 | CUST-03 | `toSubmission` D-05 column/payload shape; `user_id=null` on anon path, own id when logged in | unit | `client/src/lib/questionnaire.test.ts` · `npm test` | ✅ green (10) |
| 05-02/03 | CUST-03 | Anon/auth INSERT WITH CHECK ownership; cross-user INSERT rejected | manual-live | RLS 0007 — see Manual-Only | ✅ verified live |
| 05-02/03 | CUST-03 | Turnstile token verified server-side before insert | manual-live | Edge Function `verify-and-submit` + CF `siteverify` — see Manual-Only | ✅ verified live |
| 05-03/04 | CUST-04 | `submissionSnippet` em-dash/whitespace/truncation helper for history list | unit | `client/src/lib/submissions.test.ts` · `npm test` | ✅ green (9) |
| 05-04 | CUST-04 | `/profile` submission history scoped to caller (admin-or-owner SELECT) | manual-live | RLS (0002) — see Manual-Only | ✅ verified live |
| 05-04 | CUST-04 | Email change shows pending state (GoTrue secure email change) | manual-live | Supabase Auth — see Manual-Only | ✅ verified live |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Full unit suite: **8 files, 46 tests passing** (`npm test`, 2026-06-02).

---

## Wave 0 Requirements

- Vitest was adopted during phase execution (`vitest.config.ts`, `test` script) — no further Wave 0 install needed.
- Pure boundary-mapper logic (`toWishlistItem`, `toSubmission`, `submissionSnippet`) is unit-covered; server-enforced behaviors covered by live-RLS verification (existing project practice).

*Existing infrastructure (vitest unit suite + typecheck + live-RLS verification) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anon INSERT allowed with `user_id = null`; authenticated INSERT only with own `auth.uid()`; cross-user INSERT rejected | CUST-03 | RLS WITH CHECK enforced server-side; cannot exercise live JWT/RLS in unit runner | Run SQL inserts against live Supabase as anon, as user A, and attempting user B's id; confirm allow/allow/reject (RESEARCH.md) |
| Wishlist owner-scoping — user A cannot read user B's saved items | CUST-01, CUST-02 | RLS owner-scoped read; verify against live DB | Query `wishlists` as user A for user B's rows; expect empty |
| Turnstile token verified server-side before submission accepted | CUST-03 | Edge Function + external CF API; cannot unit-test | Submit form with invalid/missing token → rejected; valid token → inserted |
| Email change shows pending "check your inbox" state, not immediate success | CUST-04 | Depends on Supabase Auth "Secure email change" behavior | Trigger email change; confirm UI shows pending state until confirmation link clicked |

*Security-critical behaviors are validated against live Supabase (the unit runner has no JWT/RLS context). Confirmed during execution UAT (05-UAT.md, 14 passed).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (unit/typecheck) or a documented manual-live verification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vitest present; no gaps)
- [x] No watch-mode flags (`vitest run`, non-watch)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-06-02

---

## Validation Audit 2026-06-02
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (all testable logic already covered green) |
| Escalated | 0 |

Stale "no test framework" claim corrected: vitest adopted during execution; 8 files / 46 tests passing. Per-task map reconstructed from PLAN/SUMMARY + committed test files. Remaining server-enforced/external behaviors are documented manual-live verifications (confirmed in UAT).
