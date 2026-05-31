# Pitfalls Research

**Domain:** Supabase-direct (no backend server) auth + admin CMS + Storage bolted onto a static React/Vite SPA deployed to GitHub Pages
**Researched:** 2026-05-31
**Confidence:** HIGH (security core verified against Supabase official docs + community post-mortems; a few API-syntax items marked VERIFY)

> **Why this matters for THIS project:** PROJECT.md already commits to "Supabase-direct — frontend talks to Supabase via its client; no custom Express API layer" and "Admin-only actions must be enforced server-side via Supabase RLS, not just hidden in the UI." That single architectural choice means **the Postgres database (via RLS) is the only trust boundary** — there is no server to check anything. Every critical pitfall below flows from getting that boundary right. CONCERNS.md also confirms the existing Express/Passport/Drizzle scaffolding is being dropped, so none of the prior server-side security model carries over.

## Phase shorthand

Map to real roadmap when created. Used throughout:

- **P0 – Supabase foundation:** project, schema, RLS, env wiring, CI secrets
- **P1 – Auth:** signup/login, sessions, redirect/confirmation, role model
- **P2 – Admin CMS:** admin-only writes, role gating, dashboard, content/social edits
- **P3 – Storage/Images:** buckets, upload, public/signed URLs
- **P4 – Data migration:** 68 products + repo images into Supabase
- **P5 – Public/customer features:** native questionnaire, wishlist, profile/history, public reads
- **P-deploy:** GitHub Pages build/routing config

---

## Critical Pitfalls

### Pitfall 1: Admin authorization enforced only on the client

**What goes wrong:**
The app hides the admin dashboard and write buttons behind a React check (`if (user.role === 'admin')`) but the underlying tables allow any authenticated user — or even `anon` — to write. The "admin CMS" is cosmetic: anyone can open devtools, read the anon key from the bundle (it ships in the JS, see Pitfall 4), and call `supabase.from('products').insert(...)` directly. It succeeds.

