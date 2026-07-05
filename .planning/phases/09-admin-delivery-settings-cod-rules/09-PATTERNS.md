# Phase 9: Admin Delivery Settings & COD Rules - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 8 (2 new, 6 modified)
**Analogs found:** 8 / 8 (all verified against current tree)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/src/pages/admin/Delivery.tsx` (NEW) | admin page (form) | CRUD (site_content) + request-response (preview) | `client/src/pages/admin/SiteContent.tsx` | exact |
| `client/src/lib/pincodes.ts` (NEW, optional) | data-layer util | request-response (single lookup) | `client/src/lib/siteContent.ts` `fetchSiteContent` | role-match |
| `client/src/lib/siteContent.ts` (EXTEND) | data layer (defaults) | CRUD read | self (extend `SITE_CONTENT_DEFAULTS`) | exact |
| `client/src/lib/admin.ts` (EXTEND) | data layer (mutation hook) | CRUD write + invalidation | `useSaveSiteContent` (same file, L793-809) | exact |
| `client/src/lib/delivery.ts` (EXTEND) | data layer (invoke wrapper) | request-response (fn invoke) | `estimateDelivery` (same file, L62-84) | exact |
| `client/src/pages/admin/AdminLayout.tsx` (EXTEND) | layout (nav) | config | `NAV_ITEMS` array (same file, L37-44) | exact |
| `client/src/App.tsx` (EXTEND) | route table | config | `/admin/content` route (same file, L119-125) | exact |
| `supabase/functions/delivery-estimate/index.ts` (EXTEND) | edge function | request-response + service-role CRUD | self + `verify-and-submit/index.ts` (caller-JWT) | exact/role-match |

**No files have "no analog" — every target clones an in-repo precedent.**

## Pattern Assignments

### `client/src/pages/admin/Delivery.tsx` (NEW — clone SiteContent.tsx)

**Analog:** `client/src/pages/admin/SiteContent.tsx` (verified, 232 lines, current)

**Imports pattern** (SiteContent.tsx L6-17) — copy verbatim, swap TipTap for delivery bits:
```tsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";           // add Controller only if needed for Switch
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { useSaveSiteContent } from "@/lib/admin";      // or new useSaveDeliverySettings wrapper
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";
// NEW for this page: import { Switch } from "@/components/ui/switch"; (COD toggle, D-13)
// NEW: import { previewDelivery } from "@/lib/delivery"; checkServiceable from "@/lib/pincodes";
// NEW: import { formatPrice } from "@/lib/format";
```

**Read + mutation hook wiring** (SiteContent.tsx L52-54) — identical shape:
```tsx
const { data, isLoading } = useSiteContent();
const save = useSaveSiteContent();   // Phase 9: wrap/extend to also purge cache (see admin.ts below)
```

**Form + zodResolver + defaultValues** (SiteContent.tsx L56-67) — same construction; use the
D-15 schema from RESEARCH "Code Examples" (int/min/max, blank→null, `000000` reject, superRefine COD fee).

**Prefill via `reset()` in `useEffect`** (SiteContent.tsx L69-83) — THE key pattern to clone:
```tsx
const { reset } = form;
useEffect(() => {
  if (isLoading) return;
  reset({
    originPincode: data?.delivery_origin_pincode ?? SITE_CONTENT_DEFAULTS.delivery_origin_pincode,
    // ...parse delivery_cod_rules JSON here (see COD codec below)...
  });
}, [data, isLoading, reset]);
```
Note the analog's `valueFor()` helper (L45-50) does `data?.[key] ?? SITE_CONTENT_DEFAULTS[key] ?? ""` —
reuse for the plain string keys; COD needs its own JSON parse (not a plain string passthrough).

**onSubmit → save.mutate** (SiteContent.tsx L85-95) — pass a `Record<string,string>` of the 5 keys.
`delivery_cod_rules` must be `JSON.stringify({enabled,fee,valueCap})`; blanks → `null` (D-14).

**Sectioned `<fieldset><legend>` + inline `role="alert"` errors** (SiteContent.tsx L117-216) — copy this
markup shape exactly. Three fieldsets per D-02: Origin & Dispatch / Cash on Delivery / Free shipping.
The error block pattern (repeat per field):
```tsx
{errors.originPincode && (
  <p role="alert" className="text-[0.8rem] font-medium text-destructive">
    {errors.originPincode.message}
  </p>
)}
```

**Single submit Button with pending spinner** (SiteContent.tsx L218-227) — copy verbatim:
```tsx
<Button type="submit" disabled={save.isPending || originInvalid}>
  {save.isPending ? (<><Spinner className="size-4" />Saving…</>) : "Save delivery settings"}
