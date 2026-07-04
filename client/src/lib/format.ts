// Single source of truth for price rendering (D-01 / D-02).
// D-01: a null/unset price renders as "Price on request".
// D-02: a set price renders as the INR symbol + whole rupees, no decimals.
// Phase 7 (D-04): renders Indian thousands grouping via toLocaleString('en-IN').
// The delivery engine already rounds costs to ₹10, so this helper NEVER
// re-rounds — it keeps whole rupees with no decimals and only groups. This also
// (intentionally) groups product prices site-wide, per the UI-SPEC copy contract.
// Pure helper — imports nothing, mirrors utils.ts conventions.
export function formatPrice(price: number | null): string {
  // Use `== null` to catch null AND undefined while NOT treating 0 as unset
  // (0 is a real, set price and must render as "₹0").
  if (price == null) return 'Price on request';
  return `₹${Number(price).toLocaleString('en-IN')}`;
}
