---
phase: 09-admin-delivery-settings-cod-rules
verified: 2026-07-06T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 9: Admin Delivery Settings & COD Rules — Verification Report

**Phase Goal:** The owner configures the estimator's core settings through the admin portal — the origin (dispatch) pincode with validation and a live preview, the default fallback weight, the dispatch lead time, COD rules (toggle, fee, value cap), and the free-shipping threshold — with edits reflected in live estimates and no redeploy.

**Verified:** 2026-07-06
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can set/edit origin pincode; form validates 6-digit serviceable + live preview; rejects empty/invalid origin | ✓ VERIFIED | `deliverySchema.ts` regex + `000000` refine reject invalid/placeholder origin (`deliverySchema.test.ts`, 20 cases, all green); `Delivery.tsx` runs `checkServiceable` on blur, disables Save until `originValid` (6-digit ∧ ≠000000 ∧ serviceable); Preview button calls `previewDelivery` → `formatPreviewLine` renders the exact SC1 string. Owner-signed live UAT scenarios (a)(b)(c) in 09-04-SUMMARY.md PASS. **Caveat:** code review found a narrow edge-case (WR-02) where editing the origin after a successful blur-check without re-blurring can leave a stale ✓ state — see Anti-Patterns below (non-blocking WARNING, primary flow unaffected). |
| 2 | Default fallback weight (g) and dispatch lead time (days) set by admin flow into live estimates | ✓ VERIFIED | `deliverySchema` enforces weight 1–2000 int / lead 0–14 int; edge function `readSettings` reads `delivery_default_weight_g`/`delivery_dispatch_lead_days` from `site_content` (index.ts:235-236) and uses them at L330 (`lead = settings.dispatchLeadDays`) and L464 (`effectiveWeightG` fallback). Owner-signed live UAT scenario (e) PASS. |
| 3 | Admin can configure COD rules (toggle, fee, value cap); customer estimator reflects them | ✓ VERIFIED | `codRules.ts` codec round-trips `{enabled,fee,valueCap}` identically to the edge function's tolerance (8 test cases green); `Delivery.tsx` COD fieldset retains fee/cap inputs (disabled, not cleared) on toggle-off (D-13); edge function reads `codRules.enabled` into `codAvailable` (index.ts:336) surfaced to the customer estimator. Owner-signed live UAT scenarios (d)(f) PASS. |
| 4 | Admin can set optional free-shipping threshold; surfaced as static "free over ₹X" messaging | ✓ VERIFIED | `deliverySchema.freeShipThreshold` blank→null / positive int; `Delivery.tsx` saves `delivery_free_ship_threshold`; customer-facing `DeliveryEstimate.tsx:236-238` reads the same `site_content` key and renders "Free delivery on orders over {formatPrice(...)}" when set, renders nothing when null. Owner-signed live UAT scenario (g) PASS. (Note: threshold is NOT applied to the computed per-product cost — by design, since no order-value context exists pre-cart; matches REQUIREMENTS.md "static threshold messaging... in scope" / cart-aggregation out of scope.) |
| 5 | All settings ride the existing site_content admin pattern (upsert + `['siteContent']` invalidation) so edits appear with no redeploy | ✓ VERIFIED | `useSaveDeliverySettings` (admin.ts:825-851) does `supabase.from("site_content").upsert(rows, {onConflict:"key"})` → `qc.invalidateQueries({queryKey:["siteContent"]})` → best-effort `functions.invoke("delivery-estimate", {body:{purge:true}})`. Edge function purge branch (index.ts:395-411) is admin-gated (403 non-admin) and deletes all `delivery_estimate_cache` rows via service role — no RLS policy added (0017 deny-direct preserved). Owner-signed live UAT scenario (d) confirms no-redeploy propagation. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/pages/admin/deliverySchema.ts` | Zod schema (D-15 bounds) + `formatPreviewLine` | ✓ VERIFIED | Both exported; 20 vitest cases green; `000000` reject present |
| `client/src/lib/codRules.ts` | `parseCodRules`/`serializeCodRules` codec | ✓ VERIFIED | Both exported; 8 vitest cases green; round-trip + malformed→off + blank-cap→null confirmed |
| `client/src/lib/pincodes.ts` | `checkServiceable` lookup | ✓ VERIFIED | Exported; single `maybeSingle()` query against `pincodes`; 4 vitest cases green |
| `client/src/lib/delivery.ts` | `previewDelivery` admin invoke wrapper | ✓ VERIFIED | Exported alongside unchanged `estimateDelivery`; sends `{originPincode,destPincode}` with no `token` key (asserted in delivery.test.ts) |
| `client/src/lib/siteContent.ts` | 5 delivery keys in `SITE_CONTENT_DEFAULTS` | ✓ VERIFIED | All 5 keys present (lines 38-42), values mirror 0014 seed |
| `client/src/lib/admin.ts` | `useSaveDeliverySettings` | ✓ VERIFIED | Present at line 825; upsert + invalidate + tolerant purge invoke, confirmed by direct read |
| `client/src/pages/admin/Delivery.tsx` | Sectioned settings form (396 lines) | ✓ VERIFIED | 3 fieldsets (origin/dispatch, COD, free-ship), RHF + zodResolver, prefill useEffect, Preview (type="button"), Save gated on `originValid` |
| `client/src/pages/admin/AdminLayout.tsx` | Delivery NAV_ITEMS entry | ✓ VERIFIED | `{ label:"Delivery", href:"/admin/delivery", icon:Truck }` present between "Site Content" and "Submissions" (line 44) |
| `client/src/App.tsx` | `/admin/delivery` route behind AdminRoute | ✓ VERIFIED | Route present (lines 127-133), wrapped in `<AdminRoute>`, placed before the `/admin` catch-all |
| `supabase/functions/delivery-estimate/index.ts` | Admin branch: isAdmin, override, purge | ✓ VERIFIED | `auth.getUser` + `profiles.role` detection (L373-386); `if (!isAdmin)` gates Turnstile (L427); admin-only `originPincode` override (L459-461); purge branch with 403-non-admin guard (L395-411); deployed live per 09-04-SUMMARY.md |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `Delivery.tsx` | `useSaveDeliverySettings` | `save.mutate(5 keys)` in `onSubmit` | ✓ WIRED | Confirmed at Delivery.tsx:136-149 |
| `useSaveDeliverySettings` (admin.ts) | `delivery-estimate` purge branch | `functions.invoke("delivery-estimate",{body:{purge:true}})` in `onSuccess` | ✓ WIRED | Confirmed admin.ts:840-846; tolerant of failure (D-11 best-effort) |
| `Delivery.tsx` | `previewDelivery` / `checkServiceable` | Preview button + origin `onBlur` | ✓ WIRED | `handlePreview` (L113-131) and `handleOriginBlur` (L100-111) confirmed |
| `AdminLayout.tsx` | `Delivery.tsx` | NAV_ITEMS → App route → component | ✓ WIRED | Confirmed end-to-end: nav entry → `/admin/delivery` route → `<Delivery/>` |
| `delivery-estimate` handler | `auth.getUser` + `public.profiles` | Bearer JWT → `admin.auth.getUser(jwt)` → `profiles.role` | ✓ WIRED | Confirmed index.ts:373-386 |
| purge branch | `public.delivery_estimate_cache` | service-role `.delete().neq('id', <impossible-uuid>)` | ✓ WIRED | Confirmed index.ts:402-405; no new RLS policy added to 0017 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `Delivery.tsx` prefill | `data` (from `useSiteContent()`) | `supabase.from("site_content").select("key,value")` | Yes — live DB read, not static | ✓ FLOWING |
| Edge function estimate | `settings.dispatchLeadDays`, `settings.defaultWeightG`, `settings.codRules` | `readSettings(admin)` reading `site_content` table rows | Yes — DB-backed, no hardcoded fallback used except when key absent (documented, seeded by 0014) | ✓ FLOWING |
| `DeliveryEstimate.tsx` free-ship messaging | `siteContent?.delivery_free_ship_threshold` | `useSiteContent()` (same live query as above) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pure-logic + wrapper test suites pass | `npx vitest run client/src/pages/admin/deliverySchema.test.ts client/src/lib/codRules.test.ts client/src/lib/pincodes.test.ts client/src/lib/delivery.test.ts` | PASS (41) FAIL (0) | ✓ PASS |
| Full vitest suite (regression check) | `npx vitest run` | PASS (143) FAIL (0) | ✓ PASS |
| Production build succeeds (icon import resolves, no phase-9 tsc errors) | `npm run build` | ✓ built in 3.01s | ✓ PASS |
| `npm run check` — phase-9 files clean | `npm run check` | 3 pre-existing `TS2802` errors in `scripts/transform-pincodes.ts` only (Phase-06, documented in deferred-items.md, unrelated to this phase); zero errors in any phase-9 file | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention used by this project; the phase's own VALIDATION.md documents the Deno edge function and live estimate loop as "Manual-Only" with no in-repo probe harness. Step 7c: SKIPPED (no probe scripts declared or discovered; live behavior instead verified via the recorded, git-committed owner UAT sign-off in 09-04-SUMMARY.md, commit `6d3ef42`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| DLVR-01 | 09-01, 09-02, 09-03, 09-04 | Admin can set/edit origin pincode with validation + live preview on save | ✓ SATISFIED | `deliverySchema`, `checkServiceable`, `previewDelivery`, `Delivery.tsx` origin fieldset, live UAT (a)(b)(c) |
| DLVR-02 | 09-01, 09-02, 09-03, 09-04 | Admin can set default fallback weight + dispatch lead time | ✓ SATISFIED | `deliverySchema` bounds, `Delivery.tsx` fields, edge function `readSettings` consumption, live UAT (e) |
| DLVR-04 | 09-01, 09-02, 09-03, 09-04 | Admin can configure COD rules + optional free-ship threshold | ✓ SATISFIED | `codRules.ts` codec, `Delivery.tsx` COD/free-ship fieldsets, `DeliveryEstimate.tsx` messaging, live UAT (d)(f)(g) |

No orphaned requirements: REQUIREMENTS.md maps exactly DLVR-01/02/04 to Phase 9, and all three appear in every plan's `requirements` frontmatter. (Traceability table status column still reads "Pending" — this is a bookkeeping field updated separately at milestone close, not a code gap.)

### Anti-Patterns Found

Carried forward from `09-REVIEW.md` (code review, 0 critical / 4 warning / 4 info) — all WARNING/INFO, none BLOCKER:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/pages/admin/Delivery.tsx` | 113-131, 388-392 | Preview line renders live `testDest` against a stale `previewResult` if the destination is edited after a preview resolves without re-clicking Preview (WR-01) | WARNING | Preview can show a mismatched estimate line; does not affect Save/persistence |
| `client/src/pages/admin/Delivery.tsx` | 95-111, 340 | `serviceability` state is only refreshed on `onBlur`; editing the origin to a different pincode without re-blurring reuses stale serviceability and can let Save persist an unserviceable origin (WR-02) | WARNING | Narrows but does not eliminate D-10's origin gate in one specific edit sequence; RLS/server-side admin check remains the enforced security boundary (unaffected) |
| `client/src/pages/admin/Delivery.tsx` | 76-111, 340, 350-354 | Save stays disabled after prefill until the origin is manually re-blurred, even for an already-valid saved origin; a transient `checkServiceable` network failure is indistinguishable from "not serviceable" and can block Save with a misleading message (WR-03) | WARNING | UX friction; does not corrupt data, does not block the live UAT primary flow |
| `supabase/functions/delivery-estimate/index.ts` | 427-451 | Turnstile `siteverify` fetch is issued before the `AbortController`/timeout is created and doesn't receive `signal`, so it is unbounded despite the header comment claiming full timeout coverage (WR-04) | WARNING | Weakens (does not remove) the public-path DoS timeout guarantee for a hung Cloudflare dependency; unrelated to admin settings goal |
| `client/src/lib/codRules.ts` / `siteContent.ts` / edge function | — | Client vs. server COD-absent-key defaults diverge (client defaults to COD-on, server to COD-off) (IN-01) | INFO | Inert today (0014 seed always present); latent trap if the seed row is ever deleted |
| `supabase/functions/delivery-estimate/index.ts` L227-240, `Delivery.tsx` copy | — | Free-ship threshold is read but not applied to computed cost; admin page copy ("changes apply to delivery estimates immediately") slightly overstates this for the threshold specifically (IN-02) | INFO | By design per REQUIREMENTS.md scope (static messaging only, no cart/order-value context yet); copy could be more precise |
| `Delivery.tsx` L133-135 | — | Redundant `deliverySchema.parse()` re-run in `onSubmit` after zodResolver already validated (IN-03) | INFO | Minor perf/clarity only |
| `Delivery.tsx` L113-131 | — | Preview failure always shows generic retry copy, discarding `EstimateError.code` (IN-04) | INFO | UX polish only |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any phase-9 file. No stub/placeholder returns, no empty-array hardcoding feeding a render path.

