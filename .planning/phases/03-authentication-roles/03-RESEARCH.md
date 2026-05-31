# Phase 3: Authentication & Roles - Research

**Researched:** 2026-05-31
**Domain:** Supabase Auth (email/password) + Postgres RLS role enforcement on a static React/Vite SPA (GitHub Pages sub-path)
**Confidence:** HIGH (stack, RLS, trigger patterns verified against codebase + official Supabase docs; supabase-js pinned to installed 2.106.2)

## Summary

This phase establishes the auth trust boundary the rest of the milestone depends on, using **Supabase Auth (email/password)** through the already-installed `@supabase/supabase-js@2.106.2` singleton (`client/src/lib/supabase.ts`) — no custom API layer. The work splits cleanly into a **database migration** (new `0004`), a **frontend auth layer** (React context + `useAuth`, three routes, a route guard, a navbar account menu), and a **local bootstrap script** (service-role, never shipped). The real security boundary is Postgres RLS (migrations 0001/0002 already enforce admin-only catalog writes via `private.is_admin()`); this phase closes the single remaining hole — a customer escalating their own `role` — and wires automatic `customer` profile-row creation via a trusted `SECURITY DEFINER` trigger on `auth.users`.

The two non-obvious risks are both verified below: (1) the D-04 role-lockdown **cannot** be done with an RLS `WITH CHECK` alone because Postgres `WITH CHECK` sees only the NEW row, never OLD — so a `BEFORE UPDATE` trigger (consistent with the existing `private` conventions) is the canonical mechanism; and (2) the D-02 password-reset link uses Supabase's **implicit flow**, which returns the recovery token in the URL **hash fragment** (`#access_token=…&type=recovery`). supabase-js parses this automatically (`detectSessionInUrl`), but it interacts with the GitHub Pages 404.html SPA fallback and the Wouter sub-path base — the fragment survives redirects (browsers preserve `#…` across 404→index navigations), so a path-based router is required (Supabase explicitly does **not** support hash-based routers).

**Primary recommendation:** Ship one migration `0004` (add `profiles.name`, replace `profiles_self_update` with a role-excluding policy + a `BEFORE UPDATE` trigger that rejects non-admin role changes, add `handle_new_user` trigger). Build a `useAuth` context wrapping `getSession` + `onAuthStateChange` that resolves a `loading` flag before the guard decides. Mirror `scripts/seed.ts` exactly for `scripts/promote-admin.ts` (native `node --env-file=…`, service-role, idempotent). Keep email confirmation OFF and use built-in email (2/hr is ample for owner-only resets).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Customer can register with email + password | `supabase.auth.signUp({ email, password, options: { data: { name } } })`; handle_new_user trigger creates the `customer` profile row (D-05/D-06). Email confirmation OFF → session returned immediately (D-01). |
| AUTH-02 | Log in and stay logged in across browser sessions | `signInWithPassword`; supabase-js defaults `persistSession:true` (localStorage) + `autoRefreshToken:true` → survives refresh/restart (D-13). |
| AUTH-03 | Log out from any page | `supabase.auth.signOut()` exposed in the persistent Navbar account menu (D-09). |
| AUTH-04 | Roles stored server-side + RLS-enforced | `role` lives only in `public.profiles`; migration 0002 admin-write policies already call `private.is_admin()`. This phase locks the `role` column against self-escalation (D-04 — BEFORE UPDATE trigger). |
| AUTH-05 | Admin routes protected | `/admin/*` namespace + `useAuth`-driven route guard with loading gate (D-11/D-12); empty admin shell this phase. RLS is the real enforcement. |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Email confirmation OFF — user logged in immediately after `signUp` (no verify gate). Set "Confirm email" disabled in Supabase Auth. Tradeoff accepted: fake/typo emails can create dead accounts.
- **D-02:** Password reset ("forgot password") IS in scope — the only email-dependent flow kept. Requires Supabase Site URL + redirect allowlist configured for a `/reset-password` page (name = planner discretion), accounting for the GitHub Pages sub-path base (`import.meta.env.BASE_URL`, `client/src/App.tsx:15`) and the 404.html SPA fallback. VERIFY: current Auth URL-config setting names, built-in email rate limit, built-in-vs-custom-SMTP. *(Verified below.)*
- **D-03:** First admin via a local bootstrap script (e.g. `scripts/promote-admin.ts <email>`) run with the service-role key, never bundled into the client, never `VITE_`-prefixed. Owner registers normally (gets `customer` row), then runs the script to set `role='admin'`. No code/UI path grants admin. Must be idempotent and document required env.
- **D-04:** Role column locked at the RLS layer so a customer cannot escalate. Tighten the self-update path so `role` cannot be changed by a non-admin via any client call (anon key + raw PostgREST included). Required outcome: a customer calling `update profiles set role='admin' where id = auth.uid()` is rejected; customers may still self-update non-privileged fields (name, email). Mechanism = researcher/planner discretion. *(Recommended below: BEFORE UPDATE trigger.)*
- **D-05:** Profile row auto-created via a `SECURITY DEFINER` trigger on `auth.users` (e.g. `handle_new_user`), NOT a client-side INSERT policy. Migration 0002 deliberately has no `profiles` INSERT policy. Trigger inserts `id`, `email`, `role='customer'`, and the name. VERIFY: standard non-recursive trigger pattern + locked `search_path`, consistent with `private.is_admin()`. *(Verified below.)*
- **D-06:** Signup collects email + password + name. Add a `name` column to `public.profiles` (nullable text) via the new migration. Name passed at `signUp` via `options.data` (user metadata) and copied into `profiles` by the D-05 trigger. (Name being user-editable in metadata is fine — not a trust boundary like `role`.)
- **D-07:** Keep Supabase default minimum password length (6), no complexity rules. Client-side validation should match.
- **D-08:** Dedicated `/login` and `/register` routes inside the existing `Layout` (Wouter routes in `App.tsx`). Plus a `/reset-password` route for D-02.
- **D-09:** Navbar account entry = account/person icon + menu (alongside the social icons in `Navbar.tsx`). Logged-out: links to `/login`. Logged-in: menu exposing Log out (any page → AUTH-03), with room for Wishlist/Profile in Phase 5.
- **D-10:** After login, return the user to where they came from / the protected page they were sent from. Guard must track the intended destination.
- **D-11:** `/admin/*` namespace with a UI guard. Logged-out → redirect to `/login` remembering the `/admin` destination (D-10). Logged-in non-admins → redirect to home (`/`). No 403 "access denied" page (would advertise the admin area exists). RLS is the real enforcement. Ships an empty protected `/admin` shell this phase.
- **D-12:** Guard renders a loading state until the Supabase session + role check resolves, then shows or redirects. Prevents both flashing admin UI and wrongly bouncing a real admin on refresh (session loads async from localStorage).
- **D-13:** Always persist session + auto-refresh (Supabase default: session in localStorage, token auto-refresh). No "remember me" toggle.
- **D-14:** Inline form errors (react-hook-form, near the field) + success toasts (Sonner / `@/components/ui/toaster`). Map common Supabase Auth error messages to friendly copy.

