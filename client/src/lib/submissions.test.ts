import { describe, it, expect } from "vitest";
import {
  submissionSnippet,
  submissionAnswers,
  submissionPreview,
  isUnread,
} from "@/lib/submissions";

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

// submissionAnswers maps BOTH submission shapes to the same label/value pairs
// the admin inbox + Profile history render: the new snapshot (payload.answers)
// and the legacy skin_type/payload/message columns.
describe("submissionAnswers", () => {
  it("maps the new payload.answers snapshot (joining array values)", () => {
    const row = {
      skin_type: null,
      message: null,
      payload: {
        answers: [
          {
            question_id: "q1",
            label: "Skin type",
            field_type: "single_select",
            value: "Dry",
          },
          {
            question_id: "q2",
            label: "Concerns",
            field_type: "multi_select",
            value: ["Acne", "Dullness"],
          },
        ],
      },
    };
    expect(submissionAnswers(row)).toEqual([
      { label: "Skin type", value: "Dry" },
      { label: "Concerns", value: "Acne, Dullness" },
    ]);
  });

  it("reconstructs a legacy row from skin_type + payload + message", () => {
    const row = {
      skin_type: "Oily",
      message: "Please keep it fragrance-free.",
      payload: {
        concerns: ["Acne"],
        productInterest: "clarifying soap",
        allergies: "nuts",
      },
    };
    expect(submissionAnswers(row)).toEqual([
      { label: "Skin type", value: "Oily" },
      { label: "Concerns", value: "Acne" },
      { label: "Looking for", value: "clarifying soap" },
      { label: "Allergies / avoid", value: "nuts" },
      { label: "Message", value: "Please keep it fragrance-free." },
    ]);
  });

  it("keeps an empty answer value (UI shows the em dash)", () => {
    const row = {
      skin_type: null,
      message: null,
      payload: {
        answers: [
          {
            question_id: "q1",
            label: "Allergies",
            field_type: "short_text",
            value: "",
          },
        ],
      },
    };
    expect(submissionAnswers(row)).toEqual([{ label: "Allergies", value: "" }]);
  });
});

// submissionPreview is the raw list-row preview (truncated by submissionSnippet).
describe("submissionPreview", () => {
  it("prefers the legacy message column when present", () => {
    const row = {
      skin_type: "Dry",
      message: "A short note.",
      payload: { concerns: ["Acne"] },
    };
    expect(submissionPreview(row)).toBe("A short note.");
  });

  it("falls back to the first non-empty snapshot answer for new rows", () => {
    const row = {
      skin_type: null,
      message: null,
      payload: {
        answers: [
          {
            question_id: "q1",
            label: "Allergies",
            field_type: "short_text",
            value: "",
          },
          {
            question_id: "q2",
            label: "Skin type",
            field_type: "single_select",
            value: "Dry",
          },
        ],
      },
    };
    expect(submissionPreview(row)).toBe("Dry");
  });

  it("returns an empty string when nothing is fillable", () => {
    expect(
      submissionPreview({ skin_type: null, message: null, payload: null }),
    ).toBe("");
  });
});

// isUnread is the single shared new-row predicate used by both the inbox
// highlight/mark-on-open (Submissions.tsx) and the unread-count badge. It is the
// testable shape assertion for the status column: 'new' -> true, 'read' -> false.
describe("isUnread", () => {
  it("is true for a new submission", () => {
    expect(isUnread({ status: "new" })).toBe(true);
  });

  it("is false for a read submission", () => {
    expect(isUnread({ status: "read" })).toBe(false);
  });
});
