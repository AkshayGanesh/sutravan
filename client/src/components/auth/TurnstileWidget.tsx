import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { loadTurnstile } from "@/lib/turnstile";

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
 * (Login / Register / Reset REQUEST). Loads the hosted CDN script via
 * `@/lib/turnstile` and drives `window.turnstile.render/reset/remove` directly
 * — the SAME pattern the questionnaire uses (D-03). No npm wrapper is added:
 * `client/src/lib/turnstile.ts` documents that this path mandates no new client
 * packages, and a wrapper's global `window.turnstile` typing collides with the
 * ambient one declared there.
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

    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetId = useRef<string | null>(null);
    // Hold the latest onToken so the render callbacks (registered once) always
    // call the current handler without re-rendering the widget.
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          onTokenRef.current(null);
          if (window.turnstile && widgetId.current) {
            window.turnstile.reset(widgetId.current);
          }
        },
      }),
      [],
    );

    useEffect(() => {
      // Dev-bypass: emit a placeholder token once so the submit-gate clears when
      // no site key is configured. Real enforcement lives in Supabase.
      if (!siteKey) {
        onTokenRef.current("dev-bypass");
        return;
      }

      let active = true;
      loadTurnstile()
        .then(() => {
          const container = containerRef.current;
          if (!active || !window.turnstile || !container) return;
          container.innerHTML = "";
          widgetId.current = window.turnstile.render(container, {
            sitekey: siteKey,
            callback: (token: string) => onTokenRef.current(token),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
          });
        })
        .catch(() => {
          if (active) onTokenRef.current(null);
        });

      return () => {
        active = false;
        if (window.turnstile && widgetId.current) {
          window.turnstile.remove(widgetId.current);
          widgetId.current = null;
        }
      };
    }, [siteKey]);

    if (!siteKey) {
      return (
        <p className="text-[0.75rem] text-muted-foreground">
          Turnstile disabled: VITE_TURNSTILE_SITE_KEY not set.
        </p>
      );
    }

    return <div ref={containerRef} />;
  },
);

export default TurnstileWidget;
