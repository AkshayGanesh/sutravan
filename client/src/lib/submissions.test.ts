import { describe, it, expect } from "vitest";
import { submissionSnippet } from "@/lib/submissions";

// submissionSnippet is the pure one-line list-row helper shared by the admin
// inbox (Submissions.tsx) and the customer's own history (Profile.tsx). It must
// return '—' for empty/null, collapse internal whitespace, and truncate long
// messages to 80 chars with an ellipsis.
describe("submissionSnippet", () => {
  it("returns an em dash for null", () => {
    expect(submissionSnippet(null)).toBe("—");
  });

  it("returns an em dash for an empty string", () => {
    expect(submissionSnippet("")).toBe("—");
  });

  it("returns an em dash for a whitespace-only string", () => {
    expect(submissionSnippet("   \n\t  ")).toBe("—");
  });

  it("collapses internal whitespace to single spaces", () => {
    expect(submissionSnippet("hello   world\n\tagain")).toBe(
      "hello world again",
    );
  });

  it("trims leading/trailing whitespace", () => {
    expect(submissionSnippet("  trimmed  ")).toBe("trimmed");
  });

  it("passes through a short message unchanged", () => {
    const short = "I would like a lavender soap for sensitive skin.";
    expect(submissionSnippet(short)).toBe(short);
  });

  it("truncates a long message to 80 chars plus an ellipsis", () => {
    const long = "a".repeat(200);
    const result = submissionSnippet(long);
    expect(result).toBe(`${"a".repeat(80)}…`);
    // 80 content chars + the single ellipsis character.
    expect(result).toHaveLength(81);
  });

  it("does not truncate a message of exactly 80 chars", () => {
    const exact = "b".repeat(80);
    expect(submissionSnippet(exact)).toBe(exact);
  });
});
