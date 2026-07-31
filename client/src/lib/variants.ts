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
 * The variant carrying the lowest NON-null price, tie-broken by the lowest
 * sortOrder. null when there are no variants or every variant price is null.
 * Variants with a null price are ignored.
 *
 * This is the SINGLE place the "cheapest variant" rule lives — both the price
 * label and the badge module's active price point derive from it, so a card's
 * "From ₹X" and its "% OFF" can never describe different weights.
 */
export function lowestPricedVariant(variants: Variant[]): Variant | null {
  let best: Variant | null = null;
  for (const v of variants) {
    if (v.price == null) continue;
    if (best == null) {
      best = v;
      continue;
    }
    const bp = best.price as number;
    if (v.price < bp || (v.price === bp && v.sortOrder < best.sortOrder)) {
      best = v;
    }
  }
  return best;
}

/**
 * The lowest NON-null variant price, or null when there are no variants or all
 * variant prices are null. Variants with a null price are ignored.
 *
 * Expressed via lowestPricedVariant so the min logic exists in exactly one
 * place; the exported signature and behaviour are unchanged.
 */
export function lowestVariantPrice(variants: Variant[]): number | null {
  return lowestPricedVariant(variants)?.price ?? null;
}

/**
 * The discount percentage for a single price point, or null when there is no
 * genuine discount to advertise (QUICK-260731-grz).
 *
 * Returns null unless BOTH values are numbers AND the MRP strictly EXCEEDS the
 * price. An equal or lower MRP is a data-entry error, not a 0% badge — so a
 * sale is never advertised without a real number behind it. Rounded to the
 * nearest whole percent.
 */
export function discountPercent(
  price: number | null,
  originalPrice: number | null,
): number | null {
  if (price == null || originalPrice == null) return null;
  if (originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

// The structural shape displayPricePair needs. Declared locally (rather than
// importing Product) to keep this module free of data/products.ts's bundled
// image imports — Product is structurally assignable to it.
type PricePairInput = {
  price: number | null;
  originalPrice: number | null;
  showDiscount: boolean;
  variants: Variant[];
};

/**
 * The card/detail price line broken into its three renderable parts:
 *  - prefix:   'From ' for a variant product, '' otherwise (see displayPriceLabel)
 *  - original: the struck-through MRP string, or null when no discount is active
 *  - current:  the price actually charged
 *
 * The price POINT is chosen exactly as displayPriceLabel chooses it (no
 * variants -> the product's own price; variants -> the lowest-priced one), and
 * `original` is drawn from that SAME point, so the strikethrough always belongs
 * to the price beside it. `original` is non-null only when showDiscount is on
 * AND that point has a valid MRP. Rupees always render through formatPrice.
 */
export function displayPricePair(p: PricePairInput): {
  prefix: '' | 'From ';
  original: string | null;
  current: string;
} {
  let prefix: '' | 'From ' = '';
  let price: number | null;
  let originalPrice: number | null;

  if (p.variants.length === 0) {
    price = p.price;
    originalPrice = p.originalPrice;
  } else {
    const lowest = lowestPricedVariant(p.variants);
    if (lowest == null) {
      // A price-less variant set reads as on-request, with NO "From " prefix.
      price = null;
      originalPrice = null;
    } else {
      prefix = 'From ';
      price = lowest.price;
      originalPrice = lowest.originalPrice;
    }
  }

  const showOriginal =
    p.showDiscount && discountPercent(price, originalPrice) != null;

  return {
    prefix,
    original: showOriginal ? formatPrice(originalPrice) : null,
    current: formatPrice(price),
  };
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
 *
 * Now expressed as displayPricePair's prefix + current (with the discount
 * deliberately disabled) so the two never drift apart. Its signature and every
 * output string are unchanged.
 */
export function displayPriceLabel(
  productPrice: number | null,
  variants: Variant[],
): string {
  const { prefix, current } = displayPricePair({
    price: productPrice,
    originalPrice: null,
    showDiscount: false,
    variants,
  });
  return prefix + current;
}
