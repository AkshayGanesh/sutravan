# Coding Conventions

**Analysis Date:** 2026-05-31

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `ProductCard.tsx`, `Hero.tsx`, `Layout.tsx`)
- Hooks: PascalCase with `use` prefix (e.g., `use-mobile.tsx`)
- Utilities: camelCase (e.g., `utils.ts`, `queryClient.ts`)
- Data files: camelCase (e.g., `products.ts`)
- Pages: PascalCase (e.g., `Shop.tsx`, `OurStory.tsx`, `Contact.tsx`)
- UI components: PascalCase (e.g., `dialog.tsx`, `button.tsx`, `card.tsx`)

**Functions:**
- React components: PascalCase (e.g., `export default function ProductCard()`)
- Helper functions: camelCase (e.g., `getSoapImages()`, `getProductsByCategory()`)
- Handler functions: camelCase prefixed with `handle` (e.g., `handleCategoryChange()`, `onSelect()`)
- Utility functions: camelCase (e.g., `cn()` for className utilities)

**Variables:**
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `MOBILE_BREAKPOINT`, `INSTAGRAM_URL`, `EMAIL`, `BATCH_NOTE`)
- State variables: camelCase (e.g., `activeCategory`, `selectedProduct`, `activeIndex`)
- Destructured props: camelCase (e.g., `{ product, onSelect }`)

**Types:**
- Interfaces: PascalCase (e.g., `ProductCardProps`, `ProductDetailProps`, `Product`, `Category`, `CategoryInfo`)
- Type aliases: PascalCase (e.g., `Category = 'soap' | 'scrub' | 'cream'`)
- Discriminated types: camelCase for discriminant values (e.g., `on401: UnauthorizedBehavior`)

## Code Style

**Formatting:**
- No ESLint or Prettier configuration detected
- Code follows consistent patterns with:
  - 2-space indentation (inferred from actual code)
  - Semicolons used consistently
  - Single quotes preferred in JSX strings where possible

**Linting:**
- No linting configuration file present (.eslintrc, eslint.config.*, etc.)
- TypeScript strict mode enabled via `tsconfig.json` (`"strict": true`)
- Type checking enforced with `npm run check` (runs `tsc`)

## Import Organization

**Order:**
1. React/framework imports (`import { useState, useEffect } from "react"`)
2. Third-party library imports (date-fns, wouter, react-hook-form, etc.)
3. Local component imports (relative paths or aliased paths)
4. Type imports (using `import type`)

**Example pattern** from `Shop.tsx`:
```typescript
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import ProductCard from "@/components/ProductCard";
import {
  products,
  categories,
  type Product,
  type Category,
} from "@/data/products";
```

**Path Aliases:**
- `@/*` → `./client/src/*` (primary app code)
- `@shared/*` → `./shared/*` (shared schemas, types)
- `@assets/*` → `./attached_assets/*` (static assets)
- Import aliases defined in `tsconfig.json` and `vite.config.ts`

## Error Handling

**Patterns:**
- HTTP errors: Check response status and throw descriptive Error objects
  - Pattern: `if (!res.ok) throw new Error(${res.status}: ${text})`
  - Used in `queryClient.ts` via `throwIfResNotOk()` helper

- Hook validation errors: Throw descriptive errors if hooks used outside required context
  - Pattern: `throw new Error("useChart must be used within a <ChartContainer />")`
  - Used in `form.tsx`, `sidebar.tsx`, `chart.tsx`

- Build-time errors: Throw if required environment variables missing
  - Pattern: `if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL, ensure the database is provisioned")`
  - Used in `drizzle.config.ts`

- Server errors: Generic 500 handler catches unhandled errors and logs them
  - Error middleware in `server/index.ts` (lines 65-76)
  - Extracts status and message, returns JSON response

**No try/catch** patterns observed in component code; errors propagate to parent handlers or global error boundary.

## Logging

**Framework:** Native `console` object

**Patterns:**
- Server-side logging: Custom `log()` function in `server/index.ts` (lines 25-34)
  - Formats with timestamp and source label
  - Example: `log("message")` or `log(message, "custom-source")`
  
- API request logging: Middleware in `server/index.ts` (lines 36-60)
  - Logs HTTP method, path, status code, duration in milliseconds
  - Includes JSON response body for `/api` routes
  - Only logs `/api/*` paths; other routes are silent

- Client-side: No explicit logging detected in component code

## Comments

**When to Comment:**
- Complex data transformations (e.g., in `products.ts` filter/sort logic)
- Intentional workarounds or non-obvious patterns
- Port and host configuration explanations (e.g., "ALWAYS serve the app on the port specified in the environment variable PORT")

**JSDoc/TSDoc:**
- Not used; type annotations provide sufficient documentation
- Single-line comments used sparingly for clarification
- Section dividers used in data files: `// ─── SOAPS ───────────────────────────────────────────────`

## Function Design

**Size:**
- Small, focused functions preferred
- Helper functions 1-15 lines (e.g., `getSoapImages()`, `cn()`)
- React components typically 40-200 lines including JSX

**Parameters:**
- Props destructured inline for clarity
  - Pattern: `({ product, onSelect }: ProductCardProps)`
- Callback handlers passed as props, named with `on` or `handle` prefix
  - Pattern: `onSelect`, `onClose`, `onClick`, `onChange`, `onKeyDown`

**Return Values:**
- React components return JSX (single root or Fragment)
- Helper functions return typed values explicitly
- Query functions return data or null (conditional on 401 behavior)

## Module Design

**Exports:**
- Named exports for utilities and types: `export function getProductsByCategory()`, `export type Product`
- Default exports for React components: `export default function ProductCard()`
- Single named export for storage interface and implementation: `export { storage, MemStorage, IStorage }`

**Barrel Files:**
- Not used; direct imports from component paths
- UI components imported directly from `@/components/ui/dialog`, not a central index

**Import statements** show preference for explicit imports over wildcard imports.

## Component Patterns

**Functional components:**
- All React components are functional (no class components)
- React hooks used for state management (`useState`, `useEffect`)
- Custom hooks extracted for reuse (e.g., `useIsMobile()`)

**Props interface pattern** from `ProductCard.tsx`:
```typescript
interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  // implementation
}
```

**Tailwind CSS:**
- Heavy use of Tailwind utility classes directly in JSX
- Custom color theme variables via CSS custom properties (in `index.css`)
- No external CSS files; all styling via `className` attribute
- Example: `className="px-5 py-2.5 text-sm uppercase tracking-wider font-medium transition-colors duration-300 border"`

---

*Convention analysis: 2026-05-31*
