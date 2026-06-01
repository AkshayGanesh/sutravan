import { describe, it, expect } from "vitest";
import { mapWriteError } from "@/lib/adminErrors";

describe("mapWriteError", () => {
  it("maps PostgREST 23503 (FK violation) to the in-use-category copy", () => {
    const msg = mapWriteError({ code: "23503" });
    expect(msg).toContain("move or delete them first");
  });

  it("maps PostgREST 23505 (unique violation) to a name/slug collision signal", () => {
    const msg = mapWriteError({ code: "23505" });
    expect(msg.toLowerCase()).toMatch(/already|in use|taken/);
  });

  it("maps network/fetch failures to the network copy", () => {
    expect(mapWriteError({ message: "Failed to fetch" })).toBe(
      "Network error — please check your connection and try again.",
    );
  });

  it("falls back to the generic save copy for unknown errors", () => {
    expect(mapWriteError({})).toBe(
      "Something went wrong while saving. Please try again.",
    );
    expect(mapWriteError(null)).toBe(
      "Something went wrong while saving. Please try again.",
    );
  });
});
