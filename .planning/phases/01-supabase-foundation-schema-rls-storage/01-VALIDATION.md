---
phase: 1
slug: supabase-foundation-schema-rls-storage
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none installed — lightweight SQL assertions (`supabase/tests/rls_assertions.sql`) + scripted anon-client read (`scripts/verify-skeleton.ts` via `npx tsx`) + a bundle-secret grep guard (`scripts/check-no-secret.sh`). No Vitest stood up (disproportionate for an infra-bootstrap phase per RESEARCH). |
| **Config file** | none |
| **Quick run command** | `npm run check && npm run build` |
| **Full suite command** | `npm run build && bash scripts/check-no-secret.sh && npx tsx scripts/verify-skeleton.ts && <psql/CLI run of supabase/tests/rls_assertions.sql --linked>` |
| **Estimated runtime** | ~30-45 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run check` (tsc green)
- **After every plan wave:** `npm run build` + `bash scripts/check-no-secret.sh` (no `service_role` in `dist/`)
- **Before `/gsd-verify-work`:** Full suite green against the LIVE project — RLS assertions pass, walking-skeleton anon read returns OK, anon write rejected
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | DATA-04 | T-01-DEADCODE | Express/Drizzle/Passport fully removed; config repointed client-only | smoke/grep | `test ! -d server && ! grep -E '"(express\|passport\|drizzle-orm\|pg)"' package.json` | scaffolds created this task | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | DATA-01 | T-01-SECRET, T-01-ENVLEAK | Client singleton on `VITE_` env-or-throw; no `VITE_`-prefixed secret; `.env.local` gitignored | smoke/grep | `grep -q "import.meta.env.VITE_SUPABASE_URL" client/src/lib/supabase.ts && ! grep -Eq "VITE_.*SERVICE\|VITE_.*SECRET" .env.example` | ❌ → created here | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | DATA-04, DATA-01 | T-01-SECRET | App builds + dev-serves post-cleanup; no `service_role` in bundle | smoke | `npm run check && npm run build && bash scripts/check-no-secret.sh` | uses T2 scaffolds | ⬜ pending |
| 01-02-T1 | 01-02 | 1 | DATA-02 | T-02-ROLEESC, T-02-RECURSION, T-02-SEARCHPATH | Six full tables + non-recursive `private.is_admin()` SECURITY DEFINER w/ locked search_path | SQL static | grep init_schema migration for schema/function/six tables | ❌ → created here | ⬜ pending |
| 01-02-T2 | 01-02 | 1 | DATA-02 | T-02-RLSOFF, T-02-ANONWRITE, T-02-XUSER | RLS enabled on all six; public-read only on catalog; owner/admin write posture (D-12) | SQL static | `[ $(grep -c "enable row level security" 0002) -ge 6 ]` + policy greps | ❌ → created here | ⬜ pending |
| 01-02-T3 | 01-02 | 1 | DATA-02 | T-02-STORWRITE | Buckets public-read/admin-write on `storage.objects`; RLS assertion file encodes invariants | SQL static | grep storage migration (>=8 policies) + `relrowsecurity`/`prosecdef` in assertion file | ❌ → created here | ⬜ pending |
| 01-03-T1 | 01-03 | 2 | DATA-01/02 | T-03-SECRETENV | Live project created; `.env.local` holds only `VITE_` anon vars; gitignored | manual (checkpoint) | human-verify | n/a | ⬜ pending |
| 01-03-T2 | 01-03 | 2 | DATA-02 | T-03-FALSEPASS | [BLOCKING] migrations pushed to live DB, tracked in schema_migrations | CLI | `supabase migration list --linked` shows 0001/0002/0003 | depends on 01-02 | ⬜ pending |
| 01-03-T3 | 01-03 | 2 | DATA-01, DATA-02 | T-03-LIVEWRITE, T-03-RECURSION, T-01-SECRET | Walking skeleton: live anon read OK, anon write rejected, RLS assertions GREEN, no secret in bundle | e2e-lite + SQL | `npx tsx scripts/verify-skeleton.ts` + rls_assertions.sql `--linked` + `bash scripts/check-no-secret.sh` | depends on 01-01/01-02 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Created within Plan 01/02 (no separate Wave 0 — scaffolds are first-class tasks):

- [x] RLS posture checks: SQL assertions (`supabase/tests/rls_assertions.sql`) authored in Plan 02 Task 3
- [x] Bundle-secret guard: `scripts/check-no-secret.sh` (`grep -r service_role dist/`) authored in Plan 01 Task 2
- [x] Walking-skeleton script: `scripts/verify-skeleton.ts` (anon-key `select` on live `products`) authored in Plan 01 Task 2
- [x] No test-runner install (Vitest deferred — not needed this phase)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Supabase project created, linked, migrations pushed | DATA-01/DATA-02 | Requires a human-created cloud project + one-time DB password (checkpoint:human-verify, Plan 03 Task 1) | Create project, capture ref + anon key + DB password, populate `.env.local`, then `supabase link` + `supabase db push` (Plan 03 Task 2) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a documented manual checkpoint (Plan 03 Task 1 is the only manual gate; it is a true human-action prerequisite)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 coverage folded into Plan 01/02 tasks (scaffolds created before they are run live)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (pending execution)
