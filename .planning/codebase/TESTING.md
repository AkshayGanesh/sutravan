# Testing Patterns

**Analysis Date:** 2026-05-31

## Test Framework

**Runner:**
- Not detected / Not configured
- No Jest, Vitest, Mocha, or other test runner found in `package.json`
- No test configuration files present (jest.config.*, vitest.config.*, etc.)

**Assertion Library:**
- Not applicable (no testing framework configured)

**Run Commands:**
- No test commands defined in `package.json`
- Available commands: `npm run dev:client`, `npm run dev`, `npm run build`, `npm run start`, `npm run check`, `npm run db:push`
- Type checking available: `npm run check` (runs `tsc`)

## Test File Organization

**Location:**
- Not applicable; no test files found in the repository
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files detected

**Naming:**
- Not applicable (no tests present)

**Structure:**
- Not applicable (no tests present)

## Type Checking as Validation

**TypeScript Strict Mode:**
- Strict TypeScript configuration enabled in `tsconfig.json`:
  - `"strict": true` enforces all strict type checking options
  - `"noEmit": true` (type checking without emitting code)
  - `"moduleResolution": "bundler"` for proper module resolution

**Validation via Type System:**
- Props interfaces enforce shape of component inputs
  - Example from `ProductCardProps`:
    ```typescript
    interface ProductCardProps {
      product: Product;
      onSelect: (product: Product) => void;
    }
    ```

- Type-safe data structures defined in `shared/schema.ts`
  - Uses Drizzle ORM with Zod schemas for runtime validation
  - Pattern:
    ```typescript
    export const insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
    });
    export type InsertUser = z.infer<typeof insertUserSchema>;
    ```

- Query function types in `queryClient.ts`:
  - Generic type parameter enforces return type shape
  - Discriminated union for conditional behavior (`on401: UnauthorizedBehavior`)

## Mocking

**Framework:**
- Not applicable (no test framework)

**Patterns:**
- No mocking libraries detected

**What to Mock:**
- Not applicable

**What NOT to Mock:**
- Not applicable

## Error Handling in Code

**Runtime Validation:**
- Zod schema validation in `shared/schema.ts` for user data
- HTTP status checks in `queryClient.ts`:
  ```typescript
  async function throwIfResNotOk(res: Response) {
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }
  ```

- Hook context validation (throws if used outside required provider):
  - `useChart` requires `<ChartContainer />` (from `chart.tsx`)
  - `useSidebar` requires `<SidebarProvider>` (from `sidebar.tsx`)
  - `useFormField` requires `<FormField>` (from `form.tsx`)

- Server-side validation:
  - Database URL check at startup: `if (!process.env.DATABASE_URL) throw new Error(...)`
  - Build directory check: `if (!fs.existsSync(distPath)) throw new Error(...)`

## Integration Testing Surface

**API Routes:**
- Defined in `server/routes.ts` (currently empty skeleton)
- Prefix convention: all routes should use `/api` prefix
- Storage interface pattern in `storage.ts` allows swapping implementations for testing:
  ```typescript
  export interface IStorage {
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
  }
  ```

**Component Integration:**
- `App.tsx` wraps Router in providers:
  - `QueryClientProvider` - TanStack React Query
  - `TooltipProvider` - Radix UI
  - Global `Toaster` component for notifications

- `Layout.tsx` wraps pages with `Navbar`, `Footer`, and scroll-to-top logic

**Manual Testing Surface:**
- Dev server: `npm run dev` runs Express + TypeScript with hot reload
- Client dev: `npm run dev:client` runs Vite on port 3200
- Build verification: `npm run build` produces distributable artifact

## Code Coverage

**Requirements:**
- None enforced
- No coverage configuration or thresholds

**View Coverage:**
- Not applicable (no test framework)

## Existing Test Patterns in Code

**Defensive Programming:**
- Optional chaining used: `product?.tips` (in `ProductDetail.tsx`)
- Nullish coalescing: `images.length > 0 ? imgs : [soapImg]` (in `products.ts`)
- Conditional rendering: `{filteredProducts.length === 0 && <p>...no products found</p>}`

**Type Safety as Contract:**
- All components require typed props
- Data queries return typed responses
- Server routes expect typed request/response bodies (via Zod when used)

**Build-Time Validation:**
- `npm run check` validates entire codebase against TypeScript strict rules
- Missing types or type mismatches fail the build

## Accessibility Testing Patterns

**ARIA Attributes:**
- Buttons: `role="button"` and `tabIndex={0}` for keyboard navigation (from `ProductCard.tsx`)
- Image carousels: `aria-label` on prev/next buttons (from `ProductDetail.tsx`)
- Dialog: `DialogTitle` with `sr-only` class for screen readers
- Icons: Inline SVGs with proper styling, no alt text needed if decorative

**Semantic HTML:**
- Dialog component from Radix UI (accessible by default)
- Form field components with proper label association
- Proper heading hierarchy: `h1` for page titles, `h2-h6` for sections

## Testing Recommendations

**Immediate Gaps:**
- No unit test framework configured
- No integration test setup
- No E2E testing framework (Cypress, Playwright, etc.)
- No component snapshot testing

**Suggested Additions for Production Readiness:**
1. **Unit Testing Framework:** Vitest (fast, Vite-native, TypeScript first)
   - Location: `client/src/**/*.test.tsx` or `server/**/*.test.ts`
   - Commands: `npm run test`, `npm run test:watch`, `npm run test:coverage`

2. **Component Testing:** Vitest + React Testing Library
   - Test user interactions, not implementation details
   - Focus on accessibility (`role`, `aria-*` attributes)

3. **E2E Testing:** Playwright or Cypress
   - Test critical user flows: browse products, view details, navigation
   - Location: `e2e/` directory
   - Command: `npm run test:e2e`

4. **API Testing:** Vitest with supertest for Express routes
   - Test `/api/*` endpoints with various payloads
   - Verify error responses (401, 400, 500)

---

*Testing analysis: 2026-05-31*
