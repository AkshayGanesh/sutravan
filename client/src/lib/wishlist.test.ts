import { describe, it, expect } from "vitest";
import { toWishlistItem, type WishlistItem } from "@/lib/wishlist";

// A representative joined `wishlists` + `products` PostgREST row. The mapper
// must bind the products UUID -> productId and the text slug -> slug, and
// resolve images via productImageUrls (catalog.ts).
function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    product_id: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-06-01T00:00:00.000Z",
    products: {
      id: "00000000-0000-0000-0000-000000000001",
      slug: "neem",
      name: "Neem Soap",
      subtitle: "Purifying bar",
      price: 250,
      images: ["products/neem/1.jpg"],
      categories: { slug: "soap" },
      ...overrides,
    },
  };
}

describe("toWishlistItem", () => {
  it("maps productId (UUID), slug, name, price and category correctly", () => {
    const item = toWishlistItem(baseRow());
    expect(item.productId).toBe("00000000-0000-0000-0000-000000000001");
    expect(item.slug).toBe("neem");
    expect(item.name).toBe("Neem Soap");
    expect(item.price).toBe(250);
    expect(item.category).toBe("soap");
  });

  it("coerces a null subtitle to the empty string", () => {
    const item = toWishlistItem(baseRow({ subtitle: null }));
    expect(item.subtitle).toBe("");
  });

  it("keeps a null price as null (renders 'Price on request' downstream)", () => {
    const item = toWishlistItem(baseRow({ price: null }));
    expect(item.price).toBeNull();
  });

  it("yields a non-empty images array (placeholder) when products.images is empty", () => {
    const item: WishlistItem = toWishlistItem(baseRow({ images: [] }));
    expect(item.images.length).toBeGreaterThan(0);
  });

  it("resolves a non-empty images array for a populated image set", () => {
    const item = toWishlistItem(baseRow());
    expect(item.images.length).toBe(1);
  });
});
