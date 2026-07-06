# Phase 10: Admin Zone-Weight Rate Slab Editor - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 5 (2 create, 3 modify) + 2 read-only reference
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/src/pages/admin/RateSlabs.tsx` (NEW) | page (admin editor) | request-response / bulk edit | `client/src/pages/admin/Delivery.tsx` | exact (admin single-Save form) |
| `client/src/lib/admin.ts` — `useDeliveryRateSlabs()` read hook (MODIFY / add) | data hook (query) | CRUD-read | `useAdminQuestions()` in same file | exact |
| `client/src/lib/admin.ts` — `useSaveRateSlabs()` bulk-upsert hook (MODIFY / add) | data hook (mutation) | CRUD-write + cache-purge | `useSaveDeliverySettings()` in same file | exact |
| `client/src/pages/admin/AdminLayout.tsx` — `NAV_ITEMS` (MODIFY) | config (nav array) | static list | existing `NAV_ITEMS` entries | exact |
| `client/src/App.tsx` — admin route (MODIFY) | route registration | request-response | existing `/admin/delivery` Route | exact |
| `supabase/functions/delivery-estimate/index.ts` (READ-ONLY reuse) | edge function | request-response | — its own `{purge:true}` branch | reused verbatim, no change |
| `supabase/migrations/0016_delivery_rate_slabs.sql` (READ-ONLY) | migration (table being edited) | — | — | no change |

## Pattern Assignments

### `client/src/pages/admin/RateSlabs.tsx` (NEW — page, bulk edit)

**Analog:** `client/src/pages/admin/Delivery.tsx` (full file read; secondary: `SiteContent.tsx`, the template Delivery.tsx itself cloned).

**Imports pattern** (`Delivery.tsx` lines 9-23) — RHF + zodResolver + shadcn primitives + the admin save hook from `@/lib/admin`:
```typescript
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
// New page swaps useSiteContent → useDeliveryRateSlabs, useSaveDeliverySettings → useSaveRateSlabs
```
Note: this page's live source is the **`delivery_rate_slabs` table** (via a new `useDeliveryRateSlabs()` query), NOT `useSiteContent()`. That is the one structural difference from Delivery.tsx — otherwise clone the shape.

**Form-value type idiom** (`Delivery.tsx` line 28) — raw `z.input` so number cells hold strings until zod coerces on submit:
```typescript
type RateSlabsFormValues = typeof rateSlabsSchema._input;
```
Define `rateSlabsSchema` alongside the page (mirror `deliverySchema.ts`: `z.coerce.number().int()` with `.positive()` messages, `z.superRefine`/`.refine` for the cross-field `eta_min ≤ eta_max` — see D-08). The `eta_min ≤ eta_max` check mirrors `deliverySchema.ts` line 67's `z.ZodIssueCode.custom` superRefine idiom.

**Prefill-from-live via `reset()` in `useEffect`** (`Delivery.tsx` lines 76-88) — re-seed the form once the query resolves. For the grid, map the 20 fetched rows into a `{ cells: { [zone-band]: cost }, etas: { [zone]: {min,max} } }` shape:
```typescript
useEffect(() => {
  if (isLoading) return;
  reset(mapSlabsToForm(data)); // 20 rows → 20 costs + 5 ETA pairs (D-06)
}, [data, isLoading, reset]);
```

**Number-cell registration** (`Delivery.tsx` lines 214-223) — `type="number" inputMode="numeric" min step` + `role="alert"` inline error:
```typescript
<Input id="..." type="number" inputMode="numeric" min={1} step={1}
  {...register("...", { valueAsNumber: true })} />
{errors.X && (
  <p role="alert" className="text-[0.8rem] font-medium text-destructive">
    {errors.X.message}
  </p>
)}
```
Cost cells: `min={1}` (D-08, integer ≥1). ETA min/max: `min={1}`, one pair per zone row (D-06). Grid = 5 zone rows × 4 weight-band columns; column headers are read-only gram-range labels (D-03: 0–250 / 251–500 / 501–1000 / 1001–2000g).

**Single Save button, disabled while pending/invalid** (`Delivery.tsx` lines 340-354, D-04/D-07):
```typescript
<Button type="submit" disabled={save.isPending || !formState.isValid}>
  {save.isPending ? (<><Spinner className="size-4" />Saving…</>) : "Save rate slabs"}
