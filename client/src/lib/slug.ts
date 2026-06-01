// Single source of truth for slug generation (D-07).
// Produces a lowercase, hyphenated, ASCII-safe slug from a display name:
// punctuation/whitespace collapse to single hyphens, no leading/trailing hyphen.
// D-07: a slug stays STABLE on rename — that stability is enforced by the
// caller (admin.ts), which keeps the original slug; this util only derives the
// initial value. Pure helper — imports nothing, mirrors format.ts conventions.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics → single hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens
}
