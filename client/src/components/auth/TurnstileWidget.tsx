import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";

/**
 * Public handle exposed to parent forms — lets the auth pages reset the widget
 * after a failed/expired attempt so a fresh single-use token is issued.
 */
export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  /**
   * Called with the captcha token on success, or `null` when the token is
   * cleared (error/expiry). Parents gate submit on a non-null value.
   */
  onToken: (token: string | null) => void;
}

/**
 * Reusable Cloudflare Turnstile widget for the unauthenticated auth surfaces
 * (Login / Register / Reset REQUEST). Wraps `@marsidev/react-turnstile`, which
 * owns the widget lifecycle, single-use token expiry, and React cleanup.
 *
 * The PUBLIC site key is read from `VITE_TURNSTILE_SITE_KEY` (mirrors the VITE_
 * pattern in `@/lib/supabase`). The SECRET key never touches the client — token
 * verification happens server-side via Supabase native Bot Protection.
 *
 * Dev fallback: with no site key (e.g. `npm run dev:client` without `.env.local`)
 * the widget is not rendered; instead it emits a one-time "dev-bypass" token so
 * the submit-gate stays satisfied locally. Real enforcement is unaffected — it
 * lives entirely in Supabase once the owner enables Bot Protection.
 */
const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onToken }, ref) {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
      | string
      | undefined;

    const innerRef = useRef<TurnstileInstance | undefined>(undefined);
    const devEmitted = useRef(false);

    // Dev-bypass: emit a placeholder token once so the submit-gate clears when
    // no site key is configured. Guarded so it fires a single time per mount.
    useEffect(() => {
      if (!siteKey && !devEmitted.current) {
        devEmitted.current = true;
        onToken("dev-bypass");
      }
    }, [siteKey, onToken]);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          // No-op in the dev-bypass branch (no underlying widget).
          innerRef.current?.reset();
        },
      }),
      [],
    );

    if (!siteKey) {
      return (
        <p className="text-[0.75rem] text-muted-foreground">
          Turnstile disabled: VITE_TURNSTILE_SITE_KEY not set.
        </p>
      );
    }

    return (
      <Turnstile
        ref={innerRef}
        siteKey={siteKey}
        onSuccess={(token) => onToken(token)}
        onError={() => onToken(null)}
        onExpire={() => onToken(null)}
      />
    );
  },
);

export default TurnstileWidget;
