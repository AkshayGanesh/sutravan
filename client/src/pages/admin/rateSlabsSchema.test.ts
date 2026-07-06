import { describe, it, expect } from "vitest";

// rateSlabsSchema + the grid⇄rows mapping are PURE (a plain Zod object and two
// data-shaping functions). Neither imports the supabase client or React, so this
// suite runs in the plain node env with no VITE_ env vars and no vi.mock —
// mirroring the deliverySchema.test.ts sibling from Phase 9.
import {
  rateSlabsSchema,
  mapSlabsToForm,
  expandFormToRows,
  ZONE_ORDER,
  WEIGHT_BAND_LABELS,
  WEIGHT_BAND_BOUNDS,
} from "@/pages/admin/rateSlabsSchema";
import type { RateSlabUpsertRow } from "@/pages/admin/rateSlabsSchema";

// A fully-valid grid the individual cases override one cell/zone at a time. All
// 20 costs are a safe ₹50; every zone shares a valid { min: 2, max: 4 } ETA pair.
function validCosts(): Record<string, unknown> {
  const costs: Record<string, unknown> = {};
  for (const zone of ZONE_ORDER) {
    for (const band of [1, 2, 3, 4]) {
      costs[`${zone}_${band}`] = 50;
    }
  }
  return costs;
}

function validEtas(): Record<string, { min: unknown; max: unknown }> {
  const etas: Record<string, { min: unknown; max: unknown }> = {};
  for (const zone of ZONE_ORDER) {
    etas[zone] = { min: 2, max: 4 };
  }
  return etas;
}

function base(overrides: {
  costs?: Record<string, unknown>;
  etas?: Record<string, { min: unknown; max: unknown }>;
} = {}) {
  return {
    costs: overrides.costs ?? validCosts(),
    etas: overrides.etas ?? validEtas(),
  };
}

