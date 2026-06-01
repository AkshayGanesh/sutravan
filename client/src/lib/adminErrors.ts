// Maps raw Supabase/PostgREST write errors to friendly admin-facing copy.
//
// Mirrors authErrors.ts: a pure unknown->string mapper with no React, no I/O,
// no side effects. Admin writes surface PostgREST error CODES (not just
// messages), so this reads `error.code` first, then falls back to `error.message`.
// All copy is verbatim from the UI-SPEC Error-states contract — never surface
// the raw DB error to the owner.

const GENERIC_FALLBACK =
  "Something went wrong while saving. Please try again.";

/** Extract the PostgREST error code (e.g. '23503') from an unknown error shape. */
function codeOf(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

/** Extract a lowercase message string from an unknown error shape. */
function messageOf(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (error && typeof error === "object") {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") return msg.toLowerCase();
  }
  return "";
}

/**
 * Map a Supabase/PostgREST write error to friendly copy safe to render directly.
 *
 * @param error - the raw error (object with `.code`/`.message`) or a string.
 * @returns a user-facing message.
 */
export function mapWriteError(error: unknown): string {
  const code = codeOf(error);

  // FK violation: deleting a category that still has products (D-15). The {N}
  // count is filled by the caller (admin.ts) which knows the product count;
  // this base copy carries the actionable instruction.
  if (code === "23503") {
    return "This category has products — move or delete them first.";
  }

  // Unique violation: a name/slug already in use (Pitfall 6 — slug collision).
  if (code === "23505") {
    return "That name is already in use — choose a different one.";
  }

  const msg = messageOf(error);

  // Network / fetch failure.
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("networkerror") ||
    msg.includes("fetch failed")
  ) {
    return "Network error — please check your connection and try again.";
  }

  return GENERIC_FALLBACK;
}