**Why it happens:**
Teams coming from Express/Passport (exactly this project's prior scaffolding) treat the API as the trust boundary and React route guards as security. In Supabase-direct there is no API and no server — the database is the only boundary, and that mental shift is easy to miss.

**How to avoid:**
- Treat **RLS policies as the security boundary; client checks are UX only** (this is already a stated PROJECT.md decision — enforce it).
- Enable RLS on **every** table at creation. No policy = no access (default-deny is correct).
- Gate all CMS writes (`products`, `categories`, `site_content`, `contact/social`) with an `is_admin()` SQL check (Pitfall 2), never a client flag.
- Write a negative test: as a logged-in non-admin holding only the anon key, attempt every write — all must fail with an RLS error.

**Warning signs:**
RLS toggled off on any table; policies like `USING (true)` for writes; admin gating that lives only in `.tsx`; no test proving a non-admin is blocked at the DB.

**Phase to address:** P0 (enable RLS everywhere), enforced again in P2 (admin writes) and P5 (wishlist/questionnaire ownership).

---

### Pitfall 2: Recursive RLS policy on the `profiles`/roles table (and the SQL-inlining trap)

**What goes wrong:**
Admin role lives in a `profiles` table (`role = 'admin'`). The naive RLS check on `profiles` queries `profiles` — e.g. `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role='admin'))`. Postgres re-evaluates the policy on that inner select → **`infinite recursion detected in policy for relation "profiles"`** (error 42P17). Same trap when other tables' policies subquery `profiles`.

**Subtle second trap:** the standard fix is a `SECURITY DEFINER` helper — **but if you write it as a plain `language sql` function, Postgres inlines it during planning, the definer context is lost, RLS applies to the inner query, and the recursion comes back.** This is the gotcha most blog posts get wrong.

**Why it happens:**
The self-referencing subquery is the obvious way to express "admins can see all profiles," and the SQL-vs-plpgsql inlining nuance is invisible until it recurses at runtime.

**How to avoid (in order of preference):**
1. **Store role in the JWT, not in a self-referencing table read.** Put `role`/`is_admin` in **`app_metadata`** (admin-controlled, not user-editable — see Pitfall 3) and read it in policies via `auth.jwt()`. No table read → no recursion. (For richer RBAC, Supabase's documented pattern is a **Custom Access Token Auth Hook** that injects the role claim.) **VERIFY** exact claim-access syntax for current version.
2. **`SECURITY DEFINER` helper written in `plpgsql` (not `sql`)** so it is never inlined:
   ```sql
   create or replace function public.is_admin()
   returns boolean
   language plpgsql            -- MUST be plpgsql, not sql, to prevent inlining
   security definer
   set search_path = ''        -- prevent search_path hijack (Pitfall 13)
   stable
   as $$
   begin
     return exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'admin'
     );
   end;
   $$;
   ```
   Call `public.is_admin()` in policies instead of an inline subquery.

**Caveat (verified):** a JWT-based role is not refreshed instantly — changing `app_metadata` won't reflect in `auth.jwt()` until the user's token refreshes. For a single owner-admin that's fine; just know it.

**Warning signs:**
`infinite recursion detected in policy`; any policy whose `USING`/`WITH CHECK` subqueries its own table; a `language sql` security-definer helper used in policies.

**Phase to address:** P0/P1 — decide the role model and write `is_admin()` before any admin policy exists. Wrong here = redo every downstream policy.

---

### Pitfall 3: Insecure admin-role assignment (role stored where the user can edit it)

**What goes wrong:**
Role kept in **`user_metadata`** (`raw_user_meta_data`), which **the user can modify themselves** via `supabase.auth.updateUser({ data: { role: 'admin' }})`. A customer self-promotes to admin. Variant: a `profiles` UPDATE policy lets users edit their own row including the `role` column.

**Why it happens:**
`user_metadata` and `app_metadata` look interchangeable; the user-editability of `user_metadata` is easy to miss. Verified: `raw_user_meta_data` is user-updatable and is explicitly the wrong place for authorization data; `app_metadata` cannot be updated by the user.

**How to avoid:**
- Put privilege data in **`app_metadata`** (writable only by service role / admin API), never `user_metadata`.
- If using a `profiles.role` column: the self-UPDATE policy must **exclude `role`** (column grants, or a trigger/`WITH CHECK` that forbids changing `role`).
- Make the **first admin** a deliberate one-time act via the Supabase SQL editor/dashboard or a service-role script on a trusted machine — **never** a self-serve "make me admin" path in the SPA. Given this is a single-owner brand, manual bootstrap is ideal.
- Any future "promote user to admin" is a privileged op requiring the service role (run manually or via a locked-down Edge Function — never from the browser).

**Warning signs:**
Role read from `user_metadata`; any code letting a logged-in user write their own role; ability to flip role via the normal client.

**Phase to address:** P1 (role model + first-admin bootstrap), reinforced P2.

---

### Pitfall 4: Exposing the service-role key (or any secret) in the client bundle

**What goes wrong:**
The `service_role` key (which **bypasses all RLS**) gets imported into client code or — most common with Vite — placed in a **`VITE_`-prefixed** env var. Verified: anything `VITE_*` is **inlined into the public JS bundle at build time**. On GitHub Pages that bundle is a public static asset. Leaking the service-role key = total DB compromise (read/write/delete everything, ignore all policies).

**Why it happens:**
Misreading Vite's env model: people assume `VITE_` means "managed/secret." It means the opposite — `VITE_` = published to the browser. The service-role key also "just works" in quick tests because it bypasses RLS, which is exactly the temptation. (CONCERNS.md notes there's currently *no* `.env` parser and vars are read from the environment — so env discipline must be established fresh.)

**How to avoid:**
- **Only two values belong in the SPA: the project URL and the `anon` (publishable) key.** Both are designed to be public; verified that the anon key is safe in a browser **only because RLS is enabled and correct** — which is why Pitfalls 1–2 are non-negotiable.
- The `service_role` key never touches client code, the repo, `VITE_` vars, or any CI step that feeds the bundle. If a server-side action truly needs it, use a Supabase **Edge Function** with the key as a function secret.
- Add `.env` to `.gitignore`; ship a `.env.example`. If the key was ever committed/exposed, **rotate it immediately** in the dashboard.

**Warning signs:**
`service_role` / `SUPABASE_SERVICE` string anywhere under `client/src/`; a `VITE_*SERVICE*` var; secret-scanning alerts; the key visible in built `dist/assets/*.js`.

**Phase to address:** P0 (env + secrets discipline before any code), re-audited at P-deploy.

---

### Pitfall 5: Overly-permissive `anon` / `authenticated` policies (`USING (true)`)

**What goes wrong:**
To silence dev errors, tables get blanket policies (`FOR ALL USING (true)` or `FOR SELECT TO anon USING (true)`) applied to tables holding private data — wishlists, questionnaire submissions (PII: skin type, contact), customer profiles. Public reads are correct for `products`/`categories`; they are a breach for user data.

**Why it happens:**
One permissive policy makes everything work during development; differentiating per-table/role/operation is more effort and gets deferred.

**How to avoid:**
- Decide a per-table intent matrix up front:
  - `products`, `categories`, `site_content`, contact/social → **SELECT public (anon ok); write admin-only.**
  - `wishlist`, `questionnaire_submissions`, `profiles` → **owner-only** (`auth.uid() = user_id`); admin read via `is_admin()`. **No anon read.**
- Prefer specific policies per operation and per role over one `FOR ALL`.
- Native questionnaire from logged-out visitors: allow **`anon INSERT` only**, with a `WITH CHECK` constraining fields, and **never `anon SELECT`** on that table.

**Warning signs:**
`USING (true)` on anything non-public; `TO anon` on a user-data table; one user able to read another's wishlist or submissions.

**Phase to address:** P0 (policy matrix), P5 (wishlist/questionnaire ownership).

---

### Pitfall 6: Storage bucket misconfiguration — leaking files, or unrestricted upload

**What goes wrong:**
Two opposite failures: (1) a **public bucket** correctly used for catalog images, but later reused for sensitive files → world-readable via predictable URLs. (2) **Upload/delete not restricted:** Storage is backed by `storage.objects` with its own RLS, separate from table RLS. With no policies, uploads either fail entirely or a permissive policy lets any authenticated user (or anon) upload/overwrite/delete product images. Image writes must be **admin-only**, same as `products`.

**Why it happens:**
Storage RLS is a separate system that's easy to forget; "public bucket" gets conflated with "anyone can upload."

**How to avoid:**
- Product images → dedicated **public bucket; read = public, but write/update/delete = admin-only** via policies on `storage.objects` (`bucket_id = '...' AND public.is_admin()`).
- Any future user-private files → **private bucket + short-TTL signed URLs** (`createSignedUrl`). Do not serve private content via public URLs, and do not put catalog images behind signed URLs (needless churn/expiry).
- Validate file type/size client-side AND constrain via policy/path (client validation is bypassable).

**Confidence:** HIGH on concepts; MEDIUM on exact `storage.objects` policy syntax — **VERIFY** current Storage access-control API.

**Warning signs:**
Catalog images served via signed URLs; private files via public URL; no admin gate on `storage.objects` insert/delete; any user can replace a product image.

**Phase to address:** P3 (buckets + policies before upload UI), P4 (migration writes via service role/admin).

---

### Pitfall 7: Data migration without RLS-aware tooling — failed inserts, broken images, or accidental exposure

**What goes wrong:**
Migrating 68 hardcoded products + repo images: the importer runs with the **anon key**, silently hits admin-only RLS → partial/empty import; OR the team disables RLS "just for migration" and **forgets to re-enable it**, leaving production wide open. Image variant: product rows reference **paths that don't match** the Storage bucket layout after upload → broken `<img>` everywhere. CONCERNS.md notes the current images come from fragile `import.meta.glob` folders keyed loosely to product IDs — that mapping must be rebuilt deliberately, not guessed.

**Why it happens:**
The migration is a one-off, run differently from the app, often hastily.

**How to avoid:**
- Run migration with the **service-role key from a local/trusted script** (Node/`psql`/SQL editor) — never shipped to the static site. RLS stays enabled; service role legitimately bypasses it.
- If RLS is ever toggled off for bulk load, make re-enabling it a hard checklist gate verified by the Pitfall 1 negative test.
- **Upload images first → capture the real public URL/path → insert product rows referencing those exact paths.** Store the path/key (not a transient signed URL).
- Make migration **idempotent** (upsert on slug/SKU) so re-runs don't duplicate the 68 products. Diff counts: 68 in → 68 rows.
- Keep `client/src/data/products.ts` as source of truth until parity is verified; also populate the currently-empty `price` fields as part of migration (or explicitly leave blank by design).

**Warning signs:**
Migration run from browser/anon; RLS left off; broken images post-migration; duplicate rows on re-run.

**Phase to address:** P4 (depends on P3 buckets + P0 RLS/service-role discipline).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Disable RLS to "ship faster" | Everything works instantly | Public read/write API; full data compromise | **Never** in any deployed env |
| `USING (true)` blanket policy | Silences dev errors | Leaks user PII; rewrite of policy layer | Only on truly-public read tables (`products`) |
| `language sql` security-definer helper | Slightly simpler | Inlined → recursion returns silently | Never for RLS-used helpers — use `plpgsql` |
| Role in `user_metadata` | Easy to set from client | Self-promotion to admin | Never for authorization data |
| Skip email confirmation | Faster signup | Spam/fake accounts | Acceptable for low-volume single-brand MVP — a deliberate choice, not an oversight |
| Hardcode Supabase URL in source | One less env var | Harder env switching; URL leak is harmless but messy | Tolerable (URL is public); still prefer env var |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vite env | Putting secrets in `VITE_*` | Only URL + anon key as `VITE_*`; secrets never client-side |
| Supabase Auth (email) | Site URL/redirect left at localhost defaults | Set Site URL + redirect allowlist to the Pages sub-path URL + localhost dev |
| Supabase Auth (SSR assumption) | Expecting session in query string server-side | Pure SPA — session arrives in URL fragment; handle client-side; use `/auth/confirm` not `/auth/callback` for email |
| Supabase Storage | Forgetting `storage.objects` has its own RLS | Add explicit admin-only write policies per bucket |
| Edge Function (if added) | No CORS / preflight handling | Handle `OPTIONS`, restrict `Access-Control-Allow-Origin` to the Pages origin |
| GitHub Pages | Wrong/absent Vite `base` for project sub-path | Set `base` to `/Repo/` (or custom domain); keep router basename consistent |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `auth.uid()`/`is_admin()` re-evaluated per row | Slow admin list queries | Wrap as `(select auth.uid())` so Postgres caches it per-statement (Supabase RLS perf guidance) | Noticeable at thousands of rows; fine at 68 products now |
| Eager glob-import of all images (existing) | Large bundle | Moving images to Storage with lazy `<img>` fixes this | Already flagged in CONCERNS.md; worsens as scrub/cream images added |
| Fetching full product list with images each load | Slow Shop page | Cache via TanStack Query (already wired); paginate later | Fine at 68; revisit at hundreds |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Client-only admin gate | Anyone with anon key writes catalog | RLS `is_admin()` on all writes (Pitfall 1) |
| Service-role key in bundle | Total DB compromise | Only URL + anon key client-side (Pitfall 4) |
| Role in user_metadata / editable `role` column | Self-promotion to admin | `app_metadata` / column-locked role (Pitfall 3) |
| Recursive / SQL-inlined RLS helper | Policies fail or recurse, tempting a "disable RLS" hack | `plpgsql` security-definer + `search_path=''` (Pitfall 2) |
| `anon SELECT` on questionnaire/wishlist | Customer PII leak | Owner-only reads; anon INSERT-only on public form (Pitfall 5) |
| Unrestricted Storage upload | Visitors overwrite/delete product images | Admin-only `storage.objects` write policies (Pitfall 6) |
| Over-broad SELECT columns via auto REST API | Internal columns queryable by clients | Tight SELECT policies / views / column grants |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Email confirmation link 404s on Pages sub-path | User "can't sign up" | Site URL/redirect incl. sub-path; test full round trip on live site |
| Hard refresh on `/admin` → GitHub 404 | Admin locked out of deep links | Keep `404.html`=`index.html` (repo already does this) or hash router |
| Random logout after token expiry | Admin loses work mid-edit | supabase-js auto-refresh + `onAuthStateChange`; gate UI on live session |
| Default SMTP rate limits in prod | Confirmation emails stop arriving | Configure real SMTP, or disable confirmation for low-volume MVP |
| Stale `is_admin` after role change | Admin sees wrong UI until re-login | Re-derive on auth change; accept JWT-refresh lag |

## "Looks Done But Isn't" Checklist

- [ ] **Admin CMS:** UI hides write buttons — verify a non-admin with the anon key is **blocked at the DB**, not just in React.
- [ ] **RLS:** Looks enabled — verify **every** table has it on AND has explicit policies (enabled with no policy = locked, which can also masquerade as "broken").
- [ ] **`is_admin()` helper:** Works in SQL editor — verify it's `plpgsql` (not `sql`) and has `set search_path=''`, else recursion/hijack risk.
- [ ] **Env/secrets:** App runs — grep built `dist/` for `service_role`; confirm only URL + anon key shipped.
- [ ] **Auth email flow:** Works locally — verify confirmation/reset round trip on the **deployed Pages URL** (sub-path included).
- [ ] **SPA routing:** Home loads — verify **hard refresh** on `/admin` and a `/product/:id` deep link don't 404.
- [ ] **Storage:** Upload works as admin — verify a normal user **cannot** upload/delete; verify public catalog URLs resolve.
- [ ] **Migration:** 68 rows present — verify image URLs resolve, no duplicates on re-run, RLS still enabled, prices handled.
- [ ] **Questionnaire (anon):** Submit works — verify anon **cannot read** submissions; admin inbox can.
- [ ] **Wishlist:** Saves — verify user A cannot read user B's wishlist.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service-role key leaked | HIGH | Rotate key in dashboard immediately; purge from repo history; audit data for tampering |
| Recursive RLS in prod | MEDIUM | Replace inline subquery with `plpgsql` `is_admin()`; re-test all policies |
| `user_metadata` role used | MEDIUM | Migrate role to `app_metadata`; revoke self-promoted accounts; force token refresh |
| RLS left disabled post-migration | LOW (if caught fast) | Re-enable RLS; run negative test; assume breach if public for any window |
| Broken image paths post-migration | LOW | Re-derive paths from Storage; bulk-update product image refs |
| Auth redirect misconfigured | LOW | Fix Site URL + allowlist + `emailRedirectTo`; resend confirmations |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 Client-only admin check | P0 + P2 | Non-admin write attempt fails at DB |
| #2 Recursive / inlined RLS helper | P0/P1 | No 42P17 error; helper is `plpgsql`; admin policies pass |
| #3 Insecure role assignment | P1 | Role in `app_metadata`; user cannot change own role |
| #4 Service-role key in bundle | P0 + P-deploy | `dist/` grep clean; only URL + anon key present |
| #5 Permissive anon policies | P0 + P5 | User B cannot read user A's data; anon cannot read submissions |
| #6 Storage misconfig | P3 + P4 | Non-admin cannot upload/delete; public URLs resolve |
| #7 Migration mistakes | P4 | 68 rows, images resolve, idempotent, RLS on |
| #8 Auth redirect/email on Pages | P1 + P-deploy | Confirmation round trip on live sub-path URL |
| #9 SPA 404 routing | P-deploy/P1 | Hard refresh on deep routes + auth callback works |
| #10 Session/token handling | P1 | No surprise logout; UI tracks `onAuthStateChange` |
| #11 CORS (Edge Fn only) | P3 (if used) | Preflight OK from Pages origin |
| #12 Vite `base` sub-path | P-deploy | Assets/images load on deployed Pages |
| #13 Definer `search_path` | P0/P1 | Helper has `set search_path=''` |
| #14 Missing `WITH CHECK` | P0/P5 | Cannot insert rows scoped to another user |

> Pitfalls #8–#14 are documented inline within the critical entries above and this table; they are moderate/minor relative to the security core (#1–#7) but each maps to a concrete verification.

## Top 3 (do not get these wrong)

1. **RLS is the only security boundary (#1, #2, #5)** — no server exists; client checks are decoration. Default-deny, test as a non-admin.
2. **Never expose the service-role key (#4)** — `VITE_*` is public; only URL + anon key in the bundle; rotate if leaked.
3. **Secure role assignment (#3)** — role in `app_metadata`, never user-editable `user_metadata`; bootstrap the first admin out-of-band.

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH
- [Custom Claims & RBAC | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — HIGH (`app_metadata` vs `user_metadata`, Custom Access Token Auth Hook)
- [Token Security and Row Level Security | Supabase Docs](https://supabase.com/docs/guides/auth/oauth-server/token-security) — HIGH (`raw_app_meta_data` not user-editable)
- [RLS Performance and Best Practices | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH (`(select auth.uid())` caching)
- [Redirect URLs | Supabase Docs](https://supabase.com/docs/guides/auth/redirect-urls) — HIGH (Site URL + allowlist, wildcard paths)
- [Why am I redirected to the wrong URL (redirectTo) | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO) — HIGH
- [Env Variables and Modes | Vite](https://vite.dev/guide/env-and-mode) — HIGH (`VITE_` inlined into client bundle)
- [Environment Variables (secrets) | Supabase Docs](https://supabase.com/docs/guides/functions/secrets) — HIGH
- [Infinite recursion using users table for RLS role · Discussion #1138](https://github.com/orgs/supabase/discussions/1138) — MEDIUM (post-mortem)
- [Infinite recursion in Postgres RLS: a SECURITY DEFINER gotcha (DEV)](https://dev.to/bairescodeai/infinite-recursion-in-postgres-rls-a-security-definer-gotcha-1916) — MEDIUM (the `sql` vs `plpgsql` inlining trap)
- [Supabase RLS SECURITY DEFINER: Preventing Infinite Recursion (DEV)](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — MEDIUM
- [Supabase RLS Best Practices (makerkit.dev)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM
- [Supabase Auth redirecting to base path, not subdirectory · Issue #10949](https://github.com/supabase/supabase/issues/10949) — MEDIUM (Pages sub-path redirect bug)
- [Always redirects to localhost · Discussion #26483](https://github.com/orgs/supabase/discussions/26483) — MEDIUM

**VERIFY before locking roadmap:** exact `auth.jwt()` claim-access syntax and Custom Access Token Auth Hook API; current `storage.objects` policy syntax; current Auth URL-config setting names; default email rate limits. Confirm `vite.config.ts` `base` and the `404.html` copy step against the current repo (CONCERNS/deploy workflow indicate both exist).

---
*Pitfalls research for: Supabase-direct SPA + admin CMS + Storage on GitHub Pages*
*Researched: 2026-05-31*
