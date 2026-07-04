import { useRef, useState } from "react";
import type { Product } from "@/data/products";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { EstimateError, useDeliveryEstimate } from "@/lib/delivery";
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
 * Five distinct, visually separable states (DLVR-06 / UI-SPEC Interaction
 * States): idle prompt, inline invalid-format guard, loading skeleton (mirrors
 * the result layout so there is no layout shift), the serviceable result panel
 * (cost + ETA range + COD), a clean non-serviceable line, and the fetch-failure
 * state with a "Try again" retry that re-solves Turnstile (single-use token).
 *
 * Error routing (D-13, via `EstimateError.code`):
 *   - `"invalid-format"` (server `bad_request`) → the SAME inline invalid message,
 *     no retry framing.
 *   - `"retry"` (captcha_failed / network / timeout / 5xx) → the fetch-failure
 *     line + the CTA relabeled "Try again".
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

  // Map the mutation error onto the two client outcomes (D-13). A server
  // `bad_request` (EstimateError.code === "invalid-format") is presented exactly
  // like the client format guard (inline invalid, NO retry framing); every other
  // failure (captcha_failed / network / timeout / 5xx, or any non-EstimateError)
  // is a retriable fetch failure.
  const errorCode = error
    ? error instanceof EstimateError
      ? error.code
      : "retry"
    : null;
  const isInvalidFormat = formatError || errorCode === "invalid-format";
  const isRetryError = errorCode === "retry";

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
          // Single-use token (D-01/D-13 / T-07-06) — reset the widget after every
          // completed or failed invoke so a fresh token is issued for the next
          // lookup. This is the reset that runs BEFORE the next "Try again"
          // invoke: the failed attempt's token is consumed and a new challenge is
          // solved, so the retry press re-solves Turnstile and re-invokes with a
          // fresh single-use token (no replay, no unbounded no-captcha retries).
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
          {isPending ? "Checking…" : isRetryError ? "Try again" : "Check delivery"}
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

      {/* Invalid format — inline, no panel. Covers the client guard AND a server
          `bad_request` (D-13): both read as the same message, no retry framing. */}
      {isInvalidFormat && (
        <p className="mt-2 text-sm text-destructive">
          Enter a valid 6-digit pincode.
        </p>
      )}
      {tokenMissing && (
        <p className="mt-2 text-sm text-destructive">
          Please complete the verification check and try again.
        </p>
      )}

      {/* Loading — Skeleton rows mirror the serviceable panel layout (cost + ETA +
          COD) so there is NO layout shift when the real result swaps in. */}
      {isPending && (
        <div className="mt-3 bg-muted/40 p-4 space-y-2" aria-hidden="true">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-52" />
        </div>
      )}

      {/* Fetch failure (D-13: captcha_failed / network / timeout / 5xx) — the CTA
          above is relabeled "Try again"; pressing it re-solves Turnstile (the
          onSettled reset issued a fresh token) and re-invokes. */}
      {isRetryError && !isPending && (
        <p className="mt-3 text-sm text-destructive">
          Couldn't get an estimate right now. Please try again.
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
          // Non-serviceable — clean single line, no cost/ETA panel; the input
          // stays editable for a re-check.
          <p className="mt-3 text-sm text-foreground/70">
            Sorry, we don't deliver to this pincode yet.
          </p>
        )
      )}
    </div>
  );
}
