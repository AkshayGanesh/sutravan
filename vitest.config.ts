import { defineConfig } from "vitest/config";
import path from "path";

// Vitest footing for the admin write-layer pure modules (Phase 04 Plan 02).
// Defaults to the `node` environment for the pure suites (slug, adminErrors,
// imagePipeline guard); suites that touch the DOM (sanitizeHtml → DOMPurify)
// opt into jsdom via a `// @vitest-environment jsdom` file pragma.
// The `@` alias mirrors vite.config.ts so test imports resolve like app code.
//
// esbuild.jsx = "automatic" mirrors the app's tsconfig `jsx: react-jsx` runtime so
// component suites (e.g. DeliveryPincodePill via renderToStaticMarkup) transform
// JSX with the automatic runtime instead of esbuild's classic default — which
// otherwise throws "React is not defined" because components import named hooks
// only, never a default `React` (matching the app's automatic-runtime build).
export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
});
