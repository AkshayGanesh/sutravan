// The customer questionnaire data layer (CUST-03): the Zod schema, the pure
// camelCase-wizard -> D-05 snake/payload mapper, and the thin Edge-Function
// invoke wrapper. This is the symmetric customer-side analogue of admin.ts
// fromProductForm — the camelCase form shape is mapped to its DB row shape ONCE
// at this boundary, never per component.
//
// D-05 field destinations (the binding contract):
//   name              -> `name`   column
//   email             -> `email`  column
//   skin type         -> `skin_type` column (admin inbox renders it as a Badge)
//   message / note    -> `message` column
//   skin concerns     -> payload.concerns       (jsonb)
//   product interest  -> payload.productInterest (jsonb)
//   allergies / avoid -> payload.allergies       (jsonb)
//
// The admin inbox (pages/admin/Submissions.tsx) pretty-prints `payload` via
// JSON.stringify(payload, null, 2) under a "Details" field, so the payload keys
// are deliberately human-readable — they render verbatim for the owner.
import { z } from "zod";
import { supabase } from "./supabase";

// ── Schema (RHF + zodResolver source of truth) ───────────────────────────────
//
// name/email are required + email-format validated on the anon path (D-02);
// for logged-in users they are prefilled from the account and locked (D-08) but
// still satisfy these same rules. skinType is required (single-select);
// concerns is a (possibly empty) multi-select array; productInterest/allergies
// are free text (may be empty); message is optional.
export const questionnaireSchema = z.object({
  name: z.string().trim().min(1, "Please add your name so we can reply."),
  email: z.string().trim().email("Enter a valid email address."),
  skinType: z.string().min(1, "Please choose your skin type."),
  concerns: z.array(z.string()).default([]),
  productInterest: z.string().default(""),
  allergies: z.string().default(""),
  message: z.string().optional(),
});

export type QuestionnaireValues = z.infer<typeof questionnaireSchema>;

// Per-step field groups for the multi-step wizard (D-06). `next()` runs
// form.trigger(STEP_FIELDS[step]) and only advances when that step's fields are
// valid. The review step (no input fields of its own) is not listed here.
export const STEP_FIELDS: Record<number, (keyof QuestionnaireValues)[]> = {
  0: ["name", "email"], // About you
  1: ["skinType", "concerns"], // Your skin
  2: ["productInterest", "allergies", "message"], // What you're looking for
};

// ── D-05 mapping boundary: camelCase wizard values -> snake/payload DB row ────

/** The exact insertable shape for `customization_submissions` (0001 columns). */
export type QuestionnaireSubmission = {
  name: string;
  email: string;
  skin_type: string;
  message: string;
  payload: {
    concerns: string[];
    productInterest: string;
    allergies: string;
  };
  user_id: string | null;
};

/**
 * Map the camelCase wizard values to the D-05 row shape.
 *
 * skin_type and message are dedicated columns; concerns/productInterest/
 * allergies live ONLY inside `payload`. `user_id` is the caller's id when
 * logged in, or `null` on the anon path (required by the 0007 INSERT RLS
 * WITH CHECK — anon rows must carry user_id = null). A missing/undefined
 * message collapses to '' so the column is never null.
 *
 * Pure and side-effect-free so it is trivially unit-testable (mirrors
 * admin.ts fromProductForm).
 */
export function toSubmission(
  values: QuestionnaireValues,
  userId: string | null,
): QuestionnaireSubmission {
  return {
    name: values.name,
    email: values.email,
    skin_type: values.skinType,
    message: values.message ?? "",
    payload: {
      concerns: values.concerns,
      productInterest: values.productInterest,
      allergies: values.allergies,
    },
    user_id: userId,
  };
}

// ── Edge-Function invoke wrapper (Plan 02 `verify-and-submit`) ────────────────

/**
 * Send a verified submission through the `verify-and-submit` Edge Function
 * (Plan 02). The function verifies the Turnstile `token` server-side, then
 * inserts `submission` under the caller's JWT so the 0007 RLS WITH CHECK is the
 * real ownership gate. Throws on error so the caller can toast.
 *
 * functions.invoke automatically attaches the session JWT (the logged-in
 * Authorization header); anon submitters reach the function with no auth header
 * and the row's user_id must be null.
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
