import { describe, it, expect } from "vitest";
import { activePricePoint, productBadge, discountPercent } from "@/lib/badges";
import { displayPricePair, displayPriceLabel, type Variant } from "@/lib/variants";
import type { Product } from "@/data/products";

// A camelCase Variant builder, mirroring variants.test.ts.
function variant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: "v1",
    label: "70gm",
    price: 120,
    originalPrice: null,
    sortOrder: 0,
    ...overrides,
  };
}

// A Product fixture covering every field the badge ladder reads. Defaults are
// the "untouched product" baseline: in stock, no MRP, no badge flags.
function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "neem",
    name: "Neem",
    subtitle: "Purifying bar",
    category: "soap",
    price: 400,
    benefits: [],
    ingredients: [],
    tips: [],
    shelfLife: "",
    batchNote: "",
    images: [],
    inStock: true,
    showPatchTestNote: false,
    originalPrice: null,
    showDiscount: false,
    isNew: false,
    isBestSeller: false,
    variants: [],
    ...overrides,
  };
}

describe("discountPercent", () => {
  it("computes the percentage off when the MRP exceeds the price", () => {
    expect(discountPercent(400, 500)).toBe(20);
  });

  it("returns null when the price is null", () => {
    expect(discountPercent(null, 500)).toBeNull();
  });

  it("returns null when the MRP is null (no MRP on file)", () => {
    expect(discountPercent(400, null)).toBeNull();
  });

  it("returns null when the MRP EQUALS the price (never a 0% badge)", () => {
    expect(discountPercent(500, 500)).toBeNull();
  });

  it("returns null when the MRP is BELOW the price (data-entry error)", () => {
    expect(discountPercent(500, 400)).toBeNull();
  });

  it("rounds to the nearest whole percent", () => {
    expect(discountPercent(333, 500)).toBe(33);
  });

  it("treats a zero price as a real price (100% off), not as unset", () => {
    expect(discountPercent(0, 500)).toBe(100);
  });
});

describe("activePricePoint", () => {
  it("returns the product's own pair when there are no variants", () => {
    expect(activePricePoint(product({ price: 400, originalPrice: 500 }))).toEqual({
      price: 400,
      originalPrice: 500,
    });
  });

  it("returns the LOWEST-PRICED variant's pair, not the first row's", () => {
    const p = product({
      price: 999, // ignored once variants exist
      originalPrice: 1200,
      variants: [
        variant({ id: "b", label: "100gm", price: 560, originalPrice: 700, sortOrder: 0 }),
        variant({ id: "a", label: "70gm", price: 400, originalPrice: 500, sortOrder: 1 }),
      ],
    });
    expect(activePricePoint(p)).toEqual({ price: 400, originalPrice: 500 });
  });

  it("returns a null pair when every variant price is null", () => {
    const p = product({
      price: 400,
      originalPrice: 500,
      variants: [
        variant({ id: "a", price: null }),
        variant({ id: "b", price: null }),
      ],
    });
    expect(activePricePoint(p)).toEqual({ price: null, originalPrice: null });
  });
});

describe("productBadge priority ladder", () => {
  it("returns null for an untouched product (no badge at all)", () => {
    expect(productBadge(product())).toBeNull();
  });

  it("returns the out-of-stock badge even when a valid discount exists", () => {
    const p = product({
      inStock: false,
      price: 400,
      originalPrice: 500,
      showDiscount: true,
      isBestSeller: true,
      isNew: true,
    });
    expect(productBadge(p)).toEqual({ kind: "oos", label: "Out of stock" });
  });

  it("returns the discount badge over Most sold and New", () => {
    const p = product({
      price: 400,
      originalPrice: 500,
      showDiscount: true,
      isBestSeller: true,
      isNew: true,
    });
    expect(productBadge(p)).toEqual({ kind: "discount", label: "20% OFF" });
  });

  it("computes the discount from the lowest-priced variant", () => {
    const p = product({
      showDiscount: true,
      variants: [
        variant({ id: "b", price: 560, originalPrice: 700, sortOrder: 0 }),
        variant({ id: "a", price: 400, originalPrice: 500, sortOrder: 1 }),
      ],
    });
    expect(productBadge(p)).toEqual({ kind: "discount", label: "20% OFF" });
  });

  it("returns Most sold over New", () => {
    const p = product({ isBestSeller: true, isNew: true });
    expect(productBadge(p)).toEqual({ kind: "bestSeller", label: "Most sold" });
  });

  it("returns New when it is the only flag set", () => {
    const p = product({ isNew: true });
    expect(productBadge(p)).toEqual({ kind: "new", label: "New" });
  });

  it("falls THROUGH to Most sold when showDiscount is on but no MRP is on file", () => {
    const p = product({
      price: 400,
      originalPrice: null,
      showDiscount: true,
      isBestSeller: true,
    });
    expect(productBadge(p)).toEqual({ kind: "bestSeller", label: "Most sold" });
  });

  it("falls THROUGH when showDiscount is on but the MRP is <= the price", () => {
    const p = product({
      price: 400,
      originalPrice: 400,
      showDiscount: true,
      isNew: true,
    });
    expect(productBadge(p)).toEqual({ kind: "new", label: "New" });
  });

  it("returns null when showDiscount is on, the MRP is invalid and nothing else applies", () => {
    expect(
      productBadge(product({ price: 400, originalPrice: 300, showDiscount: true })),
    ).toBeNull();
  });

  it("ignores a valid MRP entirely while showDiscount is OFF", () => {
    expect(productBadge(product({ price: 400, originalPrice: 500 }))).toBeNull();
  });
});

