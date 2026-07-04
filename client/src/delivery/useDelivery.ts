import * as React from "react";
import {
  DeliveryContext,
  type DeliveryContextValue,
} from "@/delivery/DeliveryProvider";

/**
 * Read the delivery context: `{ pincode, setPincode }`.
 *
 * Throws if called outside `<DeliveryProvider>` (mirror useAuth.ts guard style),
 * so misuse fails loudly at the call site instead of silently returning stale
 * defaults.
 */
export function useDelivery(): DeliveryContextValue {
  const ctx = React.useContext(DeliveryContext);
  if (ctx === undefined) {
    throw new Error("useDelivery must be used within a DeliveryProvider");
  }
  return ctx;
}
