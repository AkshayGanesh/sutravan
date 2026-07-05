import { describe, it, expect } from "vitest";

// deliverySchema is a PURE Zod object + formatPreviewLine is a PURE string
// builder. Neither pulls the supabase client at runtime (the estimate result
// shape is imported with `import type`, which is erased at compile time), so
// this suite needs no vi.mock — it runs in the plain node env with no VITE_
// env vars and no network.
import { deliverySchema, formatPreviewLine } from "@/pages/admin/deliverySchema";
import type { DeliveryEstimateResult } from "@/lib/delivery";

// A fully-valid input the individual field cases override one key at a time.
function base(overrides: Record<string, unknown> = {}) {
  return {
    originPincode: "560001",
    defaultWeightG: 250,
    dispatchLeadDays: 1,
    codEnabled: true,
    codFee: 30,
    codValueCap: "",
    freeShipThreshold: "",
    ...overrides,
  };
}

describe("deliverySchema — originPincode (D-15 6-digit / D-10 placeholder)", () => {
  it("accepts a real 6-digit pincode", () => {
    const r = deliverySchema.safeParse(base({ originPincode: "560001" }));
    expect(r.success).toBe(true);
  });

  it("rejects a 5-digit pincode with the 6-digit message", () => {
    const r = deliverySchema.safeParse(base({ originPincode: "12345" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "originPincode")
        ?.message;
      expect(msg).toBe("Enter a 6-digit pincode");
    }
  });

  it("rejects a 7-digit pincode", () => {
    const r = deliverySchema.safeParse(base({ originPincode: "1234567" }));
    expect(r.success).toBe(false);
  });

  it("rejects the 000000 placeholder with a distinct message (D-10)", () => {
    const r = deliverySchema.safeParse(base({ originPincode: "000000" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "originPincode")
        ?.message;
      expect(msg).toBe("Enter a real origin pincode");
    }
  });
});

describe("deliverySchema — defaultWeightG (D-15 int 1..2000)", () => {
  it("accepts the lower and upper bounds 1 and 2000", () => {
    expect(deliverySchema.safeParse(base({ defaultWeightG: 1 })).success).toBe(
      true,
    );
    expect(
      deliverySchema.safeParse(base({ defaultWeightG: 2000 })).success,
    ).toBe(true);
  });

  it("rejects 0, 2001, -1 and a decimal string", () => {
    expect(deliverySchema.safeParse(base({ defaultWeightG: 0 })).success).toBe(
      false,
    );
    expect(
      deliverySchema.safeParse(base({ defaultWeightG: 2001 })).success,
    ).toBe(false);
    expect(deliverySchema.safeParse(base({ defaultWeightG: -1 })).success).toBe(
      false,
    );
    expect(
      deliverySchema.safeParse(base({ defaultWeightG: "2.5" })).success,
    ).toBe(false);
  });
});

describe("deliverySchema — dispatchLeadDays (D-15 int 0..14)", () => {
  it("accepts the lower and upper bounds 0 and 14", () => {
    expect(
      deliverySchema.safeParse(base({ dispatchLeadDays: 0 })).success,
    ).toBe(true);
    expect(
      deliverySchema.safeParse(base({ dispatchLeadDays: 14 })).success,
    ).toBe(true);
  });

  it("rejects -1, 15 and a decimal string", () => {
    expect(
      deliverySchema.safeParse(base({ dispatchLeadDays: -1 })).success,
    ).toBe(false);
    expect(
      deliverySchema.safeParse(base({ dispatchLeadDays: 15 })).success,
    ).toBe(false);
    expect(
      deliverySchema.safeParse(base({ dispatchLeadDays: "1.5" })).success,
    ).toBe(false);
  });
});

describe("deliverySchema — codFee (D-15 required-when-enabled)", () => {
  it("raises an issue on ['codFee'] when COD is enabled and the fee is blank", () => {
    const r = deliverySchema.safeParse(base({ codEnabled: true, codFee: "" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "codFee");
      expect(issue?.message).toBe("Enter a COD fee (₹0 or more)");
    }
  });

  it("accepts a zero fee when COD is enabled", () => {
    expect(
      deliverySchema.safeParse(base({ codEnabled: true, codFee: 0 })).success,
    ).toBe(true);
  });

  it("rejects a negative fee", () => {
    expect(
      deliverySchema.safeParse(base({ codEnabled: true, codFee: -1 })).success,
    ).toBe(false);
  });

  it("does not require a fee when COD is disabled", () => {
    expect(
      deliverySchema.safeParse(base({ codEnabled: false, codFee: "" })).success,
    ).toBe(true);
  });
});

describe("deliverySchema — codValueCap / freeShipThreshold (D-14 blank→null, >0)", () => {
  it("maps blank and null codValueCap to null", () => {
    const a = deliverySchema.safeParse(base({ codValueCap: "" }));
    const b = deliverySchema.safeParse(base({ codValueCap: null }));
    expect(a.success && a.data.codValueCap).toBe(null);
    expect(b.success && b.data.codValueCap).toBe(null);
  });

  it("parses a numeric-string codValueCap to a number", () => {
    const r = deliverySchema.safeParse(base({ codValueCap: "5000" }));
    expect(r.success && r.data.codValueCap).toBe(5000);
  });

  it("rejects a zero or negative codValueCap (must be > 0 or blank)", () => {
    expect(deliverySchema.safeParse(base({ codValueCap: 0 })).success).toBe(
      false,
    );
    expect(deliverySchema.safeParse(base({ codValueCap: -1 })).success).toBe(
      false,
    );
  });

  it("maps blank freeShipThreshold to null and parses a numeric string", () => {
    const a = deliverySchema.safeParse(base({ freeShipThreshold: "" }));
    const b = deliverySchema.safeParse(base({ freeShipThreshold: "999" }));
    expect(a.success && a.data.freeShipThreshold).toBe(null);
    expect(b.success && b.data.freeShipThreshold).toBe(999);
  });

  it("rejects a zero freeShipThreshold", () => {
    expect(
      deliverySchema.safeParse(base({ freeShipThreshold: 0 })).success,
    ).toBe(false);
  });
});

describe("formatPreviewLine (SC1 / D-06 exact string)", () => {
  const serviceable: DeliveryEstimateResult = {
    serviceable: true,
    cost: 80,
    etaDays: { min: 3, max: 5 },
    codAvailable: true,
    originConfigured: true,
  };

  it("renders the exact serviceable line with COD available", () => {
    expect(formatPreviewLine("560001", "110001", serviceable)).toBe(
      "From 560001 to 110001: ₹80, 3–5 working days · COD available",
    );
  });

  it("renders 'COD not available' when COD is off", () => {
    expect(
      formatPreviewLine("560001", "110001", {
        ...serviceable,
        codAvailable: false,
      }),
    ).toBe("From 560001 to 110001: ₹80, 3–5 working days · COD not available");
  });

  it("renders the not-serviceable variant", () => {
    expect(
      formatPreviewLine("560001", "110001", {
        serviceable: false,
        cost: null,
        etaDays: null,
        codAvailable: false,
        originConfigured: true,
      }),
    ).toBe("From 560001 to 110001: not serviceable");
  });
});
