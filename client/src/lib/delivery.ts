// The delivery-estimator client service layer: the thin invoke wrapper around
// the deployed `delivery-estimate` Edge Function, the boundary error mapper, and
// the React-Query mutation hook the UI presses.
//
// This is the site-wide headless layer (D-11): Phase 8's navbar widget plugs
// into `useDeliveryEstimate` with no refactor. It mirrors the questionnaire
// invoke pattern (lib/questionnaire.ts submitQuestionnaire) — a single
// `supabase.functions.invoke("<fn>", { body })` call that throws on the error
// branch so callers can render a failure state.
//
// D-10: the invoke body carries NO weightG — the Edge Function falls back to the
// seeded 250g `delivery_default_weight_g` default. The free-text variant label is
// NEVER parsed for grams. (The future DLVR-F2 per-variant weight will add it
// server-side; the UI path stays weightless.)
import { useMutation } from "@tanstack/react-query";
import { supabase } from "./supabase";

/**
 * The public response shape of the `delivery-estimate` Edge Function
 * (supabase/functions/delivery-estimate/index.ts L62-73). Named `*Result` (NOT
 * `DeliveryEstimate`) to avoid colliding with the `DeliveryEstimate` component.
 */
export interface DeliveryEstimateResult {
  serviceable: boolean;
  cost: number | null;
  etaDays: { min: number; max: number } | null;
  codAvailable: boolean;
  originConfigured: boolean;
}

/** The two client-facing outcomes an estimate failure maps to (D-13). */
export type EstimateErrorCode = "invalid-format" | "retry";

/**
 * PURE boundary mapper from the deployed function's string error codes to the
 * client outcome. Only `bad_request` (the server-side format re-validation) maps
 * to the inline invalid-format message; `captcha_failed`, network, timeout, 5xx,
 * an unknown code, or an unreadable body (null) all map to a retry.
 */
export function mapEstimateError(code: string | null): EstimateErrorCode {
  return code === "bad_request" ? "invalid-format" : "retry";
}

/** An estimate failure carrying the mapped client outcome for the UI to branch on. */
export class EstimateError extends Error {
  readonly code: EstimateErrorCode;
  constructor(code: EstimateErrorCode) {
    super(code);
    this.name = "EstimateError";
    this.code = code;
  }
}

/**
 * Invoke the deployed `delivery-estimate` Edge Function for one lookup. The
 * `token` is a single-use Turnstile token verified server-side; `destPincode` is
 * the customer's 6-digit pincode. On the `{ error }` branch we read the
 * FunctionsHttpError body (`error.context.json()`) to pull the `.error` string
 * code, map it, and throw an `EstimateError`; if the body cannot be read we throw
 * `EstimateError("retry")`. On success we return the normalized result.
 */
export async function estimateDelivery(
  token: string,
  destPincode: string,
): Promise<DeliveryEstimateResult> {
  const { data, error } = await supabase.functions.invoke("delivery-estimate", {
    body: { token, destPincode },
  });
  if (error) {
    let code: string | null = null;
    try {
      // FunctionsHttpError carries the Response on `.context`; the body is the
      // function's `{ error: "<code>" }` JSON (400 bad_request / captcha_failed).
      const context = (error as { context?: { json?: () => Promise<unknown> } })
        .context;
      const body = (await context?.json?.()) as { error?: string } | undefined;
      code = body?.error ?? null;
    } catch {
      code = null; // unreadable body -> retry via mapEstimateError(null)
    }
    throw new EstimateError(mapEstimateError(code));
  }
  return data as DeliveryEstimateResult;
}

/**
 * The mutation the UI presses. A mutation (not a passive query) because each
 * press is one deliberate single-use-token action — the token must never become
 * a cache key, and D-09's server-side cache already handles dedup. Exposes the
 * mutation's `data`, `isPending`, `error`, `mutate`, and `reset`.
 */
export function useDeliveryEstimate() {
  return useMutation<
    DeliveryEstimateResult,
    Error,
    { token: string; destPincode: string }
  >({
    mutationFn: ({ token, destPincode }) => estimateDelivery(token, destPincode),
  });
}