### Claude's / Researcher's Discretion
- Exact route/file names (`/reset-password` page name, `scripts/promote-admin.ts` location), the auth state container (React context + `useAuth` wrapping `onAuthStateChange` + `getSession`), and the route-guard component shape.
- The precise RLS expression that locks `role` (D-04) and the exact `handle_new_user` trigger SQL (D-05) — must follow migration 0001/0002 conventions (non-recursive, `set search_path=''`, fully-qualified objects).
- Form layout/validation schema (Zod), which Supabase Auth error strings to remap, skeleton/loading visuals for the guard, whether `/login` and `/register` share a layout component.
- Whether the `name` column is `name` vs `full_name` (pick one; update trigger + Phase 5 references consistently).

### Deferred Ideas (OUT OF SCOPE)
- Admin portal screens & catalog/content management — Phase 4 (ADMIN-01..08). This phase ships only the empty protected `/admin` shell + guard.
- Wishlist, customer profile page, submission history, native questionnaire — Phase 5 (CUST-01..04). D-09 account menu leaves room for these links.
- Stronger password rules / complexity, "remember me", email confirmation — explicitly chosen against (D-07, D-13, D-01).
- Multiple admins / granular permissions — v2 (ADME-03). Single owner-admin via bootstrap script is sufficient.
- CR-01 RLS tightening (`products_public_read` → `using (is_active = true)`) — deferred to Phase 4. Not this phase.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Supabase-direct architecture** — frontend talks to Supabase via its client; NO custom Express API layer. (Express scaffolding removal is DATA-04, Phase 1 — do not re-introduce it.)
- **RLS is the real security** — admin-only actions enforced server-side via RLS, never UI-only.
- **Anon key + RLS** — only the anon key reaches the public client; the service-role key never gets a `VITE_` prefix (Vite inlines every `VITE_*` var into the public bundle). Enforced by `scripts/check-no-secret.sh` against `dist/`.
- **Static SPA on GitHub Pages** with sub-path base (`import.meta.env.BASE_URL`) and 404.html SPA fallback (generated in `deploy.yml`).
- **Naming:** PascalCase React components (`Login.tsx`, `AdminGuard.tsx`), camelCase utils/hooks (`useAuth`), camelCase handlers prefixed `handle`. Default export for components, named exports for utilities/types.
- **Forms:** react-hook-form + Zod + `@hookform/resolvers` (all installed). shadcn primitives (Input, Button, Card, DropdownMenu, Sheet). Sonner toasts via `@/components/ui/toaster`.
- **TypeScript strict mode** (`tsc` via `npm run check`); path aliases `@/*` → `client/src/*`, `@shared/*` → `shared/*`.
- **Migrations** are versioned `supabase/migrations/*.sql`, pushed via `supabase db push` (the `supabase` CLI is a dep, `^2.102.0`). Non-recursive, `set search_path=''`, fully-qualified objects (0001/0002 conventions).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential verification / session issuance | Supabase Auth (GoTrue) | — | Managed auth service; client never sees password hashes. |
| Session persistence + token refresh | Browser / Client (localStorage) | Supabase Auth | supabase-js default `persistSession`/`autoRefreshToken` (D-13). |
| Role storage | Database (`public.profiles.role`) | — | Server-side only; never auth metadata (D-04/AUTH-04). |
| Role *enforcement* (writes) | Database / RLS (`private.is_admin()`) | — | The real trust boundary; client cannot bypass via raw PostgREST. |
| Role *lockdown* (anti-escalation) | Database (BEFORE UPDATE trigger) | RLS policy | `WITH CHECK` can't see OLD row → trigger is canonical (verified). |
| Profile-row creation on signup | Database (`SECURITY DEFINER` trigger on `auth.users`) | — | Trusted server-side insert; a client INSERT policy would let clients forge rows (D-05). |
| Admin-route gating (UX) | Client (route guard) | — | UX layer only; redirects unauthorized users. NOT the security boundary (D-11). |
| Auth state propagation | Client (React context / `useAuth`) | — | `onAuthStateChange` + `getSession`; feeds navbar + guard (D-12). |
| First-admin promotion | Local script (service-role) | Database | Out-of-band; never a code/UI path (D-03). |
| Email delivery (reset link) | Supabase Auth built-in SMTP | — | 2 emails/hr; sufficient for owner-only resets (verified). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | **2.106.2** (installed) | Auth API surface (`signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`, `getSession`, `onAuthStateChange`) | Already the project's only backend client; singleton in `client/src/lib/supabase.ts`. [VERIFIED: package-lock.json + `node -e require(...).version` → 2.106.2] |
| `supabase` (CLI) | ^2.102.0 (installed) | `supabase db push` for migration 0004; local `config.toml` mirrors hosted auth settings | Project's migration toolchain (0001–0003 shipped this way). [VERIFIED: package.json] |
| `wouter` | 3.3.5 | Path-based routing for `/login`, `/register`, `/reset-password`, `/admin/*`; sub-path base already wired | Existing router; path-based (required — Supabase doesn't support hash routers). [VERIFIED: CLAUDE.md + App.tsx] |
| `react-hook-form` + `zod` + `@hookform/resolvers` | 7.66.0 / 3.25.76 / 3.10.0 | Auth forms + inline validation (D-14) | Already deps; project's form convention. [VERIFIED: CLAUDE.md] |
| `sonner` (`@/components/ui/toaster`) | 2.0.7 | Success toasts (D-14) | Already mounted in `App.tsx`. [VERIFIED: App.tsx:33] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Input`/`Button`/`Card`/`Label` | installed | Login/Register/Reset form fields | All three auth pages. [VERIFIED: components.json + ui/ dir] |
| shadcn `DropdownMenu` (or `Sheet`) | installed | Navbar account menu (D-09) | Logged-in menu with Log out; `Sheet` already used in mobile nav. [VERIFIED: Navbar.tsx imports Sheet] |
| `lucide-react` | 0.545.0 | Account/person icon (D-09) | `User` / `CircleUser` icon in navbar. [VERIFIED: CLAUDE.md] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/supabase-js` raw | `@supabase/auth-ui-react` | Pre-built auth widget; rejected — brand wants bespoke low-key UX (D-09), and the project already standardizes on react-hook-form. Adds a dependency for no gain. |
| BEFORE UPDATE trigger (D-04) | Postgres column-level GRANT (column security) | Column GRANT on `role` is global per-role; harder to express "admins may, customers may not" cleanly alongside `is_admin()`. Trigger reuses the existing `private` convention. |
| Built-in email (D-02) | Custom SMTP (Resend/SendGrid) | Custom SMTP raises limits to 30+/hr but adds setup/secrets. Owner-only resets are far under 2/hr — built-in is correct now; documented as easy to upgrade later. |
| React context `useAuth` | TanStack Query for session | Session is a long-lived subscription (`onAuthStateChange`), not a fetch — context fits better and avoids cache-invalidation gymnastics. (Role can still be a Query keyed on user id.) |

**Installation:** No new npm packages required — all dependencies already present. (The bootstrap script reuses `@supabase/supabase-js` and native Node 22 `--env-file`; no `tsx`/`dotenv` needed — `scripts/seed.ts` proves this pattern.)

**Version verification:**
```
@supabase/supabase-js: 2.106.2  [VERIFIED: package-lock.json + node resolution, 2026-05-31]
supabase (CLI):        ^2.102.0 [VERIFIED: package.json devDeps]
```

## Package Legitimacy Audit

> No new external packages are installed in this phase — every library is already a project dependency shipped in prior phases. Legitimacy gate is N/A for new installs.

| Package | Registry | Disposition |
|---------|----------|-------------|
| `@supabase/supabase-js` | npm | Already installed (2.106.2) — no new install. |
| `supabase` (CLI) | npm | Already installed (^2.102.0) — no new install. |
| react-hook-form / zod / @hookform/resolvers / sonner / lucide-react / wouter | npm | All pre-existing deps — no new install. |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new installs).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────────┐
  Browser (static SPA)      │  React app (Vite, base = import.meta.env.    │
  GitHub Pages sub-path     │  BASE_URL; Wouter path router)               │
                            │                                              │
  ┌──────────────┐          │   <AuthProvider> (getSession + onAuthState-  │
  │ /login       │──signIn──┼──▶ Change → {session, user, role, loading})  │
  │ /register    │──signUp──┤        │            │                        │
  │ /reset-pass  │          │        ▼            ▼                        │
  └──────────────┘          │   Navbar account   AdminGuard (D-11/D-12)    │
        │                   │   menu (D-09)        │ loading? → spinner    │
        │ resetPassword     │                      │ no session → /login   │
        │ ForEmail          │                      │   (+ remember dest)   │
        ▼                   │                      │ session, !admin → /    │
   ┌─────────────────┐      │                      │ admin → <Outlet/>      │
   │ Supabase Auth   │      └──────────┬───────────┴───────────────────────┘
   │ (GoTrue)        │                 │ all calls via supabase singleton
   │ - issues JWT    │◀────────────────┘ (anon key)
   │ - sends reset   │
   │   email (2/hr)  │   recovery link → https://<pages-base>/reset-password
   └────────┬────────┘     #access_token=…&type=recovery  (implicit flow,
            │ JWT (role NOT in JWT)     parsed by detectSessionInUrl)
            ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ Postgres + RLS (the real trust boundary)                              │
   │                                                                       │
   │  auth.users  ──INSERT──▶ TRIGGER handle_new_user (SECURITY DEFINER)   │
   │                              └─▶ public.profiles (id,email,name,      │
   │                                  role='customer')                     │
   │                                                                       │
   │  UPDATE public.profiles ─▶ TRIGGER enforce_role_lock (BEFORE UPDATE)  │
   │                              └─▶ raise if new.role<>old.role AND       │
   │                                  not private.is_admin()  (D-04)       │
   │                                                                       │
   │  catalog writes ─▶ products_admin_write USING private.is_admin()      │
   │                    (already live from 0002 — unchanged)               │
   └──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
