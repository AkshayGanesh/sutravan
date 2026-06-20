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
  section_id: string | null; // null = ungrouped (falls into "More questions")
}

/** A section row (migration 0013) — groups questions into a wizard step. */
export interface QuestionnaireSection {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

const QUESTION_SELECT =
  "id, label, help_text, field_type, options, placeholder, required, sort_order, section_id";

const SECTION_SELECT = "id, title, description, sort_order";

async function fetchQuestionnaireQuestions(): Promise<QuestionnaireQuestion[]> {
  const { data, error } = await supabase
    .from("questionnaire_questions")
    .select(QUESTION_SELECT)
    .order("sort_order", { ascending: true });
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []) as QuestionnaireQuestion[];
}

async function fetchQuestionnaireSections(): Promise<QuestionnaireSection[]> {
  const { data, error } = await supabase
    .from("questionnaire_sections")
    .select(SECTION_SELECT)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuestionnaireSection[];
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

/** Public read of the live sections (migration 0013), ordered by sort_order. */
export function useQuestionnaireSections() {
  return useQuery({
    queryKey: ["questionnaire", "sections"],
    queryFn: fetchQuestionnaireSections,
  });
}

// ── Section grouping (the wizard's step model) ────────────────────────────────

/** A wizard step: a section (real or the synthetic bucket) + its questions. */
export type QuestionGroup = {
  /** Stable key for React + the synthetic bucket sentinel. */
  id: string;
  title: string;
  description: string | null;
  questions: QuestionnaireQuestion[];
};

/** Sentinel id/title for the trailing bucket of ungrouped questions. */
export const UNGROUPED_SECTION_ID = "__ungrouped__";
const UNGROUPED_TITLE = "More questions";

/**
 * Group questions into ordered wizard steps. Real sections come first (in
 * sort_order, as returned), each carrying its questions (in their own
 * sort_order). Any question whose section_id is null OR points at a missing
 * section is collected into a single trailing "More questions" group. Groups
 * with zero questions are dropped so the wizard never shows an empty step.
 *
 * Pure (no React/IO) so it is trivially unit-testable and stable per render.
 */
export function groupIntoSections(
  sections: QuestionnaireSection[],
  questions: QuestionnaireQuestion[],
): QuestionGroup[] {
  const byId = new Map<string, QuestionnaireQuestion[]>();
  const ungrouped: QuestionnaireQuestion[] = [];
  const known = new Set(sections.map((s) => s.id));

  for (const q of questions) {
    if (q.section_id && known.has(q.section_id)) {
      const bucket = byId.get(q.section_id) ?? [];
      bucket.push(q);
      byId.set(q.section_id, bucket);
    } else {
      ungrouped.push(q);
    }
  }

  const groups: QuestionGroup[] = [];
  for (const s of sections) {
    const qs = byId.get(s.id);
    if (qs && qs.length > 0) {
      groups.push({
        id: s.id,
        title: s.title,
        description: s.description,
        questions: qs,
      });
    }
  }
  if (ungrouped.length > 0) {
    groups.push({
      id: UNGROUPED_SECTION_ID,
      title: UNGROUPED_TITLE,
      description: null,
      questions: ungrouped,
    });
  }
  return groups;
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
