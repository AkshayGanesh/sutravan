import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AuthProvider from "@/auth/AuthProvider";
import DeliveryProvider from "@/delivery/DeliveryProvider";
import DeliveryPincodePill from "@/components/delivery/DeliveryPincodePill";

// The DeliveryPincodePill is a Radix Popover consumer. We render only the CLOSED
// state (trigger pill) via server static markup — no jsdom, no testing-library,
// no new dependency. This exercises the D-06 empty-vs-set label derivation, the
// single behavior that is observable from the trigger without user events (the
// submit/sanitize interaction paths are behaviorally deferred to the Plan 03
// human checkpoint per the plan's verification section).

// DeliveryProvider reads its initial pincode from localStorage via a try/catch
// lazy initializer. Node has no localStorage, so we stub a minimal in-memory one
// to drive the provider into the empty vs set state.
function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

// DeliveryProvider now reads useAuth() (Plan 08-02 login-merge/write-through), so
// it must render inside an AuthProvider — mirroring the real app tree
// (AuthProvider > DeliveryProvider). AuthProvider only touches Supabase inside
// effects, which do not run under renderToStaticMarkup, so the synchronous render
// resolves to the anonymous/logged-out path (user: null) this suite asserts.
function renderPill() {
  return renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(DeliveryProvider, null, createElement(DeliveryPincodePill)),
    ),
  );
}

beforeEach(() => {
  stubLocalStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("DeliveryPincodePill trigger label (D-06 empty vs set)", () => {
  it("shows the empty-state prompt when no pincode is set", () => {
    const html = renderPill();
    // Desktop + mobile empty copy from the UI-SPEC copywriting contract.
    expect(html).toContain("Set pincode");
    expect(html).toContain("Set");
    // Must NOT render the set-state prefix when empty.
    expect(html).not.toContain("Deliver to");
  });

  it("shows 'Deliver to {pincode}' with the value when a pincode is set", () => {
    stubLocalStorage({ "sutravan.delivery.pincode": "110001" });
    const html = renderPill();
    expect(html).toContain("Deliver to");
    expect(html).toContain("110001");
    // Empty prompt must not appear once a value exists.
    expect(html).not.toContain("Set pincode");
  });
});
