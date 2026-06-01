---
phase: 04-admin-portal-catalog-content-management
plan: 07
subsystem: ui
tags: [tiptap, dompurify, react-query, site-content, rich-text, code-splitting, xss]

# Dependency graph
requires:
  - phase: 04-01
    provides: admin shell + routing + auth-gated /admin routes
  - phase: 04-03
    provides: lib/admin.ts useSaveSiteContent (upsert + invalidate ['siteContent'])
  - phase: 04-04
    provides: lib/siteContent.ts useSiteContent + SITE_CONTENT_DEFAULTS; SiteContent.tsx stub; lib/sanitizeHtml.ts sanitizeRichText (Plan 02)
provides:
  - "Site-content editor page: validated plain fields (hero/email/social URLs) + lazy TipTap rich-text for Our Story body"
  - "Lazy RichTextEditor wrapper (TipTap StarterKit + Link) kept out of the public bundle via React.lazy"
  - "All seven public read sites (Footer, Navbar, Contact, ProductDetail, Shop, Hero, OurStory) wired to useSiteContent single source with mandatory fallbacks (D-20)"
  - "Our Story rich text rendered safely via sanitizeRichText (DOMPurify) — the app's only dangerouslySetInnerHTML path"
affects: [admin-portal, public-site, content-management, future e-commerce content surfaces]

# Tech tracking
tech-stack:
  added: []  # TipTap + DOMPurify deps verified installed in Plan 02; no new installs here
  patterns:
    - "Lazy code-split admin-only editor (React.lazy + Suspense) keeps heavy ProseMirror/TipTap out of the public chunk (Pitfall 5)"
    - "Consumer fallback pattern: data?.key ?? SITE_CONTENT_DEFAULTS.key — never render blank (T-04-21)"
    - "Single dangerouslySetInnerHTML path routed exclusively through sanitizeRichText DOMPurify allow-list (T-04-18)"

key-files:
  created:
    - client/src/components/admin/RichTextEditor.tsx
  modified:
    - client/src/pages/admin/SiteContent.tsx
    - client/src/components/Footer.tsx
    - client/src/components/Navbar.tsx
    - client/src/pages/Contact.tsx
    - client/src/components/ProductDetail.tsx
    - client/src/pages/Shop.tsx
    - client/src/components/Hero.tsx
    - client/src/pages/OurStory.tsx

key-decisions:
  - "D-18/D-19/D-20 honored exactly: seven editable keys, TipTap-authored Our Story, single source of truth across all 7 files"
  - "TipTap imported lazily by SiteContent so ProseMirror (377kB) is code-split out of the public bundle — verified 0 prosemirror refs in main chunk"
  - "Our Story body is the app's only dangerouslySetInnerHTML, always passed through sanitizeRichText (DOMPurify) — verified with a <script> probe (inert)"

patterns-established:
  - "Lazy admin editor pattern: heavy authoring deps only load behind the admin route"
  - "Consumer fallback pattern: data?.key ?? SITE_CONTENT_DEFAULTS for all public site-content reads"
  - "Sanitized-render pattern: rich-text HTML rendered only via sanitizeRichText"

requirements-completed: [ADMIN-05, ADMIN-06]

# Metrics
duration: ~3min (task commits) + manual verification
completed: 2026-06-01
---

# Phase 4 Plan 07: Site-Content Vertical Slice Summary

**Admin-editable site content (hero copy, Our Story rich text, contact email, social URLs) wired live across all seven public files via a single site_content source, with TipTap authoring code-split out of the public bundle and DOMPurify-sanitized Our Story rendering**

## Performance

- **Duration:** ~3 min (atomic task commits) plus manual end-to-end verification
- **Started:** 2026-06-01T11:02:30+05:30 (Task 1 commit)
- **Completed:** 2026-06-01 (manual checkpoint approved)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- Site-content editor (`SiteContent.tsx`) with Zod-validated plain fields (hero_title/subtitle/cta, email, instagram_url, youtube_url) plus a lazy TipTap rich-text field for `our_story_body`; "Save content" upserts all seven keys via `useSaveSiteContent` and invalidates `['siteContent']`.
- New `RichTextEditor.tsx` (lazy default export) — TipTap StarterKit + Link with a bold/italic/link/bullet/ordered-list toolbar matching the DOMPurify allow-list; emits HTML via `editor.getHTML()`.
- Rewired all seven public files to `useSiteContent` with `SITE_CONTENT_DEFAULTS` fallbacks (D-20): email/social removed as hardcoded consts in Footer/Contact; Hero copy and Our Story body now sourced from site_content.
- Our Story renders `our_story_body` exclusively through `sanitizeRichText` (DOMPurify) — the app's single `dangerouslySetInnerHTML` path; external links carry `rel="noopener noreferrer"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RichTextEditor (lazy TipTap) + SiteContent editor page** - `6b9b259` (feat)
2. **Task 2: Rewire 7 public files to useSiteContent (D-20) + sanitized Our Story** - `314706b` (feat)
3. **Task 3: Verify site-content slice end-to-end** - human-verify checkpoint, **APPROVED** (manual browser walk)

