import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(slugify("Neem Soap")).toBe("neem-soap");
  });

  it("strips punctuation and ampersands, no trailing hyphen", () => {
    expect(slugify("Neem & Tulsi Soap!")).toBe("neem-tulsi-soap");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(slugify("  Multani  Mitti  ")).toBe("multani-mitti");
  });

  it("collapses repeated separators with no leading/trailing hyphen", () => {
    expect(slugify("Rose---Cream")).toBe("rose-cream");
  });
});
