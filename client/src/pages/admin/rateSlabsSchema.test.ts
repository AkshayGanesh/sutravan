import { describe, it, expect } from "vitest";

// rateSlabsSchema + the grid⇄rows mapping are PURE (a plain Zod object and two
// data-shaping functions). Neither imports the supabase client or React, so this
// suite runs in the plain node env with no VITE_ env vars and no vi.mock —
// mirroring the deliverySchema.test.ts sibling from Phase 9.
import {
  rateSlabsSchema,
  ZONE_ORDER,
  WEIGHT_BAND_LABELS,
  WEIGHT_BAND_BOUNDS,
} from "@/pages/admin/rateSlabsSchema";

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
