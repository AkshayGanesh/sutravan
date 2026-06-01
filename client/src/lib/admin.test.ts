import { describe, it, expect } from "vitest";
import {
  fromProductForm,
  imageStoragePath,
  type ProductFormValues,
} from "@/lib/admin";

// A representative camelCase form payload. categoryId is resolved by the caller
// (slug -> id) and passed in separately, exactly as the data-layer does on write.
function baseForm(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    name: "Neem Soap",
    subtitle: "Purifying bar",
    category: "soap",
    price: 250,
    benefits: ["Clarifying", "Soothing"],
    ingredients: ["Neem", "Coconut oil"],
    tips: ["Lather gently"],
    shelfLife: "12 months",
    batchNote: "Small batch",
    isActive: true,
    imagePaths: ["products/neem/1.jpg"],
    slug: "neem",
    ...overrides,
  };
}

const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

// The minimal subset of catalog.ts's snake->camel reader, inlined so the
// round-trip assertion has no module side effects (catalog.ts imports image
// assets). The mapping under test is the exact reverse of catalog.ts toProduct.
function toProductCore(row: ReturnType<typeof fromProductForm>) {
  return {
    name: row.name,
    price: row.price,
    benefits: row.benefits ?? [],
    ingredients: row.ingredients ?? [],
    tips: row.tips ?? [],
    shelfLife: row.shelf_life ?? "",
    batchNote: row.batch_note ?? "",
  };
}

describe("fromProductForm", () => {
  it("keeps price: null when the form price is null (blank -> 'Price on request')", () => {
    const row = fromProductForm(baseForm({ price: null }), CATEGORY_ID);
    expect(row.price).toBeNull();
  });

  it("keeps a numeric price unchanged", () => {
    const row = fromProductForm(baseForm({ price: 250 }), CATEGORY_ID);
    expect(row.price).toBe(250);
  });

  it("maps camelCase fields to their snake_case DB columns", () => {
    const row = fromProductForm(baseForm(), CATEGORY_ID);
    expect(row.shelf_life).toBe("12 months");
    expect(row.batch_note).toBe("Small batch");
    expect(row.is_active).toBe(true);
    expect(row.images).toEqual(["products/neem/1.jpg"]);
    expect(row.category_id).toBe(CATEGORY_ID);
    expect(row.slug).toBe("neem");
  });

  it("coerces empty subtitle/shelfLife/batchNote to null (not the empty string)", () => {
    const row = fromProductForm(
      baseForm({ subtitle: "", shelfLife: "", batchNote: "" }),
      CATEGORY_ID,
    );
    expect(row.subtitle).toBeNull();
    expect(row.shelf_life).toBeNull();
    expect(row.batch_note).toBeNull();
  });

  it("coerces undefined optional fields to null", () => {
    const row = fromProductForm(
      baseForm({ subtitle: undefined, shelfLife: undefined, batchNote: undefined }),
      CATEGORY_ID,
    );
    expect(row.subtitle).toBeNull();
    expect(row.shelf_life).toBeNull();
    expect(row.batch_note).toBeNull();
  });

  it("round-trips through catalog.ts toProduct's core fields", () => {
    const form = baseForm();
    const row = fromProductForm(form, CATEGORY_ID);
    const back = toProductCore(row);
    expect(back).toEqual({
      name: form.name,
      price: form.price,
      benefits: form.benefits,
      ingredients: form.ingredients,
      tips: form.tips,
      shelfLife: form.shelfLife,
      batchNote: form.batchNote,
    });
  });

  it("round-trips a null-price draft with empty optionals", () => {
    const form = baseForm({
      price: null,
      subtitle: "",
      shelfLife: "",
      batchNote: "",
      isActive: false,
    });
    const row = fromProductForm(form, CATEGORY_ID);
    expect(row.is_active).toBe(false);
    const back = toProductCore(row);
    expect(back.price).toBeNull();
    // catalog.ts toProduct uses `?? ''` so a null shelf_life reads back as ''.
    expect(back.shelfLife).toBe("");
    expect(back.batchNote).toBe("");
  });
});

describe("imageStoragePath", () => {
  it("builds the D-08 convention products/{slug}/{filename}", () => {
    expect(imageStoragePath("neem", "1.jpg")).toBe("products/neem/1.jpg");
  });
});
