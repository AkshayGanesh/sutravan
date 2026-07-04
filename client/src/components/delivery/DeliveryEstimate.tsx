import { useRef, useState } from "react";
import type { Product } from "@/data/products";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { useDeliveryEstimate } from "@/lib/delivery";
import { useDelivery } from "@/delivery/useDelivery";
import TurnstileWidget, {
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";

// D-02 / T-07-01: the client-side format guard — no network call fires unless the
// pincode is exactly six digits (the Edge Function re-validates server-side as
// defense-in-depth).
const PINCODE_RE = /^\d{6}$/;

interface DeliveryEstimateProps {
  /**
   * The product being viewed. Unused for now (D-10: no weightG is sent — the
   * server falls back to the seeded 250g default), but part of the contract for
   * the future DLVR-F2 per-variant weight. Reset-on-product-change is handled by
   * the parent's `key={product.id}` remount.
   */
  product: Product;
}

/**
 * Per-product delivery estimate block rendered inside the ProductDetail modal
 * (D-03), between the price/variant selector and the Benefits section.
 *
 * Happy-path vertical slice (Plan 01): idle prompt + inline format guard + the
 * serviceable result (cost + ETA range + COD). The loading skeleton, the full
 * non-serviceable / fetch-failure treatment, the provisional banner, the ETA
 * sub-caption, and free-ship messaging are STUBBED here and completed in Plan 02.
 *
 * Turnstile is reused via `TurnstileWidget` (the hosted-CDN loader) — never a
 * third-party npm wrapper (its global `window.turnstile` typing collides with
 * the ambient one; see `client/src/lib/turnstile.ts`).
 */
export default function DeliveryEstimate({ product }: DeliveryEstimateProps) {
  void product; // referenced for the future per-variant weight (DLVR-F2)

  const { pincode, setPincode } = useDelivery();
  const [value, setValue] = useState(pincode ?? "");
  const [formatError, setFormatError] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  // Latest single-use Turnstile token, captured via the widget's onToken.
  const tokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const { data: result, isPending, error, mutate } = useDeliveryEstimate();

  function handleCheck() {
    const destPincode = value.trim();
    setTokenMissing(false);

    // D-02: inline format guard FIRST — no network call when invalid.
    if (!PINCODE_RE.test(destPincode)) {
      setFormatError(true);
      return;
    }
    setFormatError(false);

    const token = tokenRef.current;
    if (!token) {
      // Prompt the user to complete the verification check, then bail (no invoke).
      setTokenMissing(true);
      return;
    }

    mutate(
      { token, destPincode },
      {
        onSuccess: () => setPincode(destPincode),
        onSettled: () => {
          // Single-use token (D-01/D-13) — reset the widget after every completed
          // or failed invoke so a fresh token is issued for the next lookup.
          turnstileRef.current?.reset();
        },
      },
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
        Delivery
      </h3>
      <p className="text-sm text-foreground/70 mb-3">
        Enter your pincode to estimate delivery cost, time &amp; COD.
      </p>

      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit pincode"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          aria-label="Delivery pincode"
        />
        <button
          type="button"
          onClick={handleCheck}
          disabled={isPending}
          className="shrink-0 bg-primary text-primary-foreground py-3 px-5 text-sm uppercase tracking-wider font-medium transition-colors duration-300 hover:bg-secondary hover:text-primary disabled:opacity-60"
        >
          {isPending ? "Checking…" : "Check delivery"}
        </button>
      </div>

      {/* Managed Turnstile widget — provides the single-use token for each lookup. */}
      <div className="mt-2">
        <TurnstileWidget
          ref={turnstileRef}
          onToken={(t) => {
            tokenRef.current = t;
          }}
        />
      </div>

      {formatError && (
        <p className="mt-2 text-sm text-destructive">
          Enter a valid 6-digit pincode.
        </p>
      )}
      {tokenMissing && (
        <p className="mt-2 text-sm text-destructive">
          Please complete the verification check and try again.
        </p>
      )}

      {/* Fetch-failure stub — Plan 02 adds the "Try again" relabel + full treatment. */}
      {error && !isPending && (
        <p className="mt-3 text-sm text-destructive">
          Couldn&rsquo;t get an estimate right now. Please try again.
        </p>
      )}

      {/* Result stays HIDDEN until an explicit "Check delivery" press (D-08). */}
      {result && !isPending && (
        result.serviceable ? (
          <div className="mt-3 bg-muted/40 p-4 space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-semibold text-primary">
                {formatPrice(result.cost)}
              </span>
              <span className="text-xs text-foreground/50">
                Estimated — final delivery charge may vary.
              </span>
            </div>
            {result.etaDays && (
              <p className="text-sm text-foreground/80">
                Arrives in {result.etaDays.min}–{result.etaDays.max} working days
              </p>
            )}
            <p className="text-sm text-foreground/80">
              {result.codAvailable
                ? "Cash on delivery available"
                : "Cash on delivery not available for this pincode"}
            </p>
          </div>
        ) : (
          // Non-serviceable stub — plain single line (Plan 02 finalizes the state).
          <p className="mt-3 text-sm text-foreground/70">
            Sorry, we don&rsquo;t deliver to this pincode yet.
          </p>
        )
      )}
    </div>
  );
}
