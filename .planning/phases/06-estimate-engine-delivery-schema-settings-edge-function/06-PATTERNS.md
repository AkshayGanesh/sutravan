# Phase 6: Estimate Engine — Delivery Schema, Settings & Edge Function - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 10 (5 migrations, 1 Edge Function, config.toml mod, 2 node scripts, 1 committed dataset)
**Analogs found:** 9 / 10 (the committed `pincodes.ndjson` dataset has no code analog — it is data, acquired by a human)

This phase is **pure backend on proven v1.0 patterns** — every file clones an existing in-repo analog. The only genuinely new logic is `deriveZone()` + slab lookup inside the Edge Function (RESEARCH §Zone-Derivation Algorithm). Everything else is a copy.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0014_delivery_settings_seed.sql` | migration (seed) | batch | `supabase/migrations/0006_seed_site_content.sql` | exact (same table, same upsert) |
| `supabase/migrations/0015_pincodes.sql` | migration (table+RLS) | CRUD | `supabase/migrations/0011_product_variants.sql` | exact (new table + public-read/admin-write RLS) |
| `supabase/migrations/0016_delivery_rate_slabs.sql` | migration (table+RLS+seed) | CRUD + batch | `0011_product_variants.sql` (table/RLS) + `0006` (inline seed) | exact |
| `supabase/migrations/0017_delivery_estimate_cache.sql` | migration (table, deny-direct RLS) | CRUD | `0011_product_variants.sql` (table shape); RLS = enable-no-policies (novel posture, see Shared Patterns) | role-match |
| `supabase/migrations/0018_profiles_default_pincode.sql` | migration (alter column) | — | `supabase/migrations/0004_auth_profiles.sql` line 32 (`alter table public.profiles add column ...`) | exact |
| `supabase/functions/delivery-estimate/index.ts` | edge-function | request-response | `supabase/functions/verify-and-submit/index.ts` | exact scaffold, divergent body |
| `supabase/config.toml` (MODIFY) | config | — | `config.toml` `[functions.verify-and-submit]` (line 375) | exact |
| `scripts/seed-pincodes.ts` | script (service-role loader) | batch / file-I/O | `scripts/seed.ts` | exact (service-role chunked upsert) |
| `scripts/verify-delivery-seed.ts` | script (verification) | CRUD / RLS probe | `scripts/verify-seed.ts` | exact |
| `scripts/data/pincodes.ndjson` | data asset | — | (none — human-acquired dataset) | no analog |

---

## Pattern Assignments

### `supabase/migrations/0014_delivery_settings_seed.sql` (migration seed, batch)

**Analog:** `supabase/migrations/0006_seed_site_content.sql`

**Core pattern — idempotent key/value seed into the existing `site_content` (text key/value) table** (0006 lines 15-46):
```sql
insert into public.site_content (key, value) values
  ('hero_title',     'Formulas Born From The Purity of Earth'),
  ...
on conflict (key) do nothing;
```
Apply to the 5 delivery keys (RESEARCH DDL lines 356-362). `delivery_cod_rules` is a **JSON string in the text `value` column** (D-09); scalars are plain strings; `delivery_free_ship_threshold` seeds `null` (D-19):
```sql
insert into public.site_content (key, value) values
  ('delivery_origin_pincode',    '000000'),
  ('delivery_default_weight_g',  '250'),
  ('delivery_dispatch_lead_days','1'),
  ('delivery_cod_rules',         '{"enabled":true,"fee":30,"valueCap":5000}'),
  ('delivery_free_ship_threshold', null)
on conflict (key) do nothing;
```
**Note:** `site_content` is unchanged — it rides the existing `['siteContent']` invalidation + admin upsert (no new admin plumbing in Phase 6). Single quotes inside string values must be doubled per 0006's header note.

---

### `supabase/migrations/0015_pincodes.sql` (migration table+RLS, CRUD)

**Analog:** `supabase/migrations/0011_product_variants.sql`

**Table convention** (0011 lines 25-35): `create table public.X (...)`, then `create index ... on public.X (...)`. Mirror for `pincodes` (RESEARCH DDL lines 365-376; `pincode text primary key`, `state not null`, `is_metro`/`is_remote`/`serviceable` booleans with defaults, `pincodes_state_idx`).

**RLS — deny-all baseline then public-read + admin-write** (0011 lines 41-63, the canonical catalog posture):
```sql
alter table public.product_variants enable row level security;

create policy "product_variants_public_read"
  on public.product_variants for select
  to anon, authenticated
  using ( ... );

create policy "product_variants_admin_write"
  on public.product_variants for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
