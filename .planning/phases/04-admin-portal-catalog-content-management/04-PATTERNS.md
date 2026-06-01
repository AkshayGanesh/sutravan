# Phase 4: Admin Portal — Catalog & Content Management - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 22 new/modified
**Analogs found:** 19 / 22

> Architecture note: Supabase-direct SPA. There is NO server tier — every "controller/service" is browser-side (PostgREST/Storage writes). RLS is the real security boundary (migrations 0002/0003 + CR-01 in 0005). All admin UI is convenience only.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/src/lib/admin.ts` (NEW) | service (write data-layer) | CRUD | `client/src/lib/catalog.ts` | exact (mirror) |
| `client/src/lib/siteContent.ts` (NEW) | service (read hook) | request-response | `client/src/lib/catalog.ts` (`useProducts`) | exact |
| `client/src/lib/slug.ts` (NEW) | utility | transform | `client/src/lib/format.ts` | role-match (pure util) |
| `client/src/lib/imagePipeline.ts` (NEW) | utility | file-I/O / transform | `client/src/lib/catalog.ts` (`productImageUrls`) | partial (Storage-adjacent) |
| `client/src/lib/sanitizeHtml.ts` (NEW) | utility | transform | `client/src/lib/authErrors.ts` | role-match (pure str→str) |
| `client/src/lib/adminErrors.ts` (NEW, optional) | utility | transform | `client/src/lib/authErrors.ts` | exact (mirror) |
| `client/src/pages/admin/AdminLayout.tsx` (NEW) | component (shell) | — | `client/src/components/Layout.tsx` + `Footer.tsx` | role-match |
| `client/src/pages/admin/ProductsList.tsx` (NEW) | page (list) | CRUD/read | `client/src/pages/Shop.tsx` (useProducts consumer) | role-match |
| `client/src/pages/admin/ProductForm.tsx` (NEW) | page (form) | request-response | `client/src/pages/Login.tsx` / `Register.tsx` | exact (RHF+Zod) |
| `client/src/pages/admin/CategoriesList.tsx` (NEW) | page (list+form) | CRUD | `client/src/pages/Login.tsx` (form) + `catalog.ts` | role-match |
| `client/src/pages/admin/SiteContent.tsx` (NEW) | page (form) | request-response | `client/src/pages/Register.tsx` (RHF+Zod) | role-match |
| `client/src/pages/admin/Submissions.tsx` (NEW) | page (read list+detail) | read-only | `client/src/lib/catalog.ts` (useQuery) | role-match |
| `client/src/components/admin/ImageDropzone.tsx` (NEW) | component | file-I/O | — | **no analog** |
| `client/src/components/admin/RepeatableRows.tsx` (NEW) | component | event-driven | `client/src/pages/Login.tsx` (RHF field) | partial |
| `client/src/components/admin/RichTextEditor.tsx` (NEW, lazy) | component | event-driven | — | **no analog** |
| `client/src/components/admin/ConfirmDialog.tsx` (NEW) | component | event-driven | `client/src/components/ui/alert-dialog.tsx` | role-match (wrap) |
| `supabase/migrations/0005_cr01_products_public_read.sql` (NEW) | migration | — | `supabase/migrations/0002_rls_policies.sql` | exact |
| `supabase/migrations/0006_seed_site_content.sql` (NEW) | migration | — | `supabase/migrations/0003_storage_buckets.sql` (idempotent insert) | role-match |
| `client/src/App.tsx` (MODIFY) | route config | — | self (existing `/admin/*` route) | exact |
| `client/src/components/Footer.tsx` (MODIFY) | component | — | self (rewire to `useSiteContent`) | exact |
| `client/src/components/Navbar.tsx` / `Contact.tsx` / `ProductDetail.tsx` / `Shop.tsx` (MODIFY) | components | — | `Footer.tsx` (same consts) | exact |
| `client/src/components/Hero.tsx` / `pages/OurStory.tsx` (MODIFY) | components | — | self (copy → `useSiteContent`) | exact |

## Pattern Assignments

### `client/src/lib/admin.ts` (service, CRUD) — THE core new file

**Analog:** `client/src/lib/catalog.ts` (read the WHOLE file — it is 99 lines).

**Mapping-boundary pattern** — mirror `toProduct` (catalog.ts:41-56) with a symmetric `fromProductForm` (camelCase→snake_case), doing the map ONCE at the boundary. RESEARCH Pattern 1 gives the exact shape. Reverse of:
```typescript
// catalog.ts:41-56 — snake→camel (read). admin.ts does camel→snake (write):
function toProduct(row: any): Product {
  return { id: row.slug, name: row.name, subtitle: row.subtitle ?? '',
    category: row.categories?.slug, price: row.price,
    benefits: row.benefits ?? [], ingredients: row.ingredients ?? [],
    tips: row.tips ?? [], shelfLife: row.shelf_life ?? '',
    batchNote: row.batch_note ?? '', images: productImageUrls(row.images ?? [], categorySlug) };
}
```
**Admin read path differs from catalog.ts** — the admin product LIST query must NOT add `.eq('is_active', true)` (catalog.ts:77 does, for public). RESEARCH Pitfall 4: admins see drafts via the `products_admin_write` FOR-ALL policy; do not inherit the public filter.

**Storage write pattern** (RESEARCH Pattern 3, supabase docs CITED):
```typescript
const bucket = supabase.storage.from('product-images');
await bucket.upload(`products/${slug}/${filename}`, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true }); // upsert:true = "replace"
await bucket.remove([`products/${slug}/old.jpg`]); // remove takes an ARRAY; use on image-remove AND product-delete orphan cleanup
```
Reuse `getPublicUrl` for display via `productImageUrls` (catalog.ts:31-38) — never hand-build URLs.

**In-use category delete** (RESEARCH friendly-error example): catch FK `error.code === '23503'` → throw the D-15 copy "This category has {N} products — move or delete them first." Slug collision: catch `23505`, retry `-2`/`-3`.

**Mutation + invalidation** (RESEARCH Pattern 2) — MANDATORY because `queryClient.ts:9` sets `staleTime: Infinity`:
```typescript
const qc = useQueryClient();
useMutation({ mutationFn: upsertProduct,
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalog'] }); toast.success('Product saved.'); },
  onError: (e) => toast.error(mapWriteError(e)) });
```
Existing read keys are `['catalog','products']` and `['catalog','categories']` (catalog.ts:93,97) — invalidate the `['catalog']` prefix to refresh both; add `['siteContent']` family for D-20.

---

### `client/src/lib/siteContent.ts` (service, request-response)

**Analog:** `client/src/lib/catalog.ts` `useProducts`/`fetchProducts` (lines 71-98).

Mirror the `useQuery` + `fetchX` split (RESEARCH Pattern 5). Fetch all `site_content` rows once, reduce to `Record<string,string>`, queryKey `['siteContent']`. **Mandatory fallback:** consumers do `data?.email ?? DEFAULT_EMAIL`, where defaults are the current hardcoded literals (Footer.tsx:3-5).

---

### `client/src/pages/admin/ProductForm.tsx` (page, request-response) — RHF+Zod form

**Analog:** `client/src/pages/Login.tsx` (whole file, 191 lines) — the canonical RHF+Zod form. Also `Register.tsx`.

**Imports** (Login.tsx:3-27): `useForm` from `react-hook-form`, `zodResolver` from `@hookform/resolvers/zod`, `z`, the shadcn `Form/FormField/FormItem/FormLabel/FormControl/FormMessage` set, `Input`/`Button`/`Card*`, `supabase`, `useToast`.

**Schema + types** (Login.tsx:29-34):
```typescript
const loginSchema = z.object({ email: z.string().trim().email("...") });
type LoginValues = z.infer<typeof loginSchema>;
```
Product form uses `z.email()`/`.url()` per UI-SPEC; price = numeric/blank → `null` (D-09; feed `formatPrice`).

**Form wiring** (Login.tsx:58-83, 115-183): `useForm({ resolver: zodResolver(schema), defaultValues })`; `form.handleSubmit(onSubmit)`; `FormField` render-prop per field with `<FormMessage/>` for inline validation; submit `Button disabled={form.formState.isSubmitting}` with label-swap loading state (Login.tsx:176-182). UI-SPEC: write success/failure via Sonner toast, NOT inline; field validation inline only.

**Inline form-level error** (Login.tsx:56,167-174): `formError` state rendered as `<p role="alert" className="text-destructive">`.

---

### `client/src/pages/admin/ProductsList.tsx` (page, list)

**Analog (data):** `catalog.ts` useQuery consumers; **(UI):** shadcn `table.tsx` + `switch.tsx`.

Loading → `Skeleton` rows; error → inline block + Retry calling `refetch()` (UI-SPEC mirrors Phase 2 pattern); empty → shadcn `empty`. Published toggle = `switch` with optimistic flip + revert-on-error (UI-SPEC). "No photo" badge when `images[]` empty.

---

### `client/src/components/admin/ConfirmDialog.tsx` (component)

**Analog:** `client/src/components/ui/alert-dialog.tsx` (in-repo). Wrap once; required on every destructive action (D-12). Confirm button `variant="destructive"`, cancel `outline`/`ghost`. Copy verbatim from UI-SPEC §Destructive confirmations.

---

### `client/src/lib/sanitizeHtml.ts` (utility, transform)

**Analog:** `client/src/lib/authErrors.ts` — same "pure str→str, no React/IO, documented at top" convention. RESEARCH Pattern 4 gives the DOMPurify allow-list + the `afterSanitizeAttributes` hook forcing `rel="noopener noreferrer"`. Public render: `<div dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }} />`.

---

### `client/src/lib/slug.ts` (utility, transform)

**Analog:** `client/src/lib/format.ts` (pure, self-documenting header, named export). RESEARCH slugify example. Slug stays stable on rename (D-07); collision handled in admin.ts (23505 retry).

---

### `supabase/migrations/0005_cr01_products_public_read.sql` (migration)

**Analog:** `supabase/migrations/0002_rls_policies.sql:28-31` (the current `products_public_read using (true)`). Drop + recreate with `using (is_active = true)`. RESEARCH gives the exact SQL. Header-comment style mirrors 0002/0003 (purpose + invariant + source line).

---

### `supabase/migrations/0006_seed_site_content.sql` (migration)

**Analog:** `supabase/migrations/0003_storage_buckets.sql:21-24` — idempotent `insert ... on conflict (id) do nothing`. Use `on conflict (key) do nothing` so re-runs never clobber owner edits. Seed values verbatim from `Footer.tsx:3-5` (email/instagram/youtube), `Hero.tsx`, `OurStory.tsx`.

---

### `client/src/App.tsx` (MODIFY, route config)

**Analog:** self — existing `/admin/:rest*` + `/admin` routes already wrap `<Admin/>` in `<AdminGuard>` (App.tsx:32-45). Replace `<Admin/>` with `<AdminLayout/>` and add nested `/admin/products`, `/admin/products/new`, etc. Keep `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` (App.tsx:21) for GitHub Pages sub-path.

---

### `client/src/components/Footer.tsx` + Navbar/Contact/ProductDetail/Shop/Hero/OurStory (MODIFY)

**Analog:** `Footer.tsx:3-5` consts (`INSTAGRAM_URL`/`YOUTUBE_URL`/`EMAIL`) are duplicated across all targets. Rewire each to `const { data } = useSiteContent(); const email = data?.email ?? "sutravan.in@gmail.com"`. Keep the current literal as the fallback default (D-20, mandatory). Exact source lines: RESEARCH Runtime State Inventory (Footer.tsx:3-5; Navbar.tsx:77/102/126/249/279/301/318; Contact.tsx:4-5,30; ProductDetail.tsx:16,182; Shop.tsx:177).

## Shared Patterns

### Authentication / Guard
**Source:** `client/src/auth/AdminGuard.tsx`, `client/src/auth/useAuth.ts`
**Apply to:** All `/admin/*` pages — they render INSIDE `AdminGuard` (App.tsx). Admin writes ride the authenticated session that RLS's `private.is_admin()` recognizes. `useAuth()` exposes `{ session, user, role, loading, signOut }` — `signOut` powers the AdminLayout logout button. UI guard is convenience only; never the boundary.

### Error mapping (write errors → friendly copy)
**Source:** `client/src/lib/authErrors.ts` (`mapAuthError`, str→str)
**Apply to:** `lib/admin.ts` write errors. Mirror as `mapWriteError` translating PostgREST codes (`23503` FK→category-in-use, `23505` unique→slug collision, network) to the UI-SPEC copy. Same pure-function convention.

### Toast on every write (D-12 cross-cutting)
**Source:** Login.tsx:55,77 (`useToast` / `toast(...)`) AND `@/components/ui/sonner`/`toaster` (mounted in App.tsx:57). RESEARCH recommends Sonner `toast.success/error` for admin writes. Success strings verbatim from UI-SPEC §Write success toasts.

### Supabase client + QueryClient
**Source:** `client/src/lib/supabase.ts` (singleton), `client/src/lib/queryClient.ts` (`staleTime: Infinity`)
**Apply to:** All data files — import the `supabase` singleton; remember `staleTime: Infinity` means invalidation is mandatory after writes.

### Price + image-URL render (do not duplicate)
**Source:** `client/src/lib/format.ts` (`formatPrice`), `catalog.ts` (`productImageUrls`/`getPublicUrl`)
**Apply to:** ProductForm price field and any admin thumbnail — reuse, never re-implement.

### Migration header convention
**Source:** `supabase/migrations/0002`/`0003` headers — top comment block: file name, phase/plan/task, the decision IDs, the net invariant, source line ref. Mirror in 0005/0006.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `client/src/components/admin/ImageDropzone.tsx` | component | file-I/O | No drag-drop/upload component exists. Build from RESEARCH §Image pipeline + UI-SPEC dropzone states; lazy-import `heic2any`/`browser-image-compression`. |
| `client/src/components/admin/RichTextEditor.tsx` | component | event-driven | No rich-text editor exists. Build TipTap wrapper (RESEARCH); lazy-loaded to keep public bundle clean. |
| `client/src/lib/imagePipeline.ts` | utility | file-I/O | No browser image-processing code exists. Build from RESEARCH §Image pipeline (size guard → HEIC → compress); only the size/type GUARD is unit-testable. |

> For these three, the planner should follow RESEARCH.md code examples (Pattern 3, Image pipeline, Pitfalls 2/3/5) and UI-SPEC component-state contracts rather than a codebase analog.

## Metadata

**Analog search scope:** `client/src/lib/`, `client/src/pages/`, `client/src/auth/`, `client/src/components/`, `client/src/components/ui/`, `supabase/migrations/`
**Files scanned:** catalog.ts, format.ts, supabase.ts, queryClient.ts, authErrors.ts, Login.tsx, Admin.tsx, App.tsx, Footer.tsx, AdminGuard.tsx, useAuth.ts, AuthProvider.tsx, migrations 0001-0003; ui/ inventory
**Pattern extraction date:** 2026-06-01
