import * as React from "react";
import { useAuth } from "@/auth/useAuth";
import { supabase } from "@/lib/supabase";
import { resolveDeliveryLoginMerge } from "./loginMerge";

/**
 * The site-wide "deliver to" pincode, persisted in localStorage so it survives a
 * reload and is shared across every page (D-11). Phase 8's navbar widget reads and
 * writes the SAME context + storage key with no refactor.
 *
 * `pincode` is null until the customer sets one; `setPincode` persists then updates.
 */
export interface DeliveryContextValue {
  pincode: string | null;
  setPincode: (p: string) => void;
}

/** Stable, namespaced storage key — Phase 8 reads the SAME key (D-11). */
export const DELIVERY_PINCODE_KEY = "sutravan.delivery.pincode";

// Default undefined so useDelivery can detect out-of-provider usage.
export const DeliveryContext = React.createContext<
  DeliveryContextValue | undefined
>(undefined);

/**
 * Read the persisted pincode once at mount. Every localStorage access is wrapped
 * in try/catch so blocked/unavailable storage (private mode, disabled cookies)
 * never throws — it degrades to null.
 */
function readStoredPincode(): string | null {
  try {
    return localStorage.getItem(DELIVERY_PINCODE_KEY);
  } catch {
    return null;
  }
}

/**
 * Best-effort write-through of a logged-in customer's pincode to their own
 * `profiles.default_pincode` row (D-03). Kept module-level (not a useCallback)
 * so it never churns the `setPincode`/effect dependency arrays.
 *
 * Silent-degrade (D-08): a failed read/write NEVER throws and NEVER surfaces a
 * user-facing error — the pincode keeps working this session via localStorage +
 * context. No `sonner` notification is imported or fired here. The update
 * payload is deliberately minimal `{ default_pincode }` — never `role` or any
 * other column. RLS scopes the row to the caller (auth.uid() = id) and the
 * Phase-3 role-lock trigger blocks role changes regardless; the minimal payload
 * is defense-in-depth (T-08-02).
 */
async function writePincodeToProfile(
  userId: string,
  pincode: string,
): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ default_pincode: pincode })
      .eq("id", userId);
  } catch {
    // Silent-degrade (D-08): the local/session pincode already works.
  }
}

export default function DeliveryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  // Lazy initializer: read storage once, not on every render.
  const [pincode, setPincodeState] = React.useState<string | null>(
    () => readStoredPincode(),
  );

  const setPincode = React.useCallback(
    (p: string) => {
      try {
        localStorage.setItem(DELIVERY_PINCODE_KEY, p);
      } catch {
        // Storage unavailable — keep the in-memory value so the session still works.
      }
      setPincodeState(p);
      // Write-through for logged-in customers (D-03): fire-and-forget, silent
      // (D-08). Anonymous visitors get localStorage + state only (D-04).
      const userId = user?.id;
      if (userId) void writePincodeToProfile(userId, p);
    },
    [user?.id],
  );

  // Login-merge read effect (D-01/D-02): reconcile the profile pincode against
  // localStorage on login/session-restore. Cloned from AuthProvider's role read
  // — never decide while auth is still `loading` (the resolvedFor race), and use
  // an `active` cleanup flag to ignore a resolved query after unmount/user swap.
  React.useEffect(() => {
    if (loading) return; // Never decide during the auth-resolution window.
    let active = true;
    const userId = user?.id ?? null;

    if (!userId) {
      // Logged out: localStorage only (D-04) — no profile involvement.
      return () => {
        active = false;
      };
    }

    supabase
      .from("profiles")
      .select("default_pincode")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!active) return;
        const profilePin = (data?.default_pincode as string | null) ?? null;
        const localPin = readStoredPincode();
        const action = resolveDeliveryLoginMerge(profilePin, localPin);
        switch (action.kind) {
          case "adopt-profile":
            // The account wins — mirror it onto this device (D-01). This also
            // re-writes the same value to the profile (idempotent, harmless).
            setPincode(action.pincode);
            break;
          case "push-local":
            // Adopt the anonymous choice into the empty profile (D-02).
            void writePincodeToProfile(userId, action.pincode);
            break;
          case "noop":
            break;
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id, loading, setPincode]);

  const value = React.useMemo<DeliveryContextValue>(
    () => ({ pincode, setPincode }),
    [pincode, setPincode],
  );

  return (
    <DeliveryContext.Provider value={value}>
      {children}
    </DeliveryContext.Provider>
  );
}
