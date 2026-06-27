# Pitfalls Research

**Domain:** Pincode delivery estimator (Indian courier/aggregator rate API) bolted onto a static React/Vite SPA (GitHub Pages) backed by Supabase Postgres + RLS + Deno Edge Functions, with no cart/checkout to reconcile against
**Researched:** 2026-06-27
**Confidence:** HIGH (Supabase Edge Function security + Delhivery/Shiprocket API behavior verified against official docs + vendor help centers; estimate/legal framing is judgement-based, marked MEDIUM)

> **Why this matters for THIS project:** v1.1 introduces the project's **first outbound call to a paid third-party API that requires onboarding/KYC and holds a money-bearing secret.** Everything before this was self-contained inside Supabase. Three structural facts drive every pitfall below:
> 1. **There is no checkout.** The estimate is the *entire* customer-facing artifact — it is never reconciled against a real charged amount, so an inaccurate or stale number is the deliverable, not a transient pre-checkout guess.
> 2. **The frontend is a public static SPA.** The courier API key cannot ever touch the client. The only server-side seam is a Supabase Edge Function — the same pattern already proven by `verify-and-submit` (Turnstile). Reuse it; do not invent a second pattern.
> 3. **The aggregator account is a real-world dependency with a human approval loop** (KYC 24–48h, wallet recharge). This can block the milestone for days and is invisible to a code-first plan.

## Phase shorthand

Map to the real roadmap when created. Used throughout:

- **P0 – Aggregator selection & onboarding:** choose vendor (Shiprocket vs Delhivery-direct vs alt), create account, KYC, obtain **sandbox + prod** tokens, confirm rate/serviceability endpoints exist on the chosen plan
- **P1 – Edge Function rate proxy:** Deno function holding the secret, serviceability + rate call, normalization, caching, timeout/fallback, abuse protection (Turnstile/rate-limit reuse), CORS
- **P2 – Product-detail estimator UI:** pincode input → cost + ETA + COD, weight resolution from `product_variants`, disclaimers, unavailable states
- **P3 – Global "Deliver to [pincode]" navbar widget:** site-wide persistence, cross-page reflection
- **P4 – Admin origin pincode config + hardening:** admin-set dispatch pincode, edge cases, holiday/ETA, monitoring

---

## Critical Pitfalls

### Pitfall 1: Aggregator onboarding/KYC blocks the milestone (discovered too late)

**What goes wrong:**
The team scaffolds the Edge Function and UI first, then discovers at integration time that the rate/serviceability API is gated behind an *approved, KYC-completed, wallet-funded* seller account. Shiprocket manually reviews KYC in **24–48 business hours** and can reject. Delhivery-direct is **enterprise-contract gated** (custom quotes, volume negotiation) and is effectively unavailable to a low-volume handmade brand except through an aggregator. The "code is done" but cannot be tested against prod, and the milestone stalls waiting on a human approval loop nobody scheduled.

**Why it happens:**
Onboarding is invisible in a code-first plan. Developers assume "API = sign up and get a key in 5 minutes" (true for Stripe/Turnstile, false for Indian logistics). Delhivery's public developer portal makes it *look* self-serve, but rate-card access depends on a commercial relationship.

**How to avoid:**
- Make P0 a **real, human, blocking task started on day one**: register the account, submit PAN/Aadhaar KYC, recharge the minimum wallet, and confirm the *rate calculator + pincode serviceability* endpoints are accessible on the chosen plan — **before** any estimator code is written.
- **Default recommendation: Shiprocket** (or an equivalent pay-as-you-go aggregator such as iThink/Shipway) for a low-volume D2C brand — no minimum-volume commitment, multi-carrier, self-serve KYC. Treat Delhivery-direct as out of reach unless volume justifies a contract.
- Have the owner (not the developer) do KYC — it needs their business identity documents.
- Build the Edge Function against a **mocked/recorded response** in parallel so code progress doesn't block on approval.

**Warning signs:**
"We'll sign up for the API when we get to that phase." Rate endpoint returns 401/403 with a valid-looking token (account not activated). Sandbox works but prod rates return empty (wallet not funded / plan lacks rate access).

