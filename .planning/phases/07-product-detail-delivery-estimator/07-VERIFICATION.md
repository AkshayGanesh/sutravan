---
phase: 07-product-detail-delivery-estimator
verified: 2026-07-04T00:00:00Z
status: passed
score: 5/5
overrides_applied: 0
---

# Phase 7: Product Detail Delivery Estimator Verification Report

**Phase Goal:** The product detail page shows a per-product delivery estimator — the customer enters a pincode and sees estimated cost, an ETA range, and COD availability for that product (using the product's weight, falling back to the admin default) — with every loading / error / unavailable state handled and the result prominently framed as an estimate.

**Mode:** mvp (ROADMAP.md `**Mode:** mvp` for Phase 7)
**Verified:** 2026-07-04
**Status:** passed
**Re-verification:** No — initial verification

## User Flow Coverage (MVP mode)

User story (derived faithfully in 07-01-PLAN.md / 07-02-PLAN.md from the ROADMAP descriptive goal + REQUIREMENTS.md core value — ROADMAP's own Goal line is descriptive, not template-formatted, and the plan explicitly documents this derivation): *«As a customer browsing a product, I want to enter my pincode on the product page and see the estimated shipping cost, delivery time, and whether cash-on-delivery is available for that product — with clear feedback whether the pincode is invalid, unserviceable, or the lookup failed — so that I can judge the true delivery cost and timeline before any cart or checkout exists, and trust the numbers as an honest estimate, not a promise.»*

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open a product | DELIVERY section renders below price/variant, above Benefits/Instagram CTA | `client/src/components/ProductDetail.tsx:209` `<DeliveryEstimate key={product.id} product={product} />` placed after price block (L194-205), before Benefits (L212) | VERIFIED |
| Enter invalid pincode, press Check delivery | Inline "Enter a valid 6-digit pincode.", no network call | `DeliveryEstimate.tsx:92-95` `PINCODE_RE.test` short-circuits before `mutate`; human-verified live (07-02-PLAN Task 3, step 3) | VERIFIED |
| Enter valid pincode, press Check delivery | Loading skeleton, then serviceable panel: ₹cost + disclaimer, "Arrives in X–Y working days" + IST caption, COD line, provisional banner (origin unconfigured) | `DeliveryEstimate.tsx:175-181` (Skeleton rows), `:193-241` (result panel); human-verified live, owner response "approved" (07-02-SUMMARY.md) | VERIFIED |
| Enter valid-format, non-serviceable pincode | "Sorry, we don't deliver to this pincode yet." | `DeliveryEstimate.tsx:245-247`; human-verified live | VERIFIED |
| Network/captcha failure, press Check delivery | "Couldn't get an estimate right now. Please try again." + CTA relabeled "Try again"; pressing it re-solves Turnstile and re-invokes | `DeliveryEstimate.tsx:105-119` (`onSettled` resets Turnstile), `:186-190`; human-verified live | VERIFIED |
| Reload page, re-open product | Pincode field prefilled from localStorage; no auto-fire | `DeliveryProvider.tsx:41-44` lazy-init from `localStorage`; `DeliveryEstimate.tsx:53` `useState(pincode ?? "")` only seeds the input, no mutate call on mount; human-verified live | VERIFIED |
| Outcome: judge true delivery cost/timeline as an honest estimate | Cost disclaimer + ETA IST caption + provisional banner always accompany the numbers; numbers never hidden | `DeliveryEstimate.tsx:196-227` | VERIFIED |

**Note on live-behavior evidence:** Turnstile is enforced server-side in the deployed `delivery-estimate` Edge Function, so the serviceable/compute path cannot be exercised from source or an unattended script — it requires a real Turnstile site key + allow-listed origin. Plan 07-02 Task 3 was a blocking human-verify checkpoint the owner ran and approved across all states this session (idle/inline-invalid, loading skeleton, serviceable result + provisional banner + disclaimer + IST caption + COD, non-serviceable, fetch-failure retry re-solving Turnstile, and prefill-without-auto-fire). That approval is treated as the evidence for the live-behavior rows above; it is not re-requested here.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria for Phase 7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The product detail page renders a delivery estimate block that, given a pincode, shows estimated shipping cost (integer ₹), an ETA range in working days, and COD yes/no for that specific product | ✓ VERIFIED | `ProductDetail.tsx:209` renders `<DeliveryEstimate>`; `DeliveryEstimate.tsx:208-233` renders `formatPrice(result.cost)`, `"Arrives in {min}–{max} working days"`, and the COD yes/no line, gated on a real `useDeliveryEstimate()` mutation result (not static) |
| 2 | The estimate uses the product's weight where available and transparently falls back to the admin default weight when none exists — the free-text variant label ("70gm") is never parsed for grams | ✓ VERIFIED | Invoke body is `{ token, destPincode }` only — `client/src/lib/delivery.ts:66-68`, confirmed no `weightG`/`weightg` reference anywhere except explanatory comments (`grep -i weightg` returns only comments). Server (`supabase/functions/delivery-estimate/index.ts:399-402`) computes `effectiveWeightG = typeof weightG === 'number' ... : settings.defaultWeightG` — since the client never sends `weightG`, it always uses `settings.defaultWeightG` (seeded `delivery_default_weight_g`, migration `0014_delivery_settings_seed.sql`). This is the documented D-10 scope decision (no per-variant weight exists yet; DLVR-F2 future work) — the fallback path is exercised correctly and the variant label is never parsed |
| 3 | Every state is handled clearly and distinctly: loading skeleton, invalid pincode format (inline), non-serviceable pincode, and fetch failure with a retry affordance | ✓ VERIFIED | `DeliveryEstimate.tsx`: loading → `Skeleton` rows (`:175-181`); invalid format → inline `text-destructive` message (`:162-166`), also routes server `bad_request` here (`errorCode === "invalid-format"`, `:84`); non-serviceable → single line (`:242-248`); fetch-failure → "Couldn't get an estimate..." + "Try again" CTA that resets Turnstile before re-invoking (`:105-119`, `:146`, `:186-190`). Human-verified live across all states |
| 4 | The result is prominently and inline labeled as an estimate (not a guaranteed charge) — cost shown as a range / with disclaimer where appropriate, ETA framed as working days excluding weekends/holidays, anchored to IST | ✓ VERIFIED | `"Estimated — final delivery charge may vary."` adjacent to every ₹ figure (`:212-215`); `"Working days, excluding weekends & holidays (IST)."` sub-caption (`:223-226`); provisional banner `"Delivery estimates are provisional and will be finalized shortly."` when `!result.originConfigured`, numbers never hidden (`:199-207`) |
| 5 | A shared `DeliveryProvider` + `useDelivery` + `useDeliveryEstimate` client layer (mirroring `AuthProvider` / `catalog.ts`) backs the block, and the entered pincode persists (localStorage) so it survives a reload | ✓ VERIFIED | `DeliveryProvider.tsx` (context + lazy localStorage init + try/catch guards), `useDelivery.ts` (throws outside provider), `useDeliveryEstimate` (`delivery.ts:92-100`, `useMutation`); mounted at app root `App.tsx:155-160` inside `AuthProvider`, inside `QueryClientProvider`. Key `sutravan.delivery.pincode` confirmed in both `DeliveryProvider.tsx:16` and referenced by the plan for Phase 8 reuse |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/lib/delivery.ts` | `estimateDelivery`, `useDeliveryEstimate`, `mapEstimateError`, `EstimateError`, `DeliveryEstimateResult` | ✓ VERIFIED | All exports present; invoke body `{ token, destPincode }`, no `weightG`; `mapEstimateError` pure and pinned by 4 passing vitest specs |
| `client/src/lib/format.ts` | `formatPrice` with `en-IN` grouping | ✓ VERIFIED | `toLocaleString('en-IN')`; `== null` guard for "Price on request"; 4 passing vitest specs |
| `client/src/delivery/DeliveryProvider.tsx` | Pincode context + localStorage persistence | ✓ VERIFIED | 65 lines; try/catch-guarded storage; `sutravan.delivery.pincode` key |
| `client/src/delivery/useDelivery.ts` | Read/set-pincode hook, throws outside provider | ✓ VERIFIED | Throws `"useDelivery must be used within a DeliveryProvider"` |
| `client/src/components/delivery/DeliveryEstimate.tsx` | Per-product estimate block, all 5 states + framing | ✓ VERIFIED | 253 lines; all locked UI-SPEC copy strings present (grepped individually below) |

**Locked copy grep confirmation (run directly against the file, not from SUMMARY claims):**
```
grep -q 'Check delivery' ✓        grep -q "6-digit pincode" ✓
grep -q 'Estimated — final delivery charge may vary.' ✓
grep -q 'Arrives in' ✓            grep -q "Sorry, we don't deliver to this pincode yet." ✓
grep -q "Couldn't get an estimate right now. Please try again." ✓   grep -q 'Try again' ✓
grep -q 'Delivery estimates are provisional and will be finalized shortly.' ✓
grep -q 'Working days, excluding weekends' ✓   grep -q 'delivery_free_ship_threshold' ✓
```

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `client/src/App.tsx` | `DeliveryProvider.tsx` | provider mounted at app root inside AuthProvider | ✓ WIRED | `App.tsx:151-160`: `<AuthProvider><DeliveryProvider><Router/></DeliveryProvider></AuthProvider>` inside `QueryClientProvider` |
| `client/src/components/ProductDetail.tsx` | `DeliveryEstimate.tsx` | rendered between price/variant and Benefits | ✓ WIRED | `ProductDetail.tsx:209`, confirmed placement between price block (ends L205) and Benefits heading (L213) |
| `DeliveryEstimate.tsx` | `delivery-estimate` Edge Function | `useDeliveryEstimate → estimateDelivery → supabase.functions.invoke` | ✓ WIRED | `delivery.ts:66-68` invokes the real deployed function name `"delivery-estimate"`; response consumed as `result` and rendered, not discarded |
| `DeliveryEstimate.tsx` | `useDelivery.ts` | pincode prefill + `setPincode` on success | ✓ WIRED | `DeliveryEstimate.tsx:52-53` prefill, `:108` `setPincode(destPincode)` on `onSuccess` |
| `DeliveryEstimate.tsx` | `EstimateError.code` | map retry vs invalid-format to fetch-failure vs inline states | ✓ WIRED | `:79-85` maps `error.code` to `isInvalidFormat` / `isRetryError`, each rendering a distinct branch |
| `DeliveryEstimate.tsx` | `useSiteContent (['siteContent'])` | read `delivery_free_ship_threshold` for the free-ship line | ✓ WIRED | `:67-72`; sourced from a real Supabase `site_content` query (`siteContent.ts:29-38`), seeded as `null` today (migration `0014`) — gated correctly, renders nothing until Phase 9 sets it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `DeliveryEstimate.tsx` | `result` (`useDeliveryEstimate().data`) | `estimateDelivery` → `supabase.functions.invoke("delivery-estimate", ...)` → deployed Edge Function → real zone-weight slab query (Phase 6) | Yes | ✓ FLOWING |
| `DeliveryEstimate.tsx` | `freeShipThreshold` (`useSiteContent().data`) | Real `site_content` table query (`siteContent.ts:29-38`); currently seeded `null` by design (D-19, Phase 9 sets it) | Yes (query is real; value intentionally unset) | ✓ FLOWING |
| `DeliveryEstimate.tsx` | `pincode` (`useDelivery().pincode`) | Real `localStorage.getItem("sutravan.delivery.pincode")`, lazy-initialized | Yes | ✓ FLOWING |

No hardcoded/static stand-ins found feeding any rendered value — every dynamic value traces to a real query, mutation, or storage read.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `mapEstimateError` / `formatPrice` pure-function contract (verifier-run, not SUMMARY-quoted) | `npx vitest run` | `PASS (97) FAIL (0)` — includes `delivery.test.ts` (4) + `format.test.ts` (4) | ✓ PASS |
| Typecheck of Phase-7 files | `npm run check` | Only the 3 pre-existing, unrelated `scripts/transform-pincodes.ts` TS2802 errors; zero errors in any Phase-7 `client/src/**` file | ✓ PASS |
| Production build | `npm run build` | `✓ built in 2.96s`, no errors | ✓ PASS |
| Live Turnstile-gated compute path (serviceable/non-serviceable/retry) | Manual live walk (owner) | Owner ran `npm run dev:client` against the deployed Edge Function with a real Turnstile site key and confirmed all states — response "approved" | ✓ PASS (human-verified, not independently re-runnable by this verifier without Turnstile secrets) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventions or PLAN/SUMMARY-declared probes found for this phase. Step 7c: SKIPPED (no declared or conventional probes).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DLVR-06 | 07-02-PLAN.md | Estimator handles all states clearly (invalid format, non-serviceable, fetch failure + retry, loading) | ✓ SATISFIED | All four states present and distinct in `DeliveryEstimate.tsx`; human-verified live; REQUIREMENTS.md checkbox `[x]` and traceability row "Complete" — consistent |
| DLVR-07 | 07-01-PLAN.md, 07-02-PLAN.md | Every estimate prominently labeled as an estimate, shown as a range where appropriate | ✓ SATISFIED | Disclaimer + ETA IST caption + provisional banner present; human-verified live; REQUIREMENTS.md checkbox `[x]` and traceability row "Complete" — consistent |
| DLVR-08 | 07-01-PLAN.md | Product detail page shows a delivery estimator for that product, using product weight falling back to admin default | ✓ SATISFIED (code) / ⚠ STALE DOC | `DeliveryEstimate` is rendered per-product in `ProductDetail.tsx:209`; server correctly falls back to `delivery_default_weight_g` since no `weightG` is sent (D-10, matches scoped design). **However, REQUIREMENTS.md line 25 still shows `- [ ] **DLVR-08**` (unchecked) and the traceability table (line 66) still reads "Pending"**, despite both `07-01-PLAN.md` frontmatter (`requirements: [DLVR-08, DLVR-07]`) and `07-01-SUMMARY.md` / `07-02-SUMMARY.md` explicitly claiming DLVR-08 was delivered in Plan 01. This is a documentation-sync gap, not a functional gap — the code demonstrably satisfies the requirement text. |

No orphaned requirements: all three phase-declared requirement IDs (DLVR-06, DLVR-07, DLVR-08) appear in REQUIREMENTS.md's Phase 7 traceability mapping.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 25, 66 | DLVR-08 checkbox/traceability not updated to reflect Plan 01 completion | ⚠️ Warning | Doc-sync only; functionality is verified working. Recommend flipping to `[x]` / "Complete" to match the other two Phase-7 requirements |
| `client/src/components/delivery/DeliveryEstimate.tsx` | 92-95, 137 | (WR-01/WR-02 from 07-REVIEW.md) A prior serviceable result / stale `formatError` can render alongside a subsequent invalid-format submission or in-progress correction | ⚠️ Warning (pre-existing, already logged in `07-REVIEW.md`, 0 blockers) | Edge-case UI polish — not exercised by the human-verify script's linear per-state walk; does not block the core "every state handled" truth in normal single-pass use, but is a real state-leakage bug for a state-transition sequence the human-verify did not test. Advisory per 07-REVIEW.md, not a phase-goal blocker |
| `client/src/lib/delivery.ts` | 83 | (WR-06) `return data as DeliveryEstimateResult` — unchecked cast, no runtime shape validation | ℹ️ Info (already logged in `07-REVIEW.md`) | A malformed function response would silently render as "non-serviceable" rather than an error. Advisory, not a phase-goal blocker |
| `client/src/components/delivery/DeliveryEstimate.tsx` | 108 | (IN-01) A `serviceable: false` result still calls `setPincode`, persisting a non-deliverable pincode as the shared "deliver to" value for Phase 8 | ℹ️ Info (already logged in `07-REVIEW.md`) | Cross-phase consideration for Phase 8; does not affect Phase 7's own goal |

No `TBD`/`FIXME`/`XXX` debt markers found in any Phase-7-modified file. No placeholder/"coming soon"/"not yet implemented" strings found (the two "placeholder" grep hits are the `<input placeholder="6-digit pincode">` attribute and a comment describing the `000000` placeholder origin value — both legitimate, not stubs).

### Human Verification Required

None outstanding. The one blocking human-verify checkpoint for this phase (07-02-PLAN.md Task 3) was run and approved by the owner this session across all five states, the fetch-failure retry re-solving Turnstile, the provisional banner, and the reload-prefill-without-auto-fire behavior. No further live-behavior items require human testing for this phase's goal.

### Gaps Summary

No blocking gaps. All five ROADMAP success criteria for Phase 7 are verified against actual code (not SUMMARY claims): the per-product estimate block exists, is wired into `ProductDetail.tsx`, invokes the real deployed Edge Function, falls back to the admin default weight correctly, handles all four non-happy-path states distinctly, frames the result as an estimate throughout, and is backed by a properly-mounted, localStorage-persisted `DeliveryProvider`/`useDelivery`/`useDeliveryEstimate` layer ready for Phase 8. `npm run check`, `npx vitest run` (97 tests), and `npm run build` were independently re-run by this verifier (not taken from SUMMARY.md) and all pass cleanly except the pre-existing, documented, out-of-scope `scripts/transform-pincodes.ts` errors.

One non-blocking documentation gap was found: REQUIREMENTS.md was not updated to check off DLVR-08 / mark its traceability row "Complete" even though the code satisfies it and the other two Phase-7 requirements (DLVR-06, DLVR-07) were correctly updated. Recommend a one-line REQUIREMENTS.md edit before closing the phase, but this does not block proceeding — the underlying requirement is functionally met.

Two clusters of advisory findings from `07-REVIEW.md` (6 warnings, 2 info; state-machine sequencing edge cases and an unchecked response cast) are carried forward here for visibility but are explicitly non-blocking per the code review's own classification (0 blockers) and are not required to close this phase.

---

*Verified: 2026-07-04*
*Verifier: Claude (gsd-verifier)*
