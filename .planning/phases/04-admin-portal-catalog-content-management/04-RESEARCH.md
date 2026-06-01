# Phase 4: Admin Portal — Catalog & Content Management - Research

**Researched:** 2026-06-01
**Domain:** React/Vite SPA admin CMS over Supabase-direct (Postgres + Storage + RLS); browser-side image pipeline; safe rich-text rendering; TanStack Query write/invalidation
**Confidence:** HIGH (stack + Supabase mechanics + RLS verified against codebase and official docs); MEDIUM (image-pipeline tuning values, rich-text editor ergonomics — exact knobs are planner discretion)

## Summary

This phase turns the existing read-only Supabase-direct SPA into a full write client. Almost everything needed is already in the repo: the `@supabase/supabase-js` v2 singleton, TanStack Query, react-hook-form + Zod, the complete shadcn primitive set (including `sidebar.tsx`, `table.tsx`, `switch.tsx`, `alert-dialog.tsx`, `progress.tsx`, `form.tsx`), the `AdminGuard`/`AuthProvider` boundary, and the `catalog.ts` read layer whose `toProduct`/`toCategory`/`getPublicUrl` mapping must be mirrored symmetrically for writes. RLS already enforces admin-only writes on every table and `storage.objects` (migrations 0002/0003), so the portal UI is convenience, not the security boundary — the only new SQL this phase strictly needs is the CR-01 tightening (`products_public_read` → `using (is_active = true)`) plus a `site_content` seed, both shipped as new numbered migrations (0005+).

Three areas need new dependencies and careful design: (1) the **browser-side image pipeline** — `heic2any` (HEIC→JPEG) + `browser-image-compression` (downscale/compress), both dynamically imported so the public bundle stays small; (2) a **rich-text editor** for the Our Story body — TipTap (`@tiptap/react` + `@tiptap/starter-kit`, React 19 peer-supported) storing sanitized HTML, rendered publicly through **DOMPurify** + `dangerouslySetInnerHTML`; (3) **mutation → cache-invalidation** wiring, which is non-trivial because `queryClient.ts` sets `staleTime: Infinity` and `refetchOnWindowFocus: false` — without explicit `invalidateQueries(['catalog'])` after every write, the public Shop will not update in the same session.

**Primary recommendation:** Build a new `client/src/lib/admin.ts` write layer that mirrors `catalog.ts`'s snake↔camel boundary and calls `queryClient.invalidateQueries({ queryKey: ['catalog'] })` after every product/category/content mutation. Use TipTap+DOMPurify for Our Story, `heic2any` + `browser-image-compression` (lazy-loaded) for the image pipeline, the shadcn `sidebar`/`table`/`switch`/`alert-dialog` primitives for the dashboard, and ship CR-01 + the `site_content` seed as migrations 0005 and 0006.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Product/category/content CRUD authorization | Database / Storage (RLS `is_admin()`) | API (Browser→PostgREST) | "Admin-only enforced server-side via RLS, not hidden in UI" (CLAUDE.md). Migrations 0002/0003 already enforce it. |
| Draft/published visibility gate | Database / Storage (RLS `using (is_active=true)`) | Browser (query filter) | CR-01: query-side filter alone leaks drafts via raw PostgREST. RLS is the real gate. |
| Image upload / HEIC convert / compress | Browser / Client | Database / Storage (`product-images` bucket) | Conversion + compression must run client-side (static SPA, no server); Storage only receives final bytes. |
| Image display URL resolution | Browser / Client (`getPublicUrl`) | — | Storage paths on rows; never hand-build URLs (Phase 2 D-04). |
| Rich-text authoring | Browser / Client (TipTap) | Database (`site_content.value` HTML) | Editor is pure client UI; DB stores the produced HTML string. |
| Rich-text public rendering safety | Browser / Client (DOMPurify) | — | XSS sanitization happens at render in the browser before `dangerouslySetInnerHTML`. |
| Write→public-Shop propagation | Browser / Client (TanStack Query invalidation) | — | `staleTime: Infinity` means no auto-refresh; explicit invalidation is mandatory. |
| Slug generation + collision | Browser / Client (util) | Database (`slug unique` constraint) | UI derives slug; DB unique constraint is the real collision guard. |
| In-use category delete protection | Database (`category_id` FK) | Browser (friendly error) | FK rejects the delete (Phase 1 D-04); UI translates the error to a readable message. |

## Standard Stack

### Core (already installed — reuse, do not re-add)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.106.2 | Storage upload/update/remove/list + table writes | Already the client singleton (`lib/supabase.ts`) [VERIFIED: package.json] |
| `@tanstack/react-query` | 5.60.5 | Mutations + cache invalidation | Read layer already on it [VERIFIED: package.json] |
| `react-hook-form` | 7.66.0 | Product/category/content forms | Phase 3 auth-form pattern [VERIFIED: package.json] |
| `@hookform/resolvers` | 3.10.0 | Zod resolver for RHF | Already installed [VERIFIED: package.json] |
| `zod` | 3.25.76 | Form schemas + email/URL validation | Already installed [VERIFIED: package.json] |
| `wouter` | 3.3.5 | `/admin/*` sub-routing (base-aware) | Already routing; `/admin/:rest*` route exists in App.tsx [VERIFIED: codebase] |
| `sonner` | 2.0.7 | Write success/error toasts (D-12) | Phase 3 D-14 toast pattern; `Toaster` mounted in App.tsx [VERIFIED: codebase] |
| shadcn `sidebar/table/switch/alert-dialog/progress/form/select/input/textarea/card/button` | n/a (in repo) | Dashboard shell + controls | All present in `client/src/components/ui/` [VERIFIED: ls] |

