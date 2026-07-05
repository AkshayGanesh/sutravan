import { describe, it, expect, vi, beforeEach } from "vitest";

// delivery.ts imports the supabase client, which throws at module load without
// VITE_ env vars. Stub @/lib/supabase with a controllable functions.invoke spy so
// we can unit-test both the PURE mapEstimateError boundary mapper AND the
// previewDelivery invoke wrapper (body shape + error mapping) with no env / no
// network. (vi.mock is hoisted above the imports, so the stub is in place before
// delivery.ts loads.)
const invokeMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

import { mapEstimateError, previewDelivery } from "@/lib/delivery";
import { SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";

beforeEach(() => {
  invokeMock.mockReset();
});

// mapEstimateError is a PURE boundary mapper from the deployed delivery-estimate
// Edge Function error codes to the two client outcomes (D-13):
//   "bad_request"    -> "invalid-format" (client shows the inline format guard)
//   everything else  -> "retry"          (captcha_failed / network / timeout / 5xx)
describe("mapEstimateError", () => {
  it("maps bad_request to invalid-format", () => {
    expect(mapEstimateError("bad_request")).toBe("invalid-format");
  });

  it("maps captcha_failed to retry", () => {
    expect(mapEstimateError("captcha_failed")).toBe("retry");
  });

  it("maps a null code (unreadable body) to retry", () => {
    expect(mapEstimateError(null)).toBe("retry");
  });

  it("maps any unknown code to retry", () => {
    expect(mapEstimateError("some_unknown_code")).toBe("retry");
  });
});

// previewDelivery is the ADMIN preview path (D-06/D-08): it invokes the SAME
// delivery-estimate function but with an explicit originPincode override and NO
// Turnstile token (the admin branch skips the captcha per D-07; the session JWT
// is auto-attached by supabase-js). It reuses estimateDelivery's error mapping.
describe("previewDelivery", () => {
  const result = {
    serviceable: true,
    cost: 80,
    etaDays: { min: 3, max: 5 },
    codAvailable: true,
    originConfigured: true,
  };

  it("invokes delivery-estimate with {originPincode,destPincode} and NO token", async () => {
    invokeMock.mockResolvedValue({ data: result, error: null });
    await previewDelivery("560001", "110001");
    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [fnName, opts] = invokeMock.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(fnName).toBe("delivery-estimate");
    expect(opts.body).toMatchObject({
      originPincode: "560001",
      destPincode: "110001",
    });
    expect("token" in opts.body).toBe(false);
  });

  it("resolves the DeliveryEstimateResult unchanged on success", async () => {
    invokeMock.mockResolvedValue({ data: result, error: null });
    await expect(previewDelivery("560001", "110001")).resolves.toEqual(result);
  });

  it("throws EstimateError('invalid-format') on a bad_request body", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { context: { json: () => ({ error: "bad_request" }) } },
    });
    await expect(previewDelivery("560001", "110001")).rejects.toMatchObject({
      code: "invalid-format",
    });
  });

  it("throws EstimateError('retry') when the error body cannot be read", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: () => {
            throw new Error("unreadable");
          },
        },
      },
    });
    await expect(previewDelivery("560001", "110001")).rejects.toMatchObject({
      code: "retry",
    });
  });
});

// D-03: the five delivery keys mirror the 0014 seed so public/admin reads never
// render blank while the ['siteContent'] query loads (D-20 mandatory fallback).
describe("SITE_CONTENT_DEFAULTS delivery keys (D-03)", () => {
  it("carries all five delivery defaults mirroring the 0014 seed", () => {
    expect(SITE_CONTENT_DEFAULTS.delivery_origin_pincode).toBe("000000");
    expect(SITE_CONTENT_DEFAULTS.delivery_default_weight_g).toBe("250");
    expect(SITE_CONTENT_DEFAULTS.delivery_dispatch_lead_days).toBe("1");
    expect(SITE_CONTENT_DEFAULTS.delivery_cod_rules).toBe(
      '{"enabled":true,"fee":30,"valueCap":5000}',
    );
    expect(SITE_CONTENT_DEFAULTS.delivery_free_ship_threshold).toBe("");
  });
});