</Button>
```
(Use `formState.isValid` block-save per D-07 in place of Delivery's `originValid` gate — there is no serviceability concept here.)

**onSubmit → bulk mutate** (`Delivery.tsx` lines 133-150) — parse then hand the full payload to the save hook. Expand each zone's ETA pair across its 4 cells (D-06) so all 20 rows carry cost + eta_min + eta_max keyed by `(zone, weight_band)`.

**Loading guard** (`Delivery.tsx` lines 152-158): early-return a centered `<Spinner className="size-6" />` while `isLoading`.

Do NOT clone Delivery's serviceability/preview blocks (lines 44-56, 100-131, 357-393) — not applicable to the grid.

---

### `client/src/lib/admin.ts` → `useDeliveryRateSlabs()` (NEW read hook — query)

**Analog:** `useAdminQuestions()` / `fetchAdminQuestions()` (`admin.ts` lines 605-623).

```typescript
const RATE_SLAB_COLUMNS =
  "id, zone, weight_band, weight_min_g, weight_max_g, cost, eta_min_days, eta_max_days";

async function fetchRateSlabs() {
  const { data, error } = await supabase
    .from("delivery_rate_slabs")
    .select(RATE_SLAB_COLUMNS)
    .order("zone", { ascending: true })
    .order("weight_band", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useDeliveryRateSlabs() {
  return useQuery({ queryKey: ["deliverySlabs"], queryFn: fetchRateSlabs });
}
```
Query key `["deliverySlabs"]` per CONTEXT D-10. Public-read RLS on the table (migration 0016 lines 38-41) means the plain client read works. Exact key string is Claude's discretion (CONTEXT lines 112-114) but `["deliverySlabs"]` matches the CONTEXT wording.

### `client/src/lib/admin.ts` → `useSaveRateSlabs()` (NEW bulk-upsert hook — mutation + purge)

**Analog:** `useSaveDeliverySettings()` (`admin.ts` lines 825-851) — clone its onSuccess **verbatim** (invalidate + best-effort purge + toast), swapping the upsert target and invalidation key.

```typescript
export function useSaveRateSlabs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: RateSlabUpsertRow[]) => {
      // D-10: full 20-row upsert every save (no dirty-row tracking).
      const { error } = await supabase
        .from("delivery_rate_slabs")
        .upsert(rows, { onConflict: "zone,weight_band" }); // matches 0016 unique key (line 29)
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["deliverySlabs"] });
      // Best-effort cache purge (D-11) — tolerate any failure; 24h TTL is fallback.
      try {
        const { error } = await supabase.functions.invoke("delivery-estimate", {
          body: { purge: true },
        });
        if (error) console.warn("Delivery cache purge failed (tolerated):", error);
      } catch (e) {
        console.warn("Delivery cache purge failed (tolerated):", e);
      }
      toast.success("Rate slabs updated.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}
```
Key details copied from the analog: `onConflict` uses the composite `"zone,weight_band"` (the migration's `unique (zone, weight_band)` at line 29 — NOT `id`, so the upsert matches existing rows instead of duplicating). `mapWriteError` imported from `./adminErrors` (admin.ts line 24). Reuse `import { toast } from "sonner"` and `supabase` already at top of file.

---

### `client/src/pages/admin/AdminLayout.tsx` — `NAV_ITEMS` (MODIFY)

**Analog:** the existing `NAV_ITEMS` array (lines 38-46) and the `Truck` Delivery entry (line 44).

Add a sibling entry immediately **after** Delivery (D-05). Pick a Lucide icon (discretion — e.g. `Table`, `Grid3x3`, `IndianRupee`) and add it to the lucide import (lines 3-13):
```typescript
{ label: "Delivery", href: "/admin/delivery", icon: Truck },
{ label: "Rate Slabs", href: "/admin/rates", icon: Table }, // NEW (after Delivery, D-05)
{ label: "Submissions", href: "/admin/submissions", icon: Inbox },
```
Active-state matching (lines 75-77) and rendering (lines 84-90) already handle any new item generically — no other change needed.

### `client/src/App.tsx` — admin route (MODIFY)

**Analog:** the `/admin/delivery` Route block (lines 127-133).

Add the import next to line 29 (`import Delivery from "@/pages/admin/Delivery";`):
```typescript
import RateSlabs from "@/pages/admin/RateSlabs";
```
Add the Route after the `/admin/delivery` block (line 133), before `/admin/submissions`. `AdminRoute` (defined lines ~40-44) already wraps children in `AdminGuard` + `AdminLayout` — no guard change:
```tsx
<Route path="/admin/rates">
  {() => (
    <AdminRoute>
      <RateSlabs />
    </AdminRoute>
  )}
</Route>
```
Route path `/admin/rates` is Claude's discretion (CONTEXT line 112) but must match the `NAV_ITEMS` href chosen above.

---

## Shared Patterns

### Cache purge for live-no-redeploy (SC2)
**Source:** `supabase/functions/delivery-estimate/index.ts` lines 395-411 (the `body.purge === true` branch — admin-gated, service-role deletes ALL `delivery_estimate_cache` rows via `.neq('id', <impossible-uuid>)`).
**Apply to:** `useSaveRateSlabs` onSuccess. **Reused verbatim — NO edge-function change** (D-11). The branch is source-agnostic (clears the whole cache), so a slab edit triggers full recompute exactly like a settings edit. Client call shape: `supabase.functions.invoke("delivery-estimate", { body: { purge: true } })`.

### Admin write via RLS
**Source:** migration `0016_delivery_rate_slabs.sql` lines 43-47 (`delivery_rate_slabs_admin_write` — `for all ... using/with check (private.is_admin())`).
**Apply to:** `useSaveRateSlabs` upsert. No new server plumbing — the bulk upsert inherits admin gating; a non-admin write fails RLS and surfaces via `mapWriteError` → toast.

### RHF + zodResolver + `role="alert"` inline errors
**Source:** `Delivery.tsx` (lines 58-71 form setup, 206-210 error render) + `deliverySchema.ts` (coerce/int/positive/superRefine).
**Apply to:** RateSlabs page + its `rateSlabsSchema`. Block-save while invalid (D-07); bounds cost ≥1, eta_min ≥1, eta_min ≤ eta_max (D-08).

### Mutation error mapping + success toast
**Source:** `mapWriteError` from `@/lib/adminErrors` (admin.ts line 24); `toast` from sonner. Every admin mutation uses `onError: (e) => toast.error(mapWriteError(e))` + `toast.success(...)` in onSuccess.
**Apply to:** `useSaveRateSlabs`.

## No Analog Found

None — every file has a direct in-repo analog. The only novel logic is the 20-row ⇄ grid-form mapping (`mapSlabsToForm` / expanding 5 ETA pairs to 20 rows per D-06), which is pure data-shaping local to `RateSlabs.tsx` with no existing analog but no external pattern needed.

## Metadata

**Analog search scope:** `client/src/pages/admin/`, `client/src/lib/admin.ts`, `client/src/App.tsx`, `supabase/functions/delivery-estimate/`, `supabase/migrations/`
**Files scanned:** 6 (Delivery.tsx, AdminLayout.tsx, admin.ts, App.tsx, delivery-estimate/index.ts, 0016 migration) + deliverySchema.ts grep
**Pattern extraction date:** 2026-07-06