### Supporting (NEW — must install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `browser-image-compression` | 2.0.2 | Downscale + compress large phone photos before upload (D-11) | All accepted image types after HEIC step; lazy-import |
| `heic2any` | 0.0.4 | HEIC/HEIF → JPEG blob in-browser (D-11) | Only when input MIME is HEIC/HEIF; lazy-import |
| `@tiptap/react` + `@tiptap/starter-kit` (+ transitively `@tiptap/pm`, `@tiptap/core`) | 3.24.0 | Rich-text editor for Our Story body (D-19) | Our Story content field only; lazy-import the editor route |
| `dompurify` | 3.4.7 | Sanitize admin-authored HTML before public render (D-19) | Public Our Story render path; cheap, import normally |

**Installation:**
```bash
npm install browser-image-compression@2 heic2any@0 @tiptap/react@3 @tiptap/starter-kit@3 dompurify@3
```

> **Bundle-size discipline (D-11/D-19):** `heic2any` (~1.4MB unpacked, libheif WASM) and `browser-image-compression` (~web-worker) and TipTap must NOT enter the public bundle. Use dynamic `import()` inside the upload handler / behind the admin route so Vite code-splits them into admin-only chunks. DOMPurify (~20KB) is small and runs on the public Our Story page, so a normal import is fine there.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `heic2any` | `heic-to` (1.5.2, libheif-based, actively maintained 2026, 276K/wk) | `heic-to` is newer/maintained vs `heic2any`'s stale 0.0.4 (2023). `heic2any` has 753K/wk and a wider track record. **Both are [ASSUMED] (discovered via web/training).** Recommend `heic2any` for proven track record; `heic-to` is a valid fallback if `heic2any` fails on modern HEIC. Planner should pick one and gate behind a verify checkpoint. |
| TipTap (HTML) | `react-markdown` + a markdown textarea (store markdown) | Markdown storage avoids HTML-injection surface entirely (render via react-markdown, no `dangerouslySetInnerHTML`), but a raw markdown textarea is a worse UX for a non-technical owner than a WYSIWYG toolbar. TipTap gives bold/italic/link/list buttons (D-19) but requires DOMPurify on render. **Recommend TipTap+DOMPurify** for the owner-friendly toolbar D-19 asks for. |
| `dompurify` | `isomorphic-dompurify` | The `isomorphic` wrapper is for SSR/Node; this is a pure browser SPA, so plain `dompurify` is correct and lighter. |

**Version verification:** All versions confirmed via `npm view <pkg> version` on 2026-06-01. TipTap 3.24.0 declares `react: ^17 || ^18 || ^19` peer [VERIFIED: npm peerDependencies] — React 19.2 compatible. `@tiptap/pm` 3.24.0 exists. DOMPurify 3.4.7 (published 2026-05-27, zero runtime deps) [VERIFIED: npm].

## Package Legitimacy Audit

> slopcheck ran successfully — all candidate packages scanned `[OK]`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `browser-image-compression` | npm | published 2023, mature | 1.06M/wk | github.com/Donaldcwl/browser-image-compression | OK | Approved [ASSUMED — discovered via web] |
| `heic2any` | npm | 0.0.4 (2023, stale) | 753K/wk | github.com/alexcorvi/heic2any | OK | Approved [ASSUMED — discovered via web] |
| `heic-to` (fallback) | npm | 1.5.2 (2026-05, active) | 276K/wk | github.com/hoppergee/heic-to | OK | Fallback [ASSUMED] |
| `@tiptap/react` | npm | 3.24.0 (2026-05-31) | 8.6M/wk | github.com/ueberdosis/tiptap | OK | Approved [ASSUMED — discovered via web] |
| `@tiptap/starter-kit` | npm | 3.24.0 (2026-05-31) | 9.3M/wk | github.com/ueberdosis/tiptap | OK | Approved [ASSUMED] |
| `dompurify` | npm | 3.4.7 (2026-05-27) | 40.5M/wk | github.com/cure53/DOMPurify | OK | Approved [ASSUMED — discovered via web] |

**No postinstall scripts** found on any package (`npm view scripts.postinstall` empty). **Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

