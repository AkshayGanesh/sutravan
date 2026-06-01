# Phase 5: Customer Experience — Wishlist, Profile & Native Questionnaire - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 12 (10 new, 2 modified, plus 1 migration + 1 edge function)
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/src/lib/wishlist.ts` | service (data layer) | CRUD (optimistic) | `client/src/lib/admin.ts` (mutation) + `client/src/lib/catalog.ts` (read/map) | role-match (no optimistic analog yet) |
| `client/src/lib/submissions.ts` (MODIFY) | service (data layer) | request-response (read) | self — extend existing `useSubmissions` | exact |
| `client/src/lib/profile.ts` | service (data layer) | CRUD | `client/src/lib/admin.ts` (mutation+toast) | role-match |
| `client/src/lib/questionnaire.ts` (map+invoke) | service (data layer) | request-response | `client/src/lib/admin.ts` (`fromProductForm` mapping) | role-match |
| `client/src/components/WishlistButton.tsx` | component | event-driven (toggle) | `client/src/components/ProductCard.tsx` (stopPropagation target) | partial (net-new control) |
| `client/src/components/AuthGuard.tsx` | component (route guard) | request-response | `client/src/auth/AdminGuard.tsx` | exact (minus role check) |
| `client/src/pages/Wishlist.tsx` | page | CRUD (list+remove) | `client/src/pages/admin/Submissions.tsx` (states) + `catalog.ts` grid | role-match |
| `client/src/pages/Profile.tsx` | page | CRUD + read | `client/src/pages/Login.tsx` (RHF form) + `Submissions.tsx` (history) | role-match |
| `client/src/pages/Questionnaire.tsx` (REPLACE) | page | request-response (wizard) | `client/src/pages/Login.tsx` (RHF+Zod+Form) | role-match |
| `client/src/components/ProductCard.tsx` (MODIFY) | component | event-driven | self — add heart | exact |
| `client/src/components/ProductDetail.tsx` (MODIFY) | component | event-driven | self — add heart | exact |
| `client/src/components/Navbar.tsx` (MODIFY) | component | request-response | self — add heart+badge+dropdown items | exact |
| `client/src/App.tsx` (MODIFY) | config (routing) | — | self — add 3 gated routes | exact |
| `supabase/migrations/0007_submissions_insert_policy.sql` | migration | — | `supabase/migrations/0002_rls_policies.sql` | exact (idiom) |
| `supabase/functions/verify-and-submit/index.ts` | service (edge fn) | request-response | none in codebase (first edge fn) | NO ANALOG — use RESEARCH Pattern 2 |

## Pattern Assignments

### `client/src/lib/wishlist.ts` (service, CRUD optimistic)

**Analogs:** `client/src/lib/catalog.ts` (read + snake→camel + `productImageUrls`), `client/src/lib/admin.ts` (mutation + invalidation).

**Read-layer pattern** — copy the fetch/map/useQuery split from `catalog.ts:71-94`:
```typescript
async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select(...).order(...);
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []).map(toProduct);
}
export function useProducts() {
  return useQuery({ queryKey: ['catalog', 'products'], queryFn: fetchProducts });
}
```
Reuse `productImageUrls(paths, category)` (exported from `catalog.ts:31-38`, re-exported by `admin.ts:27`) for wishlist card thumbnails — never hand-build Storage URLs.

**Mutation + invalidation pattern** — `admin.ts:283-302` (`useToggleProductActive`):
```typescript
export function useToggleProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, isActive }) => {
      const { error } = await supabase.from("products").update(...).eq("slug", slug);
      if (error) throw error;
      return { isActive };
    },
    onSuccess: ({ isActive }) => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(...);
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}
```
For wishlist, ADD the optimistic `onMutate`/`onError`-rollback/`onSettled`-invalidate layer (RESEARCH Pattern 3, lines 339-364) on a single `['wishlist']` key. `staleTime: Infinity` (queryClient.ts) means `invalidateQueries` in `onSettled` is the reconciliation point — same invariant `admin.ts` documents (`admin.ts:11-16`).

**Derived count (no separate query):** `useWishlistCount()` reads `useWishlist().data?.length` — RESEARCH Pattern 3 lines 334-337 (D-12/Pitfall 6).

---

### `client/src/lib/submissions.ts` (MODIFY — service, read)

**Analog:** itself (`lib/submissions.ts:24-35`). Add `useMySubmissions()` parallel to `useSubmissions()`:
```typescript
async function fetchSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('customization_submissions')
    .select('id, name, email, skin_type, message, payload, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionRow[];
}
export function useSubmissions() {
  return useQuery({ queryKey: ['submissions'], queryFn: fetchSubmissions });
}
```
The owner-scoped variant uses the SAME select (RLS `customization_submissions_admin_or_owner_read` already scopes rows to the caller for a non-admin) with a distinct key `['my-submissions']` (RESEARCH lines 526-538). Reuse the exported `SubmissionRow` type — no new shape.

---

### `client/src/lib/profile.ts` (service, CRUD)

**Analog:** `admin.ts` mutation shape + `Login.tsx` Supabase-auth call.

Email change is PENDING (toast "Check your inbox…", not "changed"), password is immediate, display name is a `profiles` update (RESEARCH Pattern 5, lines 413-425). Mutation/toast wrapper mirrors `admin.ts:283-302` (`onSuccess` toast.success, `onError` toast.error). Auth call shape from `Login.tsx:65-68`:
```typescript
const { error } = await supabase.auth.signInWithPassword({ ... });
if (error) { ...; return; }
```
→ becomes `supabase.auth.updateUser({ email })` / `{ password }`, and `supabase.from('profiles').update({ name }).eq('id', user.id)`.

---

### `client/src/lib/questionnaire.ts` (service, mapping + invoke)

**Analog:** `admin.ts:84-90` `fromProductForm` — the camelCase→snake_case "map once at the boundary" function.
Map wizard values to the D-05 shape (`name`, `email`, `skin_type`, `message`, `payload:{concerns,productInterest,allergies}`, `user_id`) then `supabase.functions.invoke('verify-and-submit', { body })` (RESEARCH lines 544-555). Keep mapping pure and unit-testable (RESEARCH Wave 0 gap `questionnaire.test.ts`).

---

### `client/src/components/WishlistButton.tsx` (component, event-driven)

**Analog:** `ProductCard.tsx` (the `onClick`/`onKeyDown` it must not trigger).
**Critical:** `e.stopPropagation()` + `e.preventDefault()` on keyboard (D-09 / Pitfall 7) so the heart never fires the card's `onSelect` (`ProductCard.tsx:13-18`). 44px hit area (UI-SPEC). Filled gold/primary when saved, `text-foreground/60` outline when not (UI-SPEC Color). lucide `Heart` icon. Logged-out tap → sign-in toast → `/login?next=` via `safeReturnTo` (see Shared Patterns). Reads/writes the shared `['wishlist']` cache via `useToggleWishlist`.

---

### `client/src/components/AuthGuard.tsx` (component, route guard)

**Analog:** `client/src/auth/AdminGuard.tsx:30-58` — copy EXACTLY, removing branch 3 (the `role !== "admin"` check). Keep:
```typescript
const { loading, session } = useAuth();
const [location] = useLocation();
if (loading) return <Spinner .../>;            // centered spinner
if (!session) {
  const next = location.startsWith("/") ? location : "/";
  return <Redirect to={`/login?next=${encodeURIComponent(next)}`} />;
}
return <>{children}</>;
```
Place in `client/src/auth/` to match `AdminGuard.tsx` location.

---

### `client/src/pages/Wishlist.tsx` (page, list + remove)

**Analog:** `Submissions.tsx` for the loading/error/empty state trio; Shop/`catalog.ts` grid for the product layout.
- Loading = `Skeleton` grid mirroring the product grid (UI-SPEC: no layout shift).
- Error = inline block `border-destructive/40 bg-destructive/5` + `Button variant="outline"` Retry calling `refetch()` (`Submissions.tsx:96-110`).
- Empty = `Empty`/`EmptyHeader`/`EmptyTitle`/`EmptyDescription` (`Submissions.tsx:113-128`).
- Page header = `<h1 className="font-serif text-2xl text-primary">` (`Submissions.tsx:50-54`).
- Remove = neutral/ghost icon button, instant optimistic, NO ConfirmDialog (D-13 / UI-SPEC). Optional undo toast.

---

### `client/src/pages/Profile.tsx` (page, CRUD + read)

**Analogs:** `Login.tsx` (RHF + Zod + shadcn `Form`/`FormField`/`Input` blocks, lines 58-184) for the three account-mgmt forms; `Submissions.tsx` (lines 130-263) for the inline submission-history list + read-only detail `Dialog` with the `Field` row helper and `Badge` skin-type render. Reuse `displayName`/`formatDate`/`snippet`/`Field` verbatim from `Submissions.tsx:33-140` (D-15, customer-friendly, no admin chrome). Header `font-serif text-2xl text-primary`.

---

### `client/src/pages/Questionnaire.tsx` (REPLACE — page, wizard)

**Analog:** `Login.tsx` RHF+Zod+shadcn `Form` scaffolding (lines 1-34, 58-184) — same `useForm`/`zodResolver`/`FormField` idiom, extended to multi-step. Single `useForm`, a `step` state, per-step `form.trigger(STEP_FIELDS[step])` before advance (RESEARCH Pattern 4, lines 375-394). Logged-in name/email prefilled read-only from `useAuth()` (D-08). Final step = Turnstile (lazy CF script, RESEARCH lines 562-575) + "Send my request" → invoke edge function → thank-you screen (D-07). Page-brand heading `font-serif text-4xl` (display role, UI-SPEC), copy from UI-SPEC Copywriting Contract.

---

### `supabase/migrations/0007_submissions_insert_policy.sql` (migration)

**Analog:** `supabase/migrations/0002_rls_policies.sql:91-114` — follow the `(select auth.uid())` + `to anon, authenticated` + `with check (...)` idiom (e.g. `wishlists_owner_insert` lines 96-99). The new INSERT policy body is fully specified in RESEARCH Pattern 1 (lines 215-223): anon path → `user_id IS NULL`; authenticated path → `user_id = (select auth.uid())`. Number `0007` (next after `0006`).

---

### `supabase/functions/verify-and-submit/index.ts` (edge function)

**No codebase analog (first edge function).** Use RESEARCH Pattern 2 verbatim (lines 232-302): `Deno.serve` + CORS/OPTIONS preflight + Turnstile `siteverify` + insert under the CALLER's JWT (NOT service role). Config: `verify_jwt = false` in `supabase/config.toml` (Pitfall 1). Secret via `supabase secrets set TURNSTILE_SECRET_KEY`. Restrict CORS origin to the GitHub Pages site in production (Pitfall 2).

## Shared Patterns

### Authentication / session
**Source:** `client/src/auth/useAuth` — `{ session, user, role, loading, signOut }`.
**Apply to:** `AuthGuard.tsx`, `Profile.tsx`, `Questionnaire.tsx` (prefill), `WishlistButton.tsx`, `Navbar.tsx`.

### Open-redirect-safe return URL
**Source:** `client/src/pages/Login.tsx:44-50` (`safeReturnTo`) consumed via `/login?next=${encodeURIComponent(location)}`.
**Apply to:** `AuthGuard.tsx`, `WishlistButton.tsx` logged-out prompt (D-10/D-16). Do NOT build a new sanitizer.
```typescript
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("://")) return "/";
  return raw;
}
```

### State trio (loading / error / empty)
**Source:** `client/src/pages/admin/Submissions.tsx:62-128`.
**Apply to:** `Wishlist.tsx`, `Profile.tsx` history. Skeleton mirrors real layout; error = `border-destructive/40 bg-destructive/5` block + outline Retry `refetch()`; empty = `Empty*` components.

### Mutation toast + cache invalidation
**Source:** `client/src/lib/admin.ts:274-302` — `onSuccess: invalidateQueries + toast.success`, `onError: toast.error(mapWriteError(e))`. `staleTime: Infinity` makes invalidation the reconciliation point.
**Apply to:** `wishlist.ts`, `profile.ts`.

### Read-layer (fetch/map/useQuery split, throw-on-error)
**Source:** `client/src/lib/catalog.ts:71-98`, `client/src/lib/submissions.ts:24-35`.
**Apply to:** `wishlist.ts`, extended `submissions.ts`. Map snake→camel ONCE at the boundary; `if (error) throw error`.

### Detail dialog + Field helper
**Source:** `client/src/pages/admin/Submissions.tsx:131-140` (`Field`), `:216-263` (`Dialog` + payload `pre` + skin-type `Badge`).
**Apply to:** `Profile.tsx` submission history detail (reuse, strip admin chrome — D-15).

### RLS migration idiom
**Source:** `supabase/migrations/0002_rls_policies.sql:91-114`.
**Apply to:** `0007_submissions_insert_policy.sql`. `(select auth.uid())` wrapped form, explicit `to` roles, `with check`.

### Routing (base-aware, guarded)
**Source:** `client/src/App.tsx:39-101` — `AdminRoute` wraps children in guard; `WouterRouter base={import.meta.env.BASE_URL...}`.
**Apply to:** add `/profile`, `/wishlist` (and replaced `/questionnaire` stays public) wrapped in `AuthGuard`. Mirror the `AdminRoute` wrapper shape.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/functions/verify-and-submit/index.ts` | edge function | request-response | First Supabase Edge Function in the project — no Deno/edge precedent. Use RESEARCH Pattern 2 (lines 232-302). |
| Turnstile lazy-load + widget integration | client util | event-driven | No CDN-script lazy-loader precedent (TipTap/HEIC are npm code-split, not script-injected). Use RESEARCH lines 562-575. |

## Metadata

**Analog search scope:** `client/src/lib/`, `client/src/pages/`, `client/src/pages/admin/`, `client/src/components/`, `client/src/auth/`, `supabase/migrations/`.
**Files scanned:** 11 read in full/targeted (submissions.ts, Submissions.tsx, catalog.ts, admin.ts, ProductCard.tsx, ProductDetail.tsx, AdminGuard.tsx, Login.tsx, Navbar.tsx, App.tsx, 0002_rls_policies.sql).
**Pattern extraction date:** 2026-06-01
