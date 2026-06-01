---
phase: 04
slug: admin-portal-catalog-content-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (recommended in RESEARCH.md for 4 pure functions only; not yet installed) |
| **Config file** | none — Wave 0 installs if automated checks adopted |
| **Quick run command** | `npx vitest run` (if adopted) / else `npm run check` (tsc) |
| **Full suite command** | `npx vitest run` + manual verification checklist |
| **Estimated runtime** | ~5 seconds (unit) + manual passes |

---

## Sampling Rate

- **After every task commit:** Run `npm run check` (tsc type-check; the always-available automated signal)
- **After every plan wave:** Run unit suite (if adopted) + relevant manual checks
- **Before `/gsd-verify-work`:** Type-check green + manual verification checklist complete
- **Max feedback latency:** ~30 seconds (type-check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD — planner fills during planning | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Decide: adopt vitest for the 4 pure functions (slug generation, snake↔camel mapper, image-size guard, HTML sanitizer wrapper) OR keep strict manual-only and make these reviewer-verified checks.
- [ ] If adopted: install vitest + config; stub test files for the 4 pure functions.

*If manual-only is kept: "Existing infrastructure (tsc) plus the manual verification checklist below covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Draft product hidden from public Shop, published product appears | ADMIN-08 | Requires live Supabase + public route render | Create product → confirm absent on `/shop`; flip Published → confirm appears, no redeploy |
| HEIC phone photo uploads and renders | ADMIN-03 | Browser-only image pipeline + Storage round-trip | Upload a HEIC file → converts → thumbnail shows → public Shop renders via `getPublicUrl` |
| Site-content edit propagates to all locations | ADMIN-05/06 | Cross-component live read | Edit email → confirm Navbar + Footer + Contact + ProductDetail update together |
| In-use category delete is blocked | ADMIN-04 | FK-constraint-driven UX | Delete a category with products → friendly block message, no orphaned rows |
| CR-01 RLS: draft row unreachable via raw PostgREST | ADMIN-08 / D-14 | Security boundary, server-side | Direct PostgREST query without `is_active` filter returns no draft rows after migration 0005 |
| Confirm dialog on every destructive action; toast on every write | cross-cutting | UX assertion | Each delete prompts AlertDialog; each create/edit/delete/upload fires a Sonner toast |

*The planner should map each ADMIN-xx requirement to at least one row above or an automated check.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies or a Manual-Only row
- [ ] Sampling continuity: type-check after every commit; no silent gaps
- [ ] Wave 0 decision recorded (vitest adopted vs manual-only)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (type-check)
- [ ] `nyquist_compliant: true` set in frontmatter once map is complete

**Approval:** pending
