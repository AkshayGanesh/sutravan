import { describe, it, expect } from "vitest";
import {
  toSubmission,
  buildQuestionnaireSchema,
  buildDefaultValues,
  type QuestionnaireQuestion,
  type QuestionnaireValues,
} from "@/lib/questionnaire";

// A representative configurable question set, mirroring the 5 seeded questions
// (migration 0012) in miniature: one of each select type plus text.
const QUESTIONS: QuestionnaireQuestion[] = [
  {
    id: "q-skin",
    label: "Skin type",
    help_text: null,
    field_type: "single_select",
    options: ["Dry", "Oily"],
    placeholder: null,
    required: true,
    sort_order: 0,
  },
  {
    id: "q-concerns",
    label: "Skin concerns",
    help_text: "Choose any that apply.",
    field_type: "multi_select",
    options: ["Acne", "Dryness"],
    placeholder: null,
    required: false,
    sort_order: 1,
  },
  {
    id: "q-note",
    label: "Anything else?",
    help_text: null,
    field_type: "long_text",
    options: [],
    placeholder: null,
    required: false,
    sort_order: 2,
  },
];

const USER_ID = "11111111-1111-1111-1111-111111111111";

function baseValues(
  overrides: Partial<QuestionnaireValues> = {},
): QuestionnaireValues {
  return {
    name: "Asha",
    email: "asha@example.com",
    "q-skin": "Dry",
    "q-concerns": ["Acne", "Dryness"],
    "q-note": "Please make it gentle.",
    ...overrides,
  };
}

describe("toSubmission", () => {
  it("maps name/email straight through as columns", () => {
    const row = toSubmission(baseValues(), QUESTIONS, USER_ID);
    expect(row.name).toBe("Asha");
    expect(row.email).toBe("asha@example.com");
  });

  it("snapshots every question as a payload.answers entry (label + field_type + value)", () => {
    const row = toSubmission(baseValues(), QUESTIONS, USER_ID);
    expect(row.payload.answers).toEqual([
      {
        question_id: "q-skin",
        label: "Skin type",
        field_type: "single_select",
        value: "Dry",
      },
      {
        question_id: "q-concerns",
        label: "Skin concerns",
        field_type: "multi_select",
        value: ["Acne", "Dryness"],
      },
      {
        question_id: "q-note",
        label: "Anything else?",
        field_type: "long_text",
        value: "Please make it gentle.",
      },
    ]);
  });

  it("does NOT leak the legacy skin_type / message columns", () => {
    const row = toSubmission(baseValues(), QUESTIONS, USER_ID);
    expect(row).not.toHaveProperty("skin_type");
    expect(row).not.toHaveProperty("message");
  });

  it("preserves snapshot order from the questions array, not the values object", () => {
    const row = toSubmission(baseValues(), QUESTIONS, USER_ID);
    expect(row.payload.answers.map((a) => a.question_id)).toEqual([
      "q-skin",
      "q-concerns",
      "q-note",
    ]);
  });

  it("fills a missing multi_select answer with [] and a missing text answer with ''", () => {
    const { "q-concerns": _c, "q-note": _n, ...partial } = baseValues();
    void _c;
    void _n;
    const row = toSubmission(partial as QuestionnaireValues, QUESTIONS, USER_ID);
    const concerns = row.payload.answers.find(
      (a) => a.question_id === "q-concerns",
    );
    const note = row.payload.answers.find((a) => a.question_id === "q-note");
    expect(concerns?.value).toEqual([]);
    expect(note?.value).toBe("");
  });

  it("sets user_id to null on the anon path (required by 0007 WITH CHECK)", () => {
    const row = toSubmission(baseValues(), QUESTIONS, null);
    expect(row.user_id).toBeNull();
  });

  it("sets user_id to the caller's id when logged in", () => {
    const row = toSubmission(baseValues(), QUESTIONS, USER_ID);
    expect(row.user_id).toBe(USER_ID);
  });

  it("produces exactly the column/payload shape and nothing more", () => {
    const row = toSubmission(baseValues(), QUESTIONS, USER_ID);
    expect(Object.keys(row).sort()).toEqual(
      ["email", "name", "payload", "user_id"].sort(),
    );
  });
});

describe("buildDefaultValues", () => {
  it("defaults multi_select to [] and other fields to ''", () => {
    const defaults = buildDefaultValues(QUESTIONS);
    expect(defaults["q-skin"]).toBe("");
    expect(defaults["q-concerns"]).toEqual([]);
    expect(defaults["q-note"]).toBe("");
    expect(defaults.name).toBe("");
    expect(defaults.email).toBe("");
  });

  it("prefills email when provided (logged-in path)", () => {
    const defaults = buildDefaultValues(QUESTIONS, "asha@example.com");
    expect(defaults.email).toBe("asha@example.com");
  });
});

describe("buildQuestionnaireSchema", () => {
  it("requires name + a valid email and a required single-select", () => {
    const schema = buildQuestionnaireSchema(QUESTIONS);
    const bad = schema.safeParse({
      name: "",
      email: "not-an-email",
      "q-skin": "",
      "q-concerns": [],
      "q-note": "",
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a fully valid payload", () => {
    const schema = buildQuestionnaireSchema(QUESTIONS);
    const ok = schema.safeParse(baseValues());
    expect(ok.success).toBe(true);
  });

  it("allows an empty answer for a non-required question", () => {
    const schema = buildQuestionnaireSchema(QUESTIONS);
    const ok = schema.safeParse(
      baseValues({ "q-concerns": [], "q-note": "" }),
    );
    expect(ok.success).toBe(true);
  });
});
