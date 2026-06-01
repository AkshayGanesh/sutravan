import { describe, it, expect } from "vitest";
import {
  assertImageAllowed,
  MAX_IMAGE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from "@/lib/imagePipeline";

describe("imagePipeline guard", () => {
  it("exposes a 10MB cap and the accepted MIME families", () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(ACCEPTED_IMAGE_TYPES).toEqual(
      expect.arrayContaining([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ]),
    );
  });

  it("rejects a file larger than 10MB", () => {
    const big = { size: 11 * 1024 * 1024, type: "image/jpeg", name: "big.jpg" };
    expect(() => assertImageAllowed(big)).toThrow(/too large|10/);
  });

  it("rejects an unsupported MIME type", () => {
    const txt = { size: 1024, type: "text/plain", name: "note.txt" };
    expect(() => assertImageAllowed(txt)).toThrow();
  });

  it("accepts jpeg/png/webp/heic without throwing", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(() =>
        assertImageAllowed({ size: 1024, type, name: `photo.${type}` }),
      ).not.toThrow();
    }
  });
});
