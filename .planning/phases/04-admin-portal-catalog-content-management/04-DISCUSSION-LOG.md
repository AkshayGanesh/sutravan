# Phase 4: Admin Portal — Catalog & Content Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 4-Admin Portal — Catalog & Content Management
**Areas discussed:** Portal layout & navigation, Product add/edit flow, Image upload UX, Site content editing, Categories, Submissions inbox, Visibility

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Portal layout & nav | Dashboard structure + admin chrome | ✓ |
| Product add/edit flow | Form style, list view, list fields | ✓ |
| Image upload UX | Drag-drop, formats, limits | ✓ |
| Site content editing | Editable scope, rich vs plain | ✓ |

**User's choice:** All four selected (then also explored Categories + Inbox + Visibility).

---

## Portal layout & navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar dashboard | Left sidebar: Products / Categories / Content / Submissions | ✓ |
| Top tabs | Horizontal tabs across the top | |
| Dashboard landing + pages | Landing page with cards to each area | |

**User's choice:** Sidebar dashboard.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated admin chrome | Slim admin header, drop marketing Navbar/Footer | ✓ |
| Keep public Navbar/Footer | Reuse existing Layout | |

**User's choice:** Dedicated admin chrome.

| Option | Description | Selected |
|--------|-------------|----------|
| Both, laptop-first | Design for laptop, usable on phone | ✓ |
| Desktop only | Optimize for laptop only | |
| Mobile-first | Prioritize touch/mobile | |

**User's choice:** Both, laptop-first.

---

## Product add/edit flow

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page form | Dedicated page for all fields + images | ✓ |
| Slide-over / modal panel | Edit in a panel over the list | |
| Inline in the list | Edit fields in the row | |

**User's choice:** Full-page form.

| Option | Description | Selected |
|--------|-------------|----------|
| Table with thumbnail | Compact rows w/ thumb, name, category, price, toggle | ✓ |
| Cards grid | Photo-forward cards | |
| Grouped by category | Sections per category | |

**User's choice:** Table with thumbnail.

| Option | Description | Selected |
|--------|-------------|----------|
| Repeatable rows | Each item its own input + add/remove | ✓ |
| One textarea, one per line | Single box split on newlines | |
| Comma-separated field | Items separated by commas | |

**User's choice:** Repeatable rows (for benefits / ingredients / tips).

| Option | Description | Selected |
|--------|-------------|----------|
| Auto from name, hidden | Slug generated, never shown; rename keeps paths stable | ✓ |
| Auto, but editable | Auto, shown in advanced field | |

**User's choice:** Auto from name, hidden.

| Option | Description | Selected |
|--------|-------------|----------|
| Start as draft / hidden | New products hidden until published | ✓ |
| Start published / live | New products immediately public | |

**User's choice:** Start as draft / hidden.

| Option | Description | Selected |
|--------|-------------|----------|
| Whole rupees, blank allowed | ₹ integer field; blank → "Price on request" | ✓ |
| Rupees with paise | Allow decimals | |

**User's choice:** Whole rupees, blank allowed.

---

## Image upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-drop + click, multiple | Drop zone + picker, several at once, thumbnails | ✓ |
| Click-to-pick, multiple | Picker only | |
| One photo at a time | Individual uploads | |

**User's choice:** Drag-drop + click, multiple.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-convert & shrink | Accept HEIC etc., convert+compress in browser | ✓ |
| Accept JPEG/PNG/WebP only | Reject HEIC with message | |
| Accept anything, no processing | Upload as-is | |

**User's choice:** Auto-convert & shrink. **Notes:** Flagged as a research/feasibility item (browser HEIC conversion + compression library).

| Option | Description | Selected |
|--------|-------------|----------|
| Limit + progress + toast | Max size, per-image progress, toasts | ✓ |
| Just success/error toast | No cap/progress bar | |

**User's choice:** Limit + progress + toast.

---

## Site content editing

| Option | Description | Selected |
|--------|-------------|----------|
| Required set only | Hero text, Our Story copy, email, IG/YouTube | ✓ |
| Required + more text | Plus other visible strings | |
| Everything editable | All copy + hero/Story images | |

**User's choice:** Required set only.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain multi-line text | Textarea, line breaks preserved | |
| Rich text editor | Toolbar: bold/italics/links/lists | ✓ |

**User's choice:** Rich text editor (for Our Story body). **Notes:** Triggers a research item — editor choice, stored format, and safe public rendering (sanitization).

| Option | Description | Selected |
|--------|-------------|----------|
| One source, update everywhere | Edit once; all locations read same value | ✓ |
| Edit only the main spots | Only Contact/Footer editable | |

**User's choice:** One source, update everywhere.

---

## Categories

| Option | Description | Selected |
|--------|-------------|----------|
| Block with message | Refuse delete when in use, clear message | ✓ |
| Reassign then delete | Move products first | |
| Block, offer to hide instead | Adds a category visibility field | |

**User's choice:** Block with message.

| Option | Description | Selected |
|--------|-------------|----------|
| Name + display order | Name + tab order; slug hidden | ✓ |
| Name, order + description | Plus a (currently unused) description | |

**User's choice:** Name + display order.

---

## Submissions inbox

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only list + detail | List + detail view, newest-first | ✓ |
| List + detail + mark handled | Adds a status column (schema change) | |
| Defer inbox to Phase 5 | Skip this phase | |

**User's choice:** Read-only list + detail. **Notes:** Inbox has no data until Phase 5 ships the native questionnaire; the screen is ready for it. ADMIN-07 is in this phase.

---

## Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| List toggle + form | Published switch in list AND edit form | ✓ |
| In the edit form only | Only in the edit page | |

**User's choice:** List toggle + form.

---

## Claude's Discretion

- Exact `/admin/*` route/file structure, admin shell/sidebar component shape.
- Write data-layer design (extend `catalog.ts` vs new `lib/admin.ts`), mutation + cache-invalidation wiring, camelCase↔snake_case symmetry.
- Slug-generation util + collision strategy; form validation schemas; confirm-dialog/toast wording.
- Image pipeline specifics (HEIC convert + compress library, size cap, post-shrink dimensions, replace/remove + orphan cleanup).
- Rich-text editor selection, stored format, and public-render sanitizer.
- `site_content` key naming + seed migration from current hardcoded strings; public read/fallback helper.

## Deferred Ideas

- Image reorder / primary-image pick (v2/ADME-01); bulk ops (v2/ADME-02); multi-admin (v2/ADME-03); analytics (v2/ADME-04).
- Submissions "mark handled" status (schema change) — deferred.
- Category description / category visibility field — not added.
- Admin "featured" product flag — deferred (Home stays first-published-per-category).
- Editing hero/Our Story imagery + remaining site copy — beyond the required text/links set this phase.
- Customer-facing native questionnaire that fills the inbox — Phase 5 (CUST-03).
