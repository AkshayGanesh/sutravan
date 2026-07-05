# Phase 9: Admin Delivery Settings & COD Rules - Research

**Researched:** 2026-07-05
**Domain:** Admin settings form (RHF+Zod) over `site_content` key/value + a Deno/supabase-js edge-function extension (admin-JWT bypass, origin override, cache purge)
**Confidence:** HIGH (all findings verified against this repo's actual code — Phase 6 landed the schema, RLS, and function this phase edits)

## Summary

This is a low-novelty, high-precision phase. Almost nothing new is invented: the admin
UI is a **verbatim clone of `SiteContent.tsx`** (RHF + `zodResolver` + `reset()` prefill +
sectioned `<fieldset>` + single Save), the persistence is the **existing `useSaveSiteContent`
upsert + `['siteContent']` invalidation**, and the preview reuses **`estimateDelivery()`**.
The five delivery keys already exist in `site_content` (seeded by migration `0014`), so this
phase adds **no new keys and no new tables** (confirmed against `0014` and CONTEXT D-03/D-27).

The genuinely new engineering is confined to two server-side extensions of
`supabase/functions/delivery-estimate/index.ts` plus one client serviceability lookup:
(1) an **admin-caller branch** that verifies the Supabase JWT server-side, skips Turnstile
for verified admins, honors an admin-only `originPincode` override, and leaves the public
Turnstile-gated path byte-for-byte unchanged; and (2) a **cache-purge mechanism** for the
deny-direct `delivery_estimate_cache` table (which no client can `DELETE`). The recommended
purge mechanism is **a purge branch inside the same edge function**, invoked with the admin
JWT after a successful save — it reuses the service-role client already present in the
function, adds zero new migrations/RPCs, and keeps the "function is the sole writer of the
cache" security invariant (migration `0017` banner) intact.

**Primary recommendation:** Clone `SiteContent.tsx` → `Delivery.tsx`; persist via
`useSaveSiteContent`; extend `delivery-estimate` with an admin branch (server-side
`auth.getUser(jwt)` → `profiles.role='admin'` check → Turnstile-skip + `originPincode`
override + optional `purge:true`); add a tiny `pincodes` serviceability lookup helper; wire
the manual Preview button and cache-purge-on-save.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New `Delivery` sidebar item (after `Site Content`, before `Submissions`) → route `/admin/delivery`.
- **D-02:** Single sectioned form, one Save button — mirrors `SiteContent.tsx` exactly. Fieldsets: **Origin & Dispatch** (origin pincode + preview, default weight, lead days), **Cash on Delivery** (toggle, fee, cap), **Free shipping** (threshold). NOT per-section save.
- **D-03:** All settings ride the existing `site_content` upsert + `['siteContent']` invalidation (`useSaveSiteContent`). No new admin plumbing. `delivery_cod_rules` stays a single JSON-string value; the others are plain string values.
- **D-04:** Manual "Preview" button — owner types origin + test destination pincode and clicks Preview to run the estimate on demand. NOT auto-on-save, NOT on-keystroke. Preview is independent of Save.
- **D-05:** Admin-entered test destination pincode ("Test against" input beside preview).
- **D-06:** Preview output reads exactly as SC1: **"From \<origin\> to \<test pincode\>: ₹X, Y–Z working days"** plus COD availability. Calls the deployed `delivery-estimate` function (no client-side estimate math).
- **D-07:** Admin-JWT Turnstile bypass — extend `delivery-estimate` to skip Turnstile siteverify when the caller presents a valid admin session. Public/anon path UNCHANGED (still requires a Turnstile token). Admin portal adds NO Turnstile widget.
- **D-08:** Admin-only `originPincode` override — optional request-body `originPincode` honored only for verified admins; public callers always use saved `site_content` origin.
- **D-09:** Client-side serviceability check — on origin change/blur, query public-read `pincodes` (`serviceable = true`); show inline ✓ serviceable (city) / ✗. Format is instant `/^\d{6}$/`; serviceability is one lightweight lookup.
- **D-10:** Block Save on invalid origin — Save disabled/rejected unless origin is a 6-digit pincode present in `pincodes` with `serviceable = true`. Placeholder `000000` explicitly rejected.
- **D-11:** Purge `delivery_estimate_cache` on every settings save (cache keyed by origin/dest/weight; weight/lead/COD/free-ship changes would otherwise linger up to 24h TTL).
- **D-12:** Cache purge MUST go through the service role — `delivery_estimate_cache` is deny-direct RLS with the edge function as sole writer; a direct client `DELETE` is not permitted. Mechanism is researcher/planner discretion (edge-function purge branch / admin RPC / admin-gated delete policy) but cannot be a raw client delete.
- **D-13:** When COD toggled off, Fee and Value-cap inputs grey out (disabled) but keep their values.
- **D-14:** Blank = null/off for the two optional numeric fields (empty COD cap → `null`; empty free-ship threshold → `null`). Helper text: "Leave blank to disable." No separate enable-checkbox.
- **D-15:** Zod validation bounds (on save):
  - Default weight: integer 1–2000 g, required
  - Dispatch lead time: integer 0–14 working days, required
  - COD fee: integer ≥ 0, required when COD enabled
  - COD value-cap: integer > 0 or blank
  - Free-shipping threshold: integer > 0 or blank
  - Reject negatives/decimals with inline error messages.

### Claude's Discretion

- Exact `Delivery` sidebar icon (Lucide), field labels, helper-text wording, section ordering within the form.
- The precise cache-purge mechanism (edge-function purge branch vs admin RPC vs admin-gated delete policy) per D-12.
- How the admin JWT + role is verified inside the edge function (e.g. `auth.getUser()` on the bearer token, then an `is_admin`/profiles-role check) — as long as the public path stays Turnstile-gated and unchanged.
- Whether the origin serviceability lookup reuses an existing `pincodes` query helper or adds a small one.
- Toast/success feedback on save (reuse the existing admin save-toast pattern).

### Deferred Ideas (OUT OF SCOPE)

- Zone-weight rate slab editing — Phase 10 (DLVR-03). This phase edits scalar settings only.
- Per-zone / percentage COD fee, per-pincode COD serviceability, per-variant numeric weight, live courier API, configurable global buffer % — all deferred in Phase 6, unchanged here.
- Cart free-shipping progress bar — free-ship is static "free over ₹X" messaging only (SC4). E-commerce cart/checkout is a later milestone.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DLVR-01 | Admin can set/edit origin (dispatch) pincode, with validation + live preview on save | `pincodes` public-read serviceability lookup (D-09/D-10); `delivery_origin_pincode` key in `site_content` (0014); admin preview via extended `estimateDelivery()` (D-04/D-06); reject `000000` (0014 seed placeholder) |
| DLVR-02 | Admin can set default fallback weight (g) + dispatch lead time (days) | `delivery_default_weight_g` + `delivery_dispatch_lead_days` keys (0014); `readSettings()` already consumes both; lead flows into eta via `callCourierAdapter` (function L329-334) |
| DLVR-04 | Admin can configure COD rules (toggle, fee, cap) + optional free-ship threshold | `delivery_cod_rules` JSON-in-text `{enabled,fee,valueCap}` (0014, function L215-225); `delivery_free_ship_threshold` null=off (0014, function L227-231); COD surfaced via `codAvailable` in the normalized contract |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Delivery settings form (validate, prefill, save) | Frontend (React admin page) | — | Pure UI over the existing `site_content` write layer; no server logic needed |
| Persist settings | Database (`site_content` via PostgREST) | Frontend data layer (`admin.ts`) | Reuses `useSaveSiteContent` upsert; admin-write RLS (`site_content_admin_write`, 0002) is the real gate |
| Origin serviceability check | Database (`pincodes` public read) | Frontend (inline ✓/✗) | `pincodes_public_read using(true)` (0015) makes this a direct client query; convenience validation only |
| Live preview compute | API / Edge Function (`delivery-estimate`) | Frontend (invoke wrapper) | Single source of truth for estimate math (D-06); no client-side estimate math |
| Admin-caller auth + Turnstile bypass | API / Edge Function (server-side `auth.getUser`) | — | Trust decision MUST be server-side; a client flag cannot be trusted (D-07) |
| Origin override for preview | API / Edge Function (admin-only body param) | — | Honored only after server-side admin verification (D-08) |
| Cache purge on save | API / Edge Function (service-role writer) | Frontend (invoke `purge`) | `delivery_estimate_cache` is deny-direct RLS (0017) — only the service-role function can write/delete it (D-12) |

## Standard Stack

No new dependencies. Everything needed is already installed and in use.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.66.0 | Form state | Already the admin form standard (`SiteContent.tsx`, `ProductForm.tsx`) [VERIFIED: package.json / SiteContent.tsx L7] |
| @hookform/resolvers | 3.10.0 | Zod resolver bridge | `zodResolver(schema)` used verbatim in `SiteContent.tsx` L8 [VERIFIED: SiteContent.tsx] |
| zod | 3.25.76 | Validation bounds (D-15) | Project-wide runtime validation standard [VERIFIED: CLAUDE.md / SiteContent.tsx L9] |
| @tanstack/react-query | 5.60.5 | `useSiteContent` read + `useSaveSiteContent` mutation | `['siteContent']` cache family already wired [VERIFIED: siteContent.ts / admin.ts] |
| @supabase/supabase-js | 2.x (client) / `jsr:@supabase/supabase-js@2` (function) | DB + Storage + `functions.invoke` client; `createClient`/`auth.getUser` server-side | Supabase-direct architecture; already the function's import (`index.ts` L40) [VERIFIED: delivery-estimate/index.ts, client/src/lib/supabase.ts] |
| sonner | 2.0.7 | Save toast | `toast.success`/`toast.error` already in every admin mutation (`admin.ts`) [VERIFIED: admin.ts L22,429] |
| lucide-react | 0.545.0 | Sidebar icon | `NAV_ITEMS` icons are Lucide (`AdminLayout.tsx` L3-12) [VERIFIED: AdminLayout.tsx] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/components/ui/switch (shadcn) | installed | COD availability toggle (D-13) | The single toggle in the form; grey-out fee/cap when off |
| @/components/ui/input, label, button, spinner | installed | Form primitives | Exactly as `SiteContent.tsx` uses them |

**Installation:** none — no `npm install` required for this phase.

### Suggested Lucide icon for the `Delivery` nav item
`Truck` or `PackageCheck` (Claude's discretion, D-01). `Truck` reads most clearly as "delivery/shipping" and is not already used by another nav item (`Package`, `Tags`, `ListChecks`, `LayoutList`, `FileText`, `Inbox` are taken). [ASSUMED — icon name exists in lucide-react 0.545.0; verify import resolves]

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. All libraries are already
present in `package.json` and in active use. No `npm install`, no registry lookups, no
slopcheck run needed.

## Architecture Patterns

### System Architecture Diagram

```
                         ADMIN BROWSER (/admin/delivery)
                                    │
        ┌───────────────────────────┼──────────────────────────────┐
        │                           │                              │
   (1) prefill              (2) origin blur              (3) Preview click / (4) Save click
   useSiteContent           pincodes lookup                        │
   (['siteContent'])        (public read)                          │
        │                           │                              │
        ▼                           ▼                              ▼
  site_content ──read──►  RHF reset() prefill      ┌──────── Preview ────────┐   ┌──── Save ────┐
  (5 delivery keys)                                │ estimateDelivery(        │   │ useSaveSite  │
                                                   │   {originPincode,        │   │ Content      │
   pincodes ──serviceable?──► inline ✓/✗           │    destPincode},         │   │ .mutate(5    │
   (block Save on ✗ / 000000)                      │   admin bearer, NO       │   │  keys)       │
                                                   │   turnstile token)       │   │      │       │
                                                   └───────────┬──────────────┘   │  upsert      │
                                                               │                  │  site_content│
                                    supabase.functions.invoke('delivery-estimate')│      │       │
                                    (auto-attaches session JWT as Bearer)         │  then invoke │
                                                               │                  │  purge branch│
                                                               ▼                  └──────┬───────┘
                                              ┌────────────────────────────────┐         │
                                              │  EDGE FUNCTION delivery-estimate│◄────────┘
                                              │  ── admin branch (NEW) ──       │
                                              │  jwt = Authorization bearer     │
                                              │  user = auth.getUser(jwt)       │
                                              │  isAdmin = profiles.role=admin  │
                                              │    (service-role query)         │
                                              │  if isAdmin:                    │
                                              │    • skip Turnstile             │
                                              │    • honor body.originPincode   │
                                              │    • if body.purge → DELETE     │
                                              │        delivery_estimate_cache  │
                                              │  else: UNCHANGED public path    │
                                              │    (Turnstile-gated)            │
                                              └───────────────┬────────────────┘
                                                              │ service-role
                                        ┌──────────────┬──────┴───────┬─────────────────┐
                                        ▼              ▼              ▼                 ▼
                                  site_content   pincodes    delivery_rate_slabs  delivery_estimate_cache
                                                                                  (deny-direct RLS,
                                                                                   sole writer = fn)
```

### Recommended Project Structure
```
client/src/
├── pages/admin/
│   └── Delivery.tsx              # NEW — clone of SiteContent.tsx (RHF+Zod+prefill+fieldsets+Save+Preview)
├── lib/
│   ├── siteContent.ts           # EXTEND — add the 5 delivery keys to SITE_CONTENT_DEFAULTS
│   ├── admin.ts                 # EXTEND — add cache-purge step to a delivery-save flow (or a thin useSaveDeliverySettings wrapper)
│   ├── delivery.ts              # EXTEND — estimateDelivery() gains an admin/preview variant (originPincode, no turnstile token)
│   └── pincodes.ts              # NEW (optional, D-09) — checkServiceable(pincode) lightweight lookup
└── App.tsx                      # EXTEND — add <Route path="/admin/delivery"> wrapped in AdminLayout+AdminGuard

supabase/functions/delivery-estimate/
└── index.ts                     # EXTEND — admin branch: getUser → role check → Turnstile skip + originPincode + purge
```

### Pattern 1: The admin settings form (clone `SiteContent.tsx` verbatim)
**What:** `useForm({ resolver: zodResolver(schema), defaultValues })`, then a `useEffect` that
`reset()`s with live values once `useSiteContent()` resolves, sectioned `<fieldset><legend>`,
a single `<Button type="submit">`, inline `<p role="alert">` errors.
**When to use:** the whole `/admin/delivery` page.
**Example:**
```tsx
// Source: client/src/pages/admin/SiteContent.tsx L52-105 (clone this shape)
const { data, isLoading } = useSiteContent();
const save = useSaveSiteContent();
const form = useForm<DeliveryValues>({ resolver: zodResolver(deliverySchema), defaultValues: {...} });
const { reset } = form;
useEffect(() => {
  if (isLoading) return;
  reset({
    originPincode: data?.delivery_origin_pincode ?? SITE_CONTENT_DEFAULTS.delivery_origin_pincode,
    defaultWeightG: data?.delivery_default_weight_g ?? "250",
    dispatchLeadDays: data?.delivery_dispatch_lead_days ?? "1",
    codEnabled: /* parse delivery_cod_rules JSON */,
    codFee: ..., codValueCap: ..., freeShipThreshold: ...,
  });
}, [data, isLoading, reset]);
```

### Pattern 2: COD JSON-in-text (Phase 6 D-09 shape `{enabled,fee,valueCap}`)
**What:** `delivery_cod_rules` is a single `site_content` **string** value containing JSON.
The form must **parse it on prefill** and **stringify it on save**. The function's parser
(`index.ts` L215-225) is the canonical contract: `{ enabled:boolean, fee?:number, valueCap:number|null }`.
**Example:**
```ts
// Prefill (read): parse the JSON string, tolerate malformed → COD off (mirror function L221-224)
let cod = { enabled: false, fee: 0, valueCap: null as number | null };
try { const p = JSON.parse(data?.delivery_cod_rules ?? "{}"); cod = { enabled: !!p.enabled, fee: p.fee ?? 0, valueCap: p.valueCap ?? null }; } catch {}

// Save (write): re-stringify. valueCap blank → null (D-14).
const delivery_cod_rules = JSON.stringify({
  enabled: v.codEnabled,
  fee: v.codEnabled ? v.codFee : 0,
  valueCap: v.codValueCap === "" || v.codValueCap == null ? null : Number(v.codValueCap),
});
```

### Pattern 3: Server-side admin detection inside the edge function (D-07/D-08)
**What:** The client's `supabase.functions.invoke` **auto-attaches the logged-in session's
access token** as `Authorization: Bearer <jwt>` (no explicit header needed). Inside the
function, verify that JWT server-side with `auth.getUser(jwt)`, then confirm `role='admin'`
by reading `profiles` with the **service-role** client already constructed in the function.
Role is stored in `public.profiles.role` (migration `0004`), **NOT** in a JWT claim or
`app_metadata` — so a `profiles` lookup is required; there is no shortcut claim to read.
**Example:**
```ts
// Source pattern: verify-and-submit reads req.headers.get('Authorization') (index.ts caller-JWT).
// delivery-estimate already builds `admin` = service-role client (index.ts L386-389).
const authHeader = req.headers.get('Authorization') ?? '';
const jwt = authHeader.replace(/^Bearer\s+/i, '');
let isAdmin = false;
if (jwt) {
  const { data: { user } } = await admin.auth.getUser(jwt); // verifies signature/expiry server-side
  if (user) {
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    isAdmin = prof?.role === 'admin';
  }
}
// Public path unchanged: if (!isAdmin) { ...existing Turnstile siteverify... }
// Admin path: skip Turnstile; honor body.originPincode; optionally run purge.
```
> **Gotcha (verified):** when the caller is **logged out**, supabase-js sends the **anon key**
> as the bearer. `auth.getUser(anonKey)` returns no user → `isAdmin=false` → the public
> Turnstile path runs. This is the correct, safe default — no special-casing needed.

### Pattern 4: Cache purge branch (D-11/D-12) — RECOMMENDED mechanism
**What:** Add an early branch to the same function: if `body.purge === true` **and** the
caller is a verified admin, `DELETE from delivery_estimate_cache` using the service-role
client, then return `{ purged: true }`. The client calls this once, in the mutation's
`onSuccess`, after the `site_content` upsert lands.
**Example:**
```ts
// After isAdmin is established, before the estimate compute:
if (body.purge === true) {
  if (!isAdmin) return json({ error: 'forbidden' }, 403);
  const { error } = await admin.from('delivery_estimate_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete-all
  if (error) console.error('delivery-estimate: cache purge failed', error);
  return json({ purged: !error });
}
```
> Supabase/PostgREST requires a filter on `DELETE`; `.neq('id', <impossible-uuid>)` is the
> idiomatic "delete all rows" guard. Alternatively `.gte('fetched_at','1970-01-01')`. [ASSUMED — verify the exact delete-all idiom against supabase-js 2.x when implementing]

### Pattern 5: Extending `estimateDelivery()` for the admin preview (D-06)
**What:** The current signature is `estimateDelivery(token, destPincode)` and sends
`{ token, destPincode }`. For the admin preview, send `{ originPincode, destPincode }` with
**no `token`** (the admin branch skips Turnstile). The session JWT rides automatically.
Keep the public call site unchanged; add an optional overload or a sibling
`previewDelivery(originPincode, destPincode)` that omits the token.
**Example:**
```ts
// Source: client/src/lib/delivery.ts L62-84 (estimateDelivery) — add a sibling for preview.
export async function previewDelivery(originPincode: string, destPincode: string) {
  const { data, error } = await supabase.functions.invoke("delivery-estimate", {
    body: { originPincode, destPincode },   // no token; session JWT auto-attached
  });
  if (error) { /* reuse the same error-mapping block */ }
  return data as DeliveryEstimateResult;
}
```

### Anti-Patterns to Avoid
- **Client-side estimate math for the preview.** Preview MUST call the deployed function (D-06). Never re-derive cost/ETA in the browser.
- **Trusting a client `isAdmin` flag / a body field to skip Turnstile.** The bypass decision is made ONLY from a server-verified JWT (`auth.getUser`) + `profiles.role` check. A request cannot self-declare admin.
- **Touching the public Turnstile path.** The anon branch (validate → siteverify → compute) must stay byte-for-byte behaviorally identical. Guard the new logic behind `isAdmin`.
- **Adding a Turnstile widget to the admin portal.** D-07 explicitly avoids this (and the `turnstile-no-npm-wrapper` memory: no `@marsidev/react-turnstile`). Admin uses the JWT bypass.
- **Adding an RLS delete policy to `delivery_estimate_cache`.** Migration `0017` has a load-bearing "DO NOT ADD A POLICY" banner — the absence of policies IS the anti-cache-poisoning mitigation. The purge must go through the service-role function, not a new client-reachable policy.
- **Adding new `site_content` keys or new tables.** Phase 6 landed them all (`0014`); this phase only edits the 5 existing keys (CONTEXT scope).
- **Persisting `000000`.** It's the seed placeholder (`0014` D-18); Save must reject it (D-10).
- **Parsing the free-text variant label for weight.** Out of scope; weight is the numeric default only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persist + invalidate settings | A new mutation hook / table | `useSaveSiteContent` + `['siteContent']` (admin.ts L793-809) | Already handles upsert `onConflict:'key'`, toast, invalidation, error mapping |
| Read live settings for prefill | A bespoke fetch | `useSiteContent()` (siteContent.ts L56) | Already returns the key→value map; add defaults to `SITE_CONTENT_DEFAULTS` |
| Invoke the estimator | A raw `fetch` to the function URL | `supabase.functions.invoke` via `estimateDelivery`/`previewDelivery` | Handles CORS, bearer attach, `FunctionsHttpError` body parsing (delivery.ts L66-84) |
| INR rendering in preview | Manual `₹` string building | `formatPrice()` (lib/format.ts) | Already does `toLocaleString('en-IN')`, whole rupees, no re-round |
| ETA range wording | New copy | Mirror `DeliveryEstimate.tsx` L217-223 ("Arrives in {min}–{max} working days") | Consistent estimate framing (SC1/D-06) |
| Admin role check | New claim/RPC | `auth.getUser(jwt)` + `profiles.role` read | Role lives in `profiles` (0004); RLS `private.is_admin()` is the DB gate; the function replicates the read server-side |
| Error → toast mapping | New mapper | `mapWriteError` (already imported in admin.ts) | Consistent friendly admin errors |

**Key insight:** This phase is 80% wiring existing, battle-tested pieces. The only net-new
code is the edge-function admin branch and a ~10-line `pincodes` lookup. Resist inventing.

## Runtime State Inventory

> This phase edits configuration values, not identifiers/keys, so most rename-style
> categories are inapplicable. The one live-state concern is the estimate cache.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `delivery_estimate_cache` rows keyed by `(origin, dest, weight_bucket)` with 24h TTL. Non-origin setting changes (weight/lead/COD/free-ship) do NOT change the cache key, so stale cached estimates would linger up to 24h after a save. | **Cache purge on every save (D-11)** via the service-role function branch. This is a data operation (delete existing rows), distinct from the code change that adds the branch. |
| Live service config | `delivery-estimate` edge function itself is deployed live (project ref `wfbnrcnmpcqzeyjlfflv`); its `config.toml` `verify_jwt=false` is unchanged. The admin branch is a code edit that must be **redeployed** (`supabase functions deploy delivery-estimate`). | Deploy the edited function live (BLOCKING-HUMAN — agent has no creds; see live-ops memory). |
| OS-registered state | None — no OS-level registrations involved. | None. |
| Secrets/env vars | `TURNSTILE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` already in the function env (used at L372/L386-388). No new secrets. The admin branch reuses the existing service-role client. | None — verified against `index.ts`. |
| Build artifacts | None — no compiled packages renamed. Frontend is Vite SPA; a redeploy of the static bundle ships the new admin page. | Standard `npm run build` + GitHub Pages deploy. |

**Nothing found requiring an identifier migration:** the 5 `site_content` keys keep their
exact names (`delivery_origin_pincode`, `delivery_default_weight_g`,
`delivery_dispatch_lead_days`, `delivery_cod_rules`, `delivery_free_ship_threshold`) — this
phase writes their *values*, never renames the keys.

## Common Pitfalls

### Pitfall 1: Breaking the public Turnstile path while adding the admin branch
**What goes wrong:** Refactoring the function's top-level flow moves/weakens the anon Turnstile siteverify, silently opening the public estimate endpoint to abuse.
**Why it happens:** The admin branch and public branch share the same `Deno.serve` handler.
**How to avoid:** Add admin detection **before** the Turnstile block, then wrap the existing siteverify in `if (!isAdmin) { ...unchanged... }`. Do not delete or reorder the existing siteverify lines. Keep a test that a token-less anon call still returns `captcha_failed`.
**Warning signs:** An anon `previewDelivery`-shaped call (no token) succeeds.

### Pitfall 2: `originPincode` override honored for non-admins
**What goes wrong:** A public caller sends `originPincode` and shifts the origin, poisoning the shared cache with a bogus origin.
**Why it happens:** Reading `body.originPincode` unconditionally.
**How to avoid:** `const origin = isAdmin && body.originPincode ? body.originPincode : settings.originPincode;` — the override is gated on `isAdmin` (D-08).
**Warning signs:** Cache rows appear with an origin the owner never saved.

### Pitfall 3: Cache not actually purged (TTL still hiding the change)
**What goes wrong:** Owner changes COD fee, saves, but the estimator still shows the old value for up to 24h → looks like "the edit didn't take" (SC5 fails).
**Why it happens:** The purge branch was skipped, failed silently, or the client didn't call it after the upsert.
**How to avoid:** Call the purge **in the mutation `onSuccess`**, after the `site_content` upsert resolves. Log purge failures server-side. Verify SC5 by editing COD, saving, and re-running an estimate for a route that was cached.
**Warning signs:** A previously-cached `(origin,dest,weight)` returns stale COD/cost after a save.

### Pitfall 4: `000000` placeholder saved as a real origin
**What goes wrong:** Owner leaves the seed placeholder; estimates return `originConfigured:false` forever and no cache is ever written (function OQ2 skip).
**Why it happens:** No Save-time gate.
**How to avoid:** Zod + serviceability gate rejects `000000` explicitly and any non-serviceable/absent pincode (D-10). Disable Save until the origin lookup returns ✓.
**Warning signs:** `delivery_origin_pincode` still `000000` after the owner "saved".

### Pitfall 5: COD fee/cap lost when toggling COD off
**What goes wrong:** Toggling COD off clears fee/cap; re-enabling starts blank.
**Why it happens:** Unmounting/clearing disabled inputs instead of just disabling them.
**How to avoid:** Keep the RHF field values; only set `disabled` on the inputs (D-13). On save, if COD is off, still persist the retained fee/cap OR persist fee=0 per the JSON contract — but never wipe the form state mid-session.
**Warning signs:** Re-enabling COD shows empty fee/cap after they were previously set.

### Pitfall 6: Zod coercion of numeric strings (decimals/negatives slipping through)
**What goes wrong:** `<Input>` yields strings; naive `z.number()` on a string fails or `Number("2.5")` passes a non-integer.
**Why it happens:** HTML inputs are strings; blank must map to null (D-14).
**How to avoid:** Use `z.coerce.number().int().min(...).max(...)` for required fields, and a preprocess that maps `"" → null` before an optional `z.number().int().positive().nullable()` for cap/threshold. Explicitly `.int()` to reject decimals (D-15).
**Warning signs:** `2.5` grams or `-1` days saves without an inline error.

## Code Examples

### Zod schema encoding the D-15 bounds
```ts
// D-15 bounds; blank optional numerics → null (D-14). Strings from <Input> coerced.
const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);
const deliverySchema = z.object({
  originPincode: z.string().regex(/^\d{6}$/, "Enter a 6-digit pincode")
    .refine((p) => p !== "000000", "Enter a real origin pincode"),
  defaultWeightG: z.coerce.number().int("Whole grams only").min(1).max(2000),
  dispatchLeadDays: z.coerce.number().int("Whole days only").min(0).max(14),
  codEnabled: z.boolean(),
  codFee: z.coerce.number().int().min(0),                       // required when codEnabled (superRefine)
  codValueCap: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  freeShipThreshold: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
}).superRefine((v, ctx) => {
  if (v.codEnabled && (v.codFee == null || Number.isNaN(v.codFee)))
    ctx.addIssue({ path: ["codFee"], code: "custom", message: "Enter a COD fee (₹0 or more)" });
});
// NOTE: serviceability (pincodes membership) is checked separately/async, not in Zod (D-09/D-10).
```
[ASSUMED — exact `z.preprocess`/`superRefine` composition; verify against zod 3.25.76 semantics when implementing]

### Lightweight serviceability lookup (D-09)
```ts
// client/src/lib/pincodes.ts (NEW, optional) — one indexed PK lookup against public-read pincodes.
export async function checkServiceable(pincode: string) {
  const { data } = await supabase
    .from("pincodes")
    .select("pincode, district, state, serviceable")
    .eq("pincode", pincode)
    .maybeSingle();
  return {
    known: !!data,
    serviceable: data?.serviceable === true,
    label: data ? `${data.district ?? data.state}` : null,
  };
}
// Source: pincodes table is pincodes_public_read using(true) (migration 0015 L43-46).
```

### Adding delivery keys to `SITE_CONTENT_DEFAULTS` (siteContent.ts)
```ts
// Append to SITE_CONTENT_DEFAULTS (siteContent.ts L21) so prefill is never blank.
delivery_origin_pincode: "000000",
delivery_default_weight_g: "250",
delivery_dispatch_lead_days: "1",
delivery_cod_rules: '{"enabled":true,"fee":30,"valueCap":5000}',
delivery_free_ship_threshold: "",   // null/off → empty string in the map (D-14/D-19)
// Values mirror migration 0014 seed exactly.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Turnstile-only gate on `delivery-estimate` | Dual path: Turnstile (anon) OR server-verified admin JWT (admin) | This phase (Phase 9) | Admin preview needs no captcha; public abuse protection unchanged |
| Cache lingers up to 24h TTL after settings change | Explicit purge-on-save via service-role branch | This phase | Edits appear live (SC5) even for non-origin changes |
| Role read only client-side (`AuthProvider`) + DB RLS | Role ALSO read server-side inside the function for the bypass decision | This phase | The function makes its own trust decision; does not rely on any client claim |

**Deprecated/outdated:** Nothing deprecated. The `supabase-js` v2 `functions.invoke`
auto-bearer behavior and `auth.getUser(jwt)` server-side verification are current (v2.x).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.functions.invoke` auto-attaches the logged-in session's access token as the `Authorization: Bearer` header (so admin preview needs no explicit header) | Pattern 3/5 | If not auto-attached, the client must pass `headers: { Authorization: \`Bearer ${session.access_token}\` }` explicitly — a trivial fix, verify against supabase-js 2.x during Wave 0 |
| A2 | The idiomatic PostgREST "delete all rows" for the purge is a `.delete()` with an always-true filter (`.neq('id', <impossible-uuid>)` / `.gte('fetched_at','1970-01-01')`) | Pattern 4 | Wrong filter → purge no-ops or errors; verify the delete-all idiom when implementing |
| A3 | `lucide-react@0.545.0` exports `Truck` (and `PackageCheck`) | Standard Stack | Import fails at build → pick a confirmed icon; zero functional risk |
| A4 | The exact `z.coerce`/`z.preprocess`/`superRefine` composition validates D-15 as intended (int, bounds, blank→null, COD-fee-required-when-enabled) | Code Examples | Validation gaps → decimals/negatives slip through; unit-test the schema in Wave 0 |
| A5 | Admin role for the function bypass must be read from `profiles.role` (NOT a JWT claim / `app_metadata`) | Pattern 3 | Confirmed against migration 0004 (role hard-coded in `profiles`, never in metadata) — LOW risk, but if a future JWT claim is added it could be read faster |

## Open Questions

1. **Does the admin preview need to reflect UNSAVED weight/lead/COD, or only unsaved origin?**
   - What we know: D-08 explicitly covers only an `originPincode` override for preview. Weight/lead/COD affect the estimate too, but the function reads them from saved `site_content`.
   - What's unclear: Whether the owner expects the Preview to reflect the values currently typed in the form (unsaved) for weight/COD as well, or only origin+destination against last-saved settings.
   - Recommendation: **Scope preview to origin+destination only** (matches D-06's literal SC1 string "From \<origin\> to \<test pincode\>: ₹X, Y–Z working days"). Weight/lead/COD preview-before-save is a possible follow-up; do not expand the function's admin override surface beyond `originPincode` in this phase unless the planner confirms otherwise.

2. **Purge scope: delete-all vs delete-by-origin.**
   - What we know: D-11 says purge on every save because non-origin changes don't change the cache key.
   - What's unclear: whether to nuke the whole cache or only rows for the (old+new) origin.
   - Recommendation: **Delete-all.** The cache is small, globally shared, and cheaply rebuilt on next lookup; a full purge is the simplest correct guarantee of SC5 and avoids reasoning about which key dimensions a given save touched.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI (`db push` / `functions deploy`) | Live migration (none this phase) + function redeploy | ✓ (devDep, cached auth) | v2.102.0 | — (BLOCKING-HUMAN for the live deploy step) |
| Deployed `delivery-estimate` function | Preview + purge | ✓ (live, ref `wfbnrcnmpcqzeyjlfflv`) | — | — |
| `pincodes` seeded (~19.5k rows) | Serviceability check | ✓ (Phase 6 Plan 02 seeded live) | — | — |
| vitest | Unit tests (schema, mappers) | ✓ | 4.1.7 | — |
| Node | Build/test | ✓ | 22 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — the only human-gated step is deploying the
edited edge function + running the purge live (agent has no Supabase creds; see live-ops memory).

## Validation Architecture

> `workflow.nyquist_validation: true` in config.json — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 |
| Config file | (Vite-integrated; no standalone config — tests colocated as `*.test.ts`) |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | Origin validated as 6-digit serviceable; `000000`/invalid rejected; preview string renders | unit (Zod schema + preview formatter) | `npx vitest run client/src/pages/admin/deliverySchema.test.ts` | ❌ Wave 0 |
| SC1 | Preview invoke sends `{originPincode,destPincode}` (no token) | unit (mock `functions.invoke`) | `npx vitest run client/src/lib/delivery.test.ts` | ✅ (extend delivery.test.ts) |
| SC2 | Weight (1–2000 int) + lead (0–14 int) validated; blank/decimal/negative rejected | unit (Zod) | `npx vitest run client/src/pages/admin/deliverySchema.test.ts` | ❌ Wave 0 |
| SC2 | Lead flows into eta (already: function adds lead) | manual/integration (live preview) | human UAT | n/a |
| SC3 | COD JSON round-trips: parse prefill `{enabled,fee,valueCap}`, stringify save, blank cap→null | unit (pure codec helper) | `npx vitest run client/src/lib/codRules.test.ts` | ❌ Wave 0 |
| SC3 | Customer estimator reflects COD change after save+purge | manual/integration | human UAT (edit COD → save → estimate) | n/a |
| SC4 | Free-ship threshold blank→null; static "free over ₹X" messaging | unit (codec) + manual | `npx vitest run` + human UAT | ❌ Wave 0 / manual |
| SC5 | Save upserts `site_content` + invalidates `['siteContent']` + purges cache; change appears live | integration/manual | human UAT (edit → save → re-estimate cached route shows new value) | n/a |
| — | Serviceability lookup maps known/serviceable/label correctly | unit (mock supabase) | `npx vitest run client/src/lib/pincodes.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` + `npm run check` (tsc).
- **Per wave merge:** `npm test` (full vitest suite) + `npm run check`.
- **Phase gate:** full suite green + `/gsd-verify-work` + human UAT for SC1/SC3/SC5 (live edit→estimate loop, which needs the deployed function + purge).

### Wave 0 Gaps
- [ ] `client/src/pages/admin/deliverySchema.test.ts` — Zod bounds D-15 (int/min/max, blank→null, `000000` reject, COD-fee-required-when-enabled) — covers SC1/SC2/SC4.
- [ ] `client/src/lib/codRules.test.ts` — pure parse/stringify codec for `delivery_cod_rules` (round-trip, malformed→off, blank cap→null) — covers SC3.
- [ ] `client/src/lib/pincodes.test.ts` — `checkServiceable` mapping (known/unknown/serviceable/label) — covers D-09.
- [ ] Extend `client/src/lib/delivery.test.ts` — `previewDelivery` sends `{originPincode,destPincode}` with no token; error mapping reused.
- [ ] Edge-function admin branch has **no unit harness** (Deno function, not in the vitest tree) → validate via **manual/live UAT** (admin call skips Turnstile & honors origin; anon token-less call still `captcha_failed`; purge deletes rows). Flag as manual-only.

*Edge-function logic is the one area without automated coverage in-repo (Deno runtime, no
function test harness exists) — it is validated by live human UAT, consistent with how
`verify-and-submit` and the Phase 6 function were verified.*

## Security Domain

> `security_enforcement: true` — this section is REQUIRED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Server-side `auth.getUser(jwt)` verifies the Supabase JWT signature/expiry inside the function before granting the admin bypass (never trust a client flag) |
| V3 Session Management | yes | Session JWT auto-attached by supabase-js; the function reads it from the `Authorization` header, does not mint or store sessions |
| V4 Access Control | yes | Admin bypass gated on `profiles.role='admin'` (server-side read); DB writes remain gated by `site_content_admin_write` / `pincodes` RLS + `private.is_admin()` (0002/0015); cache stays deny-direct (0017) |
| V5 Input Validation | yes | Zod bounds (D-15) client-side; function re-validates `destPincode` `/^\d{6}$/` server-side (index.ts L357); `originPincode` override validated + admin-gated |
| V6 Cryptography | no | No new crypto; JWT verification handled by supabase-js/GoTrue |

### Known Threat Patterns for {Supabase-direct + Deno edge function}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Public caller forges admin to skip Turnstile | Spoofing / Elevation | Bypass decision from server-verified JWT + `profiles.role` only; logged-out callers send anon key → `getUser` returns no user → public Turnstile path |
| Cache poisoning via bogus `originPincode` | Tampering | `originPincode` override honored ONLY when `isAdmin`; public callers always use saved origin (D-08) |
| Unauthorized cache purge (DoS-ish churn) | Tampering / DoS | Purge branch returns 403 unless `isAdmin`; cache table remains deny-direct RLS (no client `DELETE` path exists) |
| Turnstile bypass leaking to the public path | Elevation | New logic wrapped strictly behind `isAdmin`; existing anon siteverify block left unchanged and still runs for non-admins |
| Privilege escalation via `profiles.role` self-edit | Elevation | Pre-existing `enforce_profile_role_lock` trigger (0004) blocks non-admin role changes; unaffected by this phase |
| Raw Postgres errors reflected to client | Info disclosure | Existing generic `{ error: 'bad_request' }` posture (index.ts L486-494) reused; new branches log server-side, return generic bodies |

## Sources

### Primary (HIGH confidence)
- `supabase/functions/delivery-estimate/index.ts` — current function: Turnstile flow, service-role client, cache read/write, `readSettings`, normalized contract.
- `supabase/functions/verify-and-submit/index.ts` — caller-JWT header pattern, CORS allowlist, Turnstile idiom.
- `supabase/migrations/0002_rls_policies.sql`, `0004_auth_profiles.sql`, `0014_delivery_settings_seed.sql`, `0015_pincodes.sql`, `0016_delivery_rate_slabs.sql`, `0017_delivery_estimate_cache.sql`, `0001_init_schema.sql` (`private.is_admin`) — RLS posture, role storage, seeded keys, deny-direct cache banner.
- `client/src/pages/admin/SiteContent.tsx` — the exact form pattern to clone.
- `client/src/pages/admin/AdminLayout.tsx` — `NAV_ITEMS` for the Delivery entry.
- `client/src/lib/admin.ts` (`useSaveSiteContent`), `client/src/lib/siteContent.ts` (`useSiteContent`/`SITE_CONTENT_DEFAULTS`), `client/src/lib/delivery.ts` (`estimateDelivery`), `client/src/lib/format.ts` (`formatPrice`), `client/src/auth/AuthProvider.tsx` (role read).
- `.planning/phases/09-.../09-CONTEXT.md`, `.planning/ROADMAP.md` §Phase 9, `.planning/REQUIREMENTS.md`.
- Memory `supabase-live-ops.md` — live `db push` / function deploy (cached CLI auth, BLOCKING-HUMAN for creds).

### Secondary (MEDIUM confidence)
- Memory `turnstile-no-npm-wrapper.md` — rationale for JWT bypass over a Turnstile widget.

### Tertiary (LOW confidence)
- supabase-js v2 `functions.invoke` auto-bearer behavior and the PostgREST delete-all filter idiom (A1/A2) — from training knowledge; verify at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; every library verified in `package.json` + active use.
- Architecture: HIGH — all integration points read directly from current repo code (function, migrations, form).
- Pitfalls: HIGH — derived from the actual function control flow and RLS banners.
- Edge-function idioms (A1/A2): MEDIUM — supabase-js call-shape details flagged for Wave-0 verification.

**Research date:** 2026-07-05
**Valid until:** 2026-08-04 (stable — internal codebase patterns; only supabase-js call-shape details could drift)
