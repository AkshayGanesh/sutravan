# Phase 3: Authentication & Roles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 3-Authentication & Roles
**Areas discussed:** Email confirmation, Password reset, First admin bootstrap, Role lockdown, Auth UX surface, Navbar entry, Post-login redirect, Admin route protection, Guard loading, Registration fields, Password rules, Auth feedback UX, Session persistence

---

## Email Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Off — instant login | Register and immediately log in; smoothest onboarding, no email gate | ✓ |
| On — verify first | Must click confirmation link before login; safer, needs email redirect + rate limit handling | |

**User's choice:** Off — instant login
**Notes:** No checkout exists, so a verified email isn't gating money; frictionless onboarding prioritized.

---

## Password Reset (scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to a later phase | Skip forgot-password; zero Supabase email/redirect config this phase | |
| Include password reset now | Add forgot-password; requires Site URL + redirect allowlist config for the GitHub Pages sub-path | ✓ |

**User's choice:** Include password reset now
**Notes:** Pulls the only email-dependent flow into scope; researcher to verify Supabase email rate limits / SMTP need.

---

## First Admin Bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard role-flip | Register normally, then flip role to admin via SQL in the Supabase dashboard | |
| Local bootstrap script | Committed script run locally with service-role key to promote an email to admin | ✓ |

**User's choice:** Local bootstrap script
**Notes:** Repeatable and self-documenting; service-role only, never bundled. No self-serve admin path.

---

## Role Lockdown

| Option | Description | Selected |
|--------|-------------|----------|
| DB trigger guards role | BEFORE UPDATE trigger forces NEW.role = OLD.role unless caller is_admin | |
| Tighten the policy itself | Rewrite profiles_self_update so self-update can't touch role; researcher picks cleanest RLS form | ✓ |

**User's choice:** Tighten the policy itself
**Notes:** Required outcome — a customer cannot change their own role via any client call (anon key / raw PostgREST included).

---

## Auth UX Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /login + /register pages | Full Wouter routes in Layout; deep-linkable, guard-friendly | ✓ |
| Modal / sheet overlay | Login/register in a Dialog/Sheet; slicker but harder to deep-link/redirect | |
| Single combined page with tabs | One /auth page with Login/Register tabs | |

**User's choice:** Dedicated /login + /register pages

---

## Navbar Entry

| Option | Description | Selected |
|--------|-------------|----------|
| Account icon + menu | Person icon by social icons; menu with Log out, room for Phase 5 links | ✓ |
| Text 'Sign in' / 'Log out' link | Plain text link that flips on session | |
| Minimal — admins mostly | Quiet 'Sign in' link only; heavier customer UI waits for Phase 5 | |

**User's choice:** Account icon + menu

---

## Post-Login Redirect

| Option | Description | Selected |
|--------|-------------|----------|
| Back where they came from | Return to the intended/origin page; guard tracks destination | ✓ |
| Always to home (/) | Everyone lands on homepage | |
| Role-based landing | Admins → /admin, customers → home | |

**User's choice:** Back where they came from

---

## Admin Route Protection

| Option | Description | Selected |
|--------|-------------|----------|
| Logged-out→/login (return after); non-admin→home | Discreet; no page advertising the admin area | ✓ |
| Both → /login | Single rule; confusing for already-logged-in customers | |
| Show a 403 'Not authorized' page | Explicit feedback but reveals an admin area exists | |

**User's choice:** Logged-out→/login (return after); non-admin→home

---

## Guard Loading

| Option | Description | Selected |
|--------|-------------|----------|
| Loading state until session resolves | Prevents admin-UI flash and false redirect of real admins on refresh | ✓ |
| Redirect immediately, correct after | Simpler but flickers real admins to login on every refresh | |

**User's choice:** Loading state until session resolves

---

## Registration Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password + name | Store a name on profiles (adds a column); admin recognizes customers, Phase 5 profile uses it | ✓ |
| Email + password only | Minimal, no schema change; admin only sees emails | |

**User's choice:** Email + password + name

---

## Password Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum 8 characters | Bump default to 8, no complexity rules | |
| Keep Supabase default (6 chars) | Lowest friction, zero config | ✓ |
| Stronger — 8+ with complexity | Length + character-class rules | |

**User's choice:** Keep Supabase default (6 chars)

---

## Auth Feedback UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline form errors + toast on success | Errors near fields (react-hook-form), success via Sonner toast | ✓ |
| Toast for everything | Errors and successes both as toasts | |
| You decide | Planner picks cleanest pattern | |

**User's choice:** Inline form errors + toast on success

---

## Session Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Always persist + auto-refresh | Supabase default; stay logged in across restarts (satisfies AUTH-02) | ✓ |
| Add a 'remember me' choice | Opt-in persistence; extra UI + non-default config | |

**User's choice:** Always persist + auto-refresh

---

## Claude's Discretion

- Exact route/file names (`/reset-password`, `scripts/promote-admin.ts` location), auth state container (context + `useAuth` hook), route-guard component shape.
- Precise RLS expression locking `role` and the `handle_new_user` trigger SQL (must follow migration 0001/0002 conventions).
- Form layout / Zod schemas, Supabase Auth error → friendly-copy mapping, guard loading visuals.
- `name` vs `full_name` column naming.

## Deferred Ideas

- Admin portal screens & catalog/content management — Phase 4.
- Wishlist, profile page, submission history, native questionnaire — Phase 5.
- Stronger password rules, "remember me", email confirmation — chosen against for v1; revisitable.
- Multiple admins / granular permissions — v2 (ADME-03).
- CR-01 RLS tightening (`products_public_read` → `using (is_active = true)`) — Phase 4, before draft rows ship.
