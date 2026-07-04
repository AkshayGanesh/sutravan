import * as React from "react";

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

export default function DeliveryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lazy initializer: read storage once, not on every render.
  const [pincode, setPincodeState] = React.useState<string | null>(
    () => readStoredPincode(),
  );

  const setPincode = React.useCallback((p: string) => {
    try {
      localStorage.setItem(DELIVERY_PINCODE_KEY, p);
    } catch {
      // Storage unavailable — keep the in-memory value so the session still works.
    }
    setPincodeState(p);
  }, []);

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
