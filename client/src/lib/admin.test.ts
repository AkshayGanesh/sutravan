import { describe, it, expect } from "vitest";
import {
  fromProductForm,
  imageStoragePath,
  diffVariants,
  fromVariantForm,
  type ProductFormValues,
  type VariantFormValues,
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
    inStock: true,
    showPatchTestNote: false,
    originalPrice: null,
    showDiscount: false,
    isNew: false,
    isBestSeller: false,
    imagePaths: ["products/neem/1.jpg"],
    variants: [],
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
    expect(row.in_stock).toBe(true);
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

describe("fromProductForm in_stock mapping", () => {
  it("maps inStock: true -> row.in_stock === true", () => {
    const row = fromProductForm(baseForm({ inStock: true }), CATEGORY_ID);
    expect(row.in_stock).toBe(true);
  });

  it("maps inStock: false -> row.in_stock === false", () => {
    const row = fromProductForm(baseForm({ inStock: false }), CATEGORY_ID);
    expect(row.in_stock).toBe(false);
  });
});

describe("fromProductForm show_patch_test_note mapping", () => {
  it("maps showPatchTestNote: true -> row.show_patch_test_note === true", () => {
    const row = fromProductForm(baseForm({ showPatchTestNote: true }), CATEGORY_ID);
    expect(row.show_patch_test_note).toBe(true);
  });

  it("maps showPatchTestNote: false -> row.show_patch_test_note === false", () => {
    const row = fromProductForm(baseForm({ showPatchTestNote: false }), CATEGORY_ID);
    expect(row.show_patch_test_note).toBe(false);
  });
});

describe("fromProductForm badge + MRP mapping (QUICK-260731-grz)", () => {
  it("maps a numeric originalPrice -> row.original_price", () => {
    const row = fromProductForm(baseForm({ originalPrice: 500 }), CATEGORY_ID);
    expect(row.original_price).toBe(500);
  });

  it("maps a null originalPrice -> row.original_price === null (no MRP on file)", () => {
    const row = fromProductForm(baseForm({ originalPrice: null }), CATEGORY_ID);
    expect(row.original_price).toBeNull();
  });

  it("maps the three badge booleans to their snake_case columns when true", () => {
    const row = fromProductForm(
      baseForm({ showDiscount: true, isNew: true, isBestSeller: true }),
      CATEGORY_ID,
    );
    expect(row.show_discount).toBe(true);
    expect(row.is_new).toBe(true);
    expect(row.is_best_seller).toBe(true);
  });

  it("maps the three badge booleans when false (the default, un-badged product)", () => {
    const row = fromProductForm(
      baseForm({ showDiscount: false, isNew: false, isBestSeller: false }),
      CATEGORY_ID,
    );
    expect(row.show_discount).toBe(false);
    expect(row.is_new).toBe(false);
    expect(row.is_best_seller).toBe(false);
  });
});

describe("imageStoragePath", () => {
  it("builds the D-08 convention products/{slug}/{filename}", () => {
    expect(imageStoragePath("neem", "1.jpg")).toBe("products/neem/1.jpg");
  });
});

describe("fromVariantForm", () => {
  it("maps camelCase VariantFormValues -> snake_case row (sans id/product_id)", () => {
    const row = fromVariantForm({
      label: "70gm",
      price: 120,
      originalPrice: 150,
      sortOrder: 2,
    });
    expect(row).toEqual({
      label: "70gm",
      price: 120,
      original_price: 150,
      sort_order: 2,
    });
  });

  it("keeps a null price untouched", () => {
    const row = fromVariantForm({
      label: "200gm",
      price: null,
      originalPrice: null,
      sortOrder: 0,
    });
    expect(row.price).toBeNull();
  });

  it("maps a null originalPrice -> original_price === null (no MRP for this weight)", () => {
    const row = fromVariantForm({
      label: "200gm",
      price: 300,
      originalPrice: null,
      sortOrder: 0,
    });
    expect(row.original_price).toBeNull();
  });
});

describe("diffVariants", () => {
  const existing = [
    { id: "a", label: "70gm", price: 120, original_price: null, sort_order: 0 },
    { id: "b", label: "200gm", price: 300, original_price: 400, sort_order: 1 },
  ];

  // The existing rows expressed as the camelCase form shape (unchanged submit).
  const asSubmitted = (): VariantFormValues[] =>
    existing.map((e) => ({
      id: e.id,
      label: e.label,
      price: e.price,
      originalPrice: e.original_price,
      sortOrder: e.sort_order,
    }));

  it("flags a submitted row with no id as toInsert", () => {
    const submitted: VariantFormValues[] = [
      ...asSubmitted(),
      { label: "500gm", price: 600, originalPrice: null, sortOrder: 2 },
    ];
    const { toInsert, toUpdate, toDelete } = diffVariants(existing, submitted);
    expect(toInsert).toEqual([
      { label: "500gm", price: 600, originalPrice: null, sortOrder: 2 },
    ]);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it("flags a submitted row whose id matches but fields differ as toUpdate", () => {
    const submitted: VariantFormValues[] = [
      { id: "a", label: "70gm", price: 150, originalPrice: null, sortOrder: 0 }, // price changed
      { id: "b", label: "200gm", price: 300, originalPrice: 400, sortOrder: 1 }, // unchanged
    ];
    const { toInsert, toUpdate, toDelete } = diffVariants(existing, submitted);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([
      { id: "a", label: "70gm", price: 150, originalPrice: null, sortOrder: 0 },
    ]);
    expect(toDelete).toEqual([]);
  });

  it("treats an unchanged matching row as a no-op (in neither insert nor update)", () => {
    const { toInsert, toUpdate, toDelete } = diffVariants(existing, asSubmitted());
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it("flags an existing id absent from submitted as toDelete", () => {
    const submitted: VariantFormValues[] = [
      { id: "a", label: "70gm", price: 120, originalPrice: null, sortOrder: 0 },
    ];
    const { toInsert, toUpdate, toDelete } = diffVariants(existing, submitted);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual(["b"]);
  });

  // THE key regression this change is most exposed to: without original_price in
  // diffVariants' change check, editing ONLY an MRP would issue no UPDATE and
  // the owner's edit would silently vanish on save.
  it("flags an MRP-ONLY change as toUpdate (setting a first MRP on a row)", () => {
    const submitted = asSubmitted();
    submitted[0] = { ...submitted[0], originalPrice: 150 }; // 120/null -> 120/150
    const { toInsert, toUpdate, toDelete } = diffVariants(existing, submitted);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([
      { id: "a", label: "70gm", price: 120, originalPrice: 150, sortOrder: 0 },
    ]);
    expect(toDelete).toEqual([]);
  });

  it("flags an MRP-ONLY change as toUpdate (clearing an existing MRP)", () => {
    const submitted = asSubmitted();
    submitted[1] = { ...submitted[1], originalPrice: null }; // 300/400 -> 300/null
    const { toUpdate } = diffVariants(existing, submitted);
    expect(toUpdate).toEqual([
      { id: "b", label: "200gm", price: 300, originalPrice: null, sortOrder: 1 },
    ]);
  });

  it("still reports a no-op when nothing INCLUDING the MRP changed", () => {
    const { toInsert, toUpdate, toDelete } = diffVariants(existing, asSubmitted());
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it("empty submitted + empty existing -> all three arrays empty (0-variant product)", () => {
    const { toInsert, toUpdate, toDelete } = diffVariants([], []);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
  });
});