</Button>
```
`disabled` gains the origin-serviceability gate (D-10) on top of `save.isPending`.

**Loading guard** (SiteContent.tsx L99-105) — copy the `if (isLoading) return <Spinner/>` block.

**NEW-to-this-page pieces (no direct analog in SiteContent — build fresh):**
- COD `Switch` + disabled-but-retained fee/cap (D-13): keep RHF values, only toggle `disabled` on the Inputs.
- Origin serviceability inline ✓/✗ (D-09): `onBlur` → `checkServiceable()` → local state → feedback line.
- Manual Preview button + "Test against" input (D-04/D-05): local state, calls `previewDelivery`.
- Preview output line: use `formatPrice(result.cost)` + `result.etaDays.min–max working days` +
  `result.codAvailable`. Mirror wording from `DeliveryEstimate.tsx` L210/L217-220 ("Arrives in {min}–{max} working days").

---

### `client/src/lib/pincodes.ts` (NEW — serviceability lookup, D-09)

**Analog:** `client/src/lib/siteContent.ts` `fetchSiteContent` (L36-47) — same `supabase.from(...).select(...)` idiom.

Use the RESEARCH "Code Examples" `checkServiceable()` shape: one `.eq("pincode", pincode).maybeSingle()`
query against the public-read `pincodes` table, returns `{ known, serviceable, label }`. No error throw —
absence = not serviceable. `pincodes` is `pincodes_public_read using(true)` (migration 0015), so a direct
anon client query is correct.

---

### `client/src/lib/siteContent.ts` (EXTEND — add 5 delivery keys)

**Analog:** self — `SITE_CONTENT_DEFAULTS` object (L21-34, verified).

Append the 5 keys to the existing `Record<string,string>` (values mirror migration 0014 seed):
```ts
delivery_origin_pincode: "000000",
delivery_default_weight_g: "250",
delivery_dispatch_lead_days: "1",
delivery_cod_rules: '{"enabled":true,"fee":30,"valueCap":5000}',
delivery_free_ship_threshold: "",   // null/off → empty string (D-14/D-19)
```
`fetchSiteContent` (L36-47) already selects ALL rows — no query change needed; the keys flow through
automatically once defaults exist.

---

### `client/src/lib/admin.ts` (EXTEND — cache-purge on delivery save)

**Analog:** `useSaveSiteContent` (L793-809, verified). Full current body:
```ts
export function useSaveSiteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["siteContent"] });
      toast.success("Site content updated.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}
```
**Extension (D-11/D-12):** add a sibling `useSaveDeliverySettings()` that reuses this exact upsert +
`['siteContent']` invalidation, then in `onSuccess` (after upsert resolves) invokes the edge-function
purge branch (`supabase.functions.invoke("delivery-estimate", { body: { purge: true } })`). Do NOT do a
raw client `DELETE` on `delivery_estimate_cache` — deny-direct RLS (0017). `mapWriteError` (imported L24)
is the toast error mapper — reuse it.

---

### `client/src/lib/delivery.ts` (EXTEND — add `previewDelivery`)

**Analog:** `estimateDelivery` (L62-84, verified). Current signature `(token, destPincode)` sends
`{ token, destPincode }` and maps `FunctionsHttpError` via `error.context.json()` → `mapEstimateError`.

**Extension (D-06/D-08, Pattern 5):** add a sibling `previewDelivery(originPincode, destPincode)` that
sends `{ originPincode, destPincode }` with **no `token`** (admin branch skips Turnstile; session JWT
auto-attached by supabase-js). Reuse the SAME `{ error }` → `error.context.json()` → `EstimateError`
mapping block (L69-82). Keep `estimateDelivery` + `useDeliveryEstimate` (L92-100) UNCHANGED — public path stays.

**Error-mapping block to copy** (L69-82):
```ts
if (error) {
  let code: string | null = null;
  try {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = (await context?.json?.()) as { error?: string } | undefined;
    code = body?.error ?? null;
  } catch { code = null; }
  throw new EstimateError(mapEstimateError(code));
}
return data as DeliveryEstimateResult;
```
Return type reuses the existing `DeliveryEstimateResult` interface (L23-29).

---

### `client/src/pages/admin/AdminLayout.tsx` (EXTEND — add Delivery nav item)

**Analog:** `NAV_ITEMS` array (L37-44, verified). Add entry between "Site Content" and "Submissions" (D-01):
```ts
{ label: "Site Content", href: "/admin/content", icon: FileText },
{ label: "Delivery", href: "/admin/delivery", icon: Truck },   // NEW — import Truck from lucide-react (L3-12)
{ label: "Submissions", href: "/admin/submissions", icon: Inbox },
```
Icon must be added to the lucide-react import block (L3-12). `Truck` / `PackageCheck` are unused and
suggested (RESEARCH A3 — verify import resolves in lucide-react 0.545.0). The `NAV_ITEMS.map` render
(L72-94) needs NO change — active-state + Link wiring is generic.

---

### `client/src/App.tsx` (EXTEND — add /admin/delivery route)

**Analog:** the `/admin/content` route block (L119-125, verified):
```tsx
<Route path="/admin/delivery">
  {() => (
    <AdminRoute>
      <Delivery />
    </AdminRoute>
  )}
</Route>
```
`AdminRoute` (L37-43) already wraps children in `AdminGuard` + `AdminLayout` — reuse as-is. Add the
`import Delivery from "@/pages/admin/Delivery"` alongside the other admin-page imports. Place the route
near `/admin/content` (before the `/admin` catch-all at L133).

---

### `supabase/functions/delivery-estimate/index.ts` (EXTEND — admin branch)

**Analog (structure):** self — the `Deno.serve` handler (L341-495, verified).
**Analog (caller-JWT read):** `supabase/functions/verify-and-submit/index.ts` L114-118:
```ts
const authHeader = req.headers.get('Authorization') ?? ''
// createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
```

**Insertion points (do NOT reorder the public path — Pitfall 1):**

1. After `const { token, destPincode, weightG } = await req.json()` (L352) and the `destPincode` regex
   validate (L357-362), and after the service-role `admin` client is built — NOTE: currently `admin` is
   built at L386-389 (AFTER Turnstile). **Move admin-detection before the Turnstile block** so the bypass
   can wrap it. Build the service-role client (L386-389 shape) early, then detect admin:
```ts
const authHeader = req.headers.get('Authorization') ?? ''
const jwt = authHeader.replace(/^Bearer\s+/i, '')
let isAdmin = false
if (jwt) {
  const { data: { user } } = await admin.auth.getUser(jwt)   // verifies signature/expiry server-side
  if (user) {
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = prof?.role === 'admin'
  }
}
```
   Role lives in `public.profiles.role` (migration 0004), NOT a JWT claim — the `profiles` read is required.

2. **Purge branch (D-11/D-12, Pattern 4)** — early return, before compute:
```ts
if (body.purge === true) {
  if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: jsonHeaders })
  const { error } = await admin.from('delivery_estimate_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) console.error('delivery-estimate: cache purge failed', error)
  return new Response(JSON.stringify({ purged: !error }), { status: 200, headers: jsonHeaders })
}
```
   (Verify the delete-all filter idiom against supabase-js 2.x — RESEARCH A2. Confirm the cache PK column
   name against migration 0017; `id` assumed.)

3. **Wrap the existing Turnstile siteverify (L364-383) in `if (!isAdmin) { ...unchanged... }`.** Do NOT
   delete or weaken those lines — the anon path must stay byte-for-byte behavioral.

4. **Origin override (D-08)** — at L397-398 where `origin = settings.originPincode`, gate the override:
```ts
const settings = await readSettings(admin)
const origin = (isAdmin && typeof body.originPincode === 'string' && /^\d{6}$/.test(body.originPincode))
  ? body.originPincode
  : settings.originPincode
