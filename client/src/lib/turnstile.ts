// Lazy loader for the Cloudflare Turnstile hosted widget script (D-03).
//
// The Turnstile script is injected on demand (only when the questionnaire's
// review step mounts) rather than bundled, matching the project's bundle
// discipline for heavy/optional deps (TipTap, HEIC libs are code-split the same
// way). The site key is the PUBLIC key (VITE_ is fine, T-05-13); the SECRET key
// lives only in the verify-and-submit Edge Function (Plan 02 / T-05-09).
//
// We deliberately load the hosted CDN script directly rather than adding an npm
// wrapper (@marsidev/react-turnstile) — RESEARCH.md / UI-SPEC Registry Safety
// mandate no new client packages for this path.

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Inject the Turnstile script once and resolve when it has loaded.
 *
 * Idempotent: if the script tag already exists the promise resolves
 * immediately, so repeated mounts of the review step never inject duplicates.
 * Rejects if the script fails to load so the caller can surface an error.
 */
export function loadTurnstile(): Promise<void> {
  if (document.getElementById(SCRIPT_ID)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });
}

// Minimal ambient typing for the global the hosted script attaches. Only the
// methods the wizard uses (render/reset/getResponse/remove) are declared.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
      remove: (widgetId?: string) => void;
    };
  }
}
