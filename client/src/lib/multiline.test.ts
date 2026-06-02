import { describe, it, expect } from "vitest";
import { normalizeMultiline } from "@/lib/multiline";

describe("normalizeMultiline", () => {
  it("converts the literal /n token to a real newline", () => {
    expect(normalizeMultiline("Rose oil /n Calming")).toBe("Rose oil\nCalming");
  });

  it("converts the literal backslash-n token to a real newline", () => {
    expect(normalizeMultiline("Rose oil \\n Calming")).toBe("Rose oil\nCalming");
  });

  it("is a no-op when no marker is present", () => {
    expect(normalizeMultiline("Plain ingredient")).toBe("Plain ingredient");
  });

  it("passes a real newline through and still converts literal markers", () => {
    expect(normalizeMultiline("a\nb /n c")).toBe("a\nb\nc");
  });

  it("converts multiple markers in one string", () => {
    expect(normalizeMultiline("a /n b /n c")).toBe("a\nb\nc");
  });

  it("collapses optional surrounding spaces around the marker (no stray spaces)", () => {
    expect(normalizeMultiline("a/nb")).toBe("a\nb");
    expect(normalizeMultiline("a /n b")).toBe("a\nb");
    expect(normalizeMultiline("a/n b")).toBe("a\nb");
    expect(normalizeMultiline("a /nb")).toBe("a\nb");
  });

  it("handles the backslash-n variant with optional spaces", () => {
    expect(normalizeMultiline("a\\nb")).toBe("a\nb");
    expect(normalizeMultiline("a \\n b")).toBe("a\nb");
  });

  it("is idempotent", () => {
    const once = normalizeMultiline("a /n b \\n c");
    expect(normalizeMultiline(once)).toBe(once);
    expect(once).toBe("a\nb\nc");
  });
});
