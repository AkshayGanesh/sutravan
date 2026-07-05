// The COD-rules codec for the single `delivery_cod_rules` JSON-in-text
// site_content key (D-09). PURE — no supabase import — so it unit-tests without
// env/mock and can be shared by the admin form (serialize on save) and any client
// read (parse on load).
//
// parseCodRules is deliberately IDENTICAL in tolerance to the deployed edge
// function (supabase/functions/delivery-estimate/index.ts L215-224): any falsy or
// malformed input yields COD OFF, and a missing valueCap tolerates to null. Keeping
// one canonical `{enabled,fee,valueCap}` contract means the admin UI and the
// server compute never disagree about what a rules string means.

/** The canonical COD-rules shape stored as JSON text (D-09). */
export interface CodRules {
  enabled: boolean;
  fee: number;
  valueCap: number | null;
}

// COD off is the safe default for every parse failure — never throw, never a 500
// on the server, never a broken admin form on the client.
const COD_OFF: CodRules = { enabled: false, fee: 0, valueCap: null };

/**
 * Parse the delivery_cod_rules text value into the canonical contract. Falsy
 * (""/null/undefined) or malformed JSON → COD off; a valid object coerces
 * enabled→boolean, fee→0-fallback, valueCap→null-fallback (mirrors the edge
 * function's L221-224 tolerance exactly).
 */
export function parseCodRules(raw: string | null | undefined): CodRules {
  if (!raw) return { ...COD_OFF };
  try {
    const p = JSON.parse(raw) as Partial<CodRules>;
    return {
      enabled: !!p.enabled,
      fee: p.fee ?? 0,
      valueCap: p.valueCap ?? null,
    };
  } catch {
    // Malformed JSON in the text column → COD off; never throw.
    return { ...COD_OFF };
  }
}

/**
 * Serialize the canonical rules to the JSON string persisted in site_content.
 * Retains fee/cap even when disabled (D-13) so toggling COD back on restores the
 * owner's prior values; a null cap stays null in the JSON (D-14 blank cap).
 */
export function serializeCodRules(v: CodRules): string {
  return JSON.stringify({
    enabled: v.enabled,
    fee: v.fee,
    valueCap: v.valueCap,
  });
}
