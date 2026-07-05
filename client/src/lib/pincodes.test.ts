import { describe, it, expect, vi, beforeEach } from "vitest";

// checkServiceable touches the supabase client (a single pincodes lookup), which
// throws at module load without VITE_ env. Stub @/lib/supabase with a controllable
// from().select().eq().maybeSingle() chain (the delivery.test.ts precedent) so the
// {known,serviceable,label} mapping is unit-tested with no env / no network.
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(nextResult),
        }),
      }),
    }),
  },
}));

import { checkServiceable } from "@/lib/pincodes";

beforeEach(() => {
  nextResult = { data: null, error: null };
});

describe("checkServiceable (D-09 serviceability lookup)", () => {
  it("maps a serviceable row to known + serviceable + district label", async () => {
    nextResult = {
      data: {
        pincode: "560001",
        district: "Bengaluru",
        state: "Karnataka",
        serviceable: true,
      },
      error: null,
    };
    expect(await checkServiceable("560001")).toEqual({
      known: true,
      serviceable: true,
      label: "Bengaluru",
    });
  });

  it("maps a null row (unknown pincode) to not-known / not-serviceable", async () => {
    nextResult = { data: null, error: null };
    expect(await checkServiceable("999999")).toEqual({
      known: false,
      serviceable: false,
      label: null,
    });
  });

  it("maps a known-but-not-serviceable row", async () => {
    nextResult = {
      data: {
        pincode: "190001",
        district: "Srinagar",
        state: "Jammu and Kashmir",
        serviceable: false,
      },
      error: null,
    };
    expect(await checkServiceable("190001")).toEqual({
      known: true,
      serviceable: false,
      label: "Srinagar",
    });
  });

  it("falls back to state when the district is null", async () => {
    nextResult = {
      data: {
        pincode: "800001",
        district: null,
        state: "Bihar",
        serviceable: true,
      },
      error: null,
    };
    expect(await checkServiceable("800001")).toEqual({
      known: true,
      serviceable: true,
      label: "Bihar",
    });
  });
});