**Phase to address:** P0 (start before code; gate the whole milestone on it)

---

### Pitfall 2: Showing an "estimate" that the customer treats as a promise (no checkout to reconcile)

**What goes wrong:**
The number shown (cost + ETA + COD) is, in this app, the *final* customer-facing figure — there is no checkout where a real shipping charge later corrects it. If the displayed cost is lower than what the courier actually charges, or the ETA is missed, the customer feels misled. Quoted aggregator rates frequently **exclude GST and fuel surcharge**, are computed on **volumetric (dimensional) weight** the app doesn't know, and **change without notice** as the courier revises its rate card. An estimate presented as a hard price becomes an implied commitment the brand can't honor.

**Why it happens:**
Devs surface the raw API number as if it were authoritative. Rate APIs return a "freight charge" that looks final but is pre-tax/pre-surcharge and assumes a dead-weight the app guessed at. With no checkout, there's no later step that quietly fixes the discrepancy, so the gap lands directly on the customer.

**How to avoid:**
- **Label everything as an estimate, prominently and inline** — not buried in a tooltip. e.g. "Estimated shipping — final charge confirmed when you order." ETA: "Estimated delivery in X–Y working days, excluding weekends/holidays."
- **Show a range, not a false-precision single rupee value** where possible; round sensibly (see Pitfall 11).
- Add a short standing disclaimer near the estimator: rates are indicative, may vary by final weight/dimensions/taxes and courier rate revisions, COD availability subject to courier serviceability. (MEDIUM confidence on exact legal wording — under India's Consumer Protection (E-Commerce) Rules, misleading price/ETA claims are a real exposure; keep it clearly conditional.)
- Decide the **rounding/markup policy explicitly with the owner** (e.g., round up, or add a small buffer) so the estimate is more likely to be a ceiling than a floor the brand eats.
- Persist nothing about the estimate as an order obligation — it is display-only.

**Warning signs:**
Copy says "Shipping: ₹63" with no "estimated" qualifier. ETA shown as a single date. Owner asks "why did the customer expect free/cheaper shipping?" QA never compared a quoted rate against an actual courier invoice.

**Phase to address:** P2 (UI/copy), policy decided with owner in P0/P2

---

### Pitfall 3: Courier API key leaks via a client-direct shortcut

**What goes wrong:**
Under deadline pressure someone calls the courier/aggregator API directly from the React client (or puts the token in a `VITE_` env var) to "just get it working." Because the frontend is a **public static bundle on GitHub Pages**, the token ships to every visitor in plain JS. A leaked aggregator token can create shipments, drain the prepaid wallet, and expose the seller account — real money loss, not just data exposure.

**Why it happens:**
The existing Supabase anon-key pattern conditions devs to think "frontend keys are fine." They are — for the anon key protected by RLS — but a courier token has no RLS equivalent. `VITE_`-prefixed vars are inlined into the bundle by Vite.

**How to avoid:**
- **One rule, enforced: the courier token lives only in Supabase Edge Function secrets** (`supabase secrets set`), exactly like the existing Turnstile secret in `verify-and-submit`. The client calls the Edge Function; the Edge Function calls the courier.
- Add a grep/CI check that no `VITE_*COURIER*`/`*DELHIVERY*`/`*SHIPROCKET*` var exists and no courier hostname appears in `client/`.
- Code review gate: any direct `fetch` to a courier domain from `client/src` is an automatic reject.

**Warning signs:**
A courier hostname or token string appears anywhere under `client/`. Network tab shows the browser hitting the courier API directly. Token in `.env` without the Edge-Function-only boundary.

**Phase to address:** P1 (establish the proxy boundary first; never let UI work outrun it)

---

### Pitfall 4: Unauthenticated estimate endpoint gets abused / runs up the wallet or rate-limit

**What goes wrong:**
The estimator must work for logged-out visitors, so the Edge Function is `auth: 'none'` (public). Without protection, bots/scrapers hammer it: every call hits the upstream courier API (which has its own rate limits and, on some plans, per-call cost), exhausts the courier rate-limit for real users, and can inflate Supabase Edge Function invocation usage. With no auth, the handler is *fully* responsible for vetting callers.

**Why it happens:**
"It's just a read, what's the harm?" The endpoint is the cheapest possible scraping target — a pincode→price oracle. Supabase ships **no bot protection by default**; a public function is open to unmetered abuse unless you add it.

**How to avoid:**
- **Reuse the Turnstile pattern already in the codebase** (memory note: hosted-CDN `loadTurnstile()` loader; no npm wrapper). Gate the estimate call with a Turnstile token verified server-side in the Edge Function, OR
- Add a lightweight **rate limit keyed by IP + pincode** (Supabase documents an Upstash Redis pattern; for this scale a short-window in-memory or Postgres counter may suffice).
- **Cache aggressively** (Pitfall 8) so repeat lookups never reach the courier.
- Validate pincode format server-side *before* the upstream call (reject non-6-digit / non-numeric early).
- Never use `service_role` in this user-facing function.

**Warning signs:**
Edge Function invocation count spikes without matching traffic. Courier API starts returning 429s during normal use. Same pincode queried thousands of times. No Turnstile/rate-limit on a public endpoint.

**Phase to address:** P1

---

### Pitfall 5: Sandbox-vs-production data divergence gives false confidence

**What goes wrong:**
Everything passes against the sandbox/testing token, then prod returns different serviceability flags, different (or empty) rates, different COD availability, or different response shapes. Delhivery explicitly uses **different tokens per environment** and testing data does not mirror live serviceability or live rate cards. The team ships believing it's verified.

**Why it happens:**
Sandbox endpoints return canned/optimistic data (often "serviceable everywhere," fixed rates). Wallet/plan gating that suppresses rates only bites in prod. The response schema can differ subtly (extra wrapper, different field names for tax/surcharge).

**How to avoid:**
- Treat sandbox as **schema/contract validation only**, not data validation.
- Do a **prod smoke test with the real token** against a handful of known pincodes (a metro, a remote/NE pincode, a non-serviceable PO, a COD-restricted area) before sign-off.
- Pin to the response *shape* defensively (tolerate missing fields, never assume a field is present).
- Keep the env switch (sandbox/prod token) in Edge Function secrets, not code.

**Warning signs:**
"It worked in testing." Rates present in sandbox, empty/zero in prod. Serviceability always `true` in tests. Field that exists in sandbox response is absent in prod.

**Phase to address:** P1 (contract), P4 (prod smoke test before sign-off)

---

### Pitfall 6: Token expiry / auth assumptions break silently in production

**What goes wrong:**
The integration assumes a static token forever. If the chosen vendor uses **expiring tokens** (Shiprocket's API auth token expires and must be refreshed; Delhivery's is comparatively static but env-scoped), the estimator silently starts returning errors days later when the token lapses — and because there's no checkout, nobody notices until a customer reports a broken widget.

**Why it happens:**
The Delhivery model (constant token) and the Shiprocket model (email/password → expiring bearer token, typically ~10 days) are different. Devs code to one and assume the other behaves the same. No refresh logic, no expiry alerting.

**How to avoid:**
- Confirm the **exact auth model of the chosen vendor in P0** and design refresh accordingly. For Shiprocket-style expiring tokens, fetch/refresh the token inside the Edge Function and cache it (with margin before expiry); store API credentials (not just the derived token) in secrets.
- Handle 401 from the courier as "refresh token and retry once," then fall back gracefully.
- **Alert on sustained estimate failures** (the only failure detector, since there's no checkout funnel to reveal breakage).

**Warning signs:**
Estimator works for a week then every lookup fails. 401s from the courier with a previously-valid token. No code path that re-authenticates.

**Phase to address:** P1 (auth model + refresh), P4 (failure alerting)

---

### Pitfall 7: Slow courier responses make the whole estimator feel broken (no timeout/fallback)

**What goes wrong:**
Indian courier/aggregator rate APIs can be **slow and variable (multi-second, occasionally timing out)**. If the Edge Function awaits the courier with no timeout, the user stares at a spinner; combined with Edge Function cold starts, the first lookup of the day can be especially slow. A hung upstream call can also pin the function until it times out at the platform limit.

**Why it happens:**
Devs test on a fast day and never set a timeout. Logistics APIs are not built for synchronous, user-facing, sub-second use — they're built for batch/order flows.

**How to avoid:**
- Set an explicit **upstream timeout** (e.g., 3–5s) inside the Edge Function with `AbortController`; on timeout return a graceful "estimate temporarily unavailable, try again" state, not a hang.
- **Cache** so the common case never waits on the courier (Pitfall 8).
- Optimistic UI: show the input as responsive, stream the result in; don't block the product page render on the estimate.
- Consider a tiny "warm" ping if cold starts prove material (measure first — Supabase Edge cold starts are typically small, don't over-engineer).

**Warning signs:**
Spinner that sometimes never resolves. P95 latency on the estimate visibly worse than the rest of the site. No `AbortController`/timeout in the fetch to the courier.

**Phase to address:** P1

---

### Pitfall 8: Caching staleness — rates change without notice, but no caching means slow + abused

**What goes wrong:**
Two opposite failures. (a) **No cache:** every keystroke/lookup hits the courier → slow, rate-limited, abusable. (b) **Cache too long / never invalidated:** courier revises its rate card or serviceability and the app keeps quoting **stale prices for weeks**. Couriers change rates "without notice," so an indefinite cache quietly serves wrong numbers — the worst kind of bug because it looks fine.

**Why it happens:**
Caching is added for speed/cost and then forgotten. There's no event that tells the app "the rate card changed," so a TTL is the only safety valve and it's often set to "forever" or omitted.

**How to avoid:**
- Cache keyed by **(origin pincode, destination pincode, weight bucket)** with a **bounded TTL** (e.g., 6–24h) — long enough to absorb traffic, short enough to re-pull rate changes within a day. Store in Postgres (a simple `rate_cache` table) or KV.
- Treat serviceability flags as more cacheable (change rarely) than rate amounts.
- Make the TTL a **single configurable constant** so the owner/dev can shorten it after a known rate-card change.
- Always re-label as "estimated" so a slightly-stale cached number is still framed as indicative (Pitfall 2 backstops this).

**Warning signs:**
Quoted shipping hasn't changed in months despite a known courier price hike. Or: courier invocation count == site lookup count (no cache hits). Hardcoded/absent TTL.

**Phase to address:** P1

---

### Pitfall 9: Missing product weight → wrong or crashing estimate

**What goes wrong:**
The estimate is weight-driven (project uses `product_variants` weight). If a product/variant has **null/zero/unset weight**, the rate call either errors, returns ₹0, or quotes the lowest slab — under-estimating shipping on every weightless product. Worse, couriers bill on **max(dead weight, volumetric weight)**; the app only knows dead weight, so bulky-but-light items (a boxed cream set) get under-quoted regardless.

**Why it happens:**
Not every product has weight populated (catalog was migrated from a static file with empty prices/fields). Devs assume weight is always present. Volumetric weight requires dimensions the catalog doesn't store.

**How to avoid:**
- Define a **sensible default fallback weight** (admin-configurable, e.g., 250g for a soap) used when a variant weight is missing — never send 0.
- Validate weight server-side before the courier call; clamp to a minimum.
- Flag in the admin UI which products lack weight so the owner can fill them (data-quality nudge).
- Accept that **volumetric under-quoting is unavoidable without dimensions** — backstop it with the "estimated" framing and a small buffer/round-up (Pitfall 2/11) rather than pretending precision.

**Warning signs:**
₹0 or suspiciously low shipping on some products. Rate API errors only for certain SKUs. No fallback constant in the weight path.

**Phase to address:** P2 (fallback + weight resolution), P4 (admin data-quality flag)

---

### Pitfall 10: Origin (dispatch) pincode misconfiguration silently skews every estimate

**What goes wrong:**
Origin pincode is admin-configurable and feeds *every* estimate. If it's blank, wrong, or a non-serviceable pincode, **100% of estimates are wrong or fail** — and since there's no checkout to catch it, it can ship broken. A typo (5 digits, transposed) is easy and catastrophic because it's a single global input.

**Why it happens:**
Single config value treated as low-risk. No validation on the admin form. No "what does a real estimate look like right now?" preview after saving.

**How to avoid:**
- Validate the origin pincode on save: 6-digit numeric **and** confirm it's serviceable via the serviceability API before accepting.
- Provide a **live preview** in admin ("From <origin> to <test pincode>: ₹X, Y days") so a bad origin is obvious immediately.
- Ship a sane default origin and prevent saving an empty/invalid one.
- Surface the active origin pincode somewhere in admin so it's auditable.

**Warning signs:**
All estimates wrong/failing after an admin edit. Origin field accepts non-pincode input. No serviceability check on the admin save.

**Phase to address:** P4 (admin config + validation + preview)

---

### Pitfall 11: ETA timezone/holiday handling and INR rounding produce nonsense

**What goes wrong:**
ETA returned as "X days" or a raw date gets rendered wrong: counting weekends/holidays as transit days, computing "today + N" in the browser's local timezone (wrong for users abroad, or across the IST midnight boundary), or showing a delivery date that already passed. Separately, raw INR rates arrive as floats (e.g., `62.7`) and get shown as `₹62.7` or `₹62.70000001`, looking unprofessional and inconsistent.

**Why it happens:**
Date math done naively in client local time. Courier "estimated days" is working days but rendered as calendar days. Float arithmetic on currency. Indian public/regional holidays aren't modeled.

**How to avoid:**
- Anchor ETA math to **IST**, not browser local time; label as **working/business days** and say weekends/holidays are excluded rather than trying to model every regional holiday (don't over-engineer a holiday calendar for an estimate).
- Prefer showing a **range in days** ("3–5 working days") over a hard date, sidestepping holiday precision.
- Format INR with a single helper: integer rupees (round per the agreed policy — recommend round **up**), thousands separators, `₹` prefix, no stray decimals. Reuse one formatter app-wide.

**Warning signs:**
`₹62.7` or long-decimal prices. Delivery date in the past. Same product shows different ETA depending on the viewer's timezone. ETA counts Sundays.

**Phase to address:** P2 (formatting + ETA rendering)

---

### Pitfall 12: Vendor lock-in via leaky response coupling

**What goes wrong:**
The UI and DB cache are coded against the courier's exact JSON shape (field names, COD flag format, tax breakdown). When the owner later switches aggregators (cost, service, or because Shiprocket pricing changed), it requires touching the client, the cache schema, and the Edge Function — a rewrite instead of a swap.

**Why it happens:**
Fastest path is to pass the raw vendor payload straight to the client. No normalization layer.

**How to avoid:**
- The Edge Function returns a **normalized, vendor-agnostic shape** (`{ serviceable, cod, costInr, etaMinDays, etaMaxDays, estimatedAt }`). All vendor-specific parsing stays inside the Edge Function.
- Cache stores the normalized shape, not the raw payload.
- This makes "swap Shiprocket → iThink" a single-file change.

**Warning signs:**
Client code references vendor-specific field names. Switching vendors is estimated in days. Cache table columns mirror a vendor's JSON.

**Phase to address:** P1 (define the normalized contract up front)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode a flat shipping table instead of live API for launch | Ships without onboarding/KYC dependency | Stale, no real serviceability/COD, defeats the milestone goal | Acceptable as a **temporary fallback** behind the same normalized contract while KYC is pending — never as the final state |
| Skip caching, call courier on every lookup | Less code | Slow, rate-limited, abusable, higher cost | Only in a throwaway spike, never shipped |
| Pass raw vendor JSON to the client | Fast to wire | Vendor lock-in, breaks on schema drift | Never — normalize in the Edge Function |
| No upstream timeout | Simpler fetch | Hung spinners, pinned function on slow courier days | Never for a user-facing call |
| Single shared default weight, ignore per-product | Quick | Systematic under-quoting on heavier items | Acceptable at launch **if** admin can set per-product weight and a flag surfaces missing ones |
| `auth:'none'` with no Turnstile/rate-limit | Works for logged-out users immediately | Wallet drain / courier 429 / scraping oracle | Never — reuse existing Turnstile pattern |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Delhivery-direct | Assuming self-serve rate API like Stripe | Enterprise-contract gated; for low volume use an aggregator (Shiprocket) instead |
| Shiprocket auth | Treating token as permanent | Token expires (~10 days); refresh inside Edge Function, store credentials in secrets |
| Serviceability API | Calling rate API first / skipping serviceability | Check serviceability **before** rate; treat non-serviceable as a first-class UI state |
| Quoted rate | Showing it as final price | Rate excludes GST + fuel surcharge and assumes dead weight; label "estimated", round up |
| COD flag | Assuming COD == serviceable | COD has separate flags and limits per pincode; surface COD availability independently |
| Sandbox token | Trusting sandbox data as live | Sandbox = schema only; prod smoke test with real token + real pincodes |
| Supabase Edge Function | service_role in user-facing function / reflected CORS | Anon context, explicit CORS allowlist (your GitHub Pages origin), Turnstile/rate-limit |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No cache, courier per lookup | Slow widget, courier 429s | Cache by (origin,dest,weight bucket) with bounded TTL | As soon as a few users (or a bot) repeatedly query |
| Estimate blocks product page render | Page feels slow | Async/optimistic; render page, stream estimate | Immediately on slow courier days / cold start |
| Per-keystroke lookups in pincode field | Burst of calls, rate-limit hit | Debounce + only fire on 6-digit complete + button/blur | Any real typing user |
| Cache never expires | Quotes stale for weeks after a rate hike | Bounded TTL (6–24h), single config constant | Silently, after any courier rate-card change |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Courier token in `VITE_` env / client fetch | Token in public bundle → wallet drain, account abuse | Token only in Edge Function secrets; CI grep guard |
| Public estimate endpoint with no abuse control | Scraping oracle, wallet/rate-limit exhaustion | Turnstile (reuse existing) + IP/pincode rate-limit |
| Reflected/wildcard CORS on the function | Any site invokes your paid endpoint | Explicit allowlist of your GitHub Pages origin |
| `service_role` used in the estimate function | Privilege escalation if abused | Use anon context; function needs no DB writes beyond cache |
| Logging full courier responses with token echoes | Secret leakage in logs | Log normalized result only, never the auth header |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No "not serviceable" state | Confusing blank/error on remote pincodes | Explicit "Not serviceable to <pincode>" with contact CTA |
| Estimate shown as exact price | Customer feels misled when real charge differs | Prominent "Estimated", show range, disclaimer |
| Invalid/partial pincode silently ignored | User thinks it's broken | Inline validation: 6-digit numeric, only query when complete |
| Pincode not remembered across pages | Re-enter on every product | Global navbar widget persists site-wide (localStorage) |
| Spinner with no timeout/fallback | Appears frozen | Timeout → "temporarily unavailable, retry" |
| COD availability hidden | COD-only customers can't tell | Show COD yes/no explicitly alongside cost+ETA |

## "Looks Done But Isn't" Checklist

- [ ] **Estimate display:** Often missing the "estimated / not final" label and disclaimer — verify copy on product detail AND navbar widget
- [ ] **Serviceability:** Often only tests metro pincodes — verify a remote/NE pincode, a non-serviceable PO box area, and a COD-restricted pincode
- [ ] **Weight fallback:** Often assumes weight present — verify a product with null/zero variant weight still returns a sane estimate
- [ ] **Origin pincode:** Often unvalidated — verify saving an invalid/non-serviceable origin is rejected with a live preview
- [ ] **Token boundary:** Often a `VITE_` leak — verify no courier token/hostname anywhere under `client/`
- [ ] **Abuse control:** Often skipped on the public endpoint — verify Turnstile/rate-limit fires for logged-out callers
- [ ] **Timeout/fallback:** Often missing — verify slow/timed-out courier yields a graceful state, not a hang
- [ ] **Cache TTL:** Often "forever" or absent — verify a bounded, configurable TTL and that repeat lookups hit cache
- [ ] **Prod vs sandbox:** Often only sandbox-tested — verify a prod smoke test with the real token
- [ ] **INR/ETA formatting:** Often raw floats / calendar days — verify integer ₹ and "working days" framing in IST

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| KYC/onboarding blocks milestone | MEDIUM | Ship flat-table fallback behind normalized contract; swap to live API when approved |
| Token leaked to client bundle | HIGH | Rotate courier token immediately, audit wallet for fraudulent shipments, move to Edge Function, redeploy |
| Stale cache serving wrong rates | LOW | Shorten/clear TTL constant; re-pull |
| Vendor lock-in discovered at swap time | HIGH | Retrofit normalization layer in Edge Function, migrate cache schema, update client |
| Estimate accuracy complaints | MEDIUM | Add/strengthen disclaimer, apply round-up buffer, populate per-product weights |
| Public endpoint being scraped | LOW–MEDIUM | Enable Turnstile + rate-limit, tighten CORS, raise cache TTL |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Onboarding/KYC block | P0 | Account approved, KYC done, wallet funded, rate+serviceability endpoints reachable with prod token |
| 2 Estimate-as-promise | P0 (policy) + P2 (UI) | "Estimated" label + disclaimer present; rounding/buffer policy signed off by owner |
| 3 Token leak | P1 | No courier token/hostname in `client/`; CI guard green |
| 4 Anon abuse | P1 | Turnstile/rate-limit verified for logged-out caller |
| 5 Sandbox≠prod | P1 + P4 | Prod smoke test across metro/remote/non-serviceable/COD pincodes |
| 6 Token expiry | P1 + P4 | 401→refresh→retry path tested; failure alert wired |
| 7 Slow/timeout | P1 | Upstream timeout + graceful fallback under induced delay |
| 8 Cache staleness | P1 | Bounded configurable TTL; cache-hit ratio observed |
| 9 Missing weight | P2 + P4 | Null-weight product returns fallback estimate; admin flags missing weights |
| 10 Origin misconfig | P4 | Invalid/non-serviceable origin rejected; live preview shown |
| 11 ETA/INR formatting | P2 | Integer ₹, working-days framing, IST-anchored, range shown |
| 12 Vendor lock-in | P1 | Client/cache use normalized shape only; vendor parsing isolated to Edge Function |

## Sources

- Delhivery — API Token Generation & Client Developer Portal (token constant per environment, separate testing/prod tokens; serviceability-before-rate mandatory): https://help.delhivery.com/docs/api-token-generation , https://help.delhivery.com/docs/client-developer-portal-1 , https://delhivery-express-api-doc.readme.io/reference/best-practises-to-follow-the-api-documentation
- Delhivery — Pincode Serviceability & Rate Calculator (prepaid/COD flags, estimated cost): https://delhivery-express-api-doc.readme.io/reference/1-pincode-servicability-api , https://help.delhivery.com/docs/b2b-serviceability-rate-calculator
- Shiprocket vs Delhivery vs alternatives — aggregator vs direct, no volume commitment for small business, Delhivery enterprise-gated: https://blog.shipway.com/shiprocket-vs-delhivery/ , https://www.clickpost.ai/shiprocket-alternatives , https://shipprime.live/resources/blogs/11-best-shiprocket-alternatives-in-2026-for-d2c-brands
- Shiprocket — KYC (PAN/Aadhaar), 24–48 business-hour manual approval, wallet recharge required before orders: https://support.shiprocket.in/support/solutions/articles/43000607399-what-are-the-basic-details-required-to-start-shipping-with-shiprocket- , https://www.shiprocket.in/faq/
- Supabase — Edge Functions security (auth:'none' caller responsibility, CORS, no default bot protection, service_role misuse, rate-limit via Upstash): https://supabase.com/docs/guides/functions/auth , https://supabase.com/docs/guides/functions , https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide
- Supabase — CORS troubleshooting for Edge Functions: https://corsproxy.io/blog/fix-supabase-cors-errors/
- API rate-limit / token-expiry general best practice (exponential backoff, refresh margins): https://www.getknit.dev/blog/10-best-practices-for-api-rate-limiting-and-throttling , https://zuplo.com/learning-center/token-expiry-best-practices
- Project context: `.planning/PROJECT.md` (v1.1 milestone), existing Turnstile/`verify-and-submit` Edge Function pattern, `product_variants` weight, admin-configurable origin pincode; MEMORY.md notes (Turnstile no-npm loader, Supabase live ops)

---
*Pitfalls research for: Indian courier-API delivery estimator on static SPA + Supabase Edge Functions (no checkout)*
*Researched: 2026-06-27*
