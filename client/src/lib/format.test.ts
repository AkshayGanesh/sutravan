import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format";

// formatPrice is the single source of truth for price rendering. Phase 7
// extends it with en-IN thousands grouping (D-04: the engine already rounded to
// ₹10 — the helper NEVER re-rounds and keeps whole rupees with no decimals).
describe("formatPrice", () => {
  it("groups thousands using the Indian (en-IN) system", () => {
    expect(formatPrice(1200)).toBe("₹1,200");
  });

  it("renders sub-thousand prices without a separator", () => {
    expect(formatPrice(90)).toBe("₹90");
  });

  it("renders 0 as a real, set price (not unset)", () => {
    expect(formatPrice(0)).toBe("₹0");
  });

  it("renders a null/unset price as the on-request copy", () => {
    expect(formatPrice(null)).toBe("Price on request");
  });
});