**Plan metadata:** this docs commit (summary + tracking)

## Files Created/Modified

- `client/src/components/admin/RichTextEditor.tsx` - New lazy TipTap wrapper (StarterKit + Link), ghost-icon toolbar, emits HTML via onChange (+140 lines)
- `client/src/pages/admin/SiteContent.tsx` - Replaced Plan-04 stub with prefilled, validated editor for all seven keys + lazy `<RichTextEditor>` behind Suspense (+236 lines)
- `client/src/components/Footer.tsx` - Removed INSTAGRAM_URL/YOUTUBE_URL/EMAIL consts; reads from useSiteContent with fallbacks
- `client/src/components/Navbar.tsx` - All instagram/youtube/mailto occurrences read from useSiteContent
- `client/src/pages/Contact.tsx` - Removed INSTAGRAM_URL/EMAIL consts; reads from useSiteContent
- `client/src/components/ProductDetail.tsx` - Instagram link reads from useSiteContent
- `client/src/pages/Shop.tsx` - Instagram link reads from useSiteContent
- `client/src/components/Hero.tsx` - hero_title/subtitle/cta read from useSiteContent with literal fallbacks
- `client/src/pages/OurStory.tsx` - Body replaced with `dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }}` (-165 net lines of hardcoded copy)

## Automated Verification Results

- `npm run check` exits **0** (re-verified at continuation).
- `npm run build` **succeeds**.
- Task 1 greps PASS: `useSaveSiteContent`, `RichTextEditor`, `lazy(` present in SiteContent.tsx; `@tiptap/react` present in RichTextEditor.tsx.
- Task 2 greps PASS: `useSiteContent` present in Footer/Navbar/Contact/ProductDetail/Shop/Hero; `sanitizeRichText` present in OurStory; no residual `const INSTAGRAM_URL` / `const YOUTUBE_URL` / `const EMAIL` in Footer; no `const INSTAGRAM_URL` in Contact.
- **Code-split evidence (Pitfall 5):** TipTap/ProseMirror (377kB) is split OUT of the public chunk — 0 prosemirror references in the main bundle, isolated in the lazy RichTextEditor chunk behind the admin route.
- **XSS evidence (T-04-18):** DOMPurify is present in the public chunk on the OurStory render path; a `<script>alert(1)</script>` probe is stripped and does not execute.

## Manual Verification (Checkpoint Task 3 — APPROVED)

The user performed the end-to-end browser walk and approved:

- Email and Instagram edits propagate **live** across Navbar / Footer / Contact / ProductDetail / Shop with no redeploy.
- Our Story rich text renders with formatting; external links carry `rel="noopener noreferrer"`.
- XSS `<script>` payload in `our_story_body` is stripped by DOMPurify (does not execute).
- D-20 default literals render when a key is cleared or the network is throttled (never blank).

## Decisions Made

None beyond plan — D-18/D-19/D-20 implemented exactly as specified. Lazy TipTap and DOMPurify-only Our Story rendering followed the plan's Pitfall 5 and XSS contract directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - the Plan-04 SiteContent stub was fully replaced with the working editor; all seven keys are wired to live data with fallbacks.

## Threat Flags

None - no new security-relevant surface beyond the plan's threat register. The single `dangerouslySetInnerHTML` path (T-04-18) is mitigated via sanitizeRichText and was verified with a `<script>` probe.

## User Setup Required

None - no external service configuration required (TipTap/DOMPurify deps verified in Plan 02; no new installs).

## Next Phase Readiness

- Site-content management slice complete: owner can edit hero/Our Story/email/social once and every public location updates live.
- Rich text is owner-friendly to author and XSS-safe to render.
- No blockers.

---
*Phase: 04-admin-portal-catalog-content-management*
*Completed: 2026-06-01*

## Self-Check: PASSED

- FOUND: client/src/components/admin/RichTextEditor.tsx
- FOUND: client/src/pages/admin/SiteContent.tsx
- FOUND commit 6b9b259 (Task 1)
- FOUND commit 314706b (Task 2)
- npm run check exit 0
