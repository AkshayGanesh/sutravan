# Phase 7: Product Detail Delivery Estimator - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 6 (3 new, 3 modified)
**Analogs found:** 6 / 6 (all exact or strong role-matches)

All analogs verified to exist. This phase clones established local patterns — there
are no "no analog" gaps. The `delivery-estimate` Edge Function already exists and is
NOT modified (Phase 7 consumes it as-is).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/src/delivery/DeliveryProvider.tsx` (NEW) | provider | event-driven (context + localStorage) | `client/src/auth/AuthProvider.tsx` | exact (structural template) |
| `client/src/lib/delivery.ts` (NEW) | service/hook | request-response (Turnstile-gated Edge invoke, RQ-cached) | `client/src/lib/questionnaire.ts` + `siteContent.ts` | exact (invoke) + role-match (RQ) |
| `client/src/components/delivery/DeliveryEstimate.tsx` (NEW) | component | request-response UI (5 states) | `client/src/components/auth/TurnstileWidget.tsx` (Turnstile mgmt) + ProductDetail sections (layout) | role-match |
| `client/src/components/ProductDetail.tsx` (MODIFIED) | component | insert Delivery section between variant selector (~L191) and Instagram CTA (~L320) | itself (existing section patterns) | exact (in-file) |
| `client/src/App.tsx` (MODIFIED) | config/root | mount `DeliveryProvider` alongside `AuthProvider` | `client/src/App.tsx` L146-158 | exact (in-file) |
| `client/src/main.tsx` | entry | no change expected (App is the mount point) | — | n/a |

> File names under `client/src/delivery/` + `client/src/lib/delivery.ts` +
> `client/src/components/delivery/` are the recommended locations (CONTEXT D-11 /
> Claude's Discretion — mirror `auth/` provider + `lib/` hook conventions). The
> planner may keep the hook in `lib/delivery.ts` or split provider/hook — either
> matches convention.

---

## Pattern Assignments

### `client/src/delivery/DeliveryProvider.tsx` (provider, context + localStorage)

**Analog:** `client/src/auth/AuthProvider.tsx` (exact structural template)

**Context + typed value + out-of-provider guard** (AuthProvider L17-28, 30-34):
```typescript
export interface AuthContextValue {
  session: Session | null;
  /* ... */
  signOut: () => Promise<void>;
}
// Default undefined so useAuth can detect out-of-provider usage.
export const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);
export default function AuthProvider({ children }: { children: React.ReactNode }) {
```
Clone this shape: `DeliveryContextValue { pincode: string | null; setPincode: (p: string) => void }`,
`createContext<DeliveryContextValue | undefined>(undefined)`, default export
`DeliveryProvider({ children })`.

**`useX` hook that throws outside provider** — AuthProvider itself does not contain
`useAuth`; find the companion hook pattern. The convention: a `useDelivery()` reads
`React.useContext(DeliveryContext)` and throws if `undefined`. Search
`client/src/auth/` for the exact `useAuth` throw wording to match.

**localStorage-persisted state** (NOT in AuthProvider — this is the phase's addition).
Follow the subscribe-in-`useEffect` → `setState` shape AuthProvider uses for session
(L52-73), but seed initial state lazily from `localStorage.getItem(KEY)` and write it
back in a `setPincode` callback. Use a stable namespaced key (Claude's Discretion,
D-11) — e.g. `"sutravan.delivery.pincode"` — because Phase 8 reads the SAME key.

**`useMemo` value + Provider return** (AuthProvider L124-129):
```typescript
const value = React.useMemo<AuthContextValue>(
  () => ({ session, user, role, loading, signOut }),
  [session, user, role, loading, signOut],
);
return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

---

### `client/src/lib/delivery.ts` (service/hook, Turnstile-gated Edge invoke, RQ-cached)

**Analog (invoke wrapper):** `client/src/lib/questionnaire.ts` `submitQuestionnaire` (L272-282)
**Analog (React-Query hook + fetch split + typed contract):** `client/src/lib/siteContent.ts` / `catalog.ts`

**Edge-Function invoke with token in body** (questionnaire.ts L272-282):
```typescript
export async function submitQuestionnaire(
  token: string,
  submission: QuestionnaireSubmission,
): Promise<void> {
  const { error } = await supabase.functions.invoke("verify-and-submit", {
    body: { token, submission },
  });
  if (error) {
    throw error;
  }
}
```
Clone as `estimateDelivery(token, destPincode)` → `supabase.functions.invoke("delivery-estimate", { body: { token, destPincode } })`.
Per D-10, DO NOT send `weightG` — the function falls back to the 250g default.
The function returns the estimate object (not just `{error}`), so return
`data as DeliveryEstimate` and throw on `error`. NOTE: `functions.invoke` surfaces
the 400 body via `error`; the planner must inspect the returned error to map
`bad_request` vs `captcha_failed` (D-13). Consider `{ error }` + `data` destructure and
reading `error.context` / re-fetching the response body for the error code.

**Estimate contract** — mirror the Edge Function's public response
(`supabase/functions/delivery-estimate/index.ts` L66-73, response strips `zone`):
```typescript
export interface DeliveryEstimate {
  serviceable: boolean;
  cost: number | null;           // rounded integer ₹ — NO UI re-rounding
  etaDays: { min: number; max: number } | null;
  codAvailable: boolean;
  originConfigured: boolean;     // false while origin is placeholder 000000
}
```

**React-Query hook + query key + typed mapper** (siteContent.ts L36-58):
```typescript
async function fetchSiteContent(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("site_content").select("key, value");
  if (error) throw error;          // surfaces to useQuery isError -> Retry
  return Object.fromEntries(/* ... */);
}
export function useSiteContent() {
  return useQuery({ queryKey: ["siteContent"], queryFn: fetchSiteContent });
}
```
For `useDeliveryEstimate`: this is a mutation-like on-demand invoke, not a passive
read. Recommended shape — a `useMutation` or a manually-triggered `useQuery` with
`enabled: false` + `refetch()`, keyed `["deliveryEstimate", origin?, destPincode, 250]`
(D-09: the `(origin, dest, 250-band)` cache key naturally dedupes since all products
share the 250g fallback). Mirror `staleTime` conventions from `catalog.ts`. The token
is single-use, so caching must key on pincode NOT token.

**Free-ship threshold read** (D-12): reuse the EXISTING `useSiteContent()` +
`['siteContent']` key — read `data?.delivery_free_ship_threshold` (null/absent today →
render nothing). No new fetch needed.

---

### `client/src/components/delivery/DeliveryEstimate.tsx` (component, 5-state estimate block)

**Analog (Turnstile widget management):** `client/src/components/auth/TurnstileWidget.tsx`
**Analog (managed-token → invoke flow):** `client/src/pages/Questionnaire.tsx` L166-291
**Analog (section layout / typography / dividers):** `ProductDetail.tsx` L206-316

**Turnstile lazy-load + render + reset + dev-bypass** (TurnstileWidget.tsx L69-101):
```typescript
if (!siteKey) { onTokenRef.current("dev-bypass"); return; }   // dev fallback
loadTurnstile().then(() => {
  widgetId.current = window.turnstile.render(container, {
    sitekey: siteKey,
    callback: (token: string) => onTokenRef.current(token),
    "expired-callback": () => onTokenRef.current(null),
    "error-callback": () => onTokenRef.current(null),
  });
});
// cleanup: window.turnstile.remove(widgetId.current)
```
REUSE the existing `TurnstileWidget` component directly (it already exposes
`onToken` + a `reset()` handle via `forwardRef`). The block holds a ref, gates
"Check delivery" on a non-null token, and calls `ref.reset()` after a failed lookup
so a fresh single-use token issues (D-01, D-13 retry). DO NOT add
`@marsidev/react-turnstile` (memory `turnstile-no-npm-wrapper.md`).

**Managed-token submit gate + reset-on-failure** (Questionnaire.tsx pattern, L271-291):
```typescript
const token = turnstileToken.current;
if (!token) { toast.error(/* need captcha */); return; }
try {
  await submitQuestionnaire(token, submission);
} catch (err) {
  toast.error(/* ... */);
  resetTurnstile();   // single-use token consumed — reset for retry
}
```
Clone: on "Check delivery" press → validate `/^\d{6}$/` inline first (D-02, no network
if invalid), then invoke with token, then map errors to the 5 states.

**Section divider + heading + body typography** (ProductDetail.tsx L206-210, L298):
```tsx
<div className="mt-4 pt-4 border-t border-border/50 space-y-1">   {/* section divider */}
<h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">Benefits</h3>
<li className="flex items-start gap-2 text-sm text-foreground/80">
```
UI-SPEC mandates: `DELIVERY` heading styled like Benefits/Ingredients
(`text-xs uppercase tracking-widest text-foreground/50`); result panel `bg-muted/40 p-4`;
cost figure `text-xl font-semibold text-primary` (matches price line L193); button
`bg-primary text-primary-foreground py-3 text-sm uppercase tracking-wider font-medium`
(matches CTA L320-329 but `py-3` not `py-3.5`). Sharp edges — NO `rounded-*`
(`--radius: 0rem`). Exactly two weights: 400 + 600.

**Cost formatting** — use `formatPrice` from `client/src/lib/format.ts`:
```typescript
export function formatPrice(price: number | null): string {
  if (price == null) return 'Price on request';
  return `₹${Math.round(price)}`;   // engine already rounded — Math.round is a no-op on integers
}
```
NOTE: `formatPrice` uses `₹${Math.round(price)}` — no thousands separator today.
UI-SPEC copy asks for "thousands-separated via formatPrice". If a separator is
required, extend `formatPrice` (single source of truth) with
`Number(price).toLocaleString('en-IN')` rather than formatting inline. Never re-round.

**Five states** (UI-SPEC Interaction States): idle/prefilled, invalid-format (inline
`text-destructive`, no network), loading (`@/components/ui/skeleton` rows mirroring
result layout), result-serviceable (inset panel), result-non-serviceable (single line),
fetch-failure (`text-destructive` + CTA relabeled "Try again"). Components from
`client/src/components/ui/`: `input`, `button`, `skeleton`, optional `badge`; lucide
`Truck`/`Package`/`Check`/`X`/`AlertCircle`.

---

### `client/src/components/ProductDetail.tsx` (MODIFIED — insert Delivery section)

**Insertion point:** between the price/variant block (ends ~L204) and the Benefits
section (L206) — CONTEXT D-03 says "below the price/variant selector, above the
Instagram CTA". The UI-SPEC anchors it as a bordered section like the shelf-life block
(L298). Insert `<DeliveryEstimate />` there.

**Existing reset-on-product-change `useEffect`** (L33-53) — the Delivery block should
NOT auto-fire on modal open (D-08). Prefill the pincode from `useDelivery()`, keep the
result hidden until an explicit "Check delivery" press. If the block manages its own
open/reset, reset its result state in a `useEffect(..., [product])` mirroring L33-53.

**Existing consumer conventions** — ProductDetail already reads a context-ish hook
(`useSiteContent`, L30-31) and imports `formatPrice` (L4). Add `useDelivery` the same
way. Keep the block a child component (`<DeliveryEstimate product={product} />`) to
keep ProductDetail lean.

---

### `client/src/App.tsx` (MODIFIED — mount DeliveryProvider at root)

**Analog:** the existing provider nesting (App.tsx L146-158):
```tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <SonnerToaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```
Add `import DeliveryProvider from "@/delivery/DeliveryProvider";` (L7 area) and wrap
`<Router />` — nest `DeliveryProvider` inside `AuthProvider` (or as a sibling around
Router). It only needs to be above ProductDetail's mount point and Phase 8's navbar,
so app-root placement alongside `AuthProvider` satisfies D-11. `QueryClientProvider`
must stay outermost so `useDeliveryEstimate`'s React Query works.

---

## Shared Patterns

### Turnstile-gated Edge invoke
**Source:** `client/src/lib/turnstile.ts` (loader) + `client/src/components/auth/TurnstileWidget.tsx` (widget) + `client/src/lib/questionnaire.ts` L272-282 (invoke)
**Apply to:** `lib/delivery.ts` (invoke) + `DeliveryEstimate.tsx` (widget)
- Hosted-CDN loader only; NEVER `@marsidev/react-turnstile` (global type collision, memory `turnstile-no-npm-wrapper.md`).
- Dev-bypass "dev-bypass" token when `VITE_TURNSTILE_SITE_KEY` unset (TurnstileWidget L72).
- Single-use tokens: reset the widget after every failed/completed lookup before retry.

### React-Query fetch/hook split + typed boundary mapper
**Source:** `client/src/lib/siteContent.ts` L36-58, `catalog.ts` L42-60
**Apply to:** `lib/delivery.ts`
- `async function fetch...(): Promise<T>` that `throw`s on `error` (surfaces to `isError` → Retry UI).
- Public `useX()` wrapping `useQuery({ queryKey: [...], queryFn })`.
- Map DB/function snake_case → camelCase ONCE at the boundary; typed interface.

### Context provider + `useX`-throws-outside-provider
**Source:** `client/src/auth/AuthProvider.tsx` L17-34, L124-129
**Apply to:** `DeliveryProvider.tsx`
- `createContext<T | undefined>(undefined)`; default export `Provider({children})`; `useMemo` value; companion `useX()` throws if context is `undefined`.
- Mount at app root in `App.tsx` alongside `AuthProvider`.

### Currency formatting
**Source:** `client/src/lib/format.ts` `formatPrice`
**Apply to:** any `₹` figure in `DeliveryEstimate.tsx`
- Use `formatPrice`; the engine already rounds — do NOT re-round. Extend the shared helper (not inline) if a thousands separator is needed.

### Section visual language
**Source:** `ProductDetail.tsx` L206-316 (headings, dividers), UI-SPEC 07
- `text-xs uppercase tracking-widest text-foreground/50` headings; `border-t border-border/50` dividers; `bg-primary text-primary-foreground` CTAs; sharp edges (no `rounded-*`); two weights only (400/600).

## No Analog Found

None. Every new file has a strong local analog; the estimate contract is fixed by the
already-deployed `delivery-estimate` Edge Function (consumed as-is, not modified).

## Metadata

**Analog search scope:** `client/src/auth/`, `client/src/lib/`, `client/src/components/`, `client/src/pages/`, `supabase/functions/delivery-estimate/`
**Files scanned:** 11 (AuthProvider, questionnaire.ts, turnstile.ts, TurnstileWidget.tsx, siteContent.ts, catalog.ts, format.ts, ProductDetail.tsx, App.tsx, main.tsx, delivery-estimate/index.ts)
**Pattern extraction date:** 2026-07-04
</content>
</invoke>
