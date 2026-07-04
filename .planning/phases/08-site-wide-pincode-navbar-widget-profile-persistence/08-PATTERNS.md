# Phase 8: Site-Wide Pincode — Navbar Widget & Profile Persistence - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 3 (1 new, 2 modified)
**Analogs found:** 3 / 3 (all exact or strong role matches)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/src/components/delivery/DeliveryPincodePill.tsx` (NEW) | component (popover consumer) | event-driven / request-response (form submit → context setter) | `client/src/components/delivery/DeliveryEstimate.tsx` | exact (same dir, same `useDelivery()` consumer, same input sanitize + format-guard) |
| `client/src/delivery/DeliveryProvider.tsx` (MODIFY) | provider / store | CRUD (profile read on login + write-through on set) | `client/src/auth/AuthProvider.tsx` (read effect) + `client/src/lib/profile.ts` (write shape) | role-match / exact pattern reuse |
| `client/src/components/Navbar.tsx` (MODIFY) | component (mount point) | request-response (renders pill in right-cluster) | itself (existing right-cluster + icon conventions) | self / exact |

**Confirmed present in repo:** `@/components/ui/popover.tsx` (exports `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`), `@/components/ui/input.tsx`, `@/components/ui/button.tsx`. No new shadcn blocks needed (matches UI-SPEC Registry Safety).

**No migration needed:** `profiles.default_pincode` already exists (Phase 6). `default_pincode` is not yet referenced anywhere in `client/src` — Phase 8 introduces the first client read/write of it.

---

## Pattern Assignments

### `client/src/components/delivery/DeliveryPincodePill.tsx` (NEW — component, event-driven)

**Primary analog:** `client/src/components/delivery/DeliveryEstimate.tsx` (same directory, same context consumer). This is the closest possible analog — copy its input handling and format-guard almost verbatim, then strip all the network/Turnstile machinery (D-05: setter only, no network).

**Format guard constant** (DeliveryEstimate.tsx lines 17):
```typescript
// Reuse verbatim — the app-wide 6-digit format contract.
const PINCODE_RE = /^\d{6}$/;
```

**Context consumption + local input state** (DeliveryEstimate.tsx lines 52-54):
```typescript
const { pincode, setPincode } = useDelivery();
const [value, setValue] = useState(pincode ?? "");
const [formatError, setFormatError] = useState(false);
```
Note (UI-SPEC "Cancel" state): on popover close/reopen, reset the local `value` back to the current `pincode` (discard unsaved edits). Manage this with the Popover `open` state + an effect or an `onOpenChange` reset.

**Input sanitize pattern — copy exactly** (DeliveryEstimate.tsx lines 132-139):
```typescript
<Input
  inputMode="numeric"
  maxLength={6}
  placeholder="6-digit pincode"
  value={value}
  onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
  aria-label="Delivery pincode"
