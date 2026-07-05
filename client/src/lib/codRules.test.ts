import { describe, it, expect } from "vitest";

// parseCodRules / serializeCodRules are PURE (no supabase import) — the codec for
// the single delivery_cod_rules JSON-in-text site_content key (D-09). The parse
// tolerance MUST match the edge function's canonical contract
// (delivery-estimate/index.ts L215-224): malformed / falsy → COD off.
import { parseCodRules, serializeCodRules } from "@/lib/codRules";

describe("parseCodRules (D-09 canonical {enabled,fee,valueCap})", () => {
  it("parses a full rules string", () => {
    expect(parseCodRules('{"enabled":true,"fee":30,"valueCap":5000}')).toEqual({
      enabled: true,
      fee: 30,
      valueCap: 5000,
    });
  });

  it("maps an empty string to COD off", () => {
    expect(parseCodRules("")).toEqual({
      enabled: false,
      fee: 0,
      valueCap: null,
    });
  });

  it("maps undefined to COD off", () => {
    expect(parseCodRules(undefined)).toEqual({
      enabled: false,
      fee: 0,
      valueCap: null,
    });
  });

  it("maps malformed JSON to COD off (never throws)", () => {
    expect(parseCodRules("not json")).toEqual({
      enabled: false,
      fee: 0,
      valueCap: null,
    });
  });

  it("tolerates a missing valueCap (→ null)", () => {
    expect(parseCodRules('{"enabled":true,"fee":30}')).toEqual({
      enabled: true,
      fee: 30,
      valueCap: null,
    });
  });
});

describe("serializeCodRules (D-14 round-trip / blank cap → null)", () => {
  it("round-trips through parseCodRules to an equal object", () => {
    const v = { enabled: true, fee: 30, valueCap: 5000 };
    expect(parseCodRules(serializeCodRules(v))).toEqual(v);
  });

  it("keeps a null valueCap in the serialized JSON", () => {
    const s = serializeCodRules({ enabled: true, fee: 30, valueCap: null });
    expect(JSON.parse(s).valueCap).toBe(null);
    expect(parseCodRules(s)).toEqual({ enabled: true, fee: 30, valueCap: null });
  });

  it("retains fee/cap when COD is toggled off (D-13 retain)", () => {
    const v = { enabled: false, fee: 30, valueCap: 5000 };
    expect(parseCodRules(serializeCodRules(v))).toEqual(v);
  });
});
