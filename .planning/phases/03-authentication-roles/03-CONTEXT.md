# Phase 3: Authentication & Roles - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the auth trust boundary the whole milestone depends on. This phase delivers:

1. **Customer self-registration + login + logout** (AUTH-01, AUTH-02, AUTH-03) via Supabase Auth — email/password, sessions that persist across browser restarts, logout reachable from any page.
2. **Auto-created `customer` profile row on signup** (success criterion #1) — a `profiles` row defaulting to `role = 'customer'` is created for every new user.
3. **Server-side role enforcement** (AUTH-04) — roles live only in `public.profiles` (never user-editable auth metadata), and the existing default-deny RLS (migration 0002, which already calls `private.is_admin()`) is the real enforcement. This phase closes the one gap that currently lets a user edit their own `role`.
4. **Protected admin routes** (AUTH-05) — an `/admin/*` namespace guarded in the UI, redirecting non-admins/logged-out users away (UX backing for RLS).
5. **First-admin bootstrap out-of-band** (success criterion #5) — a local script promotes a designated email to admin; no self-serve path to admin exists.
6. **Password reset** ("forgot password") flow — added this phase (user decision), which pulls in Supabase Site URL / redirect-allowlist configuration for the GitHub Pages sub-path.

**Out of scope (later phases):** the admin portal screens themselves and what admins manage (Phase 4); wishlist, customer profile page, submission history, native questionnaire (Phase 5). This phase builds login/identity/roles and the *empty* protected `/admin` shell + guard — not the portal's content.

Covers requirements **AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05**.

</domain>

<decisions>
## Implementation Decisions

### Email Confirmation & Password Reset
- **D-01:** **Email confirmation is OFF** — a new user is logged in immediately after registering (no verify-email gate). Rationale: smoothest onboarding for a small handmade brand with no checkout gating money; lower friction = more accounts. Set in Supabase Auth settings ("Confirm email" disabled). Tradeoff accepted: typo'd/fake emails can create dead accounts.
- **D-02:** **Password reset ("forgot password") IS in scope this phase.** This is the only email-dependent flow we keep. Consequence: Supabase **Site URL + redirect allowlist must be configured** so the reset link returns to a `/reset-password` (name = planner discretion) page on the SPA, accounting for the GitHub Pages **sub-path base** (`import.meta.env.BASE_URL`, see `client/src/App.tsx:15`) and the 404.html SPA deep-link fallback. **VERIFY (researcher):** current Supabase Auth URL-config setting names, the built-in email rate limit for reset emails, and whether the low reset volume is fine on built-in email or warrants custom SMTP.

### First Admin Bootstrap & Role Lockdown
- **D-03:** **First admin via a local bootstrap script** — e.g. `scripts/promote-admin.ts <email>` (name/location = planner discretion) run locally with the **service-role key**, never bundled into the client, never a `VITE_`-prefixed var. The owner registers normally (gets a `customer` profile row), then runs the script to set `role = 'admin'`. No code path or UI ever grants admin (success criterion #5). The script must be idempotent/safe to re-run and document the required env clearly.
- **D-04:** **Role column locked at the RLS layer** so a customer cannot escalate themselves. The current `profiles_self_update` policy (migration `supabase/migrations/0002_rls_policies.sql`) permits a user to update their own row including `role`. **Tighten the self-update path so `role` cannot be changed by a non-admin via any client call** (anon key + raw PostgREST included). Mechanism (column-scoped policy/WITH-CHECK vs equivalent) = researcher/planner discretion; **required outcome:** a `customer` calling `update profiles set role='admin' where id = auth.uid()` is rejected. Customers may still self-update non-privileged fields (e.g. name, email).
- **D-05:** **Profile row auto-created via a SECURITY DEFINER trigger on `auth.users`** (e.g. `handle_new_user`), NOT a client-side INSERT policy on `profiles` (an insert policy would let clients forge arbitrary profile rows). Migration 0002 deliberately has **no `profiles` INSERT policy** ("Phase 3 wires signup row creation"). The trigger inserts `id`, `email`, `role='customer'`, and the name (see D-06). **VERIFY (researcher):** the standard non-recursive `handle_new_user` trigger pattern and locked `search_path`, consistent with the existing `private.is_admin()` conventions in migration 0001.

### Registration Fields
- **D-06:** **Signup collects email + password + name.** Add a **`name` column to `public.profiles`** via a new versioned migration this phase (nullable text). Name is passed at `signUp` time via `options.data` (user metadata) and copied into `profiles` by the D-05 trigger. Rationale: the admin needs to recognize who submitted a customization request (Phase 4 inbox) and Phase 5's profile page needs a name to show. (Name in user_metadata being user-editable is fine — name is not a trust boundary like `role`.)

### Password Rules
- **D-07:** **Keep Supabase's default minimum password length (6 characters)**, no composition/complexity rules. Low-stakes accounts (no payment data); easy to tighten later. Client-side validation should match whatever Supabase enforces to avoid mismatched error states.

### Auth UX Surface
- **D-08:** **Dedicated `/login` and `/register` routes**, rendered inside the existing `Layout` (Wouter routes added to `client/src/App.tsx`). Deep-linkable, easy for the admin guard to redirect into, works with the GitHub Pages 404.html SPA fallback. (Plus a `/reset-password` route for D-02.)
- **D-09:** **Navbar account entry = an account/person icon + menu** (alongside the existing social icons in `client/src/components/Navbar.tsx`). Logged-out: links to `/login`. Logged-in: menu exposing **Log out** (reachable from any page → satisfies AUTH-03), with room to add Wishlist/Profile in Phase 5. Discreet but discoverable.
- **D-10:** **After login, return the user to where they came from** / the protected page they were sent from (e.g. a non-admin redirected from `/admin` lands back at `/admin` after logging in as admin; a customer logging in from the shop returns to the shop). The admin guard must track the intended destination to support this.

### Admin Route Protection
- **D-11:** **`/admin/*` route namespace** with a UI guard. **Logged-out** users hitting a protected route → redirect to `/login` with the `/admin` destination remembered (D-10). **Logged-in non-admins** (customers) → redirect to **home** (`/`). **No 403 "access denied" page** — it would advertise that an admin area exists. RLS is the real enforcement; this guard is the UX layer. This phase ships an *empty* protected `/admin` shell to prove the guard; portal content is Phase 4.
- **D-12:** **Guard renders a loading state until the Supabase session + role check resolves**, then shows the page or redirects. Prevents both (a) flashing admin UI before the role check completes and (b) wrongly bouncing a real admin to login on refresh (the session loads async from localStorage). Standard SPA auth-guard behavior.

### Session Persistence & Feedback
- **D-13:** **Always persist the session + auto-refresh** (Supabase default: session in localStorage, token auto-refresh). Users stay logged in across refreshes and browser restarts until explicit logout — directly satisfies AUTH-02. **No "remember me" toggle.**
- **D-14:** **Inline form errors + success toasts.** Auth errors (wrong password, email already registered, weak password, network) render **inline on the form** near the relevant field (react-hook-form). Successes (registered / logged in / logged out / reset email sent) fire a **Sonner toast** (existing `@/components/ui/toaster`). Map common Supabase Auth error messages to friendly copy.

### Claude's / Researcher's Discretion
- Exact route/file names (`/reset-password` page name, `scripts/promote-admin.ts` location), the auth state container (e.g. a React context + `useAuth` hook wrapping `supabase.auth.onAuthStateChange` and `getSession`), and the route-guard component shape.
- The precise RLS expression that locks `role` (D-04) and the exact `handle_new_user` trigger SQL (D-05) — must follow migration 0001/0002 conventions (non-recursive, `set search_path=''`, fully-qualified objects).
- Form layout/validation schema (Zod), which Supabase Auth error strings to remap, skeleton/loading visuals for the guard, and whether `/login` and `/register` share a layout component.
- Whether the `name` column is `name` vs `full_name` (pick one; update the trigger and any Phase 5 references consistently).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 3: Authentication & Roles" — goal, 5 success criteria, and the surfaced open questions (admin bootstrap, email confirmation, Site URL/redirect config, Auth setting-name + rate-limit VERIFY notes).
- `.planning/REQUIREMENTS.md` — AUTH-01..AUTH-05 (this phase) and the traceability table.
- `.planning/PROJECT.md` §Constraints, §Key Decisions — Supabase-direct, anon key + RLS, "admin-only actions enforced server-side via RLS, not just hidden in the UI," static SPA on GitHub Pages.

### Phase 1 foundation this phase builds on (LOCKED — read before planning)
- `.planning/phases/01-supabase-foundation-schema-rls-storage/01-CONTEXT.md` — especially **D-10** (`role` on `profiles`, default `customer`, server-side only) and **D-11/D-12** (table set + RLS posture).
- `supabase/migrations/0001_init_schema.sql` — `public.profiles` definition (`id` → `auth.users(id)`, `email`, `role check (admin|customer) default customer`, timestamps), and `private.is_admin()` (SECURITY DEFINER, `set search_path=''`, non-recursive). The D-06 `name` column is added on top of this; the D-05 trigger must respect these conventions.
- `supabase/migrations/0002_rls_policies.sql` — the live RLS this phase relies on and must amend: `profiles_self_read`, **`profiles_self_update` (the D-04 lockdown target)**, `profiles_admin_read`, `profiles_admin_write`, and the admin-only catalog/content write policies that already call `private.is_admin()`. **Note the explicit "No public insert policy (Phase 3 wires signup row creation)" comment — that is D-05's mandate.**

### Existing frontend integration points
- `client/src/App.tsx` — Wouter `Router` + `Switch`/`Route` list (add `/login`, `/register`, `/reset-password`, `/admin/*`); `QueryClientProvider` + `Toaster` already mounted; `WouterRouter base={import.meta.env.BASE_URL...}` is the GitHub Pages sub-path the reset redirect (D-02) and guard must respect.
- `client/src/lib/supabase.ts` — the env-guarded Supabase client singleton; all `auth` calls (`signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `onAuthStateChange`, `getSession`) go through it.
- `client/src/components/Navbar.tsx` — where the D-09 account icon/menu and logout live.
- `client/src/components/ui/toaster.tsx` / Sonner — the D-14 success-toast surface (already wired in `App.tsx`).
- `.github/workflows/deploy.yml` + 404.html SPA fallback — context for the D-02 reset-link redirect on the GitHub Pages sub-path.

### Codebase maps
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md` — file layout and naming (PascalCase components, camelCase utils/hooks) to match.
- `.planning/codebase/INTEGRATIONS.md` — env vars, auth/DB state, deploy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Supabase client singleton** (`client/src/lib/supabase.ts`) — env-guarded, ready; the auth API surface for the whole phase.
- **react-hook-form + Zod + @hookform/resolvers** (already deps) — for the login/register/reset forms and inline validation (D-14).
- **Sonner / `@/components/ui/toaster`** (mounted in `App.tsx`) — success toasts (D-14).
- **shadcn primitives** (Input, Button, Card, DropdownMenu/Sheet) — login/register pages and the navbar account menu (D-08, D-09).
- **`private.is_admin()`** (migration 0001) + **admin-only RLS policies** (migration 0002) — already enforce admin-only writes; this phase just supplies the authenticated identity and protects the UI routes.

### Established Patterns
- **Supabase-direct, RLS-is-the-real-security** — UI guards (D-11/D-12) are UX only; never the enforcement boundary.
- **Versioned migrations** (`supabase/migrations/*.sql`, `supabase db push`) — the D-04 role lockdown, D-05 signup trigger, and D-06 `name` column all ship as a **new** numbered migration (0004+), following the non-recursive / locked-`search_path` conventions in 0001/0002.
- **GitHub Pages sub-path base** (`import.meta.env.BASE_URL`) — every route, redirect, and reset link must be base-aware.
- **No tests exist** — verify auth/RLS behavior manually (register → customer row created; customer cannot write catalog or change own role; admin reaches `/admin`).

### Integration Points
- New auth state layer (likely a React context/provider + `useAuth` hook wrapping `onAuthStateChange` + `getSession`), provided high in `App.tsx` so the navbar and route guard can read session/role.
- New route-guard component wrapping `/admin/*` routes (D-11/D-12).
- New migration: `profiles` `name` column + tightened `profiles` update policy + `handle_new_user` trigger.
- New local `promote-admin` script (service-role; not bundled).
- Supabase dashboard/Auth config: disable email confirmation (D-01), set Site URL + redirect allowlist for the reset flow (D-02).

</code_context>

<specifics>
## Specific Ideas

- Strong, consistent preference (carried from Phases 1–2) for the **clean/correct/secure** option: roles enforced in the DB not the UI, no self-serve admin, role column locked against escalation, profile creation via a trusted DB trigger rather than a client insert.
- Auth should feel **low-key for customers** right now (account icon, not a loud "Sign up" push) — the brand is made-to-order/showcase, and customer payoff (wishlist/profile) arrives in Phase 5. Auth this phase primarily unlocks the admin portal.
- Keep onboarding **frictionless** (no email gate, 6-char passwords) — deliberately trading some account hygiene for ease, acceptable with no payments involved.

</specifics>

<deferred>
## Deferred Ideas

- **The admin portal screens & catalog/content management** — Phase 4 (ADMIN-01..08). This phase ships only the empty protected `/admin` shell + guard.
- **Wishlist, customer profile page, submission history, native questionnaire** — Phase 5 (CUST-01..04). The D-09 account menu leaves room to add these links.
- **Stronger password rules / complexity, "remember me", email confirmation** — explicitly chosen against for v1 (D-07, D-13, D-01); easy to revisit later.
- **Multiple admins / granular permissions** — already v2 (ADME-03); single owner-admin via the bootstrap script is sufficient now.
- **CR-01 RLS tightening** (`products_public_read` → `using (is_active = true)`) — deferred from Phase 2 to **Phase 4** (must land before draft rows ship). Not this phase, but related RLS work; noted so it isn't lost.

None of the above were folded — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Authentication & Roles*
*Context gathered: 2026-05-31*