/>
```

**Submit / validate handler** — adapt from `handleCheck` (DeliveryEstimate.tsx lines 87-96), but drop Turnstile/mutate. Wrap in a `<form onSubmit={...}>` so Enter submits natively (UI-SPEC Component Contract 3):
```typescript
// Adapted from DeliveryEstimate handleCheck — format guard first, NO network.
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const next = value.trim();
  if (!PINCODE_RE.test(next)) {
    setFormatError(true);   // inline error, popover stays open, no setPincode
    return;
  }
  setFormatError(false);
  setPincode(next);         // provider handles localStorage + silent profile write
  setOpen(false);           // close popover; pill re-renders. No toast (D-08).
}
```

**Inline error copy — verbatim match** (DeliveryEstimate.tsx lines 162-166):
```typescript
{formatError && (
  <p className="mt-2 text-sm text-destructive">
    Enter a valid 6-digit pincode.
  </p>
)}
```

**Submit button visual language — copy classes** (DeliveryEstimate.tsx lines 140-147), but `type="submit"`, full-width, label "Save pincode":
```typescript
className="w-full bg-primary text-primary-foreground py-3 px-5 text-sm uppercase tracking-wider font-semibold transition-colors duration-300 hover:bg-secondary hover:text-primary"
```

**Micro-label heading pattern** (DeliveryEstimate.tsx lines 124-126) — reuse for "Delivery pincode":
```typescript
<h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">Delivery pincode</h3>
```

**Popover shell** — use `@/components/ui/popover` (`Popover` / `PopoverTrigger` / `PopoverContent`, exports confirmed). Per UI-SPEC: `PopoverContent align="end" sideOffset={8} className="w-72 p-4"`. `PopoverTrigger asChild` wrapping the pill button. Pill structure: `inline-flex items-center gap-2 h-9 md:… px-3 border border-border/60 text-primary hover:text-secondary hover:border-secondary transition-colors duration-300` + lucide `<MapPin size={18} strokeWidth={1.5} />` (strokeWidth matches Navbar icon convention).

---

### `client/src/delivery/DeliveryProvider.tsx` (MODIFY — provider, CRUD)

Keep the existing public context shape `{ pincode, setPincode }` UNCHANGED (D-09) so `DeliveryEstimate` and the new pill need zero context changes. Add two things: (a) a login-merge read effect, (b) a write-through inside `setPincode`.

**Existing code to preserve** (DeliveryProvider.tsx lines 28-53): the `readStoredPincode()` try/catch wrapper, the lazy-init `useState(() => readStoredPincode())`, and the `setPincode` localStorage try/catch. Extend, do not replace.

**Consume auth** — import the existing hook (mirror `useAuth()` usage elsewhere). Provider already mounts INSIDE `AuthProvider` in `App.tsx`, so no reorder:
```typescript
import { useAuth } from "@/auth/useAuth";
// inside provider:
const { user, loading } = useAuth();
```

**Login-merge read effect — clone the AuthProvider role-read pattern** (AuthProvider.tsx lines 76-108). Same skeleton: `active` cleanup flag, keyed on `user?.id`, early-return when logged out, `supabase.from("profiles").select(...).eq("id", userId).single()`. Gate on auth `loading === false` so it never decides during the auth-resolution window (the `resolvedFor` race note, AuthProvider lines 89-93):
```typescript
React.useEffect(() => {
  // Never decide during the auth-loading window (AuthProvider resolvedFor race).
  if (loading) return;
  let active = true;
  const userId = user?.id ?? null;
  if (!userId) return () => { active = false; };  // anonymous → localStorage only (D-04)

  supabase
    .from("profiles")
    .select("default_pincode")
    .eq("id", userId)
    .single()
    .then(({ data }) => {
      if (!active) return;
      const profilePin = (data?.default_pincode as string | null) ?? null;
      const localPin = readStoredPincode();
      if (profilePin) {
        // D-01: profile wins — write into context + localStorage (mirror device to account).
        if (profilePin !== localPin) setPincode(profilePin); // setPincode already writes both
      } else if (localPin) {
        // D-02: adopt anonymous choice into empty profile (push local → profile).
        void writePincodeToProfile(userId, localPin);
      }
    });
  return () => { active = false; };
}, [user?.id, loading]);
```
Note the equality guard `profilePin !== localPin` (D-09 optional guard) mirrors the `unchanged` short-circuit in `useUpdateEmail` (profile.ts lines 96-100) — avoids a redundant state write / storage churn.

**Write-through in `setPincode` (D-03)** — extend the existing callback (DeliveryProvider.tsx lines 46-53) to also fire a best-effort profile write when a user is present. Best-effort = silent-degrade (D-08), so NO toast (contrast with profile.ts which DOES toast — those are explicit Save actions):
```typescript
const setPincode = React.useCallback((p: string) => {
  try { localStorage.setItem(DELIVERY_PINCODE_KEY, p); } catch { /* degrade */ }
  setPincodeState(p);
  const userId = user?.id;
  if (userId) void writePincodeToProfile(userId, p); // best-effort, no await, no toast
}, [user?.id]);
```

**Profile write helper — clone the `useUpdateName` mutationFn shape** (profile.ts lines 59-65), but WITHOUT React Query and WITHOUT throwing/toasting (silent per D-08). RLS scopes the update to the caller's own row; the Phase-3 role-lock trigger blocks only `role`, so a `default_pincode` self-update is allowed:
```typescript
// Silent, best-effort — swallow errors (D-08 silent-degrade). No toast, no throw.
async function writePincodeToProfile(userId: string, pincode: string) {
  try {
    await supabase
      .from("profiles")
      .update({ default_pincode: pincode })
      .eq("id", userId);
  } catch { /* offline / RLS / network — pincode still works via localStorage + context */ }
}
```
Import `supabase` from `@/lib/supabase` (same import AuthProvider.tsx line 3 uses).

**Caution — dependency-order gotcha:** the login-merge effect calls `setPincode`, and `setPincode` now depends on `user?.id`. Keep `writePincodeToProfile` as a module-level function (not a useCallback) to avoid dependency churn, matching how `readStoredPincode` is a module-level helper today.

---

### `client/src/components/Navbar.tsx` (MODIFY — component, mount point)

**Mount point — the right-cluster** (Navbar.tsx line 87): `<div className="flex items-center space-x-3">`. Per UI-SPEC "Placement & responsive": the pill is the **first item** in this cluster, rendered BEFORE the Instagram `<a>` (line 89). Single mount point on all breakpoints; the desktop/mobile difference is a `hidden md:inline` / `md:hidden` label swap on the same trigger (icon always visible).

**Icon convention to match** (Navbar.tsx lines 166, 182, 209): lucide icons at `size={20} strokeWidth={1.5}`. UI-SPEC calls for `MapPin size={18} strokeWidth={1.5}` for the pill.

**Touch-target convention (mobile `h-11`)** (Navbar.tsx line 164): existing wishlist link uses `inline-flex h-11 w-11 items-center justify-center` — the mobile pill's `h-11` matches this.

**Hover convention to match** (used on every cluster item, e.g. lines 93, 164, 179): `hover:text-secondary transition-colors duration-300`. Pill adds `hover:border-secondary`.

**Do NOT duplicate in the Sheet** (Navbar.tsx line 214+): UI-SPEC explicitly excludes the pill from the mobile hamburger `Sheet` (nested-overlay anti-pattern; the top-bar pill is already reachable in one tap). Leave the `Sheet` block untouched.

**Change is minimal:** add one import (the new `DeliveryPincodePill`) and one JSX line as the first child of the line-87 cluster. The pill is self-contained (owns its own `useDelivery()` + popover), so Navbar needs no new state.

---

## Shared Patterns

### Context-consumer hook (throws outside provider)
**Source:** `client/src/delivery/useDelivery.ts` (lines 14-20), mirrors `client/src/auth/useAuth.ts`.
**Apply to:** The new pill calls `useDelivery()`. The provider now also calls `useAuth()`. Both are established `useX()` hooks — no new hook needed.
```typescript
const { pincode, setPincode } = useDelivery(); // in the pill
const { user, loading } = useAuth();           // in the provider
```

### Per-user server read: effect keyed on `user?.id`, gated on auth `loading`
**Source:** `client/src/auth/AuthProvider.tsx` (lines 76-108, plus the `resolvedFor` race note lines 89-93).
**Apply to:** The DeliveryProvider login-merge read effect. Never decide during the auth-loading window; use an `active` cleanup flag against stale async resolutions.

### RLS-scoped `profiles` self-update
**Source:** `client/src/lib/profile.ts` `useUpdateName` (lines 59-65).
**Apply to:** `writePincodeToProfile`. Same `.update({...}).eq("id", userId)` shape. Difference: silent/best-effort (no React Query, no toast, no throw) per D-08 — because the pincode set is the primary action and profile sync is a side-effect, unlike profile.ts's explicit Save buttons.

### Equality short-circuit before a write
**Source:** `client/src/lib/profile.ts` `useUpdateEmail` `unchanged` guard (lines 96-100).
**Apply to:** Optional `profilePin !== localPin` guard in the login-merge (D-09) to skip a redundant context/storage write.

### localStorage always try/catch-wrapped (silent degrade)
**Source:** `client/src/delivery/DeliveryProvider.tsx` (lines 28-34, 47-52).
**Apply to:** Preserve as-is; the new profile write inherits the same silent-degrade posture (D-08).

### Input sanitize + inline format error (one error voice)
**Source:** `client/src/components/delivery/DeliveryEstimate.tsx` (lines 17, 132-139, 162-166).
**Apply to:** The pill's popover input. Error copy "Enter a valid 6-digit pincode." must be verbatim (UI-SPEC copy contract → matches the estimator).

### Submit-button visual language
**Source:** `client/src/components/delivery/DeliveryEstimate.tsx` (lines 140-147).
**Apply to:** The pill's "Save pincode" button (full-width, `type="submit"`).

---

## No Analog Found

None. Every file has a strong in-repo analog. The only genuinely new surface is the `Popover` composition, but the primitive is already vendored (`@/components/ui/popover.tsx`) and used per shadcn convention.

## Metadata

**Analog search scope:** `client/src/components/delivery/`, `client/src/delivery/`, `client/src/auth/`, `client/src/lib/`, `client/src/components/`, `client/src/components/ui/`.
**Files scanned:** 8 read in full (AuthProvider, lib/profile, DeliveryProvider, DeliveryEstimate, Navbar, useDelivery, useAuth head, popover exports).
**Pattern extraction date:** 2026-07-05
</content>
</invoke>
