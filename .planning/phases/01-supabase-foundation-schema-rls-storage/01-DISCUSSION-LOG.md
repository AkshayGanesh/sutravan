# Phase 1: Supabase Foundation — Schema, RLS & Storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 1-Supabase Foundation — Schema, RLS & Storage
**Areas discussed:** Product schema shape, Migration workflow, Storage bucket layout, Cleanup scope, Role model & later-phase tables

---

## Product Schema Shape

### Price type
| Option | Description | Selected |
|--------|-------------|----------|
| Numeric INR, nullable | numeric(10,2) rupees, nullable for unpriced products | ✓ |
| Integer paise (minor units) | Whole paise, avoids decimals but ÷100 everywhere | |
| Text freeform | String like today; can't sort/filter/validate | |

### Images
| Option | Description | Selected |
|--------|-------------|----------|
| images text[] array on the product row | Ordered Storage paths on the product; ordering = array order | ✓ |
| Separate product_images table | One row per image with sort_order/is_primary; heavier | |

### Category link
| Option | Description | Selected |
|--------|-------------|----------|
| FK category_id → categories.id | Relational link by UUID; FK gives in-use delete protection | ✓ |
| Text slug column on product | Simpler, no join, but fragile on rename/delete | |

### Identity
| Option | Description | Selected |
|--------|-------------|----------|
| UUID PK + unique slug | id uuid PK + unique slug; seed upserts on slug | ✓ |
| Slug as primary key | Slug edits cascade through FKs; painful | |

**User's choice:** All recommended options.
**Notes:** Schema is the load-bearing artifact every later phase depends on; owner chose the durable relational options.

---

## Migration Workflow

### Migration tooling
| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI + versioned SQL migrations in repo | supabase/migrations/*.sql in git, `supabase db push` | ✓ |
| Hand-run SQL in dashboard editor | Zero setup, but unversioned, no review trail | |
| In-repo SQL files, applied manually | Versioned but no applied-state tracking | |

### Dev target
| Option | Description | Selected |
|--------|-------------|----------|
| Hosted cloud project directly | One cloud project, no Docker; meets "live project" criterion | ✓ |
| Local Supabase stack (Docker), push to cloud | Fast/offline but adds Docker dependency | |

**User's choice:** Supabase CLI + versioned migrations; develop against hosted cloud project.
**Notes:** Establishes the pattern for all future schema changes.

---

## Storage Bucket Layout

### Buckets
| Option | Description | Selected |
|--------|-------------|----------|
| Two buckets: product-images + site-content | Clean separation; both created now | ✓ |
| One bucket: product-images only | Add site-content later; defers a migration | |

### Path convention
| Option | Description | Selected |
|--------|-------------|----------|
| products/{slug}/{filename} | Human-readable, stable across renames | ✓ |
| products/{uuid}/{filename} | Unique but opaque in dashboard | |
| Flat with unique filenames | Simplest, but messy at scale | |

### Access policy
| Option | Description | Selected |
|--------|-------------|----------|
| Public read, admin-only write via is_admin() | Matches security model exactly | ✓ |
| Public read, any authenticated write | Wrong — customers must not touch catalog images | |

**User's choice:** Two buckets, products/{slug}/{filename}, public-read/admin-write.
**Notes:** —

---

## Cleanup Scope

### Removal thoroughness
| Option | Description | Selected |
|--------|-------------|----------|
| Full removal: files + deps + scripts | Clean Supabase-direct repo; satisfies criterion #5 | ✓ |
| Delete files only, leave package.json | Leaves dead deps/scripts | |

### queryClient.ts
| Option | Description | Selected |
|--------|-------------|----------|
| Keep TanStack Query, retire Express apiRequest path | Keep QueryClient for Phase 2; drop Express wiring | ✓ |
| Leave queryClient.ts untouched this phase | Dead apiRequest lingers | |

### Dev script
| Option | Description | Selected |
|--------|-------------|----------|
| dev = Vite dev server | One obvious command, matches static-SPA reality | ✓ |
| You decide during planning | Planner settles script names/ports | |

**User's choice:** Full removal; keep React Query but retire Express path; `npm run dev` → Vite.
**Notes:** —

---

## Role Model & Later-Phase Tables

### Role model
| Option | Description | Selected |
|--------|-------------|----------|
| role text ('admin'\|'customer'), default 'customer' | Readable, extensible; is_admin() checks role = 'admin' | ✓ |
| Boolean is_admin, default false | Leaner but boxed into two roles | |

### Table depth
| Option | Description | Selected |
|--------|-------------|----------|
| Full columns now, all with RLS | All six tables fully defined in one pass | ✓ |
| Minimal stubs now, flesh out per phase | More migrations touching same tables | |

### RLS reads baseline
| Option | Description | Selected |
|--------|-------------|----------|
| Public read for catalog/content; owner/admin-scoped for the rest | Correct trust boundary from day one | ✓ |
| Default-deny everything, open up per phase | Safest baseline, more later policy work | |

**User's choice:** role text default customer; full table definitions now; refined RLS read baseline.
**Notes:** These get baked into the Phase 1 migration, so worth pinning now.

---

## Claude's Discretion
- Exact column lists for later-phase tables (site_content, customization_submissions, wishlists, profiles beyond id/role/email/timestamps).
- RLS policy SQL syntax and is_admin() implementation (plpgsql SECURITY DEFINER, locked search_path, no recursive-policy errors).
- Final package.json script names/ports after Express removal.

## Deferred Ideas
- Image reordering / primary-image selection — v2 (ADME-01).
- Email confirmation on/off + Auth Site URL/redirect allowlist — Phase 3.
- First admin bootstrap — Phase 3.
- Scrub/cream imagery upload — Phase 4.
- Seed script (68 products + images, idempotent) — Phase 2 (DATA-03).
