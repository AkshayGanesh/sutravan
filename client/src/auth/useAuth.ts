import * as React from "react";
import { AuthContext, type AuthContextValue } from "@/auth/AuthProvider";

/**
 * Read the auth context: `{ session, user, role, loading, signOut }`.
 *
 * Throws if called outside `<AuthProvider>` (mirror use-toast.ts guard style),
 * so misuse fails loudly at the call site instead of silently returning stale
 * defaults.
 */
export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
