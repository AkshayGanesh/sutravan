// Maps raw Supabase Auth error messages to friendly, non-enumerating copy.
//
// Anti-enumeration (D-14, RESEARCH Security Domain): invalid-credentials and
// "email not found" MUST return the SAME generic message so an attacker cannot
// distinguish "this email exists" from "wrong password". Pure string->string
// mapper — no React, no I/O, no side effects.

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

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
 * Map a Supabase Auth error to friendly, non-enumerating copy.
 *
 * @param error - the raw Supabase error (object with `.message`) or a string.
 * @returns a user-facing message safe to render directly.
 */
export function mapAuthError(error: unknown): string {
  const msg = messageOf(error);

  if (!msg) return GENERIC_FALLBACK;

  // Anti-enumeration: collapse "invalid login credentials" AND any
  // email-not-found / user-not-found signal into ONE generic message.
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    msg.includes("email not found") ||
    msg.includes("user not found") ||
    msg.includes("no user found") ||
    msg.includes("invalid email or password")
  ) {
    return "Email or password is incorrect.";
  }

  // Email already registered.
  if (
    msg.includes("user already registered") ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("email address is already") ||
    msg.includes("already exists")
  ) {
    return "An account with this email already exists.";
  }

  // Weak / too-short password (matches D-07: 6-char minimum).
  if (
    msg.includes("password should be at least") ||
    msg.includes("password is too short") ||
    msg.includes("weak password") ||
    msg.includes("password should contain")
  ) {
    return "Password must be at least 6 characters.";
  }

  // Rate limiting.
  if (
    msg.includes("you can only request this after") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("email rate limit")
  ) {
    return "Please wait a moment before trying again.";
  }

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
