import { describe, it, expect } from "vitest";
import { toSubmission, type QuestionnaireValues } from "@/lib/questionnaire";

// A representative camelCase wizard payload, mirroring admin.test.ts's baseForm
// helper. The mapper under test (toSubmission) is the camelCase wizard -> D-05
// snake/payload boundary, the same "map once at the boundary" pattern as
// admin.ts fromProductForm.
function baseValues(
  overrides: Partial<QuestionnaireValues> = {},
): QuestionnaireValues {
  return {
    name: "Asha",
    email: "asha@example.com",
    skinType: "dry",
    concerns: ["acne", "dryness"],
    productInterest: "creams",
    allergies: "nuts",
    message: "Please make it gentle.",
    ...overrides,
  };
}

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("toSubmission", () => {
  it("maps skinType -> skin_type and message -> message columns", () => {
    const row = toSubmission(baseValues(), USER_ID);
    expect(row.skin_type).toBe("dry");
    expect(row.message).toBe("Please make it gentle.");
  });

  it("maps name/email straight through as columns", () => {
    const row = toSubmission(baseValues(), USER_ID);
    expect(row.name).toBe("Asha");
    expect(row.email).toBe("asha@example.com");
  });

  it("puts concerns/productInterest/allergies ONLY under payload (not as columns)", () => {
    const row = toSubmission(baseValues(), USER_ID);
    expect(row.payload).toEqual({
      concerns: ["acne", "dryness"],
      productInterest: "creams",
      allergies: "nuts",
    });
    // They must NOT leak out as top-level columns.
    expect(row).not.toHaveProperty("concerns");
    expect(row).not.toHaveProperty("productInterest");
    expect(row).not.toHaveProperty("allergies");
    expect(row).not.toHaveProperty("skinType");
  });

  it("sets user_id to null on the anon path (required by 0007 WITH CHECK)", () => {
    const row = toSubmission(baseValues(), null);
    expect(row.user_id).toBeNull();
  });

  it("sets user_id to the caller's id when logged in", () => {
    const row = toSubmission(baseValues(), USER_ID);
    expect(row.user_id).toBe(USER_ID);
  });

  it("coerces an undefined message to the empty string", () => {
    const row = toSubmission(baseValues({ message: undefined }), USER_ID);
    expect(row.message).toBe("");
  });

  it("coerces a missing message field to the empty string", () => {
    const { message: _omit, ...withoutMessage } = baseValues();
    void _omit;
    const row = toSubmission(withoutMessage as QuestionnaireValues, USER_ID);
    expect(row.message).toBe("");
  });

  it("preserves an empty concerns array under payload", () => {
    const row = toSubmission(baseValues({ concerns: [] }), USER_ID);
    expect(row.payload.concerns).toEqual([]);
  });

  it("produces exactly the D-05 column/payload shape and nothing more", () => {
    const row = toSubmission(baseValues(), USER_ID);
    expect(Object.keys(row).sort()).toEqual(
      ["email", "message", "name", "payload", "skin_type", "user_id"].sort(),
    );
  });
});
