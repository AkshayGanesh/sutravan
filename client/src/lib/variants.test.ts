import { describe, it, expect } from "vitest";
import {
  toVariant,
  lowestVariantPrice,
  displayPriceLabel,
  type Variant,
} from "@/lib/variants";

// A camelCase Variant builder for the derivation tests.
function variant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: "v1",
    label: "70gm",
    price: 120,
    sortOrder: 0,
    ...overrides,
  };
}

describe("toVariant", () => {
  it("maps a snake_case row to a camelCase Variant", () => {
    const v = toVariant({ id: "abc", label: "200gm", price: 300, sort_order: 2 });
    expect(v).toEqual({ id: "abc", label: "200gm", price: 300, sortOrder: 2 });
  });

  it("keeps price null untouched (number | null)", () => {
    const v = toVariant({ id: "abc", label: "200gm", price: null, sort_order: 0 });
    expect(v.price).toBeNull();
  });

  it("defaults a missing sort_order to 0", () => {
    const v = toVariant({ id: "abc", label: "70gm", price: 120 });
    expect(v.sortOrder).toBe(0);
  });
});

describe("lowestVariantPrice", () => {
  it("returns null for no variants", () => {
    expect(lowestVariantPrice([])).toBeNull();
  });

  it("returns the minimum price across variants", () => {
    expect(
      lowestVariantPrice([variant({ price: 300 }), variant({ price: 120 })]),
    ).toBe(120);
  });

  it("ignores variants whose price is null when computing the minimum", () => {
    expect(
      lowestVariantPrice([
        variant({ price: null }),
        variant({ price: 300 }),
        variant({ price: 120 }),
      ]),
    ).toBe(120);
  });

  it("returns null when ALL variant prices are null", () => {
    expect(
      lowestVariantPrice([variant({ price: null }), variant({ price: null })]),
    ).toBeNull();
  });
});

describe("displayPriceLabel", () => {
  it("with no variants -> formatPrice(productPrice) exactly", () => {
    expect(displayPriceLabel(250, [])).toBe("₹250");
  });

  it("with no variants and null product price -> 'Price on request'", () => {
    expect(displayPriceLabel(null, [])).toBe("Price on request");
  });

  it("with variants -> 'From ' + formatPrice(lowest)", () => {
    expect(
      displayPriceLabel(999, [variant({ price: 300 }), variant({ price: 120 })]),
    ).toBe("From ₹120");
  });

  it("ignores the single product price when variants exist", () => {
    // productPrice 50 is IGNORED; the variant lowest (120) drives the label.
    expect(displayPriceLabel(50, [variant({ price: 120 })])).toBe("From ₹120");
  });

  it("with variants but ALL prices null -> 'Price on request' (NO 'From ' prefix)", () => {
    expect(
      displayPriceLabel(250, [variant({ price: null }), variant({ price: null })]),
    ).toBe("Price on request");
  });
});