```
For `pincodes`, public read is unconditional `using (true)` (no parent-row gate — pincodes are not draft-scoped). Admin write rides `private.is_admin()` verbatim (RESEARCH DDL lines 377-381). **Schema only — the ~19.5k rows load via `scripts/seed-pincodes.ts`, NOT an inline INSERT** (RESEARCH Anti-Patterns).

---

### `supabase/migrations/0016_delivery_rate_slabs.sql` (migration table+RLS+seed, CRUD+batch)

**Analog:** `0011_product_variants.sql` (table + RLS) + `0006_seed_site_content.sql` (inline idempotent seed)

Same table+RLS pattern as `0015`/`0011` above (public-read `using(true)`, admin-write `private.is_admin()`). Unique constraint `(zone, weight_band)`; `zone` and `weight_band` CHECK constraints (RESEARCH DDL lines 384-401). Then the **20-row grid seed inline** (RESEARCH Seed Slab Grid lines 325-348) with `on conflict (zone, weight_band) do nothing` — this is a small fixed seed, so it belongs in the migration (unlike pincodes). Grid is monotonic; ETA = D-05 verbatim.

---

### `supabase/migrations/0017_delivery_estimate_cache.sql` (migration table, deny-direct RLS, CRUD)

**Analog:** `0011_product_variants.sql` for the table shape; **deny-direct RLS is the divergence** — enable RLS, write NO policies (see Shared Patterns → Deny-Direct RLS).

```sql
alter table public.delivery_estimate_cache enable row level security;
-- NO policies → unreachable via PostgREST; service-role (Edge Function) is sole I/O (D-17)
```
Table carries `unique (origin_pincode, dest_pincode, weight_bucket)` (the cache key, D-17) + `expires_at` (fetched_at + 24h). Nullable `cost`/`eta_*` for the `serviceable:false` case (RESEARCH DDL lines 405-421).

---

### `supabase/migrations/0018_profiles_default_pincode.sql` (migration alter-column)

**Analog:** `supabase/migrations/0004_auth_profiles.sql` line 32

**Exact pattern — single nullable column add to `profiles`, inherits existing profiles RLS (0002):**
```sql
-- 0004 line 32:
alter table public.profiles add column name text;
```
Apply verbatim shape: `alter table public.profiles add column default_pincode text;` (RESEARCH DDL line 424). No new policy — `profiles_self_update` (0002) already covers it. Column only lands here; read/write wired in Phase 8.

---

### `supabase/functions/delivery-estimate/index.ts` (edge-function, request-response)

**Analog:** `supabase/functions/verify-and-submit/index.ts` — clone the scaffold wholesale, replace the body.

**Imports** (line 40):
```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'
```

**CORS allowlist — copy verbatim** (lines 43-60):
```typescript
const ALLOWED_ORIGINS = new Set<string>([
  'https://sutravan.in',
  'http://localhost:3200',
  'http://localhost:5173',
])
function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://sutravan.in'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
```

**Serve + OPTIONS preflight + shape-guard + generic error** (lines 62-88, 242-247):
```typescript
Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
  try {
    const { token, destPincode, weightG } = await req.json()
    // shape-guard + VALIDATE BEFORE compute (D-21):
    if (typeof destPincode !== 'string' || !/^\d{6}$/.test(destPincode))
      return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: jsonHeaders })
    ...
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: jsonHeaders })
  }
})
```

**Turnstile siteverify — copy verbatim** (lines 90-108): POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify`, secret via `Deno.env.get('TURNSTILE_SECRET_KEY')`, on `!outcome.success` → 400 `captcha_failed`.

**KEY DIVERGENCE from verify-and-submit — document in the header comment.** `verify-and-submit` deliberately uses the **anon key scoped to the caller's JWT** (lines 110-119) because `customization_submissions` has a per-user ownership RLS invariant. `delivery-estimate` has **no ownership invariant** (cache rows are global/identical for every visitor) so it legitimately uses the **service-role key** for cache+settings+pincode+slab access. State explicitly that this is NOT the Pitfall-4 anti-pattern (RESEARCH Pattern 1, lines 192-194):
```typescript
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
```

**Error-handling posture — copy verbatim** (lines 144-152): never reflect raw Postgres errors; `console.error` server-side only; return generic `{ error: 'bad_request' }` / `submission_failed`.

**Novel body (NOT in any analog — from RESEARCH):** `callCourierAdapter()` swappable seam returning the `Estimate` type (RESEARCH Pattern 2, lines 211-222); `deriveZone()` origin-relative algorithm + `ADJACENT` map + metro/remote sets (RESEARCH lines 256-310); `roundUpTo10` (line 468); cache read-then-write (lines 473-489); `originConfigured:false` guard for `000000` (lines 268-273).

---

### `supabase/config.toml` (MODIFY)

**Analog:** `[functions.verify-and-submit]` block (line 375)

Append a sibling block (RESEARCH lines 494-497):
```toml
[functions.delivery-estimate]
verify_jwt = false   # anon visitors must reach the body; Turnstile is the gate
```

---

### `scripts/seed-pincodes.ts` (script, batch / file-I/O)

**Analog:** `scripts/seed.ts`

**Service-role client from non-VITE_ env + native Node 22 runner** (seed.ts lines 17-31):
```typescript
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;            // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // non-VITE_, never committed
if (!url || !serviceKey) { console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
```
Run with `node --env-file=.env.seed.local scripts/seed-pincodes.ts` (header doc convention, lines 14-16).

