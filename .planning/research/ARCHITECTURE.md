# Architecture Research

**Domain:** Supabase-direct React/Vite SPA — public catalog showcase + admin CMS + auth (skincare brand, brownfield)
**Researched:** 2026-05-31
**Confidence:** HIGH (Supabase patterns verified against official docs + multiple sources; existing codebase inspected directly)

## Standard Architecture

The target is a **Backend-as-a-Service (BaaS) / "thick client" architecture**: the React SPA talks directly to Supabase (Postgres via PostgREST, Auth via GoTrue, Storage) using the JS client and the public anon key. There is **no custom API server** — security lives entirely in Postgres Row Level Security (RLS). This is the right fit because (a) the existing Express/Drizzle layer was never wired, (b) the frontend already deploys as a static SPA to GitHub Pages, and (c) Supabase is hosted separately, so the static-host model is preserved.

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    React SPA (Vite) — GitHub Pages                 │
├──────────────────────────────────────────────────────────────────┤
│  Public Pages          Admin Pages           Customer Pages        │
│  Home / Shop /         /admin/* (gated)      Wishlist / Profile     │
│  OurStory / Contact    products, categories  (auth-gated)           │
│  / Questionnaire       content, inbox                               │
│       │                     │                      │                │
│       └──────────┬──────────┴──────────┬───────────┘                │
│                  ▼                      ▼                            │
│        ┌───────────────────┐  ┌──────────────────┐                  │
│        │  Data-access layer │  │  Auth context     │                 │
│        │  client/src/api/*  │  │  (session/role)   │                 │
│        │  (TanStack Query)  │  │                   │                 │
│        └─────────┬─────────┘  └────────┬──────────┘                  │
│                  └──────────┬──────────┘                            │
│                             ▼                                       │
│            ┌────────────────────────────────────┐                  │
│            │  Supabase client (anon key)         │                  │
│            │  client/src/lib/supabase.ts         │                  │
│            └────────────────┬───────────────────┘                  │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ HTTPS (RLS-enforced)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                          Supabase (hosted)                          │
├──────────────────────┬──────────────────┬─────────────────────────┤
│  Postgres + PostgREST │  Auth (GoTrue)   │  Storage                │
│  tables + RLS         │  email/password  │  product-images bucket   │
│  products, categories │  auth.users      │  site-content bucket     │
│  site_content,        │  → profiles      │                          │
│  customization_subs,  │     (role)       │                          │
│  profiles, wishlists  │                  │                          │
└──────────────────────┴──────────────────┴─────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Supabase client singleton | One configured `createClient` instance shared app-wide | `client/src/lib/supabase.ts`, reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| Data-access layer (api/) | Typed functions wrapping Supabase queries per entity (`listProducts`, `upsertProduct`, `createSubmission`…) | `client/src/api/*.ts` — pure async functions, no React |
| TanStack Query hooks | Cache/refetch/mutation wrappers over the api/ layer | `client/src/hooks/queries/*` (e.g. `useProducts`, `useUpsertProduct`) |
| Auth context/provider | Holds session + resolved role, exposes `signIn/signOut`, drives route guards | `client/src/lib/auth/AuthProvider.tsx` |
| Route guards | Wouter wrappers that redirect by auth state + role | `client/src/components/guards/RequireAuth.tsx`, `RequireAdmin.tsx` |
| Public pages | Read-only catalog/content via anon-key queries | existing `pages/Shop.tsx`, `Home.tsx` (rewired) |
| Admin pages | CRUD UI for products/categories/content + submissions inbox | new `pages/admin/*` |
| Postgres + RLS | The actual security boundary; per-table policies | Supabase SQL migrations |
| Storage buckets | Product/content image binaries | `product-images` (public read), bucket-level RLS for writes |

## Recommended Project Structure

Additions to the existing `client/src/` tree (existing folders kept; `server/`, `shared/`, `drizzle.config.ts` removed):

```
client/src/
├── lib/
│   ├── supabase.ts          # createClient singleton (anon key)
│   ├── queryClient.ts       # EXISTING — keep; drop apiRequest fetch helper
│   └── auth/
│       ├── AuthProvider.tsx # session + role context
│       └── useAuth.ts       # hook to read context
├── api/                     # NEW — data-access layer (no React)
│   ├── products.ts          # list/get/upsert/delete products
│   ├── categories.ts        # CRUD categories
│   ├── siteContent.ts       # get/update keyed content blocks
│   ├── submissions.ts       # create (public), list (admin)
│   ├── wishlist.ts          # add/remove/list (customer, own rows)
│   ├── storage.ts           # upload/remove/getPublicUrl helpers
│   └── types.ts             # generated Supabase types re-exported
├── hooks/
│   ├── queries/             # NEW — TanStack Query wrappers
│   │   ├── useProducts.ts
│   │   ├── useCategories.ts
│   │   ├── useSiteContent.ts
│   │   ├── useSubmissions.ts
│   │   └── useWishlist.ts
│   ├── use-toast.ts         # EXISTING
│   └── use-mobile.tsx       # EXISTING
├── components/
│   ├── guards/              # NEW
│   │   ├── RequireAuth.tsx
│   │   └── RequireAdmin.tsx
│   └── admin/               # NEW — admin-only UI building blocks
│       ├── ProductForm.tsx
│       ├── ImageUploader.tsx
│       └── DataTable.tsx
├── pages/
│   ├── Shop.tsx             # EXISTING — rewired to useProducts()
│   ├── Login.tsx            # NEW
│   ├── Register.tsx         # NEW
│   ├── Wishlist.tsx         # NEW
│   ├── Account.tsx          # NEW (profile + own submission history)
│   └── admin/               # NEW — all behind RequireAdmin
│       ├── AdminLayout.tsx
│       ├── Dashboard.tsx
│       ├── Products.tsx
│       ├── Categories.tsx
│       ├── SiteContent.tsx
│       └── Submissions.tsx
└── data/
    └── products.ts          # DELETE after migration (kept as seed source)

supabase/                    # NEW — at repo root, not shipped to client
├── migrations/              # SQL: tables, RLS, policies, storage
└── seed/                    # one-time import scripts (products + images)
```

### Structure Rationale

- **`api/` separate from `hooks/queries/`:** Pure async data functions (testable, no React) are isolated from caching concerns. Components never import `supabase` directly — they go through `hooks/queries → api → supabase`. This single chokepoint makes RLS errors, retries, and type-safety uniform, and keeps the Supabase dependency swappable.
- **`lib/auth/` as a context provider:** Role must be resolved once and shared; guards and conditional UI both read it. Avoids each component re-fetching session.
- **`components/guards/`:** Wouter has no built-in route protection; guards are explicit wrapper components.
- **`supabase/` at repo root:** Migrations and seed scripts are infra, never bundled into the client. Keeps the SQL schema version-controlled and reproducible.

## Database Schema (Postgres)

Concrete tables. All have RLS **enabled** (mandatory — without it the anon key grants full access).

```sql
-- categories (replaces the 'soap'|'scrub'|'cream' union)
categories (
  id          uuid pk default gen_random_uuid(),
  slug        text unique not null,        -- 'soap','scrub','cream'
  label       text not null,               -- 'Soaps'
  description text,
  image_path  text,                        -- storage path
  sort_order  int default 0,
  created_at  timestamptz default now()
)

-- products (replaces client/src/data/products.ts)
products (
  id          uuid pk default gen_random_uuid(),
  slug        text unique not null,        -- 'soap-aloe-vera' (preserve existing ids)
  name        text not null,
  subtitle    text,
  category_id uuid references categories(id) on delete restrict,
  price       numeric(10,2),               -- was empty string; now nullable numeric
  benefits    text[] default '{}',
  ingredients text[] default '{}',
  tips        text[] default '{}',
  shelf_life  text,
  batch_note  text,
  images      text[] default '{}',         -- storage paths, ordered
  is_featured boolean default false,
  is_active   boolean default true,
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
)

-- site_content (Our Story copy, hero text, contact/social links)
site_content (
  key        text pk,                      -- 'hero','our_story','contact'
  value      jsonb not null,               -- flexible block per key
  updated_at timestamptz default now()
)

-- profiles (1:1 with auth.users, carries role)
profiles (
  id         uuid pk references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'customer',  -- 'customer' | 'admin'
  created_at timestamptz default now()
)
-- auto-created via trigger on auth.users insert (handle_new_user)

-- customization_submissions (native questionnaire)
customization_submissions (
  id         uuid pk default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null, -- nullable: allow guest submit
  answers    jsonb not null,               -- questionnaire payload
  status     text default 'new',           -- new|reviewed|archived (admin-managed)
  created_at timestamptz default now()
)

-- wishlists (customer saved products)
wishlists (
  user_id    uuid references auth.users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
)
```

**Key choices:**
- `slug` carries the existing string IDs (`soap-aloe-vera`) so migration preserves identity and URLs.
- `images` as `text[]` of **storage object paths** (not full URLs); the client builds public URLs at read time, so the project URL isn't baked into rows.
- `price` becomes `numeric` (was empty string) — directly satisfies the "set price in portal" requirement.
- `site_content` is key→jsonb to avoid a schema migration every time copy structure changes.

### Role model — `profiles.role` lookup (recommended over JWT claims for v1)

Verified pattern (MEDIUM-HIGH): two approaches exist — (1) a `profiles` table with a `role` column checked via a SECURITY DEFINER helper function, and (2) custom JWT claims via a Custom Access Token Auth Hook (more performant, no per-row lookup). **Recommend the profiles-table approach for this build** because the admin set is tiny (the owner), per-request lookups are negligible at this scale, and it avoids the operational complexity of auth hooks. Critically: store role in `profiles` (or `raw_app_meta_data`), **never** in `raw_user_meta_data`, which users can edit themselves.

Helper to avoid recursive RLS on `profiles`:
```sql
create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = (select auth.uid()) and role = 'admin');
$$;
```
Wrap `auth.uid()` in `(select …)` inside policies so Postgres caches it per-statement (performance best practice).

## Row Level Security — per-table policies

Data-flow rule: **public = read-only; customers write only their own rows; admins write everything.**

| Table | SELECT (read) | INSERT / UPDATE / DELETE (write) |
|-------|---------------|----------------------------------|
| `products` | `anon` + `authenticated`, `is_active = true` for public; admin sees all | `is_admin()` only |
| `categories` | public (all) | `is_admin()` only |
| `site_content` | public (all) | `is_admin()` only |
| `profiles` | own row (`id = auth.uid()`) + admin reads all | own row update (but **not** `role`); admin updates any |
| `customization_submissions` | admin reads all; customer reads own (`user_id = auth.uid()`) | INSERT: `anon` + `authenticated` (allow guest/native form); UPDATE/DELETE: `is_admin()` only |
| `wishlists` | own rows only (`user_id = auth.uid()`) | own rows only |

Notes:
- Public-read tables (products/categories/content) get a permissive `using (true)` SELECT for `anon`. Writes are locked to `is_admin()`.
- To prevent privilege escalation on `profiles`, the self-update policy must exclude `role` (enforce via a column-level grant or a `with check` that rejects role changes; simplest: only admin can update `role`, customers update name only).
- `customization_submissions` INSERT is intentionally open (with a `with check` constraint that `user_id` is null or equals `auth.uid()`), supporting both logged-in and guest questionnaire submission.

## Storage layout

Two buckets:

| Bucket | Visibility | Path convention | Policies |
|--------|-----------|-----------------|----------|
| `product-images` | **Public** (read) | `products/{product_slug}/{n}.jpg` | SELECT: public; INSERT/UPDATE/DELETE: `is_admin()` via `storage.objects` RLS |
| `site-content` | Public (read) | `content/{key}/{file}` | same admin-write policy |

- Public bucket → client uses `supabase.storage.from('product-images').getPublicUrl(path)` to render; no signed URLs needed for a public showcase.
- Writes are gated by RLS policies on `storage.objects` checking `bucket_id` + `is_admin()`, mirroring table writes. Public read + admin-only write is the verified standard pattern.
- DB rows store the **path** (`products/soap-aloe-vera/1.jpg`), not the URL.

## Architectural Patterns

### Pattern 1: Single Supabase client + thin data-access layer

**What:** One `createClient` singleton in `lib/supabase.ts`; all queries go through `api/*` functions; components/hooks never import `supabase` directly.
**When:** Always, in BaaS SPAs.
**Trade-offs:** + one place to add types, error handling, and swap the backend. − a little boilerplate per entity.

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// api/products.ts
export async function listActiveProducts() {
  const { data, error } = await supabase
    .from('products').select('*, category:categories(slug,label)')
    .eq('is_active', true).order('sort_order');
  if (error) throw error;
  return data;
}
```

### Pattern 2: Public read via TanStack Query (replaces static import)

**What:** Shop/Home call `useProducts()` (a Query hook over `api/`) instead of importing `data/products.ts`. Query cache + the existing `queryClient` handle loading/staleness.
**When:** All public catalog reads.
**Trade-offs:** + live data, no rebuild to change catalog. − loading states + empty/error UI now required (previously instant). TanStack Query is already installed, so wiring cost is low.

```typescript
// hooks/queries/useProducts.ts
export const useProducts = () =>
  useQuery({ queryKey: ['products'], queryFn: listActiveProducts });
```

### Pattern 3: Auth context + Wouter route guards (UI gate) backed by RLS (real gate)

**What:** `AuthProvider` subscribes to `supabase.auth.onAuthStateChange`, fetches the user's `profiles.role`, and exposes `{session, role}`. `RequireAdmin` wraps admin routes and redirects non-admins. **The guard is UX only; RLS is the actual enforcement** — even if a user reaches `/admin`, every write is rejected by Postgres.
**When:** Admin and customer-only routes.
**Trade-offs:** + simple, no server. − role is fetched client-side (acceptable: it's never trusted for authorization, only for what UI to show).

```tsx
// components/guards/RequireAdmin.tsx
export function RequireAdmin({ children }) {
  const { session, role, loading } = useAuth();
  if (loading) return <Spinner/>;
  if (!session) return <Redirect to="/login" />;
  if (role !== 'admin') return <Redirect to="/" />;
  return children;
}
// App.tsx
<Route path="/admin/:rest*">
  {() => <RequireAdmin><AdminLayout/></RequireAdmin>}
</Route>
```

### Pattern 4: One-time seed/migration (products + images)

**What:** A Node script in `supabase/seed/` runs **once** using the **service-role key** (server-side only, never in client). It (1) inserts categories, (2) reads the existing `client/src/data/products.ts` array, (3) uploads each product's local image files from `client/src/assets/images/products/...` to the `product-images` bucket, (4) inserts product rows with the resulting storage paths and preserved slugs.
**When:** Once, after schema + buckets exist, before the Shop is rewired.
**Trade-offs:** + scriptable, repeatable, idempotent if upserting by slug. − must run with service-role key locally; current data only has Soap images (84 files / 13 dirs), so scrub/cream rows seed with empty `images[]` and need images uploaded via the portal afterward.

```typescript
// supabase/seed/import.ts  (run with: tsx supabase/seed/import.ts)
// uses SUPABASE_SERVICE_ROLE_KEY from env — bypasses RLS for the import
for (const p of products) {
  const paths = await uploadProductImages(p.slug, localFilesFor(p)); // [] if none
  await admin.from('products').upsert({ slug: p.id, name: p.name, /*…*/ images: paths },
                                      { onConflict: 'slug' });
}
```
The 68-product / Soap-only-images reality means the migration cleanly covers data + soap images, while scrub/cream imagery becomes a portal task — aligns with the "admin uploads images" requirement rather than blocking on missing assets.

## Data Flow

### Public read flow (Shop)
```
User → /shop → useProducts() → listActiveProducts() → supabase.from('products')
                                                          ↓ RLS: anon SELECT (is_active)
              ProductCard ← TanStack cache ← rows + getPublicUrl(image paths) ← Postgres
