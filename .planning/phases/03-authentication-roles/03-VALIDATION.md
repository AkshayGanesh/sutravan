---
phase: 3
slug: authentication-roles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no automated test framework exists in this project (see CONTEXT.md "No tests exist") |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript type-check — the only fast automated gate available) |
| **Full suite command** | `npm run build` (Vite client build — proves the SPA compiles end-to-end) |
| **Estimated runtime** | ~10–30 seconds (`check`); ~30–60 seconds (`build`) |

*Auth/RLS behavior cannot be proven by `tsc`/build — it is validated manually via the SQL/psql + browser harness below (see RESEARCH.md "## Validation Architecture").*

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** `npm run build` must be green AND the migration must be pushed to Supabase (`supabase db push`) so RLS/trigger behavior is live, not just config-derived types
- **Max feedback latency:** ~60 seconds for compile gates; manual auth/RLS checks run once per relevant wave

---

## Per-Task Verification Map

> Filled by the planner against the final PLAN.md task IDs. Compile gates (`npm run check`) cover TS-level correctness; security-critical rows (role lockdown, signup trigger, RLS) are **manual-only** and proven by the harness in "Manual-Only Verifications".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner-assigned) | — | — | AUTH-01..05 | T-3-xx | see Manual-Only table | manual + compile | `npm run check` | ❌ W0 (no framework) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework to install — project has deliberately chosen no automated tests for this milestone (CONTEXT.md). `npm run check` + `npm run build` are the only automated gates.

*The security boundary (role lockdown, signup trigger, RLS) has NO automated coverage by design — it is validated by the manual psql/browser harness below. This is the Nyquist gap of record for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New user registers → `profiles` row auto-created with `role='customer'` | AUTH-01 | DB trigger on `auth.users`; no test harness | Register a new email in the UI → in Supabase SQL editor: `select id,email,role,name from public.profiles where email='<test>'` returns one row, `role='customer'` |
| Session persists across refresh/restart; logout reachable from any page | AUTH-02, AUTH-03 | Browser session + localStorage behavior | Log in → refresh page (still logged in) → close+reopen tab (still logged in) → click account menu → Log out → session cleared |
| Customer CANNOT escalate own role via anon key | AUTH-04 | RLS/trigger enforcement under anon key | As the logged-in customer (anon key), run `update public.profiles set role='admin' where id=auth.uid()` (via supabase-js or PostgREST) → request is REJECTED (error raised by BEFORE UPDATE trigger); re-query confirms `role` still `customer` |
| Customer CANNOT write catalog/content under anon key | AUTH-04 | Default-deny RLS from migration 0002 | As customer, attempt `insert`/`update` on a catalog/content table → rejected by existing `private.is_admin()` policy |
| Customer CAN still self-update non-privileged fields | AUTH-04 | Verify lockdown is column-scoped, not total | As customer, `update public.profiles set name='X' where id=auth.uid()` → succeeds |
| Admin reaches `/admin`; non-admin/logged-out redirected | AUTH-05 | UI guard + role resolution timing | Customer visits `/admin/*` → redirected to `/` (no 403 page); logged-out visits `/admin/*` → redirected to `/login`, returns to `/admin` after admin login; admin visits `/admin/*` → sees the shell (no flash of admin UI before role resolves) |
| First admin bootstrapped out-of-band only | success #5 | Service-role script, no UI path | Run `scripts/promote-admin.ts <email>` locally with service-role key → that user's `role='admin'`; confirm NO UI/code path grants admin |
| Password reset round-trip works on GitHub Pages sub-path | D-02 | Email link + recovery token + 404.html SPA fallback | Request reset → click email link → lands on `/reset-password` (under BASE_URL), `PASSWORD_RECOVERY` handled → set new password → log in with it |

---

## Validation Sign-Off

- [ ] Every security-critical behavior (role lockdown, signup trigger, RLS, admin guard) appears in the Manual-Only table with concrete steps
- [ ] Compile gates (`npm run check`, `npm run build`) wired as per-task / per-wave sampling
- [ ] Migration pushed to Supabase before `/gsd-verify-work` (RLS/trigger live, not config-only)
- [ ] No watch-mode flags
- [ ] Nyquist gap of record acknowledged: no automated test framework — security boundary proven by manual harness
- [ ] `nyquist_compliant: true` set in frontmatter once planner maps task IDs

**Approval:** pending
