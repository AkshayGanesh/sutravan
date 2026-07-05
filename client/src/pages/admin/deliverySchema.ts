// The admin delivery-settings validation contract (D-15) and the preview-line
// string builder (D-06 / SC1). BOTH are pure: `deliverySchema` is a plain Zod
// object and `formatPreviewLine` a string function. The estimate result shape is
// pulled with `import type` so this module NEVER drags the supabase client into
// its runtime (unit tests need no env / no mock, matching the SiteContent.tsx
// z.object idiom this mirrors).
import { z } from "zod";
import { formatPrice } from "@/lib/format";
import type { DeliveryEstimateResult } from "@/lib/delivery";

// A blank text input (or an explicit null) means "unset" for the optional numeric
// fields (D-14). Map both to null BEFORE coercion so "" never silently coerces to
// 0 (Number("") === 0) and so a blank COD fee stays detectable in the superRefine.
const emptyToNull = (v: unknown): unknown =>
  v === "" || v === null || v === undefined ? null : v;

// D-15 verbatim. Decimals are rejected via explicit `.int(...)` (RESEARCH
// Pitfall 6 — z.coerce.number() would otherwise accept "2.5"). codFee/cap/threshold
// preprocess blanks to null so D-14 "blank → null" holds and the required-when-enabled
// COD-fee rule can distinguish a blank from a real 0.
export const deliverySchema = z
  .object({
    originPincode: z
      .string()
      .regex(/^\d{6}$/, "Enter a 6-digit pincode")
      // D-10: the seeded 000000 placeholder passes the 6-digit shape but is not a
      // real origin — reject it with a distinct message so the owner must set one.
      .refine((v) => v !== "000000", "Enter a real origin pincode"),
    defaultWeightG: z.coerce
      .number()
      .int("Enter a whole number of grams")
      .min(1, "Weight must be at least 1g")
      .max(2000, "Weight must be 2000g or less"),
    dispatchLeadDays: z.coerce
      .number()
      .int("Enter a whole number of days")
      .min(0, "Lead days cannot be negative")
      .max(14, "Lead days must be 14 or less"),
    codEnabled: z.boolean(),
    // Blank → null (detected below when COD is enabled); a real 0 is a valid free
    // COD fee, so the floor is min(0), not positive().
    codFee: z.preprocess(
      emptyToNull,
      z.coerce
        .number()
        .int("Enter a whole rupee amount")
        .min(0, "COD fee cannot be negative")
        .nullable(),
    ),
    // D-14: blank → null; otherwise a strictly-positive whole rupee cap.
    codValueCap: z.preprocess(
      emptyToNull,
      z.coerce.number().int().positive("Enter an amount above ₹0").nullable(),
    ),
    // D-14/D-19: blank → null (free shipping off); otherwise a positive threshold.
    freeShipThreshold: z.preprocess(
      emptyToNull,
      z.coerce.number().int().positive("Enter an amount above ₹0").nullable(),
    ),
  })
  .superRefine((val, ctx) => {
    // D-15: a fee is mandatory whenever COD is switched on. A blank/NaN fee
    // reaches here as null (emptyToNull) — flag it on the codFee path so the form
    // shows the error under the fee input.
    if (val.codEnabled && (val.codFee === null || Number.isNaN(val.codFee))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codFee"],
        message: "Enter a COD fee (₹0 or more)",
      });
    }
  });

export type DeliveryValues = z.infer<typeof deliverySchema>;

// SC1 / D-06 preview line. Mirrors DeliveryEstimate.tsx wording
// ("Arrives in {min}–{max} working days") and reuses formatPrice for the ₹ figure
// (NEVER re-rounds — the engine already rounds to ₹10). A non-serviceable result
// collapses to the short "not serviceable" variant.
export function formatPreviewLine(
  origin: string,
  dest: string,
  result: DeliveryEstimateResult,
): string {
  const prefix = `From ${origin} to ${dest}:`;
  if (!result.serviceable) return `${prefix} not serviceable`;
  const eta = result.etaDays
    ? `${result.etaDays.min}–${result.etaDays.max} working days`
    : "";
  const cod = result.codAvailable ? "COD available" : "COD not available";
  return `${prefix} ${formatPrice(result.cost)}, ${eta} · ${cod}`;
}