describe("rateSlabsSchema — cost bounds (D-08: int ≥ ₹1, SC3 no silent ₹0)", () => {
  it("accepts a cost of exactly 1 (the strictly-positive floor)", () => {
    const costs = validCosts();
    costs["local_1"] = 1;
    expect(rateSlabsSchema.safeParse(base({ costs })).success).toBe(true);
  });

  it("rejects a cost of 0 with the 'at least ₹1' message", () => {
    const costs = validCosts();
    costs["local_1"] = 0;
    const r = rateSlabsSchema.safeParse(base({ costs }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find(
        (i) => i.path[0] === "costs" && i.path[1] === "local_1",
      )?.message;
      expect(msg).toBe("Cost must be at least ₹1");
    }
  });

  it("rejects a negative cost", () => {
    const costs = validCosts();
    costs["local_1"] = -5;
    expect(rateSlabsSchema.safeParse(base({ costs })).success).toBe(false);
  });

  it("rejects a decimal cost (int only)", () => {
    const costs = validCosts();
    costs["local_1"] = 2.5;
    expect(rateSlabsSchema.safeParse(base({ costs })).success).toBe(false);
  });

  it("rejects a blank/empty cost string (no coercion-to-0 passes)", () => {
    const costs = validCosts();
    costs["local_1"] = "";
    expect(rateSlabsSchema.safeParse(base({ costs })).success).toBe(false);
  });
});

describe("rateSlabsSchema — ETA bounds + cross-field (D-08)", () => {
  it("accepts a zone with { min: 2, max: 4 }", () => {
    const etas = validEtas();
    etas["local"] = { min: 2, max: 4 };
    expect(rateSlabsSchema.safeParse(base({ etas })).success).toBe(true);
  });

  it("rejects { min: 5, max: 4 } on the etas.<zone>.max path", () => {
    const etas = validEtas();
    etas["local"] = { min: 5, max: 4 };
    const r = rateSlabsSchema.safeParse(base({ etas }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(
        (i) =>
          i.path[0] === "etas" &&
          i.path[1] === "local" &&
          i.path[2] === "max",
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects eta_min_days of 0 (at least 1)", () => {
    const etas = validEtas();
    etas["local"] = { min: 0, max: 4 };
    expect(rateSlabsSchema.safeParse(base({ etas })).success).toBe(false);
  });

  it("rejects a decimal ETA", () => {
    const etas = validEtas();
    etas["local"] = { min: 1.5, max: 4 };
    expect(rateSlabsSchema.safeParse(base({ etas })).success).toBe(false);
  });

  it("rejects eta_max_days above the upper bound (31 when cap is 30)", () => {
    const etas = validEtas();
    etas["local"] = { min: 2, max: 31 };
    expect(rateSlabsSchema.safeParse(base({ etas })).success).toBe(false);
  });
});

describe("rateSlabsSchema — no monotonicity (D-09)", () => {
  it("parses a grid where remote band-4 is CHEAPER than local band-1", () => {
    const costs = validCosts();
    costs["local_1"] = 40;
    costs["remote_4"] = 180;
    // Now invert: make the far/heavy cell cheaper than the near/light one.
    costs["local_1"] = 200;
    costs["remote_4"] = 10;
    expect(rateSlabsSchema.safeParse(base({ costs })).success).toBe(true);
  });
});

describe("rateSlabsSchema — grid constants", () => {
  it("ZONE_ORDER is exactly the 5 zones in local→regional→metro→national→remote order", () => {
    expect(ZONE_ORDER).toEqual([
      "local",
      "regional",
      "metro",
      "national",
      "remote",
    ]);
  });

  it("WEIGHT_BAND_LABELS has 4 gram-range strings", () => {
    expect(WEIGHT_BAND_LABELS).toHaveLength(4);
    expect(WEIGHT_BAND_LABELS).toEqual([
      "0–250g",
      "251–500g",
      "501–1000g",
      "1001–2000g",
    ]);
  });

  it("WEIGHT_BAND_BOUNDS maps 1→[0,250], 2→[251,500], 3→[501,1000], 4→[1001,2000]", () => {
    expect(WEIGHT_BAND_BOUNDS[1]).toEqual([0, 250]);
    expect(WEIGHT_BAND_BOUNDS[2]).toEqual([251, 500]);
    expect(WEIGHT_BAND_BOUNDS[3]).toEqual([501, 1000]);
    expect(WEIGHT_BAND_BOUNDS[4]).toEqual([1001, 2000]);
  });
});

// The 20-row seed fixture built verbatim from migration 0016 (bands 1–4 per zone
// share ONE eta pair — D-06 / the Phase 6 seed).
const SEED: Array<[string, number, number, number, number, number, number]> = [
  ["local", 1, 0, 250, 40, 1, 2],
  ["local", 2, 251, 500, 55, 1, 2],
  ["local", 3, 501, 1000, 75, 1, 2],
  ["local", 4, 1001, 2000, 95, 1, 2],
  ["regional", 1, 0, 250, 55, 2, 4],
  ["regional", 2, 251, 500, 70, 2, 4],
  ["regional", 3, 501, 1000, 95, 2, 4],
  ["regional", 4, 1001, 2000, 120, 2, 4],
  ["metro", 1, 0, 250, 65, 3, 5],
  ["metro", 2, 251, 500, 85, 3, 5],
  ["metro", 3, 501, 1000, 110, 3, 5],
  ["metro", 4, 1001, 2000, 140, 3, 5],
  ["national", 1, 0, 250, 75, 4, 7],
  ["national", 2, 251, 500, 95, 4, 7],
  ["national", 3, 501, 1000, 125, 4, 7],
  ["national", 4, 1001, 2000, 160, 4, 7],
  ["remote", 1, 0, 250, 95, 6, 10],
  ["remote", 2, 251, 500, 120, 6, 10],
  ["remote", 3, 501, 1000, 150, 6, 10],
  ["remote", 4, 1001, 2000, 180, 6, 10],
];

function seedRows(): RateSlabUpsertRow[] {
  return SEED.map(
    ([zone, band, wMin, wMax, cost, etaMin, etaMax]) => ({
      zone,
      weight_band: band as 1 | 2 | 3 | 4,
      weight_min_g: wMin,
      weight_max_g: wMax,
      cost,
      eta_min_days: etaMin,
      eta_max_days: etaMax,
    }),
  );
}

describe("mapSlabsToForm — 20 rows → 20 costs + 5 ETA pairs (D-06)", () => {
  it("collapses seed rows into per-cell costs and per-zone ETA pairs", () => {
    const form = mapSlabsToForm(seedRows());
    expect(form.costs["local_1"]).toBe(40);
    expect(form.costs["remote_4"]).toBe(180);
    expect(Object.keys(form.costs)).toHaveLength(20);
    expect(form.etas["local"]).toEqual({ min: 1, max: 2 });
    expect(form.etas["remote"]).toEqual({ min: 6, max: 10 });
    expect(Object.keys(form.etas)).toHaveLength(5);
  });
});

describe("expandFormToRows — grid → 20 rows, per-zone ETA fanned to 4 bands (D-06)", () => {
  it("emits exactly 20 rows", () => {
    const rows = expandFormToRows(mapSlabsToForm(seedRows()));
    expect(rows).toHaveLength(20);
  });

  it("writes each zone's single ETA pair to ALL 4 bands of that zone", () => {
    const rows = expandFormToRows(mapSlabsToForm(seedRows()));
    for (const zone of ZONE_ORDER) {
      const zoneRows = rows.filter((r) => r.zone === zone);
      expect(zoneRows).toHaveLength(4);
      const first = zoneRows[0];
      for (const r of zoneRows) {
        expect(r.eta_min_days).toBe(first.eta_min_days);
        expect(r.eta_max_days).toBe(first.eta_max_days);
      }
    }
    // remote's 4 bands all carry the 6–10 pair.
    for (const r of rows.filter((r) => r.zone === "remote")) {
      expect(r.eta_min_days).toBe(6);
      expect(r.eta_max_days).toBe(10);
    }
  });

  it("carries the fixed weight_min_g/weight_max_g from WEIGHT_BAND_BOUNDS", () => {
    const rows = expandFormToRows(mapSlabsToForm(seedRows()));
    for (const r of rows) {
      const [min, max] = WEIGHT_BAND_BOUNDS[r.weight_band as 1 | 2 | 3 | 4];
      expect(r.weight_min_g).toBe(min);
      expect(r.weight_max_g).toBe(max);
    }
    const band3 = rows.find((r) => r.weight_band === 3)!;
    expect(band3.weight_min_g).toBe(501);
    expect(band3.weight_max_g).toBe(1000);
  });

  it("emits integer (numeric) cost/eta even when the form held string inputs", () => {
    const form = mapSlabsToForm(seedRows());
    // Simulate RHF string inputs.
    const strForm = {
      costs: Object.fromEntries(
        Object.entries(form.costs).map(([k, v]) => [k, String(v)]),
      ),
      etas: Object.fromEntries(
        Object.entries(form.etas).map(([k, v]) => [
          k,
          { min: String(v.min), max: String(v.max) },
        ]),
      ),
    };
    const rows = expandFormToRows(strForm as never);
    for (const r of rows) {
      expect(typeof r.cost).toBe("number");
      expect(typeof r.eta_min_days).toBe("number");
      expect(typeof r.eta_max_days).toBe("number");
    }
    expect(rows.find((r) => r.zone === "local" && r.weight_band === 1)!.cost).toBe(
      40,
    );
  });
});

describe("round-trip — expandFormToRows(mapSlabsToForm(seedRows))", () => {
  it("reproduces the seed cost + eta values for all 20 (zone, band) pairs", () => {
    const rows = expandFormToRows(mapSlabsToForm(seedRows()));
    expect(rows).toHaveLength(20);
    for (const [zone, band, , , cost, etaMin, etaMax] of SEED) {
      const row = rows.find(
        (r) => r.zone === zone && r.weight_band === band,
      );
      expect(row).toBeDefined();
      expect(row!.cost).toBe(cost);
      expect(row!.eta_min_days).toBe(etaMin);
      expect(row!.eta_max_days).toBe(etaMax);
    }
  });
});