client/src/
├── lib/
│   └── supabase.ts          # existing singleton (auth calls go through this)
├── auth/                    # new — auth state layer
│   ├── AuthProvider.tsx     # context provider: getSession + onAuthStateChange
│   ├── useAuth.ts           # hook: { session, user, role, loading, signOut }
│   └── AdminGuard.tsx       # D-11/D-12 route guard (loading gate + redirects)
├── pages/
│   ├── Login.tsx            # D-08
│   ├── Register.tsx         # D-08 (email + password + name, D-06)
│   ├── ResetPassword.tsx    # D-02 (request + PASSWORD_RECOVERY update form)
│   └── Admin.tsx            # D-11 empty protected shell
├── components/
│   └── Navbar.tsx           # extend with account icon/menu (D-09)
└── lib/
    └── authErrors.ts        # map Supabase error strings → friendly copy (D-14)

supabase/migrations/
└── 0004_auth_profiles.sql   # name col + role-lock + handle_new_user trigger

scripts/
└── promote-admin.ts         # service-role bootstrap (mirror seed.ts) (D-03)
```

### Pattern 1: `handle_new_user` SECURITY DEFINER trigger (D-05/D-06)
**What:** A trigger on `auth.users` AFTER INSERT inserts the matching `public.profiles` row. Replaces a client INSERT policy (which would let clients forge rows).
**When to use:** Always, for this project's signup. Must follow the 0001 conventions (`set search_path=''`, fully-qualified, non-recursive — the function bypasses `profiles` RLS by being SECURITY DEFINER).
**Example (adapt — pick `name` vs `full_name` per D-06 discretion; using `name`):**
```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data (canonical pattern)
-- Adapted to 0001 conventions: fully-qualified, locked search_path.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',   -- passed via signUp options.data.name (D-06)
    'customer'                            -- role NEVER taken from client metadata (D-04)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```
**Note:** `role` is hard-coded `'customer'` in the trigger — never read from `raw_user_meta_data` (a client could otherwise inject `role:'admin'` at signUp). [VERIFIED: docs pattern; security reasoning per D-04/D-05]

### Pattern 2: Role-lockdown — BEFORE UPDATE trigger (D-04, RECOMMENDED mechanism)
**What:** Prevent a non-admin from changing their own `role` while still allowing self-update of `name`/`email`.
**Why a trigger and not WITH CHECK:** Postgres RLS `WITH CHECK` evaluates only the **NEW** row — it has no access to the OLD row, so it cannot express "role must equal its previous value." The two viable patterns are (a) a `BEFORE UPDATE` trigger comparing `new.role <> old.role`, or (b) splitting `role` into a separate table. (a) is the least invasive given the existing single-table design. [VERIFIED: Postgres RLS semantics + Supabase RLS docs + supabase discussion #656]
**Example:**
```sql
-- Keep profiles_self_update (USING/WITH CHECK on auth.uid()=id) so customers
-- can still UPDATE their own row (name/email). Add a trigger to veto role changes.
create function public.enforce_profile_role_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'role change not permitted';
  end if;
  return new;