> Per the package-name provenance rule, every package above is tagged `[ASSUMED]` because the names were discovered via WebSearch/training, not from official Supabase/project docs. Registry existence + slopcheck `[OK]` is necessary but not sufficient for `[VERIFIED]`. **The planner should gate each new install behind a `checkpoint:human-verify` task before `npm install`.** (Confidence that these are the right, real packages is high — strong download counts, real source repos, clean slopcheck — but the provenance rule governs the tag.)

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────── BROWSER (SPA) ───────────────────────┐
                          │                                                              │
  Admin (authenticated) ──┼──> /admin/* route ──> AdminGuard (role==='admin') ──> Admin │
                          │                              │  shell (sidebar D-01)         │
                          │                              ▼                               │
                          │     ┌── Products list (table+thumb D-05) ── toggle/edit/del  │
                          │     ├── Product form (full-page D-04, RHF+Zod)               │
                          │     │      └─ image dropzone ─> [size guard >10MB reject]     │
                          │     │            └─ if HEIC: heic2any ──┐ (lazy import)       │
                          │     │            └─ browser-image-compression ──┐ (lazy)      │
                          │     │                                  ▼        ▼             │
                          │     │                          final JPEG/WebP blob           │
                          │     ├── Categories (table, in-use delete guard D-15)          │
                          │     ├── Site Content (plain inputs + TipTap for Our Story)    │
                          │     └── Submissions inbox (read-only list+detail D-17)        │
                          │              │                                                │
                          │              ▼                                                │
                          │     lib/admin.ts  (camelCase ──> snake_case writes)           │
                          │       ├─ supabase.from('products').insert/update/delete       │
                          │       ├─ supabase.storage.from('product-images')              │
                          │       │      .upload / .update(upsert) / .remove([paths])     │
                          │       └─ queryClient.invalidateQueries(['catalog'])  ◀── KEY  │
                          └──────────────┼───────────────────────────────┼───────────────┘
                                         │ (anon key + admin JWT)         │ invalidation
                                         ▼                                ▼
                    ┌──────────── SUPABASE ────────────┐      ┌── lib/catalog.ts (public read)
                    │ PostgREST ─ RLS is_admin() write  │      │   useProducts/useCategories
                    │ products/categories/site_content  │      │   refetch ──> public Shop
                    │ Storage  ─ storage.objects RLS    │      │   updates WITHOUT redeploy
                    │ product-images bucket (D-07/08/09)│      └────────────────────────────
                    └───────────────────────────────────┘

  Public Our Story page ── useSiteContent('our_story_body') ──> DOMPurify.sanitize(html)
                                                            └──> dangerouslySetInnerHTML
```

### Recommended Project Structure
```
client/src/
├── pages/admin/                 # admin route pages (replace Admin.tsx)
│   ├── AdminLayout.tsx          # D-02 admin chrome: sidebar + slim header (View site + logout)
│   ├── ProductsList.tsx         # D-05 table+thumbnail+Published toggle
│   ├── ProductForm.tsx          # D-04 full-page create/edit
│   ├── CategoriesList.tsx       # D-15/16
│   ├── SiteContent.tsx          # D-18/19 plain inputs + TipTap
│   └── Submissions.tsx          # D-17 read-only list+detail
├── components/admin/            # admin-only components
│   ├── ImageDropzone.tsx        # D-10/11/12 dropzone + pipeline + progress
│   ├── RepeatableRows.tsx       # D-06 benefits/ingredients/tips
│   ├── RichTextEditor.tsx       # TipTap wrapper (lazy)
│   └── ConfirmDialog.tsx        # shadcn AlertDialog wrapper (D-12 cross-cutting)
├── lib/
│   ├── admin.ts                 # NEW write layer (mirrors catalog.ts)
│   ├── siteContent.ts           # NEW public read helper for site_content (D-20)
│   ├── slug.ts                  # NEW slug gen + collision (D-07)
│   ├── imagePipeline.ts         # NEW HEIC convert + compress + size guard (D-11)
│   └── sanitizeHtml.ts          # NEW DOMPurify wrapper (D-19)
supabase/migrations/
│   ├── 0005_cr01_products_public_read.sql   # CR-01 (D-14)
│   └── 0006_seed_site_content.sql           # D-18 seed from hardcoded strings
```

### Pattern 1: Symmetric snake↔camel write layer (`lib/admin.ts`)
**What:** Mirror `catalog.ts`'s `toProduct` boundary with a `fromProduct(camel) → snake` mapper; do the mapping ONCE (Phase 2 decision: snake↔camel at the data-layer boundary, once).
**When to use:** Every product/category write.
```typescript
// Source: mirrors client/src/lib/catalog.ts toProduct (codebase)
// camelCase form values -> snake_case DB row
function fromProductForm(v: ProductFormValues, categoryId: string) {
  return {
    slug: v.slug,                 // generated by lib/slug.ts, stable on rename (D-07)
    name: v.name,
    subtitle: v.subtitle || null,
    category_id: categoryId,      // resolve from category slug -> id
    price: v.price ?? null,       // blank -> null -> "Price on request" (D-09)
    benefits: v.benefits,         // string[] from RepeatableRows (D-06)
    ingredients: v.ingredients,
    tips: v.tips,
    shelf_life: v.shelfLife || null,
    batch_note: v.batchNote || null,
    images: v.imagePaths,         // Storage paths, NOT URLs (Phase 1 D-03)
    is_active: v.isActive,        // draft default false on create (D-08)
  };
}
```

### Pattern 2: Mutation + mandatory invalidation
**What:** `useMutation` → on success `invalidateQueries(['catalog'])` + toast. Required because `queryClient.ts` has `staleTime: Infinity` and `refetchOnWindowFocus: false` — nothing refetches automatically.
```typescript
// Source: TanStack Query v5 + queryClient.ts staleTime:Infinity (codebase)
const qc = useQueryClient();
const save = useMutation({
  mutationFn: (v: ProductFormValues) => upsertProduct(v),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['catalog'] }); // public Shop updates live (no redeploy)
    toast.success('Product saved');
  },
  onError: (e) => toast.error(mapWriteError(e)), // reuse Phase 3 error-mapping style
});
```
> The existing read keys are `['catalog','products']` and `['catalog','categories']`. Invalidating the `['catalog']` prefix refreshes both. Add a `['siteContent']` key family for D-20.

### Pattern 3: Storage upload / replace / remove (verified)
**What:** supabase-js v2 Storage write API.
```typescript
// Source: https://supabase.com/docs/reference/javascript/storage-from-upload [CITED]
const bucket = supabase.storage.from('product-images');
// upload (new). upsert:true overwrites if path exists (use for "replace").
await bucket.upload(`products/${slug}/${filename}`, blob, {
  contentType: 'image/jpeg', cacheControl: '3600', upsert: true,
});
// remove takes an ARRAY of paths (use on image-remove and product-delete cleanup)
await bucket.remove([`products/${slug}/old.jpg`]);
// list a product's folder (to enumerate orphans before delete)
await bucket.list(`products/${slug}`);
// display: never hand-build — reuse catalog.ts productImageUrls / getPublicUrl
```
> **Orphan cleanup:** On product delete or image-remove, call `bucket.remove([...paths])` for the row's `images[]` (and/or `list()` the `products/{slug}` folder and remove all). Deleting the DB row does NOT delete Storage objects — they must be removed explicitly or they orphan. `upsert: true` is the "replace" mechanic (D-11).

### Pattern 4: Safe rich-text render (DOMPurify)
```typescript
// Source: https://dompurify.com + DOMPurify README [CITED]
import DOMPurify from 'dompurify';
export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','br','strong','em','b','i','u','a','ul','ol','li','h2','h3'],
    ALLOWED_ATTR: ['href','target','rel'],
  });
}
// Public Our Story render:
<div dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }} />
```
> Add a DOMPurify `afterSanitizeAttributes` hook (or post-process) to force `rel="noopener noreferrer"` and `target="_blank"` on external links — DOMPurify allows the `<a>` but does not add safe rel by default.

### Pattern 5: site_content public read + fallback (D-20)
```typescript
// Source: mirrors catalog.ts useQuery pattern (codebase)
// Fetch ALL site_content rows once, expose key lookups with code-default fallback.
export function useSiteContent() {
  return useQuery({
    queryKey: ['siteContent'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_content').select('key, value');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(r => [r.key, r.value])) as Record<string,string>;
    },
  });
}
// Consumers: const { data } = useSiteContent(); const email = data?.email ?? DEFAULT_EMAIL;
```
> **Fallback is mandatory (D-20):** keep the current hardcoded strings as code defaults so Navbar/Footer/Contact never render empty while the query loads or if a key is missing.

### Anti-Patterns to Avoid
- **Eager-importing heic2any/TipTap at module top:** balloons the public bundle. Always dynamic `import()` behind the admin route / inside the upload handler.
- **Forgetting `invalidateQueries` after a write:** with `staleTime: Infinity`, the admin sees their change but the public Shop tab does not until a full reload — defeats the "no redeploy, updates live" core value.
- **Hand-building Storage URLs:** breaks on spaces/parens in filenames; always `getPublicUrl` (Phase 2 D-04, already in `catalog.ts`).
- **Relying only on the query-side `is_active` filter for drafts:** CR-01 — a raw PostgREST call without the filter would return drafts until the RLS policy is tightened. Ship migration 0005.
- **Rendering `site_content.value` HTML without DOMPurify:** even admin-authored content is an XSS foothold (D-19) — sanitize on render.
- **Reassigning slug/image paths on product rename:** D-07 — slug and `products/{slug}/...` paths stay stable on rename.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC→JPEG decode | Custom libheif/WASM glue | `heic2any` (or `heic-to`) | Apple HEIC container parsing + libheif is enormous; battle-tested lib |
| Image downscale/compress | Canvas resize loops + quality search | `browser-image-compression` | Handles EXIF orientation, web-worker offload, iterative target-size search |
| HTML sanitization | Regex/string strip of tags | `dompurify` | Regex sanitizers are trivially bypassed (encoding, nested tags) — documented XSS class |
| Rich-text editor | contentEditable handling | `@tiptap/react` + starter-kit | contentEditable cross-browser selection/paste is a notorious rabbit hole |
| Confirm dialogs | Custom modal state | shadcn `AlertDialog` (already in repo) | Accessible focus-trap + Radix; D-12 cross-cutting |
| Data table | Custom `<table>` | shadcn `table.tsx` (already in repo) | Styled, consistent with the design system |
| Slug uniqueness | App-level "is it taken" loop only | DB `slug unique` constraint (exists) + suffix-on-conflict retry | The unique constraint is the real guard; app suffix is UX |
| URL/email validation | Regex | Zod `.email()` / `.url()` | Already the project's validation tool |

**Key insight:** This phase is mostly *integration* of existing, mature pieces. The only genuinely new logic worth hand-writing is small and testable: slug generation, the camel↔snake write mapper, the image-size guard, and the orphan-cleanup sequence.

## Common Pitfalls

### Pitfall 1: Public Shop not updating after admin edit
**What goes wrong:** Admin saves a product; the public Shop (same or other tab) shows stale data.
**Why:** `queryClient.ts` sets `staleTime: Infinity`, `refetchOnWindowFocus: false`, `refetchInterval: false` — nothing invalidates on its own.
**How to avoid:** Call `queryClient.invalidateQueries({ queryKey: ['catalog'] })` (and `['siteContent']`) in every mutation's `onSuccess`. (Cross-tab live update is out of scope; same-session in-app navigation will reflect after invalidation.)
**Warning signs:** Edit appears in admin but not on `/shop` without a hard refresh.

### Pitfall 2: Orphaned Storage files on delete
**What goes wrong:** Deleting a product row leaves its images in the `product-images` bucket forever.
**Why:** Postgres row delete and Storage objects are independent; no cascade.
**How to avoid:** Before/after deleting the row, `storage.remove([...row.images])` (or `list('products/{slug}')` then remove all). Same for the "remove image" button.
**Warning signs:** Bucket size grows; `products/{slug}` folders persist for deleted products.

### Pitfall 3: HEIC conversion failure / browser support
**What goes wrong:** `heic2any` throws on a malformed/unsupported HEIC, or runs in a browser without the needed APIs; the upload silently dies.
**Why:** HEIC variants differ; libheif WASM can fail on edge cases.
**How to avoid:** Wrap conversion in try/catch; on failure show a clear toast ("Couldn't process this photo — try a JPEG/PNG") rather than a stuck spinner (D-11 fallback). Validate MIME/size BEFORE conversion (D-12: reject >10MB up front, before spending CPU).
**Warning signs:** Spinner never resolves; console WASM errors.

### Pitfall 4: CR-01 migration accidentally hiding drafts from admin
**What goes wrong:** Tightening `products_public_read` to `using (is_active = true)` could be misread as "admins can't see drafts."
**Why:** Admins read products through the SEPARATE `products_admin_write` policy (`for all ... using (private.is_admin())`), which is unaffected — but the admin LIST query must not inherit the public `is_active` filter.
**How to avoid:** `products_public_read` (the `to anon, authenticated` SELECT policy) gets `using (is_active = true)`. The admin policy is FOR ALL and already grants admin SELECT regardless of `is_active`, so an admin session sees drafts. **The admin product list query must NOT add `.eq('is_active', true)`** (unlike `catalog.ts`'s public fetch). Verify: an admin's `select *` returns draft rows; an anon `select *` returns only published.
**Warning signs:** Admin product list missing newly-created (draft) products.

### Pitfall 5: TipTap bundle leaking into public chunk
**What goes wrong:** Importing the editor at the top of a shared module pulls TipTap + ProseMirror (~hundreds of KB) into the public bundle.
**Why:** Static imports are bundled eagerly.
**How to avoid:** `const RichTextEditor = lazy(() => import('@/components/admin/RichTextEditor'))`; the admin route is already behind `AdminGuard`, so route-level code-splitting keeps it out of the public path. The public Our Story page imports only DOMPurify (small), not TipTap.
**Warning signs:** Public bundle size jumps after adding the editor.

### Pitfall 6: Slug collision on create
**What goes wrong:** Two products named "Neem Soap" → same slug → DB unique violation, unhandled error toast.
**Why:** `slug unique not null` constraint.
**How to avoid:** Generate base slug (lowercase, hyphenate, strip punctuation), then on conflict append `-2`, `-3` (catch the unique-violation `23505` and retry, or pre-check via select). Slug stays fixed on later renames (D-07).
**Warning signs:** Cryptic "duplicate key value violates unique constraint" toast.

## Code Examples

### Image pipeline (size guard → HEIC → compress), lazy-loaded
```typescript
// Source: heic2any + browser-image-compression READMEs [ASSUMED — verify lib APIs]
const MAX_BYTES = 10 * 1024 * 1024; // D-12 reject >10MB up front
const ACCEPTED = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];

export async function processImage(file: File): Promise<Blob> {
  if (file.size > MAX_BYTES) throw new Error('Image too large (max 10MB).');
  if (!ACCEPTED.includes(file.type) && !/\.he(ic|if)$/i.test(file.name))
    throw new Error('Unsupported file type.');

  let working: Blob = file;
  const isHeic = file.type.includes('heic') || file.type.includes('heif') || /\.he(ic|if)$/i.test(file.name);
  if (isHeic) {
    const heic2any = (await import('heic2any')).default;     // lazy
    working = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob;
  }
  const imageCompression = (await import('browser-image-compression')).default; // lazy
  return imageCompression(working as File, {
    maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/jpeg',
  });
}
```
> Post-shrink target (planner discretion): `maxWidthOrHeight: 1600`, `maxSizeMB: 1` are sensible defaults for a product-photo Shop; tune after visual check.

### Slug generation
```typescript
// Source: standard slugify pattern [ASSUMED]
export function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// collision: try slug, on 23505 retry slug-2, slug-3, ...
```

### In-use category delete (friendly error)
```typescript
// Source: relies on category_id FK (migration 0001) [VERIFIED: codebase]
const { error } = await supabase.from('categories').delete().eq('id', id);
// FK violation -> error.code === '23503'
if (error?.code === '23503')
  throw new Error('This category has products — move or delete them first.'); // D-15
```

### CR-01 migration (0005)
```sql
-- 0005_cr01_products_public_read.sql  (D-14)
-- Tighten public read so draft (is_active=false) rows are unreachable via raw PostgREST.
-- Admin read is via products_admin_write (FOR ALL, is_admin()) — unaffected, admins still see drafts.
drop policy "products_public_read" on public.products;
create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (is_active = true);
```

### site_content seed (0006) — keys from hardcoded strings
```sql
-- 0006_seed_site_content.sql  (D-18) — seed initial values from current code
insert into public.site_content (key, value) values
  ('hero_title',      '<current Hero.tsx title>'),
  ('hero_subtitle',   '<current Hero.tsx subtitle>'),
  ('hero_cta',        '<current Hero.tsx CTA text>'),
  ('our_story_body',  '<current OurStory.tsx body as sanitized HTML>'),
  ('email',           'sutravan.in@gmail.com'),
  ('instagram_url',   'https://www.instagram.com/sutravan.in'),
  ('youtube_url',     'https://youtube.com/@sutravan?si=0ne7zUvFEh70AF6j')
on conflict (key) do nothing;  -- idempotent; do not clobber owner edits on re-run
```
> Exact hero/our-story values: planner extracts verbatim from `Hero.tsx` / `OurStory.tsx`. Email/social verbatim from grep (Footer.tsx:3-5, Navbar.tsx:77/102/126). Use `do nothing` so re-running the migration never overwrites later admin edits.

## Runtime State Inventory

> This phase ADDS the site_content rewire and a Storage write path. Relevant runtime-state notes (this is greenfield-write, not a rename, so most categories are N/A):

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `site_content` table exists but is **empty** (only seeded by migration 0006 this phase). `product-images` bucket holds Phase-2-seeded soap images; scrub/cream products have empty `images[]` (owner uploads here). | Seed `site_content` (0006); onboarding task to upload scrub/cream photos. |
| Live service config | Hosted Supabase Auth config (Site URL `https://sutravan.in`, redirect allowlist) — NOT in git, set in dashboard (Phase 3). Unaffected by this phase. | None. |
| OS-registered state | None — static SPA on GitHub Pages. | None — verified, no OS-level registrations. |
| Secrets/env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (already wired, `lib/supabase.ts`). No new secrets — anon key + RLS is the whole auth model; admin writes ride the logged-in admin JWT. | None. |
| Build artifacts | None new beyond the added npm deps in the bundle (kept out of public chunk via lazy import). | None. |

**Hardcoded-string rewire (D-20) — these source locations carry the value that moves to `site_content`:**
- `client/src/components/Footer.tsx:3-5` — `INSTAGRAM_URL`, `YOUTUBE_URL`, `EMAIL` consts.
- `client/src/components/Navbar.tsx:77,102,126,249,279,301,318` — instagram/youtube/email inline.
- `client/src/pages/Contact.tsx:4-5,30` — instagram + email.
- `client/src/components/ProductDetail.tsx:16,182` — instagram.
- `client/src/pages/Shop.tsx:177` — instagram inline.
- `client/src/components/Hero.tsx`, `client/src/pages/OurStory.tsx` — hero copy + Our Story body.
All must read from `useSiteContent()` with the current literal kept as the fallback default.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TipTap v2 | TipTap v3 (3.24.0) with explicit React 19 peer | 2025-2026 | Use v3; React 19 supported [VERIFIED: npm peerDeps] |
| DOMPurify v2 | DOMPurify v3.x (3.4.7) | ongoing | Use v3 [VERIFIED: npm] |
| Storage `upload` then separate replace | `upload(..., {upsert:true})` overwrites in place | supabase-js v2 | Single call for create-or-replace [CITED: supabase docs] |

**Deprecated/outdated:**
- `heic2any` 0.0.4 last modified 2023 — functional and widely used (753K/wk) but unmaintained; `heic-to` (1.5.2, 2026) is the maintained alternative if HEIC edge cases surface.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `heic2any` + `browser-image-compression` are the right libs for browser HEIC+compress | Standard Stack / Code Examples | Med — wrong lib = rework image pipeline; `heic-to` is the documented fallback. Gate behind verify checkpoint. |
| A2 | TipTap (HTML storage) is preferable to markdown for the non-technical owner | Standard Stack | Low-Med — markdown+react-markdown is a valid alternative if WYSIWYG proves heavy; either satisfies D-19. |
| A3 | `heic2any` exact API is `heic2any({blob, toType, quality})` returning Blob | Code Examples | Low — verify against README during planning; signature is widely documented but [ASSUMED]. |
| A4 | `browser-image-compression` default export with `{maxSizeMB, maxWidthOrHeight, useWebWorker}` options | Code Examples | Low — standard documented API; verify during build. |
| A5 | Post-shrink targets (1600px / 1MB) are appropriate for product photos | Code Examples | Low — visual-tunable, no correctness risk. |
| A6 | 10MB pre-process size cap is sensible | Image pipeline | Low — D-12 leaves exact cap to discretion. |
| A7 | DOMPurify needs an explicit hook to add `rel="noopener"` on links | Pattern 4 | Low — verify; worst case links lack rel (minor). |

> Per the provenance rule, the package NAMES (A1) are `[ASSUMED]` regardless of slopcheck `[OK]`. The planner should add a `checkpoint:human-verify` before installing the new deps.

## Open Questions (RESOLVED)

1. **Cross-tab live update scope — RESOLVED: out of scope (next-load refresh).**
   - What we know: invalidation refreshes the public Shop within the same SPA session after navigation.
   - What's unclear: whether the owner expects an already-open public tab on another device to update without reload (it won't — that needs realtime).
   - Recommendation: out of scope; "no redeploy, updates on next load/navigation" satisfies the milestone. Note it explicitly so it's not treated as a bug.
   - **RESOLVED:** Realtime cross-device push is NOT in this phase. Plans rely on TanStack Query invalidation (same-session, on next navigation/load); the public Open Questions item is documented expected behavior, not a bug. No plan task targets realtime.

2. **`heic2any` vs `heic-to` final pick — RESOLVED: start with `heic2any`, gated by the verify checkpoint.**
   - What we know: both pass slopcheck; `heic2any` more downloads, `heic-to` more recently maintained.
   - Recommendation: start with `heic2any`; if HEIC edge cases fail in manual testing, swap to `heic-to` (same role). Decide at the verify checkpoint.
   - **RESOLVED:** Plan 02 installs `heic2any` (behind the [GATE] human-verify on the [ASSUMED] packages); Plan 09 Task 2 is the manual HEIC verify where `heic-to` is the documented same-role swap if edge cases fail. Decision: `heic2any` as the default pick.

3. **Submissions inbox has no data until Phase 5 — RESOLVED: build read-only list/detail + empty state now.**
   - What we know: `customization_submissions` is empty; Phase 5 writes it (D-17).
   - Recommendation: build the read-only list+detail against the existing admin-read RLS; verify with a manually-inserted test row, and ship an empty-state.
   - **RESOLVED:** Plan 08 builds the read-only list+detail against the existing admin-read RLS and ships the "No submissions yet" empty state; Plan 08 Task 2 verifies with a manually-inserted test row. No schema change this phase (D-17).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `supabase` CLI | `db push` for migrations 0005/0006 | ✓ (devDep) | 2.102.0 | Apply SQL via dashboard SQL editor |
| Node/npm | install new deps + build | ✓ | Node 22 (CI) | — |
| Supabase project (hosted) | all writes + Storage | ✓ (wired Phases 1-3) | — | — |
| Browser WASM (libheif via heic2any) | HEIC conversion | runtime (user browser) | — | Reject HEIC with toast; owner converts to JPEG manually |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** HEIC conversion degrades gracefully to a clear error toast if the browser/WASM path fails (D-11).

## Validation Architecture

> nyquist_validation is enabled. No test framework exists today (manual verification only). This phase should add a minimal unit-test footing for the pure logic that is cheap to test, and rely on manual verification for UI/integration.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — Vitest recommended (Vite-native) if any automated tests are added |
| Config file | none — see Wave 0 |
| Quick run command | `npx vitest run` (after install) |
| Full suite command | `npx vitest run` |

> Adding Vitest is optional/lightweight. If the planner opts to keep "manual-only" per project norm, the unit-testable items below become manual code-review checks instead. Recommendation: add Vitest ONLY for the four pure functions below — they are high-value, regression-prone, and trivial to test.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01/02 | Create/edit/delete product, set price | manual | create→appears in admin list; blank price→"Price on request" on Shop | ❌ manual |
| ADMIN-01 | slug generation + collision suffix | unit | `vitest run lib/slug.test.ts` | ❌ Wave 0 |
| ADMIN-01 | camel↔snake write mapping symmetry | unit | `vitest run lib/admin.test.ts` | ❌ Wave 0 |
| ADMIN-03 | image size guard rejects >10MB / bad type | unit | `vitest run lib/imagePipeline.test.ts` (guard only; mock convert) | ❌ Wave 0 |
| ADMIN-03 | HEIC upload renders on Shop | manual | upload iPhone HEIC → product image displays | ❌ manual |
| ADMIN-03 | replace/remove image; no orphans | manual | replace image → old gone from bucket; delete product → folder empty | ❌ manual |
| ADMIN-04 | in-use category delete blocked | manual | delete category with products → friendly error, not deleted | ❌ manual |
| ADMIN-05/06 | edit email → Navbar+Footer+Contact update | manual | change email in admin → reflected in 3 places without redeploy | ❌ manual |
| ADMIN-05/19 | rich text renders safely | unit + manual | `vitest run lib/sanitizeHtml.test.ts` (strips `<script>`) + visual Our Story | ❌ Wave 0 |
| ADMIN-07 | submissions read-only inbox | manual | insert test row → appears newest-first; detail opens | ❌ manual |
| ADMIN-08 / CR-01 | draft not on public Shop; published appears; raw PostgREST hides drafts | manual + SQL | create draft → absent from /shop; anon `select` returns only published; admin select returns drafts | ❌ manual |

### Sampling Rate
- **Per task commit:** `npm run check` (tsc) — always; `npx vitest run` if tests added.
- **Per wave merge:** full manual checklist for the wave's slice + `npm run build` (confirms code-split, no public-bundle bloat).
- **Phase gate:** all 5 ROADMAP success criteria manually verified + `npm run check` + `npm run build` green.

### Wave 0 Gaps
- [ ] `lib/slug.test.ts` — slug gen + collision (ADMIN-01)
- [ ] `lib/admin.test.ts` — camel↔snake mapping round-trip (ADMIN-01/02)
- [ ] `lib/imagePipeline.test.ts` — size/type guard (ADMIN-03)
- [ ] `lib/sanitizeHtml.test.ts` — DOMPurify strips `<script>`/`onerror` (ADMIN-05/19)
- [ ] Framework install: `npm install -D vitest` — if automated tests are adopted (else convert above to manual code-review checks)

*(If the project keeps strict manual-only: the four `lib/*` items become reviewer-verified rather than CI-verified; the behavior verifications remain identical.)*

## Security Domain

> security_enforcement enabled, ASVS Level 1, block_on: high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (delivered Phase 3) | Supabase Auth + AdminGuard; reused, not modified |
| V3 Session Management | no (Phase 3) | Supabase session persistence |
| V4 Access Control | **yes** | RLS `private.is_admin()` on tables + `storage.objects` (migrations 0002/0003); CR-01 tightens object-level read (0005). UI guard is secondary. |
| V5 Input Validation | **yes** | Zod schemas on every form (email `.email()`, url `.url()`, price numeric); image MIME/size guard; slug sanitization |
| V6 Cryptography | no | No new crypto; anon key + JWT handled by Supabase |
| V1 Encoding/Injection (XSS) | **yes** | DOMPurify on the only `dangerouslySetInnerHTML` path (Our Story); never render unsanitized site_content |

### Known Threat Patterns for {React SPA + Supabase-direct + Storage}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via admin rich text rendered to all visitors | Tampering / Elevation | DOMPurify allow-list sanitize before `dangerouslySetInnerHTML` (D-19); also constrain at editor (TipTap allowed marks) |
| Draft product leaked via raw PostgREST (skip `is_active` filter) | Information Disclosure | CR-01 RLS `using (is_active = true)` on `products_public_read` (D-14, migration 0005) — server-side, not query-side |
| Non-admin attempts catalog/Storage write with anon key | Elevation of Privilege | Existing RLS `is_admin()` write policies + storage.objects admin policies (0002/0003) reject; UI guard is convenience only |
| Malicious file upload (script/SVG masquerading as image) | Tampering | MIME+extension allow-list (JPEG/PNG/WebP/HEIC), size cap, re-encode through browser-image-compression to JPEG (strips active content); bucket is public-read images only |
| Open redirect on link injection in rich text | Tampering | DOMPurify `ALLOWED_ATTR` href only + force `rel="noopener noreferrer"` |
| FK-bypass category delete orphaning products | (Integrity) | Rely on `category_id` FK (`23503`) — do not work around it; surface friendly error (D-15) |

> **No HIGH-severity blockers identified for the planned design.** The one must-do security item is CR-01 (migration 0005) — without it, ADMIN-08's draft toggle creates an Information Disclosure path. It is already a LOCKED decision (D-14).

## Project Constraints (from CLAUDE.md)

- **Supabase-direct only** — frontend talks to Supabase via its client; NO custom Express/API layer (Express/Drizzle scaffolding removed). Admin writes go browser→PostgREST/Storage.
- **Admin-only actions enforced server-side via RLS, not just hidden in the UI** — the portal is the write client; security lives in migrations 0002/0003 + CR-01 (0005). Never treat the UI guard as the boundary.
- **Keep existing React/Vite/Tailwind/shadcn frontend** — reuse the installed primitives; no framework swaps.
- **Public Shop must keep working (read from Supabase) without regressing UX** — the write layer must keep `catalog.ts`'s output shape compatible; invalidate its keys to update live.
- **Static SPA on GitHub Pages** — all admin routes base-aware via Wouter `base={import.meta.env.BASE_URL}` (already set in App.tsx); anon key + RLS only (no server secrets).
- **Naming:** PascalCase components/pages/interfaces, camelCase utils/hooks/handlers (`handle*`), UPPER_SNAKE constants. Default export for components, named export for utils.
- **TypeScript strict** — `npm run check` (tsc) must pass; no ESLint/Prettier config.
- **Versioned migrations** — new SQL ships as numbered `supabase/migrations/0005+.sql` via `supabase db push`; non-recursive RLS, locked `search_path` conventions.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Create/edit/delete products (name, subtitle, category, benefits, ingredients, tips, shelf life, batch note) | `lib/admin.ts` camel↔snake mapper (Pattern 1); RHF+Zod full-page form (D-04); RepeatableRows (D-06); slug util (Pattern, Pitfall 6); delete + Storage cleanup (Pattern 3/Pitfall 2) |
| ADMIN-02 | Set/edit price | Price field → `null` on blank (D-09); `formatPrice()` single render path (reuse) |
| ADMIN-03 | Upload/replace/remove product images in Storage | Image pipeline (heic2any+browser-image-compression, lazy, size guard); Storage upload/update(upsert)/remove/list (Pattern 3, verified); orphan cleanup (Pitfall 2); getPublicUrl display (reuse catalog.ts) |
| ADMIN-04 | Create/edit/delete categories with in-use protection | Category writes via admin.ts; FK `23503` → friendly error (Pattern, D-15); name+sort_order fields (D-16) |
| ADMIN-05 | Edit Our Story copy + hero text | TipTap editor for Our Story (D-19); DOMPurify safe render (Pattern 4); `site_content` keys + seed (0006); `useSiteContent` read+fallback (Pattern 5) |
| ADMIN-06 | Edit contact email + social links | `site_content` keys email/instagram_url/youtube_url; Zod email/url validation; D-20 rewire of 5 components (Runtime State Inventory) |
| ADMIN-07 | View submissions inbox | Read-only list+detail (D-17) against existing admin-read RLS on `customization_submissions`; empty-state until Phase 5 |
| ADMIN-08 | Toggle draft/published visibility | `is_active` toggle in list + form (D-13); new products default draft (D-08); CR-01 RLS gate (D-14, migration 0005) so drafts unreachable via raw PostgREST |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- Codebase: `client/src/lib/{catalog,supabase,format,queryClient}.ts`, `client/src/auth/{AdminGuard,AuthProvider,useAuth}.ts`, `client/src/App.tsx`, `client/src/pages/Admin.tsx`, `supabase/migrations/0001-0003`, `package.json`, `client/src/components/ui/*` — read directly this session.
- https://supabase.com/docs/reference/javascript/storage-from-upload — upload/update/remove/list signatures + upsert/contentType/cacheControl options [CITED].
- `npm view` (2026-06-01) — versions + peerDependencies + repository URLs for all candidate packages [VERIFIED: npm registry].
- slopcheck (2026-06-01) — all 6 candidate packages `[OK]`.

### Secondary (MEDIUM confidence)
- npm download API (last-week counts) — package legitimacy signal.
- DOMPurify usage pattern (dompurify.com + community 2025 articles) — `sanitize()` + `dangerouslySetInnerHTML` standard pattern [CITED].

### Tertiary (LOW confidence)
- `heic2any` / `browser-image-compression` exact runtime API shapes — from training/README knowledge [ASSUMED]; verify against READMEs at build time.

## Metadata

**Confidence breakdown:**
- Standard stack (reused libs): HIGH — confirmed in package.json/codebase.
- New deps (existence/legitimacy): HIGH — npm + slopcheck verified; names tagged [ASSUMED] per provenance rule.
- New deps (exact runtime API): MEDIUM — verify heic2any/compression signatures during planning.
- Supabase Storage + RLS mechanics: HIGH — official docs + live migration files.
- Cache-invalidation requirement: HIGH — derived from actual `queryClient.ts` config.
- Image-pipeline tuning values: MEDIUM — sensible defaults, visually tunable, no correctness risk.

**Research date:** 2026-06-01
**Valid until:** 2026-06-30 (stable stack; re-verify TipTap/DOMPurify versions if planning slips a month)
