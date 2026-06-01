# Phase 3: Authentication & Roles - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 13 (8 new, 5 modified/extended)
**Analogs found:** 12 / 13 (one new file — auth state layer — has no in-repo analog; nearest is a custom hook + the singleton)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0004_auth_profiles.sql` | migration | transform (DDL + triggers) | `supabase/migrations/0001_init_schema.sql` + `0002_rls_policies.sql` | exact |
| `supabase/tests/auth_rls_assertions.sql` | test | batch (DB invariant) | `supabase/tests/rls_assertions.sql` | exact |
| `scripts/promote-admin.ts` | utility (script) | CRUD (service-role) | `scripts/seed.ts` | exact |
| `client/src/auth/AuthProvider.tsx` | provider | event-driven (auth subscription) | `client/src/hooks/use-mobile.tsx` (subscribe/cleanup) + `client/src/lib/supabase.ts` (client) | role-match (no provider exists yet) |
| `client/src/auth/useAuth.ts` | hook | request-response (context read) | `client/src/hooks/use-mobile.tsx` / `use-toast.ts` | role-match |
| `client/src/auth/AdminGuard.tsx` | component (route guard) | request-response | `client/src/components/Navbar.tsx` (useLocation) + Wouter redirect | partial (no guard exists yet) |
| `client/src/lib/authErrors.ts` | utility | transform (error mapping) | `client/src/lib/supabase.ts` (named export util module) | role-match |
| `client/src/pages/Login.tsx` | page (form) | request-response | `client/src/pages/Contact.tsx` (page+Layout) + `ui/form.tsx` (RHF primitives) | role-match |
| `client/src/pages/Register.tsx` | page (form) | request-response | same as Login | role-match |
| `client/src/pages/ResetPassword.tsx` | page (form) | event-driven (PASSWORD_RECOVERY) + request-response | same as Login | role-match |
| `client/src/pages/Admin.tsx` | page (shell) | request-response | `client/src/pages/Questionnaire.tsx` (minimal Layout page) | exact |
| `client/src/App.tsx` (MODIFY) | config (routing) | — | self (existing Router/Switch) | exact |
| `client/src/components/Navbar.tsx` (MODIFY) | component | request-response | self (existing social-icon block + Sheet menu) | exact |

## Pattern Assignments

### `supabase/migrations/0004_auth_profiles.sql` (migration, DDL + triggers)

**Analog:** `supabase/migrations/0001_init_schema.sql` (function conventions) and `0002_rls_policies.sql` (policy conventions).

**File header convention** (0001 lines 1-10): every migration opens with a `-- 0004_...` filename comment, a one-line phase/plan/task tag, then a rationale block. Match this.

**SECURITY DEFINER function convention** — copy verbatim from `private.is_admin()` (0001 lines 115-128). Every new function (`handle_new_user`, `enforce_profile_role_lock`) MUST use this exact preamble:
```sql
language plpgsql        -- (is_admin uses `sql`; the triggers need plpgsql)
security definer        -- runs as creator → bypasses RLS on profiles
set search_path = ''    -- locked: every object reference must be fully-qualified
```
Note the existing `(select auth.uid())` initPlan form used throughout 0002 (lines 69, 79) and inside `is_admin()` (0001 line 125) — reuse it; never bare `auth.uid()`.

**`name` column add** — the existing `public.profiles` (0001 lines 66-72) has `id, email, role, created_at, updated_at`. Add `alter table public.profiles add column name text;` (nullable, per D-06). Use `name` not `full_name` (RESEARCH Open Q #2: matches `customization_submissions.name` at 0001 line 91).

**Trigger SQL** — use RESEARCH Pattern 1 (`handle_new_user`, lines 209-229) and Pattern 2 (`enforce_profile_role_lock`, lines 240-256) verbatim, adapted to the above preamble. Hard-code `role='customer'` (never read from `raw_user_meta_data`).

**Role-lock service-role carve-out (Pitfall 4, RESEARCH lines 360-364):** `enforce_profile_role_lock` must allow the change when the caller is admin OR `auth.uid()` is null (service-role bootstrap has no JWT). Recommended condition:
```sql
if new.role is distinct from old.role
   and (select auth.uid()) is not null
   and not private.is_admin() then
  raise exception 'role change not permitted';