end;
$$;

create trigger profiles_role_lock
  before update on public.profiles
  for each row execute procedure public.enforce_profile_role_lock();
```
**Outcome (D-04 required):** a customer calling `update profiles set role='admin' where id = auth.uid()` is rejected; `update profiles set name='X' where id = auth.uid()` succeeds; an admin (or the service-role bootstrap script, which bypasses RLS but still fires the trigger — `private.is_admin()` returns true for an admin caller, and the service-role key sets no `auth.uid()` so handle this case — see Pitfall 4) can change roles. The existing `profiles_self_update` policy stays; the trigger is the column-lock. [VERIFIED reasoning]

### Pattern 3: `useAuth` context with a resolved loading gate (D-12)
**What:** On mount, call `getSession()` (reads localStorage, no network unless expired) to seed state, then subscribe to `onAuthStateChange`. Expose `loading` true until the first resolution so the guard never flashes admin UI or wrongly bounces a refreshing admin.
**Example:**
```ts
// Source: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
//         + .../auth-getsession  (supabase-js v2)
useEffect(() => {
  let mounted = true;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (mounted) { setSession(session); setLoading(false); }
  });
  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);          // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / INITIAL_SESSION / PASSWORD_RECOVERY
      setLoading(false);
    });
  return () => { mounted = false; subscription.unsubscribe(); };
}, []);
```
Fetch `role` separately (e.g. a `select role from profiles where id = user.id` keyed on the user id) and fold its loading into the guard's loading state. [VERIFIED: official docs; events list confirmed including INITIAL_SESSION + PASSWORD_RECOVERY]

### Pattern 4: Password reset — implicit flow on a static SPA (D-02)
**What:** Two-step flow. (1) Request: `resetPasswordForEmail(email, { redirectTo })`. (2) The email link lands on `/reset-password` with the recovery token in the **URL hash fragment** (`#access_token=…&refresh_token=…&type=recovery`). supabase-js (default `detectSessionInUrl:true`, default `flowType:'implicit'` for JS) parses the fragment automatically and fires a `PASSWORD_RECOVERY` event; the app then renders a "set new password" form calling `updateUser({ password })`.
**Example:**
```ts
// Source: https://supabase.com/docs/guides/auth/passwords + discussion #3360
// Step 1 (request) — base-aware redirect for the GitHub Pages sub-path:
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: new URL(
    import.meta.env.BASE_URL.replace(/\/$/, '') + '/reset-password',
    window.location.origin
  ).toString(),
});

// Step 2 (on /reset-password): listen, then update.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') setShowNewPasswordForm(true);
});
// on submit:
await supabase.auth.updateUser({ password: newPassword });
```
**GitHub Pages sub-path + 404.html note:** GitHub Pages serves `404.html` (a copy of `index.html`) for any unknown path, so a deep link to `/<base>/reset-password` boots the SPA; the **hash fragment is preserved by the browser across the 404→SPA load** (fragments are never sent to the server and survive client-side navigation), so `detectSessionInUrl` still sees the token. Wouter is path-based — good; **do not** introduce a hash router (Supabase implicit flow is incompatible). [VERIFIED: implicit-flow + detectSessionInUrl docs; hash-router incompatibility stated by Supabase maintainers in discussion #3360]

### Anti-Patterns to Avoid
- **Client INSERT policy on `profiles`** to "create the row from the app." Lets a client forge arbitrary profile rows (including someone else's id). Use the D-05 trigger. (Migration 0002 deliberately omits this policy.)
- **Storing `role` in `auth.users.raw_user_meta_data` or the JWT.** Metadata is user-editable → instant privilege escalation. `role` lives only in `public.profiles` (D-04/AUTH-04).
- **Reading `role` from the trigger's `raw_user_meta_data`.** Same escalation vector at signup time — hard-code `'customer'`.
- **`WITH CHECK (new.role = old.role)`** — invalid; `WITH CHECK` cannot reference OLD. Use the BEFORE UPDATE trigger.
- **Guard that decides before `loading` resolves.** Flashes admin UI or bounces a refreshing admin to `/login` (D-12). Always gate on `loading`.
- **Open redirect on the post-login "return to" destination (D-10).** Only ever redirect to **same-origin internal paths**; never to a fully-qualified URL taken from a query param. Validate the stored destination is a leading-slash relative path.
- **`VITE_`-prefixing the service-role key** in the bootstrap script. Vite inlines it into the public bundle. Use plain `process.env.SUPABASE_SERVICE_ROLE_KEY` (mirrors `scripts/seed.ts`); `scripts/check-no-secret.sh` guards `dist/`.
- **Hash-based router** to make GitHub Pages deep links work. Breaks Supabase implicit flow. Keep Wouter path-based + 404.html.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing / credential check | Custom bcrypt + login endpoint | `supabase.auth.signInWithPassword` | GoTrue manages hashing, salting, timing-safe compare. |
| Session persistence + token refresh | Manual localStorage + refresh timer | supabase-js defaults (`persistSession`/`autoRefreshToken`) | Built-in background refresh; D-13 is literally the default. |
| Password-reset token generation/validation | Custom token table + email | `resetPasswordForEmail` + `updateUser` | GoTrue issues + validates the recovery token; email templated + rate-limited. |
| Role-check function | Inline `select role from profiles` in every policy | existing `private.is_admin()` | Non-recursive, SECURITY DEFINER, locked search_path — already shipped (0001). |
| "Is this email taken?" check | Pre-flight query | Let `signUp` return the error, map it (D-14) | Avoids a user-enumeration endpoint; GoTrue handles it. |
| Profile-row creation | Client INSERT after signUp | `handle_new_user` DB trigger | Atomic with user creation; can't be skipped or forged. |

**Key insight:** Auth correctness in this project is overwhelmingly a **database** concern (RLS + triggers), not a frontend concern. The frontend's only security-relevant job is "don't leak the service-role key" and "don't open-redirect." Everything that actually gates access is enforced in Postgres and survives a malicious client using the raw anon key against PostgREST.

## Runtime State Inventory

> This phase is mostly additive (new migration + new frontend), but it **amends live RLS** and adds DB triggers, so runtime/DB state matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public.profiles` rows already exist for any users created before migration 0004. **None expected** (auth not wired yet — no signup path exists pre-Phase-3). The owner's first registration happens *after* the trigger ships. | Verify `select count(*) from auth.users` is 0 (or only test users) before relying on the trigger; the trigger only fires on **new** inserts, so any pre-existing `auth.users` row would have **no** profile row. If test users exist, backfill or delete them. |
| Live service config (hosted, not in git) | **Supabase Dashboard Auth settings:** (1) "Confirm email" toggle (D-01) — must be set OFF in the hosted project; (2) **Site URL** + **Redirect URLs** allowlist (D-02) — must include the GitHub Pages sub-path `/reset-password` URL. `supabase/config.toml` already has `enable_confirmations=false` and `email_sent=2` **locally**, but the **hosted** project settings are the source of truth at runtime and are NOT in git. | Manual dashboard config (Authentication → Sign In / Providers → Email; URL Configuration). Document exact values. Confirm whether `config.toml` is applied via `supabase db push`/`supabase config push` or whether the hosted toggles must be set by hand. |
| OS-registered state | None. | None — verified (no OS-level auth state). |
| Secrets / env vars | `SUPABASE_SERVICE_ROLE_KEY` already present in `.env.seed.local` (gitignored) for the Phase 2 seed; the promote-admin script reuses the same non-`VITE_` runtime var. `.env.local` holds `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for the client. | No new secret keys; the bootstrap script reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from a runtime env-file (mirror `.env.seed.local`). Ensure the new script's env-file is gitignored (it is — `supabase/.gitignore` + root `.gitignore` cover `.env*.local`). |
| Build artifacts / installed packages | None relevant — no new package install; `scripts/` is not bundled into `dist/`. | None. `check-no-secret.sh` already verifies `dist/` is clean of `service_role`. |

**The canonical question — after every file is updated, what runtime systems still hold state?** The **hosted Supabase Dashboard Auth config** (email-confirm OFF + Site URL/redirect allowlist) is the one piece of required runtime state that is NOT captured by the migration or any committed file. It must be set manually and documented; otherwise reset links 404 / redirect-reject and confirmation gating won't match D-01.

## Common Pitfalls

### Pitfall 1: redirectTo not in the allowlist → reset link rejected
**What goes wrong:** `resetPasswordForEmail({ redirectTo })` silently falls back to Site URL (or errors) if `redirectTo` isn't in the project's Redirect URLs allowlist.
**Why it happens:** Supabase only redirects to **exact** allowlisted URLs. The GitHub Pages URL is a sub-path (`https://<user>.github.io/<repo>/reset-password`), easy to get wrong.
**How to avoid:** Add the exact production reset URL (and any preview/local URLs) to Authentication → URL Configuration → Redirect URLs. Set Site URL to the production base. Build `redirectTo` from `import.meta.env.BASE_URL` + `window.location.origin` so it matches.
**Warning signs:** After clicking the email link the user lands on the home page (Site URL) instead of `/reset-password`, or sees a redirect error.

### Pitfall 2: Guard decides before session loads → admin bounced on refresh
**What goes wrong:** On a hard refresh, `getSession` hasn't resolved yet; the guard sees `session=null` and redirects a real admin to `/login`.
**Why it happens:** Session restoration from localStorage is async; `onAuthStateChange` fires `INITIAL_SESSION` after mount.
**How to avoid:** D-12 loading gate — render a spinner/skeleton while `loading` is true; only redirect once both session **and** role are resolved.
**Warning signs:** Admin gets kicked to login on F5; admin UI flashes then disappears.

### Pitfall 3: `WITH CHECK` can't lock the role column
**What goes wrong:** Planner tries `with check (role = old_role)` or assumes the existing `profiles_self_update` policy is enough; customer can still escalate.
**Why it happens:** RLS WITH CHECK only sees the NEW row; the current self-update policy permits any column change for the owner.
**How to avoid:** BEFORE UPDATE trigger (Pattern 2). Add an explicit anti-escalation manual test (see Validation Architecture).
**Warning signs:** `update profiles set role='admin' where id=auth.uid()` succeeds under the anon key.

### Pitfall 4: Trigger blocks signup / fails silently
**What goes wrong:** An error in `handle_new_user` (e.g. unqualified table name under empty search_path, NOT NULL violation, or the role-lock trigger firing during the service-role promote) aborts the `auth.users` insert → signup fails with an opaque error.
**Why it happens:** The trigger runs inside the signup transaction. With `search_path=''` every reference must be fully-qualified (`public.profiles`). Also: the `profiles_role_lock` trigger fires for the **service-role** promote script too — the service role bypasses RLS but is not "admin" via `auth.uid()` (no JWT), so `private.is_admin()` returns false and the trigger would block the legitimate promotion.
**How to avoid:** Fully-qualify every object (matches 0001). For the promote case, either (a) have the script `update` via a path that the trigger allows — e.g. the trigger should permit the change when `auth.uid()` is null (service-role / no JWT context) — or (b) have the script call a `SECURITY DEFINER` RPC. **Recommended:** make `enforce_profile_role_lock` allow the change when the caller is admin **or** there is no `auth.uid()` (service-role bootstrap). Verify on a throwaway user before relying on it.
**Warning signs:** "Database error saving new user" on signup; promote script errors with "role change not permitted".

### Pitfall 5: Built-in email only delivers to team members / 2-per-hour cap
**What goes wrong:** Reset emails to non-team addresses bounce, or rapid testing hits the 2/hr cap → "email rate limit exceeded."
**Why it happens:** Supabase's built-in/shared email service is restricted (intended for development): ~2 emails/hour and, on the shared sender, deliverability is limited; production deliverability really wants custom SMTP.
**How to avoid (per D-02 decision = stay on built-in):** Fine for the owner's own occasional reset. During testing, space out reset requests, or test against the owner's email which is the project team email. Document that if customer-facing reset volume grows, switch to custom SMTP (Resend/SendGrid/Mailgun free tiers) — Authentication → Emails → SMTP Settings.
**Warning signs:** "For security purposes, you can only request this after N seconds" / "email rate limit exceeded"; emails to non-team addresses never arrive.

### Pitfall 6: Open redirect on the post-login destination (D-10)
**What goes wrong:** Storing the "return to" destination and redirecting to it blindly lets `?next=https://evil.com` phish users post-login.
**Why it happens:** Naive `redirect(params.get('next'))`.
**How to avoid:** Only store/redirect to **internal, leading-slash** paths; reject anything that parses as an absolute URL or starts with `//`. Default to `/` on anything suspicious.
**Warning signs:** A `next`/`returnTo` value that contains `://` or starts with `//`.

## Code Examples

### Sign up with name metadata (D-01/D-06)
```ts
// Source: https://supabase.com/docs/reference/javascript/auth-signup (v2)
const { data, error } = await supabase.auth.signUp({
  email,
  password,                         // >= 6 chars (D-07; matches minimum_password_length)
  options: { data: { name } },      // → new.raw_user_meta_data->>'name' in the trigger
});
// Email confirmation OFF (D-01) → data.session is non-null immediately; user is logged in.
```

### Sign in / sign out (AUTH-02/AUTH-03)
```ts
const { error } = await supabase.auth.signInWithPassword({ email, password });
// ...
await supabase.auth.signOut();      // clears localStorage session; onAuthStateChange → SIGNED_OUT
```

### Bootstrap promote-admin (D-03) — mirror `scripts/seed.ts`
```ts
// Run: node --env-file=.env.promote.local scripts/promote-admin.ts owner@example.com
// Source pattern: scripts/seed.ts (native Node 22 --env-file, no tsx/dotenv)
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;                  // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;  // never VITE_, never committed
if (!url || !serviceKey) { console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const email = process.argv[2];
if (!email) { console.error('FAIL: usage: promote-admin <email>'); process.exit(1); }
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
// idempotent: set role=admin for the profile matching the email (no-op if already admin)
const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('email', email);
if (error) { console.error(`FAIL: ${error.message}`); process.exit(1); }
console.log(`OK: ${email} is now admin (idempotent).`);
```
*(Note Pitfall 4: the `profiles_role_lock` trigger must permit this service-role update — design the trigger to allow when `auth.uid()` is null.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supabase.auth.session()` / `.user()` (v1, sync) | `getSession()` / `getUser()` (async, v2) | supabase-js v2 (2022) | Use async getters; the project is on 2.106.2. |
| `auth-helpers` packages | `@supabase/ssr` (for SSR) | 2023–2024 | **Not needed here** — this is a pure client SPA, the base `supabase-js` client is correct. Don't pull in `@supabase/ssr`. |
| Implicit flow tokens in hash | PKCE flow (default for `@supabase/ssr`) | ongoing | This SPA uses base `supabase-js` → **implicit flow is the default**; reset token arrives in the URL hash. PKCE is for server-side/SSR. |

**Deprecated/outdated:**
- v1 sync `session()`/`user()` — replaced by async `getSession`/`getUser`.
- `@supabase/auth-helpers-*` — superseded by `@supabase/ssr`; neither is needed for a client-only SPA.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Built-in email cap is **2 emails/hour** and the shared sender is restricted to team addresses unless custom SMTP is configured. | Pitfall 5 / Alternatives | Low — matches `config.toml email_sent=2`; if hosted differs, only affects reset-email testing cadence. Verify the exact hosted number in Authentication → Rate Limits. |
| A2 | The hosted Supabase Dashboard requires manually setting "Confirm email" OFF + Site URL/Redirect URLs, i.e. `config.toml` alone does not push these to the hosted project. | Runtime State Inventory / Pitfall 1 | Medium — if `config.toml` *is* applied to hosted via CLI in this project's workflow, the manual step is redundant (harmless). Confirm whether the project uses `supabase config` push to hosted or sets toggles by hand. |
| A3 | The `profiles_role_lock` trigger fires for the service-role promote script and `auth.uid()` is null in that context, so the trigger must explicitly allow null-uid (service-role) updates. | Pitfall 4 / Pattern 2 | Medium — if not handled, the legitimate promote script is blocked. Mitigation is in Pattern 2 / Pitfall 4; verify on a throwaway user. |
| A4 | Wouter's path-based routing + GitHub Pages 404.html preserves the URL hash fragment across the SPA boot so `detectSessionInUrl` sees the recovery token. | Pattern 4 | Medium — fragments are preserved by browsers across client navigation generally; the 404→index hop is a server 404 response whose body is index.html, served at the *same* URL incl. fragment, so it holds. Validate with the live reset round-trip (Validation Architecture). |
| A5 | supabase-js v2 (JS) default `flowType` is `implicit` and `detectSessionInUrl` defaults true (no explicit `createClient` options needed). | Pattern 4 / State of the Art | Low — documented default; if a future need arises, pass `{ auth: { flowType: 'implicit', detectSessionInUrl: true } }` explicitly. |

## Open Questions

1. **Does this project push `config.toml` auth settings to the hosted project, or are hosted Auth toggles set by hand?** (A2)
   - What we know: `config.toml` has `enable_confirmations=false`, `email_sent=2`, `site_url`/`additional_redirect_urls` (currently localhost). The hosted project is what serves real auth at runtime.
   - What's unclear: whether the workflow applies `config.toml` to hosted (some teams only use it for local `supabase start`).
   - Recommendation: Plan should include an explicit "set hosted Auth config" task (dashboard) AND update `config.toml`'s `site_url`/`additional_redirect_urls` for parity. Treat the dashboard as source of truth at runtime.

2. **`name` vs `full_name` column name** (D-06 discretion).
   - Recommendation: use `name` (matches existing `customization_submissions.name`, simpler); keep it consistent across the trigger and Phase 5.

3. **Exact GitHub Pages production URL** for the redirect allowlist (depends on repo/user/custom domain).
   - Recommendation: Planner must capture the real deployed origin + base when configuring the redirect allowlist; build `redirectTo` from `window.location.origin + import.meta.env.BASE_URL`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | all auth calls | ✓ | 2.106.2 | — |
| `supabase` CLI | `db push` migration 0004 | ✓ (dep) | ^2.102.0 | — |
| Node 22 `--env-file` | promote-admin script (no dotenv) | ✓ | Node 22 (CI + local; seed.ts uses it) | — |
| react-hook-form / zod / sonner / shadcn / lucide | auth forms + UI | ✓ | per CLAUDE.md | — |
| Hosted Supabase project (Auth enabled) | live signup/login/reset | assumed ✓ (Phases 1–2 shipped against it) | — | — |
| Custom SMTP | higher email volume | ✗ (not configured) | — | Built-in email (2/hr) — sufficient per D-02 |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Custom SMTP not configured — built-in email is the intended choice (D-02); fallback is documented if volume grows.

## Validation Architecture

> `nyquist_validation: true` and **no automated test framework exists** (CLAUDE.md: "Testing — Not detected"). Validation is (1) the existing `psql` RLS-assertion harness pattern (`supabase/tests/rls_assertions.sql`) extended for the new invariants, and (2) explicit manual round-trips. There is no jest/vitest config and none is introduced this phase.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (no jest/vitest). DB invariants asserted via `psql` `DO $$…$$` blocks (existing pattern). Frontend validated manually. |
| Config file | none — see Wave 0 |
| DB-invariant run command | `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/auth_rls_assertions.sql` |
| Frontend validation | Manual checklist in a dev/preview build |

### Phase Requirements → Validation Map
| Req | Behavior | Type | Command / Steps | Exists? |
|-----|----------|------|------------------|---------|
| AUTH-01 | Register creates a `customer` profile row | DB + manual | Register a new user via `/register`; then `psql … "select role,name,email from public.profiles where email='<x>'"` → expect one row, `role='customer'`, name populated. | ❌ Wave 0 (new assertion + manual) |
| AUTH-01 | Email confirmation OFF → immediate session | manual | After register, `data.session` non-null and navbar shows logged-in menu without an email step. | ❌ manual |
| AUTH-02 | Session persists across restart | manual | Log in, hard-refresh and reopen the tab/browser → still logged in (localStorage session). | ❌ manual |
| AUTH-03 | Log out from any page | manual | From `/shop` (or any route), open account menu → Log out → navbar reverts to logged-out; `getSession` null. | ❌ manual |
| AUTH-04 | Catalog write denied to customer | DB | As a logged-in **customer** (anon key + their JWT), `insert into products …` / `update products …` → **rejected** by RLS (`products_admin_write` USING `is_admin()`). Assert via a customer-JWT PostgREST call or a `set role` simulation. | ❌ Wave 0 |
| AUTH-04 | **Role self-escalation denied** (D-04 core) | DB | As a customer JWT: `update profiles set role='admin' where id=auth.uid()` → **rejected** (BEFORE UPDATE trigger). Then `update profiles set name='Test' where id=auth.uid()` → **succeeds** (non-privileged field still editable). | ❌ Wave 0 — primary security gate |
| AUTH-04 | Admin can write catalog | DB/manual | After promote-admin, the admin user can `insert/update products` (RLS allows). | ❌ manual |
| AUTH-05 | Admin route guarded | manual | (a) Logged-out → `/admin` redirects to `/login`, remembers `/admin`; after admin login lands back on `/admin` (D-10). (b) Logged-in **customer** → `/admin` redirects to `/` (no 403 page, D-11). (c) Admin → `/admin` renders the empty shell (D-12: spinner during load, no flash/bounce on refresh). | ❌ manual |
| D-02 | Reset round-trip on the sub-path | manual | From `/login`, request reset for the owner email → receive email → click link → lands on `/<base>/reset-password` with `PASSWORD_RECOVERY` firing → set new password via `updateUser` → log in with the new password. | ❌ manual (built-in email, ≤2/hr) |
| D-03 | Bootstrap is idempotent + no leak | script + DB | Run `promote-admin` twice → second run is a no-op; `profiles.role='admin'`. Run `scripts/check-no-secret.sh` → PASS (no `service_role` in `dist/`). | ❌ Wave 0 |

### SQL / psql proofs (extend the existing harness)
New file `supabase/tests/auth_rls_assertions.sql` (mirrors `rls_assertions.sql` `DO $$…$$ raise exception` style) asserting:
1. `public.profiles` has a `name` column (`information_schema.columns`).
2. `public.handle_new_user` exists, `prosecdef=true`, locked `search_path` in `proconfig`; trigger `on_auth_user_created` exists on `auth.users`.
3. `public.enforce_profile_role_lock` (or chosen name) exists with a BEFORE UPDATE trigger on `public.profiles`.
4. Functional escalation check (run as a customer JWT context, e.g. via `set local role authenticated` + `set local request.jwt.claims`): a role change is rejected; a name change succeeds. *(If simulating JWT claims is impractical in psql, this becomes the manual AUTH-04 step above against the live PostgREST endpoint with a customer token.)*
5. Still no anon/public INSERT policy on `profiles` (invariant carried from `rls_assertions.sql` #3 — the trigger, not a policy, creates rows).

### Sampling Rate
- **Per task commit:** `npm run check` (tsc) for frontend tasks; `psql … -f supabase/tests/auth_rls_assertions.sql` after the migration task.
- **Per slice / wave merge:** Full manual checklist for that slice (e.g. the register slice runs AUTH-01 steps; the role-lock slice runs the AUTH-04 escalation proof).
- **Phase gate:** `auth_rls_assertions.sql` green + `rls_assertions.sql` still green + `check-no-secret.sh` PASS + the full manual checklist (register→row, customer-blocked-from-catalog-and-escalation, admin-reaches-/admin, reset round-trip on the sub-path) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `supabase/tests/auth_rls_assertions.sql` — new DB-invariant harness (mirror `rls_assertions.sql`).
- [ ] A documented manual validation checklist (the table above) — no UI test framework is introduced this phase.
- [ ] Decide the customer-JWT simulation approach for the escalation proof (psql `set local request.jwt.claims` vs live PostgREST call with a real customer token). Recommend the live PostgREST call against the hosted project for a true end-to-end proof under the anon key.

## Security Domain

> `security_enforcement: true`, ASVS L1, block-on: high. This is an auth phase — security IS the deliverable.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) — managed password hashing, login, recovery. Min length 6 (D-07). Don't hand-roll. |
| V3 Session Management | yes | supabase-js JWT in localStorage, auto-refresh + rotation (`config.toml enable_refresh_token_rotation=true`); `signOut` clears it. |
| V4 Access Control | yes | RLS `private.is_admin()` for catalog writes; BEFORE UPDATE trigger for role lock (D-04); UI guard is UX-only (D-11). |
| V5 Input Validation | yes | Zod schemas on all auth forms (email format, password length matching server) (D-14). |
| V6 Cryptography | no (delegated) | All crypto (password hash, token signing) handled by GoTrue — never hand-rolled. Service-role key kept out of the client bundle. |
| V1/V7 (redirect/logging) | partial | Open-redirect prevention on the D-10 destination; map auth errors without leaking which factor failed (avoid user enumeration). |

### Known Threat Patterns for Supabase-direct SPA auth
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via role self-edit (`update profiles set role='admin'`) | Elevation of Privilege | BEFORE UPDATE trigger rejecting non-admin role changes (D-04, Pattern 2). **Primary threat — proven by the AUTH-04 escalation test.** |
| Profile-row forgery via client INSERT | Tampering / Spoofing | No client INSERT policy on `profiles`; rows created only by the SECURITY DEFINER trigger (D-05). |
| Role injection at signup via `raw_user_meta_data.role` | Elevation of Privilege | Trigger hard-codes `role='customer'`; never reads role from metadata. |
| Service-role key leakage in the bootstrap script | Information Disclosure | Non-`VITE_` runtime env var; script never imported by client; `check-no-secret.sh` scans `dist/`. |
| Password-reset link / redirect abuse (open redirect, wrong host) | Spoofing / Tampering | Exact Redirect URLs allowlist (Site URL + sub-path `/reset-password`); `redirectTo` built from same origin. |
| Open redirect on post-login "return to" (D-10) | Spoofing | Only redirect to internal leading-slash paths; reject absolute/`//` URLs. |
| Admin-area existence disclosure | Information Disclosure | No 403 page; non-admins redirected to `/` (D-11). |
| User enumeration via auth errors | Information Disclosure | Map errors to generic friendly copy; don't reveal "email not found" vs "wrong password" distinctly (D-14). |
| JWT does not carry role → relies on DB lookup | (design note) | Role is read from `profiles`, enforced by RLS — a tampered client JWT can't grant admin because RLS re-checks via `is_admin()` server-side. |
| Token in URL hash on reset (implicit flow) | Information Disclosure | Hash fragments aren't sent to servers/logs; clear the URL after `PASSWORD_RECOVERY` handling (replaceState) to avoid leaving the token in history. |

## Sources

### Primary (HIGH confidence)
- Codebase: `client/src/lib/supabase.ts`, `client/src/App.tsx`, `client/src/components/Navbar.tsx`, `supabase/migrations/0001_init_schema.sql`, `0002_rls_policies.sql`, `supabase/tests/rls_assertions.sql`, `scripts/seed.ts`, `scripts/check-no-secret.sh`, `supabase/config.toml`, `.github/workflows/deploy.yml`, `package.json` / `package-lock.json` — read directly this session.
- https://supabase.com/docs/guides/auth/managing-user-data — canonical `handle_new_user` trigger SQL (verbatim).
- https://supabase.com/docs/guides/auth/passwords — reset flow (`resetPasswordForEmail` + `updateUser`), email-confirmation effect on signUp session.
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange + /auth-getsession — session lifecycle, events (INITIAL_SESSION/PASSWORD_RECOVERY), getSession reads localStorage.
- https://supabase.com/docs/guides/auth/sessions/implicit-flow + /pkce-flow — implicit is JS default; token in URL hash; PKCE for SSR only.
- https://supabase.com/docs/guides/auth/rate-limits — email rate limit variable + custom-SMTP requirement.
- https://supabase.com/docs/guides/database/postgres/row-level-security + /column-level-security — RLS WITH CHECK semantics; column-lock approaches.

### Secondary (MEDIUM confidence)
- https://github.com/orgs/supabase/discussions/3360 — SPA password-recovery flow, hash fragment, hash-router incompatibility (maintainer comments).
- https://github.com/orgs/supabase/discussions/656 — column-limited update policy / BEFORE UPDATE trigger pattern.
- https://supabase.com/docs/guides/auth/auth-smtp — custom SMTP 30/hr, provider takeover.

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Exact hosted built-in email cap number (A1) — config.toml shows 2; confirm in hosted Rate Limits.
- Whether hosted picks up `config.toml` vs manual dashboard (A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from lockfile + node resolution; all deps already present.
- Architecture / RLS / triggers: HIGH — patterns cross-checked against official docs AND the project's existing 0001/0002 conventions.
- Password-reset on GitHub Pages sub-path: MEDIUM-HIGH — flow verified from docs; the 404.html+fragment interaction (A4) should be confirmed by the live round-trip in validation.
- Hosted Auth config mechanism: MEDIUM — A2 open question; planner should include an explicit dashboard-config task.

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (Supabase Auth is stable; supabase-js v2 API steady. Re-verify if upgrading supabase-js major or switching to `@supabase/ssr`.)