describe("displayPricePair", () => {
  it("no variants -> no prefix and the product's own price", () => {
    expect(displayPricePair(product({ price: 400 }))).toEqual({
      prefix: "",
      original: null,
      current: "₹400",
    });
  });

  it("no variants + active discount -> the struck MRP alongside the price", () => {
    expect(
      displayPricePair(
        product({ price: 400, originalPrice: 500, showDiscount: true }),
      ),
    ).toEqual({ prefix: "", original: "₹500", current: "₹400" });
  });

  it("variants -> the 'From ' prefix and the LOWEST-priced variant's pair", () => {
    const p = product({
      showDiscount: true,
      variants: [
        variant({ id: "b", price: 560, originalPrice: 700, sortOrder: 0 }),
        variant({ id: "a", price: 400, originalPrice: 500, sortOrder: 1 }),
      ],
    });
    expect(displayPricePair(p)).toEqual({
      prefix: "From ",
      original: "₹500",
      current: "₹400",
    });
  });

  it("omits the MRP whenever showDiscount is false, even with a valid MRP on file", () => {
    expect(
      displayPricePair(
        product({ price: 400, originalPrice: 500, showDiscount: false }),
      ).original,
    ).toBeNull();
  });

  it("omits the MRP when showDiscount is on but the MRP is not above the price", () => {
    expect(
      displayPricePair(
        product({ price: 400, originalPrice: 400, showDiscount: true }),
      ).original,
    ).toBeNull();
  });

  it("variants with ALL prices null -> 'Price on request' with NO 'From ' prefix", () => {
    const p = product({
      showDiscount: true,
      variants: [
        variant({ id: "a", price: null, originalPrice: 500 }),
        variant({ id: "b", price: null }),
      ],
    });
    expect(displayPricePair(p)).toEqual({
      prefix: "",
      original: null,
      current: "Price on request",
    });
  });

  it("a null single price renders 'Price on request'", () => {
    expect(displayPricePair(product({ price: null })).current).toBe(
      "Price on request",
    );
  });
});

// displayPriceLabel is now displayPricePair's prefix + current. These pin that
// its output strings are byte-identical to the pre-change behaviour.
describe("displayPriceLabel stays byte-identical after the rewrite", () => {
  it("matches prefix + current for a single-price product", () => {
    const pair = displayPricePair(product({ price: 250 }));
    expect(displayPriceLabel(250, [])).toBe("₹250");
    expect(displayPriceLabel(250, [])).toBe(pair.prefix + pair.current);
  });

  it("matches prefix + current for a variant product", () => {
    const variants = [variant({ price: 300 }), variant({ id: "v2", price: 120 })];
    const pair = displayPricePair(product({ price: 999, variants }));
    expect(displayPriceLabel(999, variants)).toBe("From ₹120");
    expect(displayPriceLabel(999, variants)).toBe(pair.prefix + pair.current);
  });

  it("never leaks a strikethrough into the label (the discount is not its job)", () => {
    const variants = [variant({ price: 400, originalPrice: 500 })];
    expect(displayPriceLabel(999, variants)).toBe("From ₹400");
  });
});