```

### Admin write flow (edit product)
```
Admin → ProductForm submit → useUpsertProduct() mutation → upsertProduct()
   → ImageUploader → storage.upload (RLS: is_admin) → returns path
   → supabase.from('products').upsert (RLS: is_admin)
   → onSuccess: queryClient.invalidateQueries(['products']) → public Shop refetches
```

### Auth/role resolution
```
Login → supabase.auth.signInWithPassword → onAuthStateChange fires
  → AuthProvider fetches profiles.role for auth.uid() → context {session, role}
  → guards + conditional nav read context (UI); RLS enforces on every query (security)
```

### Customer flows
```
Wishlist:    add → upsert wishlists(user_id, product_id)  [RLS: own rows]
Questionnaire: submit → insert customization_submissions  [RLS: anon/own insert]
Account:     read own submissions + profile               [RLS: own rows]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Default Supabase free/pro tier; profiles-table role lookup fine; public read uncached beyond TanStack client cache. No changes needed. |
| 1k–100k users | Add a CDN/edge cache in front of public product reads (Supabase public Storage is already CDN-backed for images); consider switching role to JWT claims to drop the per-request profiles lookup; add DB indexes on `products(category_id, is_active, sort_order)`. |
| 100k+ users | Cache catalog reads at the edge (it's read-mostly); paginate Shop; move heavy reporting off the primary; revisit RLS policy cost with `explain`. |

### Scaling Priorities
1. **First bottleneck:** Image bandwidth — already mitigated by public Storage CDN + `getPublicUrl`; ensure images are reasonably sized on upload.
2. **Second bottleneck:** RLS helper (`is_admin()`) per-query lookup — only matters at high write volume; switch to JWT custom claims if it shows up in `explain`.

## Anti-Patterns

### Anti-Pattern 1: Treating route guards as security
**What people do:** Hide `/admin` behind a client-side check and assume data is safe.
**Why it's wrong:** The anon key + table are reachable by anyone with the bundle; guards are bypassable. PROJECT.md explicitly calls this out.
**Do this instead:** Enable RLS on every table; gate writes with `is_admin()`. Treat guards as UX only.

### Anti-Pattern 2: Storing role in user metadata
**What people do:** Put `role: 'admin'` in `raw_user_meta_data` / `user_metadata`.
**Why it's wrong:** Users can update their own `user_metadata` → privilege escalation.
**Do this instead:** Role lives in `profiles` (admin-controlled) or `raw_app_meta_data`; self-update policy excludes the `role` column.

### Anti-Pattern 3: Importing `supabase` directly in components
**What people do:** Call `supabase.from(...)` inside page components.
**Why it's wrong:** Scatters queries, duplicates error handling, defeats caching, hard to type/test.
**Do this instead:** Components → `hooks/queries` → `api/*` → `supabase`. One chokepoint.

### Anti-Pattern 4: Shipping the service-role key / disabling RLS to "make it work"
**What people do:** Use the service-role key in the SPA or turn off RLS while debugging.
**Why it's wrong:** Service-role bypasses all RLS; in a public bundle it's a full data breach.
**Do this instead:** Service-role key only in the local seed script (env). RLS stays on; debug policies, not by disabling them.

### Anti-Pattern 5: Storing full public URLs in DB rows
**What people do:** Save `https://xyz.supabase.co/.../1.jpg` in `images[]`.
**Why it's wrong:** Couples rows to the project URL; breaks on project move/rename.
**Do this instead:** Store the object path; build URLs at read time with `getPublicUrl`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth (GoTrue) | `supabase.auth.*` + `onAuthStateChange` | Email/password for v1; session persisted in localStorage by the client |
| Supabase Postgres (PostgREST) | `supabase.from()` via `api/` layer | RLS is the only authz layer |
| Supabase Storage | `storage.from(bucket)` upload + `getPublicUrl` | Public read bucket; admin-write RLS on `storage.objects` |
| GitHub Pages | Existing static deploy | `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` injected at build (public, safe); SPA 404.html fallback already handles `/admin/*` deep links |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| pages ↔ hooks/queries | React hooks | Components never touch `api/` or `supabase` directly |
| hooks/queries ↔ api/ | async function calls | Caching/invalidation lives in hooks; raw queries in api/ |
| api/ ↔ supabase | client SDK | Single import site for the client |
| AuthProvider ↔ guards/UI | React context | Role for UI only; never trusted for authz |
| seed script ↔ Supabase | service-role key (local) | Isolated from client bundle entirely |

## Suggested Build Order (dependency-driven)

1. **Foundation:** Remove `server/`, `shared/`, Drizzle deps. Add `@supabase/supabase-js`, create `lib/supabase.ts`, set `VITE_` env vars. *(blocks everything)*
2. **Schema + RLS + Storage:** Write `supabase/migrations` for all tables, `is_admin()`, policies, and both buckets with policies. *(blocks all data work)*
3. **Auth:** `AuthProvider`, `profiles` trigger, Login/Register, guards. *(blocks admin + customer features)*
4. **Seed/migration:** Run the one-time import of 68 products + soap images. *(must precede Shop rewire so the page has data)*
5. **Public read rewire:** Switch Shop/Home/ProductDetail from `data/products.ts` to `useProducts()`/`useCategories()`; delete static file. *(depends on 2+4)*
6. **Admin portal:** Products/Categories/SiteContent CRUD + ImageUploader + Submissions inbox. *(depends on 2+3)*
7. **Native questionnaire:** Replace Google Form with form → `customization_submissions`. *(depends on 2; surfaces in 6's inbox)*
8. **Customer features:** Wishlist + Account/profile + own submission history. *(depends on 2+3)*

**Critical dependencies:** Schema/RLS (2) gates all data; Auth (3) gates admin/customer; Seed (4) must precede Shop rewire (5) to avoid an empty catalog. Admin (6) and customer (8) are independent of each other and can parallelize once 2+3 land.

## Sources

- Supabase Row Level Security & RBAC / Custom Claims — https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac (HIGH)
- Supabase Storage access control & public buckets — https://supabase.com/docs/guides/storage/security/access-control (HIGH)
- Supabase JS client / Auth with SPAs — https://supabase.com/docs/reference/javascript and https://supabase.com/docs/guides/auth (HIGH)
- Vite env vars (`VITE_` / `import.meta.env`) — https://vitejs.dev/guide/env-and-mode (HIGH)
- Anon key is public-by-design; RLS is the security layer — Supabase docs + corroborated by multiple sources (HIGH)
- Existing codebase: `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,STACK}.md`, `client/src/data/products.ts`, `client/src/assets/images/products/` (HIGH, directly inspected)

---
*Architecture research for: Supabase-direct React/Vite catalog + admin CMS (brownfield)*
*Researched: 2026-05-31*