end if;
```

**Do NOT add a `profiles` INSERT policy** — 0002 lines 63-65 deliberately omit it ("Phase 3 wires signup row creation"); the trigger creates rows. Keep `profiles_self_update` (0002 lines 76-80) as-is; the trigger is the column-lock, not a policy change.

---

### `supabase/tests/auth_rls_assertions.sql` (test, DB invariant)

**Analog:** `supabase/tests/rls_assertions.sql` (exact structural mirror).

**Pattern** (lines 1-52): a header comment listing invariants, then a single `do $$ declare ... begin ... end $$;` block where each invariant `raise exception '... FAILED: ...'` on violation. Run via `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ...`.

**Invariant query style** (lines 30-52): query `pg_class`/`pg_namespace`/`pg_policies`/`pg_proc` into declared vars, compare, raise with a useful message. The existing INVARIANT 4 (is_admin `prosecdef=true` + locked `proconfig`) is the template for asserting `handle_new_user`/`enforce_profile_role_lock` are SECURITY DEFINER with locked search_path. Carry over INVARIANT 3 (no anon/public INSERT on `profiles`) unchanged. Add: `name` column exists (`information_schema.columns`); both new triggers exist (`pg_trigger`).

---

### `scripts/promote-admin.ts` (utility script, service-role CRUD)

**Analog:** `scripts/seed.ts` (exact mirror — RESEARCH says copy it).

**Imports + env-guard** (seed.ts lines 17-31): native Node imports, `import { createClient } from '@supabase/supabase-js'`, read `process.env.SUPABASE_URL` + `process.env.SUPABASE_SERVICE_ROLE_KEY` (NON-`VITE_`), fail-fast:
```ts
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
```

**Header/run-doc convention** (seed.ts lines 1-16): JSDoc block documenting purpose, the SECURITY note (never imported by client → never in bundle, guarded by `check-no-secret.sh`), and the exact run command:
```
node --env-file=.env.promote.local scripts/promote-admin.ts owner@example.com
```

**Idempotent mutation + exit convention** (seed.ts lines 94-124): perform the `admin.from('profiles').update({ role: 'admin' }).eq('email', email)`, throw `new Error(...)` on `error`, `console.log('OK: ...')` + `process.exit(0)` on success, with the trailing `main().catch(...) process.exit(1)` wrapper. Body per RESEARCH Code Examples lines 399-414.

**Env-file:** gitignored `.env.promote.local` (root `.gitignore`/`supabase/.gitignore` already cover `.env*.local`).

---

### `client/src/auth/AuthProvider.tsx` (provider, event-driven) + `useAuth.ts` (hook)

**Analog:** `client/src/hooks/use-mobile.tsx` (subscribe-in-useEffect + cleanup shape) and `client/src/lib/supabase.ts` (the singleton all calls go through). No React context/provider exists in the repo yet.

**Supabase access** — always `import { supabase } from '@/lib/supabase'` (the env-guarded singleton, supabase.ts line 13). Never call `createClient` in the client.

**Subscribe/cleanup shape** (use-mobile.tsx lines 8-17): the project's established `useEffect` pattern is subscribe → set state → return cleanup that unsubscribes. Apply to `getSession()` + `onAuthStateChange` per RESEARCH Pattern 3 (lines 266-277):
```ts
useEffect(() => {
  let mounted = true;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (mounted) { setSession(session); setLoading(false); }
  });
  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoading(false); });
  return () => { mounted = false; subscription.unsubscribe(); };
}, []);
```
Fetch `role` separately (`select role from profiles where id=user.id`) and fold into `loading` (RESEARCH line 279).

**Hook convention:** camelCase `useAuth` named export (CLAUDE.md: hooks camelCase, utilities named-export). Mirror `use-toast.ts`'s "throw if used outside provider" guard style. Provider is a default-export PascalCase component.

**Mount point:** wrap inside `App.tsx` `<TooltipProvider>` (see App.tsx modify below) so Navbar + AdminGuard can read it.

---

### `client/src/auth/AdminGuard.tsx` (route guard, request-response)

**Analog:** `client/src/components/Navbar.tsx` lines 1, 18 (`useLocation` from wouter) for navigation; no guard exists yet.

**Loading gate (D-12, RESEARCH Pitfall 2):** read `{ loading, session, role }` from `useAuth`; while `loading` render `<Spinner />` from `@/components/ui/spinner` (default `Loader2Icon`, `size-4 animate-spin`). Only decide after `loading` is false.

**Redirects (D-11):** use Wouter `<Redirect to="/login" />` (or `useLocation()[1](path)`). Logged-out → `/login` remembering `/admin` destination; logged-in non-admin → `/`. No 403 page. Destination must be an internal leading-slash path only (RESEARCH Pitfall 6 — reject `://` or `//`).

