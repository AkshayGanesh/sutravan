// Per-product weight/price variants (SKUs) — pure derivations + snake->camel
// mapper (QUICK-VAR-01). The symmetric public sibling of catalog.ts's toProduct
// for the embedded product_variants relation.
//
// Pricing model (LOCKED): variants are OPTIONAL. An EMPTY variants array means
// the single products.price path is unchanged (incl. null = "Price on request").
// When variants exist, they DRIVE display pricing and products.price is ignored.
//
// This module is PURE (it only imports formatPrice, which itself imports
// nothing), so the unit test stays side-effect-free — mirroring admin.test.ts.
import { formatPrice } from "@/lib/format";

export interface Variant {
  id: string;
  label: string;
  price: number | null; // same type/units as products.price (numeric -> number | null)
  // The MRP for THIS weight (QUICK-260731-grz). Same type/units as price;
  // null = no MRP on file. Display-only — the "% OFF" is always computed.
  originalPrice: number | null;
  sortOrder: number;
}

/** snake_case product_variants row -> camelCase Variant (prices kept untouched). */
export function toVariant(row: any): Variant {
  return {
    id: row.id,
    label: row.label,
    price: row.price, // number | null — formatPrice handles null
    // Defensive: the column may not exist yet on an un-migrated DB.
    originalPrice: row.original_price ?? null,
    sortOrder: row.sort_order ?? 0,
  };
}

/**
 * The lowest NON-null variant price, or null when there are no variants or all
 * variant prices are null. Variants with a null price are ignored.
 */
export function lowestVariantPrice(variants: Variant[]): number | null {
  const prices = variants
    .map((v) => v.price)
    .filter((p): p is number => p != null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/**
 * The single source for the card/grid price STRING.
 *  - No variants -> formatPrice(productPrice) exactly (single-price path; null ->
 *    "Price on request").
 *  - Variants with at least one numeric price -> "From " + formatPrice(lowest).
 *  - Variants but all prices null -> formatPrice(null) i.e. "Price on request"
 *    with NO "From " prefix (a price-less variant set reads as on-request).
 *
 * This is the ONLY place that prepends "From "; it always reuses formatPrice —
 * rupees are never reformatted by hand.
 */
export function displayPriceLabel(
  productPrice: number | null,
  variants: Variant[],
): string {
  if (variants.length === 0) return formatPrice(productPrice);
  const lowest = lowestVariantPrice(variants);
  if (lowest == null) return formatPrice(null); // all-null variants -> "Price on request"
  return `From ${formatPrice(lowest)}`;
}
