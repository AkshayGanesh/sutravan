import { describe, it, expect } from "vitest";
import { resolveDeliveryLoginMerge } from "@/delivery/loginMerge";

describe("resolveDeliveryLoginMerge", () => {
  it("adopts the profile pincode when it is set and differs from local (D-01)", () => {
    expect(resolveDeliveryLoginMerge("560001", "110001")).toEqual({
      kind: "adopt-profile",
      pincode: "560001",
    });
  });

  it("is a noop when the profile pincode already equals local (D-09 equality guard)", () => {
    expect(resolveDeliveryLoginMerge("560001", "560001")).toEqual({
      kind: "noop",
    });
  });

  it("pushes the local pincode up when the profile is empty (D-02)", () => {
    expect(resolveDeliveryLoginMerge(null, "110001")).toEqual({
      kind: "push-local",
      pincode: "110001",
    });
  });

  it("is a noop when both profile and local are null", () => {
    expect(resolveDeliveryLoginMerge(null, null)).toEqual({ kind: "noop" });
  });

  it("treats an empty-string profile as absent and adopts local (D-02)", () => {
    expect(resolveDeliveryLoginMerge("", "110001")).toEqual({
      kind: "push-local",
      pincode: "110001",
    });
  });

  it("treats an empty-string local as absent and adopts the profile (D-01)", () => {
    expect(resolveDeliveryLoginMerge("560001", "")).toEqual({
      kind: "adopt-profile",
      pincode: "560001",
    });
  });

  it("is a noop when both inputs are empty strings", () => {
    expect(resolveDeliveryLoginMerge("", "")).toEqual({ kind: "noop" });
  });
});