**Base-awareness:** all routes resolve under Wouter `base={import.meta.env.BASE_URL...}` already set in App.tsx line 15 — use relative paths (`/login`, `/admin`), not absolute URLs.

---

### `client/src/lib/authErrors.ts` (utility, error transform)

**Analog:** `client/src/lib/supabase.ts` — same `lib/` location, camelCase filename, named export. Pure function mapping Supabase error message strings → friendly copy (D-14). Avoid user-enumeration distinctions (RESEARCH Security Domain: don't reveal "email not found" vs "wrong password").

---

### `client/src/pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx` (form pages)

**Analog:** `client/src/pages/Contact.tsx` (page-in-Layout shell, lines 1-23) for layout chrome; `client/src/components/ui/form.tsx` for the react-hook-form primitives. **No existing page uses react-hook-form** (`Questionnaire.tsx` is a Google Form iframe) — `ui/form.tsx` is the only in-repo RHF integration, so it is the canonical wiring.

**Page shell** (Contact.tsx lines 7-23): `export default function X()` wrapping content in `<Layout>`, header `<section className="pt-28 ...">` with `font-serif text-4xl md:text-6xl text-primary` heading and the `w-16 h-0.5 bg-secondary` divider. Reuse this chrome for auth pages.

**Form stack:** `useForm` + `zodResolver` (`@hookform/resolvers` — installed) + `ui/form.tsx` (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`). Fields via `Input` (`@/components/ui/input`), submit via `Button` (`@/components/ui/button`), optionally wrapped in `Card`/`CardHeader`/`CardContent` (`@/components/ui/card`). Inline errors render through `<FormMessage>` (D-14).

**Auth calls** (RESEARCH Code Examples lines 381-396): `signUp({ email, password, options: { data: { name } } })` (Register), `signInWithPassword` (Login), `resetPasswordForEmail(email, { redirectTo })` + `updateUser({ password })` (ResetPassword). Map errors via `authErrors.ts`.

**ResetPassword two-step (RESEARCH Pattern 4, lines 282-300):** build `redirectTo` from `import.meta.env.BASE_URL` + `window.location.origin`; listen for `onAuthStateChange` `PASSWORD_RECOVERY` to switch to the new-password form; `replaceState` to clear the token from the URL after handling (Security Domain).

**Zod password rule:** min 6 chars to match Supabase default (D-07).

---

### `client/src/pages/Admin.tsx` (empty protected shell)

**Analog:** `client/src/pages/Questionnaire.tsx` (minimal `export default function` wrapping `<Layout>` with a header section). Ship an empty shell only (D-11); portal content is Phase 4.

---

### `client/src/App.tsx` (MODIFY — routing + provider mount)

**Current structure** (lines 13-40): `Router()` returns `<WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Switch><Route .../></Switch></WouterRouter>`; `App()` nests `QueryClientProvider > TooltipProvider > Toaster + Router`.

**Add:** `<Route path="/login">`, `/register`, `/reset-password` (or chosen name), and `/admin/:rest*` wrapped by `AdminGuard`. Import pages with the `@/pages/...` alias (matches lines 7-11). Mount `<AuthProvider>` high — inside `<TooltipProvider>`, wrapping `<Router />` (and `<Navbar>`-bearing pages) so both navbar and guard read auth state. Keep the existing `base=` prop untouched (path-based router — RESEARCH: do NOT switch to a hash router).

---

### `client/src/components/Navbar.tsx` (MODIFY — account icon + menu, D-09)

**Current structure** (lines 53-123): a `<div className="flex items-center space-x-3">` holds the social `<a>` icon buttons (Instagram/YouTube/Email) then the mobile `<Sheet>` hamburger (lines 126-248). Add the account entry into this same icon row, styled with the existing `p-2 hover:text-secondary transition-colors duration-300` icon-button class.

**Pattern:** use a `lucide-react` `User`/`CircleUser` icon (lucide already a dep). Logged-out → `<Link href="/login">`. Logged-in → `@/components/ui/dropdown-menu` (`DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`) exposing **Log out** (calls `useAuth().signOut`), leaving room for Wishlist/Profile (Phase 5). Read state via `useAuth`. The mobile `<Sheet>` (lines 126-248) should also surface the account/logout link for parity. Follow the existing `useLocation`/`Link` import pattern (line 1).

## Shared Patterns

### Supabase client access
**Source:** `client/src/lib/supabase.ts` line 13 (`export const supabase = createClient(...)`)
**Apply to:** AuthProvider, all auth pages, AdminGuard role fetch.
Always `import { supabase } from '@/lib/supabase'` — the singleton is env-guarded (throws if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing). Never construct a client in the browser.

### SECURITY DEFINER + locked search_path (DB)
**Source:** `supabase/migrations/0001_init_schema.sql` lines 115-128 (`private.is_admin()`)
**Apply to:** `handle_new_user`, `enforce_profile_role_lock` in 0004.
```sql
security definer
set search_path = ''   -- every object fully-qualified (public.profiles, private.is_admin())
```
Reuse `private.is_admin()` for the role-lock admin check — do not reimplement role lookup (RESEARCH "Don't Hand-Roll").

### `(select auth.uid())` initPlan form
**Source:** `0002_rls_policies.sql` lines 69, 79; `0001` line 125
**Apply to:** every RLS/trigger reference to the current user in 0004. Never bare `auth.uid()`.

### Service-role secret hygiene
**Source:** `scripts/seed.ts` lines 11-13, 23-24; `scripts/check-no-secret.sh`
**Apply to:** `scripts/promote-admin.ts`. Read `SUPABASE_SERVICE_ROLE_KEY` from non-`VITE_` `process.env`; never import the script from client code; `check-no-secret.sh` proves `dist/` stays clean.

### Page-in-Layout chrome
**Source:** `client/src/pages/Contact.tsx` lines 7-23
**Apply to:** Login, Register, ResetPassword, Admin. `export default function` → `<Layout>` → header `<section>` with `font-serif ... text-primary` heading + `bg-secondary` divider.

### Toast feedback (D-14) — RESOLVE BEFORE PLANNING
**Sources:** `client/src/components/ui/toaster.tsx` (radix `useToast`) vs `client/src/components/ui/sonner.tsx` (Sonner `Toaster`)
**Note for planner:** CONTEXT/RESEARCH say "Sonner / `@/components/ui/toaster`" but these are **two different files**. The component actually mounted in `App.tsx` line 4/33 is the **radix** `@/components/ui/toaster` driven by `useToast` (`@/hooks/use-toast`) — NOT Sonner. `sonner.tsx` exists but is **not mounted**. Planner must pick one: either fire toasts via `useToast()` (the already-mounted radix toaster, zero wiring) or mount `<Toaster>` from `@/components/ui/sonner` in App.tsx and call `toast()` from `sonner`. Recommend the already-mounted `useToast()` to avoid double-mounting.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `client/src/auth/AuthProvider.tsx` | provider | event-driven | No React context/provider exists in the repo. Nearest patterns: subscribe/cleanup shape from `use-mobile.tsx`, throw-if-outside-context guard from `use-toast.ts`, and the supabase singleton. Build per RESEARCH Pattern 3. |

(react-hook-form *usage* also has no page analog — `ui/form.tsx` is the only RHF wiring in the repo; treat it as canonical.)

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/`, `scripts/`, `client/src/{lib,hooks,pages,components,components/ui}/`
**Files scanned:** ~18 (6 deep-read analogs: 0001, 0002, seed.ts, supabase.ts, App.tsx, Navbar.tsx; plus Questionnaire, Contact, toaster, sonner, use-toast, use-mobile, rls_assertions, spinner, dropdown/input/card export surfaces)
**Pattern extraction date:** 2026-05-31