### Human Verification Required

None outstanding. The phase's planner-deferred human-check items (from 09-02 Task 1/2 and 09-03 Task 2 `<human-check>` blocks) were consolidated into 09-04's end-of-phase live UAT, which the owner ran and signed off in full:

- Deploy confirmed against ref `wfbnrcnmpcqzeyjlfflv` (git commit `6d3ef42`, authored by the project owner).
- All 7 scenarios (a)-(g) recorded PASS in `09-04-SUMMARY.md`, covering: admin preview skips Turnstile and honors typed origin; public token-less path still `captcha_failed`; origin serviceability gate blocks/allows Save correctly; cache purge propagates a COD-fee edit immediately; weight/lead edits reflect in live estimate; COD toggle-off/on retains fee/cap; free-ship threshold messaging appears/disappears.

This recorded, git-committed sign-off is treated as the verification source for the live-only behaviors per this verification's scope instructions — no further human action is requested.

**Advisory (not blocking):** the four WARNING-level findings above (WR-01..WR-04) are real, reproducible code defects that a human may want scheduled as a follow-up fix (e.g., a small Phase 9 hardening plan or a fast-follow). They did not manifest during the recorded UAT and do not prevent the phase goal — admin-configurable delivery settings reflected in live estimates with no redeploy — from being true today.

### Gaps Summary

No gaps block phase goal achievement. All 5 roadmap success criteria are backed by working code (schema, codec, lookup, invoke wrapper, admin page, nav/route, edge-function admin branch) and by a recorded, git-committed owner sign-off of the live behavior that has no in-repo test harness. The code review's 4 warnings (WR-01..WR-04) are real, narrow edge-case defects that should be tracked as follow-up hardening but do not invalidate any of the 5 must-have truths.

---

*Verified: 2026-07-06*
*Verifier: Claude (gsd-verifier)*