**Idempotent upsert with onConflict** (seed.ts lines 94-109):
```typescript
const { error } = await admin.from('products').upsert(
  productMeta.map((p) => ({ slug: p.slug, ... })),
  { onConflict: 'slug' },
);
```
Apply to pincodes: read `scripts/data/pincodes.ndjson`, **chunk ~1000 rows/batch**, `upsert(batch, { onConflict: 'pincode' })`. Use PostgREST upsert, NOT `COPY` (no psql password via pooler — live-ops memory). Exit pattern + top-level `.catch` (lines 115-124).

---

### `scripts/verify-delivery-seed.ts` (script, verification / RLS probe)

**Analog:** `scripts/verify-seed.ts`

**Anon-vs-service-role assertion harness** (verify-seed.ts lines 15-26, 32-43): anon client counts via `.select('x', { count: 'exact', head: true })`; fail-fast `console.error` + `process.exit(1)`; `PASS:` on success. Mirror for SC5 assertions (5 site_content keys present, `delivery_rate_slabs` count = 20 + monotonic, `pincodes` ≈ 19.5k, `profiles.default_pincode` exists).

**RLS deny-direct probe (SC4):** verify-seed.ts uses a service-role client (lines 60-61) to mutate then asserts what anon sees. For the cache, assert an **anon `.select('*')` on `delivery_estimate_cache` returns 0 rows / is denied** (deny-direct = no policy → unreachable). Optional service-role check verifies the function-written row exists.

---

### `scripts/data/pincodes.ndjson` (data asset — NO CODE ANALOG)

Human-acquired, one-time transform of the data.gov.in All-India Pincode Directory (RESEARCH §Pincode Seed Strategy, Open Question 3). One JSON object per line: `{ pincode, state, district, circle, region, is_metro, is_remote }`. **StateName MUST be normalized** (`&`→`and`, canonical title-case) at transform time or zone derivation silently breaks (RESEARCH Pitfall A). Planner should make "acquire + transform the directory" an explicit `checkpoint:human-verify` task.

---

## Shared Patterns

### Deny-Direct RLS (service-role sole writer)
**Source:** RESEARCH DDL lines 420-421 (no in-repo analog — every existing table has policies; this is the first deny-direct table).
**Apply to:** `delivery_estimate_cache` (0017).
```sql
alter table public.delivery_estimate_cache enable row level security;
-- intentionally NO create policy statements → table is unreachable via anon/authenticated
-- PostgREST; only the service-role Edge Function reads/writes it (D-17).
```
Document the absence of policies explicitly so a future reader does not "add a missing policy." Contrast with `0011`'s header note (lines 8-12) explaining why a NEW table legitimately creates policies — here the inverse note is required.

### Public-Read + Admin-Write RLS (catalog posture)
**Source:** `supabase/migrations/0011_product_variants.sql` lines 41-63; `0002_rls_policies.sql` baseline.
**Apply to:** `pincodes` (0015), `delivery_rate_slabs` (0016).
```sql
alter table public.X enable row level security;
create policy "X_public_read"  on public.X for select to anon, authenticated using (true);
create policy "X_admin_write" on public.X for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
```
`private.is_admin()` is the canonical admin gate (defined 0001); never reimplement the role lookup.

### Secret Custody via Deno.env / non-VITE_ process.env
**Source:** `verify-and-submit/index.ts` lines 96, 116-118; `seed.ts` lines 23-24.
**Apply to:** Edge Function (TURNSTILE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY) + seed/verify scripts.
- Edge Function: `Deno.env.get('...')` only — never VITE_/bundled.
- Node scripts: `process.env.SUPABASE_*` (non-VITE_), run via `node --env-file=.env.seed.local`.
- `scripts/check-no-secret.sh` already guards the public bundle (SC3).

### Idempotent Migration Seed
**Source:** `0006_seed_site_content.sql` line 46 (`on conflict (key) do nothing`).
**Apply to:** 0014 (site_content keys), 0016 (slab grid, `on conflict (zone, weight_band)`). Re-running never clobbers later owner edits / never duplicates.

### Migration Header Comment Convention
**Source:** every migration (0004/0006/0011 lines 1-27) opens with a `-- 00NN_name.sql` banner explaining sort order, the decision IDs it satisfies, and any divergence from prior conventions. **Apply to all 5 new migrations** — especially the 0017 deny-direct rationale and the 0015 "schema-only, data via script" note.

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `scripts/data/pincodes.ndjson` | data asset | Human-acquired India Post dataset; no code to clone. Transform + normalization is a one-time manual step (RESEARCH Open Question 3 / Pitfall A). |

The **deny-direct RLS posture** (0017) and the **`deriveZone()` / `callCourierAdapter()` compute logic** have no in-repo analog — they are fully specified in RESEARCH (§Zone-Derivation Algorithm, Patterns 1-2, DDL) and the planner should source them there rather than from an existing file.

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/functions/`, `supabase/config.toml`, `scripts/`
**Files scanned:** 7 read in full (verify-and-submit, seed.ts, verify-seed.ts, 0011, 0006, 0004; config.toml grep)
**Pattern extraction date:** 2026-06-28
</content>
</invoke>