```
   Override honored ONLY when `isAdmin` (Pitfall 2 — otherwise cache poisoning).

**Unchanged & reused:** `readSettings` (L196-240 — already reads all 5 keys + parses COD JSON L215-225,
the canonical `{enabled,fee,valueCap}` contract), the cache read/write (L406-474), the generic
`{ error: 'bad_request' }` catch (L486-494), CORS (`corsHeadersFor` L49). `config.toml` `verify_jwt=false`
stays (the function does its own JWT verification for the admin decision).

## Shared Patterns

### Admin write / persistence
**Source:** `useSaveSiteContent` (admin.ts L793-809) — upsert `site_content` `onConflict:'key'` +
`invalidateQueries(['siteContent'])` + `toast.success` / `mapWriteError`.
**Apply to:** the Delivery save flow (extended with the purge step).

### Edge-function invoke wrapper + error mapping
**Source:** `estimateDelivery` (delivery.ts L62-84) — `supabase.functions.invoke` + `FunctionsHttpError`
body parse via `error.context.json()` → `mapEstimateError` → `EstimateError`.
**Apply to:** `previewDelivery` (reuse the mapping block verbatim).

### INR + ETA-range rendering
**Source:** `formatPrice` (format.ts L9-14, `₹` + `toLocaleString('en-IN')`, no re-round) and
`DeliveryEstimate.tsx` L210/L217-220 ("Arrives in {min}–{max} working days").
**Apply to:** the admin Preview output line (SC1 string, D-06).

### Server-verified admin role (server-side trust)
**Source:** `verify-and-submit/index.ts` L114-118 (caller-JWT `Authorization` header read) +
service-role `createClient` already in `delivery-estimate` (L386-389); role in `profiles` (0004).
**Apply to:** the edge-function admin-detection branch. Trust decision is server-side only — never a client flag.

### Sectioned admin form (RHF + Zod + reset-prefill)
**Source:** `SiteContent.tsx` L52-227 (the whole component).
**Apply to:** `Delivery.tsx` structure.

## No Analog Found

None. Every target file clones an existing in-repo precedent. The only genuinely net-new logic is the
edge-function admin branch (built from `verify-and-submit`'s caller-JWT pattern + the function's own
service-role client) and the ~10-line `checkServiceable` lookup (built from `fetchSiteContent`'s query idiom).

## Metadata

**Analog search scope:** `client/src/pages/admin/`, `client/src/lib/`, `client/src/components/delivery/`,
`supabase/functions/`.
**Files scanned:** SiteContent.tsx, AdminLayout.tsx, App.tsx, admin.ts, siteContent.ts, delivery.ts,
format.ts, DeliveryEstimate.tsx, delivery-estimate/index.ts, verify-and-submit/index.ts.
**All cited line numbers verified against the current working tree on 2026-07-05.**
**Pattern extraction date:** 2026-07-05
