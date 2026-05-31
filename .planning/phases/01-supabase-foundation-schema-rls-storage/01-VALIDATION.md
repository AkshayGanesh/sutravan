---
phase: 1
slug: supabase-foundation-schema-rls-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none detected — Wave 0 installs vitest if automated RLS checks are scripted; otherwise CLI/SQL assertions |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm run build` (type + bundle smoke) |
| **Full suite command** | `npm run build && <anon-key read assertion script>` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run full suite (build + live anon-key read assertion)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-XX-XX | TBD | TBD | DATA-01 / DATA-02 / DATA-04 | TBD | filled by planner | TBD | TBD | ❌ W0 | ⬜ pending |

*Planner populates this map. High-value validation targets (from RESEARCH ## Validation Architecture): default-deny RLS (anon cannot write any table), public-read open only on products/categories/site_content, `is_admin()` callable without recursive-policy error on profiles, storage public-read/admin-write, service-role key absent from built bundle, app boots + reads live anon catalog table (walking skeleton).*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Decide automated vs manual for RLS posture checks (SQL/psql assertions vs scripted anon-client reads/writes)
- [ ] `grep -r service_role dist/` returns nothing — secret-leak guard

*Refined by planner against the final task list.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Supabase project created, linked, migrations pushed | DATA-01/DATA-02 | requires human-created cloud project + secrets (checkpoint:human-verify) | Create project, capture ref + anon key + DB password, `supabase link`, `supabase db push` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
