/**
 * Pure decision for reconciling a logged-in customer's stored delivery pincode
 * against their `profiles.default_pincode` at login/session-restore.
 *
 * Extracted from the provider so the D-01/D-02/D-09 rules are provable without a
 * React/Supabase harness. No React, no Supabase, no side effects.
 *
 * Rule order (D-01 -> D-02 -> noop):
 *   - profile set, differs from local -> adopt-profile (D-01: the account wins,
 *     mirror it onto this device).
 *   - profile set, equals local       -> noop (D-09 equality guard: skip the
 *     redundant write).
 *   - profile empty, local set         -> push-local (D-02: adopt an anonymous
 *     choice into the empty profile).
 *   - both empty                       -> noop.
 *
 * An empty string is treated the same as null on both inputs (guards against a
 * "" profile column leaking through as a "set" value).
 */
export type LoginMergeAction =
  | { kind: "adopt-profile"; pincode: string }
  | { kind: "push-local"; pincode: string }
  | { kind: "noop" };

export function resolveDeliveryLoginMerge(
  profilePin: string | null,
  localPin: string | null,
): LoginMergeAction {
  const profile = profilePin ?? "";
  const local = localPin ?? "";

  if (profile !== "") {
    if (profile === local) {
      return { kind: "noop" };
    }
    return { kind: "adopt-profile", pincode: profile };
  }

  if (local !== "") {
    return { kind: "push-local", pincode: local };
  }

  return { kind: "noop" };
}
