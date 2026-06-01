---
phase: 05
slug: customer-experience-wishlist-profile-native-questionnaire
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none detected — see RESEARCH.md Validation Architecture (project has no test runner; RLS/Edge-Function behaviors validated against live Supabase per live-ops memory) |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript strict typecheck) |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd-verify-work`:** Full typecheck + build green; RLS/Edge-Function behaviors verified against live Supabase
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner from RESEARCH.md Validation Architecture. Security-critical rows
> (anon-allowed INSERT WITH CHECK, owner-scoped wishlist/submission reads, Turnstile verification)
> are validated against the live Supabase project — see RESEARCH.md and supabase-live-ops memory.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CUST-01/02/03/04 | TBD | TBD | typecheck/manual-live | `npm run check` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No automated test framework in project — Wave 0 does not install one for this phase.
- Validation relies on TypeScript strict typecheck + live Supabase RLS verification (existing project practice).

*Existing infrastructure (typecheck + live-RLS verification) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anon INSERT allowed with `user_id = null`; authenticated INSERT only with own `auth.uid()`; cross-user INSERT rejected | CUST-03, CUST-04 | RLS WITH CHECK enforced server-side; no test runner in project | Run SQL inserts against live Supabase as anon, as user A, and attempting user B's id; confirm allow/allow/reject (see RESEARCH.md) |
| Wishlist owner-scoping — user A cannot read user B's saved items | CUST-01, CUST-02 | RLS owner-scoped read; verify against live DB | Query `wishlists` as user A for user B's rows; expect empty |
| Turnstile token verified server-side before submission accepted | CUST-03 | Edge Function + external CF API; cannot unit-test | Submit form with invalid/missing token → rejected; valid token → inserted |
| Email change shows pending "check your inbox" state, not immediate success | CUST-04 | Depends on Supabase Auth "Secure email change" behavior | Trigger email change; confirm UI shows pending state until confirmation link clicked |

*Security-critical behaviors are validated against live Supabase (project has no local test harness).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (typecheck) or a documented manual-live verification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (n/a — no framework)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
