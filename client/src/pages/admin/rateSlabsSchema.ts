// The Rate Slabs editor's validation contract (D-08) and the grid⇄rows mapping
// (D-06). ALL pure: `rateSlabsSchema` is a plain Zod object; `mapSlabsToForm` /
// `expandFormToRows` are plain data-shaping functions. Nothing here imports the
// supabase client or React, so the unit suite runs in the plain node env with no
// env / no mock — mirroring the deliverySchema.ts sibling (Phase 9).
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// Grid constants — the fixed 5×4 vocabulary (Phase 6 D-01/D-02, migration 0016).
// The editor NEVER adds/removes zones or bands; these are structural constants.
// ──────────────────────────────────────────────────────────────────────────

// D-01: the 5 zones in near→far order (drives the grid's row order).
export const ZONE_ORDER = [
  "local",
  "regional",
  "metro",
  "national",
  "remote",
] as const;

export type Zone = (typeof ZONE_ORDER)[number];

// The 4 weight bands as read-only column headers (index 0 = band 1). D-03.
export const WEIGHT_BAND_LABELS = [
  "0–250g",
  "251–500g",
  "501–1000g",
  "1001–2000g",
] as const;

export type WeightBand = 1 | 2 | 3 | 4;

// The fixed gram bounds per band (migration 0016 seed). Always emitted on save so
// the NOT NULL weight_min_g/weight_max_g upsert columns are populated.
export const WEIGHT_BAND_BOUNDS: Record<WeightBand, [number, number]> = {
  1: [0, 250],
  2: [251, 500],
  3: [501, 1000],
  4: [1001, 2000],
};

// ──────────────────────────────────────────────────────────────────────────
// Validation contract (D-08). Decimals are rejected via explicit `.int(...)`
// (z.coerce.number() would otherwise accept "2.5"); a blank string coerces to 0
// which then fails the min(1) floor, so "" is never a silent valid ₹0.
// ──────────────────────────────────────────────────────────────────────────

// D-08 cost floor is 1 (strictly positive) — a ₹0 slab is impossible, satisfying
// SC3 "no silent ₹0" by construction. Free shipping is the Phase 9 threshold, not
// a ₹0 slab.
const costField = z.coerce
  .number()
  .int("Enter a whole rupee amount")
  .min(1, "Cost must be at least ₹1");

// D-08 ETA: whole days, ≥ 1, ≤ 30 (upper bound is discretion). Cross-field
// min ≤ max is enforced in the superRefine below.
const etaField = z.coerce
  .number()
  .int("Enter whole days")
  .min(1, "ETA must be at least 1 day")
  .max(30, "ETA must be 30 days or less");

export const rateSlabsSchema = z
  .object({
    // Per-cell cost, keyed `${zone}_${band}` (e.g. "local_1"); 20 cells total.
    costs: z.record(z.string(), costField),
    // Per-zone ETA pair (D-06 — one ETA per zone, fanned to all 4 bands on save).
    etas: z.record(
      z.string(),
      z.object({ min: etaField, max: etaField }),
    ),
  })
  .superRefine((val, ctx) => {
    // D-08 cross-field: max ETA must be ≥ min ETA, flagged on the zone's max path
    // so the form shows the error under that input (mirrors deliverySchema.ts).
    for (const [zone, pair] of Object.entries(val.etas)) {
      if (pair.min > pair.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["etas", zone, "max"],
          message: "Max ETA must be ≥ min ETA",
        });
      }
    }
    // D-09: no monotonicity check across zones or bands — a heavier band or
    // farther zone may be cheaper without error or warning (explicitly declined).
  });

// Raw string-in-field form-value type (RHF holds strings before coercion),
// matching the DeliveryFormValues `_input` idiom.
export type RateSlabsFormValues = typeof rateSlabsSchema._input;

// ──────────────────────────────────────────────────────────────────────────
// Grid ⇄ rows mapping (D-06). Pure — the read hook feeds fetched rows into
// mapSlabsToForm; the save mutation sends expandFormToRows' output to the upsert.
// ──────────────────────────────────────────────────────────────────────────

// A fetched slab row (only the fields the mapping reads). Mirrors the
// delivery_rate_slabs columns from migration 0016.
export type SlabRow = {
  zone: string;
  weight_band: number;
  cost: number;
  eta_min_days: number;
  eta_max_days: number;
};

// The exact upsert-row shape the save mutation (10-02) sends — every NOT NULL
// column populated, so it satisfies the table's constraints directly.
export type RateSlabUpsertRow = {
  zone: Zone;
  weight_band: WeightBand;
  weight_min_g: number;
  weight_max_g: number;
  cost: number;
  eta_min_days: number;
  eta_max_days: number;
};

// The grid form shape: per-cell costs + per-zone ETA pairs.
type GridForm = {
  costs: Record<string, number>;
  etas: Record<string, { min: number; max: number }>;
};

// Collapse the 20 fetched rows into the grid form: costs keyed `${zone}_${band}`
// and ONE ETA pair per zone (all 4 bands share it — D-06, so the first row seen
// per zone wins).
export function mapSlabsToForm(rows: SlabRow[]): GridForm {
  const costs: Record<string, number> = {};
  const etas: Record<string, { min: number; max: number }> = {};
  for (const row of rows) {
    costs[`${row.zone}_${row.weight_band}`] = row.cost;
    if (!(row.zone in etas)) {
      etas[row.zone] = { min: row.eta_min_days, max: row.eta_max_days };
    }
  }
  return { costs, etas };
}

// Expand the grid form into exactly 20 upsert rows: iterate ZONE_ORDER × bands
// 1..4, fanning each zone's single ETA pair across all 4 bands (D-06) and always
// emitting the fixed weight bounds. Coerce to Number(...) so the rows are numeric
// even when the form held string inputs.
export function expandFormToRows(
  values: RateSlabsFormValues,
): RateSlabUpsertRow[] {
  const bands: WeightBand[] = [1, 2, 3, 4];
  const rows: RateSlabUpsertRow[] = [];
  for (const zone of ZONE_ORDER) {
    const eta = values.etas[zone];
    for (const band of bands) {
      const [weightMin, weightMax] = WEIGHT_BAND_BOUNDS[band];
      rows.push({
        zone,
        weight_band: band,
        weight_min_g: weightMin,
        weight_max_g: weightMax,
        cost: Number(values.costs[`${zone}_${band}`]),
        eta_min_days: Number(eta.min),
        eta_max_days: Number(eta.max),
      });
    }
  }
  return rows;
}
