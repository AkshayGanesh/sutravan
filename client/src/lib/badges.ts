// Owner-controlled product badges (QUICK-260731-grz) — the pure derivation of
// WHICH single chip a product shows, and at WHICH price point its discount is
// computed. The symmetric sibling of variants.ts's price derivations.
//
// Badge model (LOCKED): the three flags (showDiscount / isNew / isBestSeller)
// live on the PRODUCT, are set by the owner in the admin form, and are
// DISPLAY-only — none of them affects visibility (is_active alone does, enforced
// by RLS). At most ONE badge ever renders, by a fixed priority ladder.
//
// This module is PURE. It imports Product as a TYPE ONLY (so it is erased at
// runtime and the unit test stays side-effect-free, never pulling in
// data/products.ts's bundled image assets) plus the price derivations from
// variants.ts — mirroring admin.test.ts / variants.test.ts.
import type { Product } from "@/data/products";
import { discountPercent, lowestPricedVariant } from "@/lib/variants";

// discountPercent is IMPLEMENTED in variants.ts (where displayPricePair needs
// the same MRP-validity math) and re-exported here so callers can treat badges.ts
// as the one badge/discount entry point. Defining it here instead would create a
// variants <-> badges import cycle.
export { discountPercent };

export type BadgeKind = "oos" | "discount" | "bestSeller" | "new";

/**
 * The price point a product's badge and price line are both computed from.
 *
 * For a product WITH variants this is the LOWEST-PRICED variant's
 * { price, originalPrice } pair — the same weight the card's "From ₹X" shows, so
 * the "% OFF" can never describe a different weight than the price beside it.
 * (A variant set whose prices are all null yields { null, null }.) For a product
 * with no variants it is the product's own pair.
 */
export function activePricePoint(product: Product): {
  price: number | null;
  originalPrice: number | null;
} {
  if (product.variants.length > 0) {
    const lowest = lowestPricedVariant(product.variants);
    if (lowest == null) return { price: null, originalPrice: null };
    return { price: lowest.price, originalPrice: lowest.originalPrice };
  }
  return { price: product.price, originalPrice: product.originalPrice };
}

/**
 * The single badge to render for a product, or null for none.
 *
 * Fixed priority ladder — at most ONE badge, never two:
 *   1. Out of stock  (availability always outranks merchandising)
 *   2. Discount      (money is the loudest signal)
 *   3. Most sold
 *   4. New
 *
 * LOCKED EDGE CASE: when showDiscount is ON but the ACTIVE price point has no
 * valid MRP (missing, or <= the price), the discount rung is SKIPPED and
 * priority falls THROUGH to Most sold / New (or null). A sale is never
 * advertised without a real number behind it, so a half-filled admin form
 * degrades to the next honest badge rather than to a bogus "0% OFF".
 */
export function productBadge(
  product: Product,
): { kind: BadgeKind; label: string } | null {
  if (!product.inStock) return { kind: "oos", label: "Out of stock" };

  if (product.showDiscount) {
    const { price, originalPrice } = activePricePoint(product);
    const pct = discountPercent(price, originalPrice);
    if (pct != null) return { kind: "discount", label: `${pct}% OFF` };
    // No valid MRP -> fall through to the next rung (deliberate, see above).
  }

  if (product.isBestSeller) return { kind: "bestSeller", label: "Most sold" };
  if (product.isNew) return { kind: "new", label: "New" };
  return null;
}
