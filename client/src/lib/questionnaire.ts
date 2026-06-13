// The customer questionnaire data layer: the public read of the
// admin-configurable questions (migration 0012), a dynamic Zod schema built
// from those questions, the form-defaults builder, the pure wizard -> DB-row
// mapper, and the thin Edge-Function invoke wrapper.
//
// The questions are NO LONGER hard-coded — the owner manages them from
// /admin/questions. Name + Email stay the FIXED contact step in code (Email
// drives the admin notification email + account linking), so they are part of
// the schema here but are not configurable questions.
//
// Submission shape (binding contract with the admin inbox + Profile history):
//   name  -> `name`  column        (fixed contact field)
//   email -> `email` column        (fixed contact field)
//   every configurable question's answer -> payload.answers[] as a SNAPSHOT
//     ({ question_id, label, field_type, value }). Snapshotting keeps historical
//     submissions readable after a question is edited/deleted (no FK to chase).
// The legacy `skin_type` / `message` columns are left unset on new rows; old
// rows keep them and lib/submissions.ts renders both shapes uniformly.
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

// ── Question model (migration 0012) ──────────────────────────────────────────

export type QuestionFieldType =
  | "single_select"
  | "multi_select"
  | "short_text"
  | "long_text";

/** A configurable question row as read by the public form (snake_case). */
export interface QuestionnaireQuestion {
  id: string;
  label: string;
  help_text: string | null;
  field_type: QuestionFieldType;
  options: string[]; // [] for the text types
  placeholder: string | null;
  required: boolean;
  sort_order: number;
}

const QUESTION_SELECT =
  "id, label, help_text, field_type, options, placeholder, required, sort_order";

async function fetchQuestionnaireQuestions(): Promise<QuestionnaireQuestion[]> {
  const { data, error } = await supabase
    .from("questionnaire_questions")
    .select(QUESTION_SELECT)
    .order("sort_order", { ascending: true });
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []) as QuestionnaireQuestion[];
}

/**
 * Public read of the live questionnaire questions (anon + authenticated via the
 * questionnaire_questions_public_read RLS, migration 0012). The ['questionnaire']
 * key family is invalidated by the admin write hooks (lib/admin.ts) so the form
 * reflects edits with no redeploy.
 */
export function useQuestionnaireQuestions() {
  return useQuery({
    queryKey: ["questionnaire", "questions"],
    queryFn: fetchQuestionnaireQuestions,
  });
}

// ── Dynamic form plumbing (schema + defaults keyed by question id) ────────────

const isSelect = (t: QuestionFieldType) =>
  t === "single_select" || t === "multi_select";

/**
 * Build the RHF/zodResolver schema for a given question set. Name + Email are
 * always present (required; email format-checked). Each question contributes one
 * field keyed by its id: multi_select -> string[]; everything else -> string.
 * `required` adds a min(1) so empty answers fail validation for that step.
 *
 * Pure (no React/IO) and built ONCE from the loaded questions by the form
 * component, so the resolver is stable for the session.
 */
export function buildQuestionnaireSchema(questions: QuestionnaireQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {
    name: z.string().trim().min(1, "Please add your name so we can reply."),
    email: z.string().trim().email("Enter a valid email address."),
  };
  for (const q of questions) {
    if (q.field_type === "multi_select") {
      const arr = z.array(z.string());
      shape[q.id] = q.required
        ? arr.min(1, "Please choose at least one option.")
        : arr;
    } else {
      const str = z.string();
      shape[q.id] = q.required ? str.min(1, "This field is required.") : str;
    }
  }
  return z.object(shape);
}

/** Form values: fixed name/email plus one entry per question id. */
export type QuestionnaireValues = {
  name: string;
  email: string;
  [questionId: string]: string | string[];
};

/**
 * Default values for the form: empty name/email (email prefilled by the caller
 * for logged-in users) plus a per-question default — [] for multi_select, ''
 * otherwise — so every field is controlled from first render.
 */
export function buildDefaultValues(
  questions: QuestionnaireQuestion[],
  email = "",
): QuestionnaireValues {
  const values: QuestionnaireValues = { name: "", email };
  for (const q of questions) {
    values[q.id] = q.field_type === "multi_select" ? [] : "";
  }
  return values;
}

// ── Mapping boundary: wizard values -> snake/payload DB row ───────────────────

/** A single snapshotted answer stored in payload.answers. */
export type SubmissionAnswer = {
  question_id: string;
  label: string;
  field_type: QuestionFieldType;
  value: string | string[];
};

/** The exact insertable shape for `customization_submissions` (new rows). */
export type QuestionnaireSubmission = {
  name: string;
  email: string;
  payload: { answers: SubmissionAnswer[] };
  user_id: string | null;
};

/**
 * Map the wizard values to the DB row. name/email are the fixed contact
 * columns; every configurable question becomes a SNAPSHOT entry in
 * payload.answers (label + field_type captured at submit time). `user_id` is
 * the caller's id when logged in, or `null` on the anon path (required by the
 * 0007 INSERT RLS WITH CHECK — anon rows must carry user_id = null).
 *
 * Pure and side-effect-free so it is trivially unit-testable.
 */
export function toSubmission(
  values: QuestionnaireValues,
  questions: QuestionnaireQuestion[],
  userId: string | null,
): QuestionnaireSubmission {
  return {
    name: String(values.name ?? ""),
    email: String(values.email ?? ""),
    payload: {
      answers: questions.map((q) => ({
        question_id: q.id,
        label: q.label,
        field_type: q.field_type,
        value: values[q.id] ?? (q.field_type === "multi_select" ? [] : ""),
      })),
    },
    user_id: userId,
  };
}

// ── Edge-Function invoke wrapper (verify-and-submit) ──────────────────────────

/**
 * Send a verified submission through the `verify-and-submit` Edge Function. The
 * function verifies the Turnstile `token` server-side, then inserts `submission`
 * under the caller's JWT so the 0007 RLS WITH CHECK is the real ownership gate.
 * Throws on error so the caller can toast.
 */
export async function submitQuestionnaire(
  token: string,
  submission: QuestionnaireSubmission,
): Promise<void> {
  const { error } = await supabase.functions.invoke("verify-and-submit", {
    body: { token, submission },
  });
  if (error) {
    throw error;
  }
}

// Re-exported only so existing call sites that imported it keep type-checking;
// the select-vs-text branch is also used by the form renderer.
export { isSelect };
