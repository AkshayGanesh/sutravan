import { describe, it, expect, vi } from "vitest";

// delivery.ts transitively imports the supabase client, which throws at module
// load without VITE_ env vars (the same env gate that guards lib/supabase.ts).
// mapEstimateError is a PURE function, so stub the client module to unit-test the
// boundary mapper in isolation — no env, no network. (vi.mock is hoisted above
// the imports by vitest, so the stub is in place before delivery.ts loads.)
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { mapEstimateError } from "@/lib/delivery";

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
