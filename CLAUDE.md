<!-- GSD:project-start source:PROJECT.md -->

## Project

**Earthen Luxury Sutravan**

Earthen Luxury Sutravan is a handmade luxury skincare brand (soaps, scrubs, creams)
with an existing React/Vite showcase website. This milestone turns the static,
code-managed showcase into a self-managed product: a **Supabase backend** (Postgres +
Auth + Storage) and an **admin portal** where the owner manages all catalog content
without touching code, plus **accounts** for admins and customers and a functional
**customization questionnaire** that captures customer requests. Customer-facing
e-commerce (cart, checkout, payments) is intentionally a later milestone.

**Core Value:** The owner can manage the entire product catalog (products, categories, images, prices)
through an admin portal — no code changes, no redeploys.

### Constraints

- **Tech stack**: Supabase (Postgres + Auth + Storage) as the backend — user-chosen. Keep the existing React/Vite/Tailwind/shadcn frontend.
- **Architecture**: Supabase-direct — frontend talks to Supabase via its client; no custom Express API layer.
- **Compatibility**: Public Shop must keep working (read from Supabase) without regressing the existing UX.
- **Deployment**: Frontend can remain a static SPA (GitHub Pages) since Supabase is hosted separately. Secrets (Supabase keys) handled appropriately for a public client (anon key + Row Level Security).
- **Security**: Admin-only actions must be enforced server-side via Supabase RLS, not just hidden in the UI.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.6.3 - Used for both client (`client/src/`) and server (`server/`)
- JavaScript - Node.js runtime for server-side execution
- CSS - Tailwind CSS with custom components

## Runtime

- Node.js 22 (specified in GitHub Actions, `.github/workflows/deploy.yml`)
- npm - Lockfile: `package-lock.json` present

## Frameworks

- React 19.2.0 - Client-side UI framework
- Express 5.0.1 - Server-side HTTP framework
- Vite 7.1.9 - Frontend build tool and dev server
- Tailwind CSS 4.1.14 - Utility-first CSS framework
- Radix UI (multiple packages) - Unstyled, accessible component primitives
- shadcn/ui - Styled component library built on Radix UI (components in `client/src/components/ui/`)
- Wouter 3.3.5 - Lightweight client-side router (`client/src/App.tsx`)
- TanStack React Query 5.60.5 - Server state management (`client/src/lib/queryClient.ts`)
- Zod 3.25.76 - Runtime type validation
- React Hook Form 7.66.0 - Form state management
- @hookform/resolvers 3.10.0 - Validation resolvers for form integration
- Framer Motion 12.23.24 - Animation library
- Embla Carousel 8.6.0 - Carousel/slider component (`client/src/components/ui/carousel.tsx`)
- Lucide React 0.545.0 - Icon library
- Sonner 2.0.7 - Toast notifications
- Class Variance Authority 0.7.1 - Component variant generation
- clsx 2.1.1 - Conditional className utility
- Tailwind Merge 3.3.1 - Merges Tailwind classes intelligently

## Testing

- Not detected in current configuration

## Build & Dev Tools

- esbuild 0.25.0 - JavaScript bundler for server build (`script/build.ts`)
- Vite 7.1.9 - Client build and dev server
- tsx 4.20.5 - TypeScript execution for Node.js
- @vitejs/plugin-react 5.0.4 - React support for Vite
- @tailwindcss/vite 4.1.14 - Tailwind CSS Vite plugin
- TypeScript 5.6.3 - Configured in `tsconfig.json`
- PostCSS 8.5.6 - CSS transformation framework
- Autoprefixer 10.4.21 - CSS vendor prefixing

## Database

- Drizzle ORM 0.39.3 - Type-safe SQL query builder
- Drizzle Kit 0.31.4 - Database migration tool
- pg 8.16.3 - PostgreSQL client
- `shared/schema.ts` - Shared database schema definitions
- `drizzle.config.ts` - Drizzle configuration with PostgreSQL dialect

## Key Dependencies

- drizzle-orm 0.39.3 - Core ORM for database operations
- pg 8.16.3 - PostgreSQL connectivity
- express 5.0.1 - HTTP server framework
- react 19.2.0 - React framework
- @tanstack/react-query 5.60.5 - Server state management
- express-session 1.18.1 - Session middleware
- connect-pg-simple 10.0.0 - PostgreSQL session store
- memorystore 1.6.7 - In-memory session store fallback
- passport 0.7.0 - Authentication middleware
- passport-local 1.0.0 - Local authentication strategy
- ws 8.18.0 - WebSocket support
- date-fns 3.6.0 - Date utilities
- nanoid (via build allowlist) - Unique ID generation
- zod 3.25.76 - Runtime schema validation
- drizzle-zod 0.7.0 - Zod integration for Drizzle
- zod-validation-error 3.4.0 - Improved Zod error messages
- recharts 2.15.4 - React charting library

## Configuration Files

- `tsconfig.json` - Compiler options with `strict: true`, path aliases for `@/*` and `@shared/*`
- `vite.config.ts` - Vite configuration with React and Tailwind plugins
- `drizzle.config.ts` - Database migration configuration
- `server/index.ts` - Express app setup
- `server/routes.ts` - Route registration
- `server/storage.ts` - Storage interface (currently in-memory)
- `server/vite.ts` - Development Vite middleware integration
- `server/static.ts` - Production static file serving
- `client/src/main.tsx` - Entry point
- `client/src/App.tsx` - Root component with routing
- `postcss.config.js` - PostCSS configuration
- `client/src/index.css` - Global styles
- `components.json` - shadcn/ui configuration
- `package.json` - Dependencies and scripts

## Environment Configuration

- `DATABASE_URL` - PostgreSQL connection string (required by `drizzle.config.ts`)
- `NODE_ENV` - Development or production mode
- `PORT` - Server port (defaults to 3200 if not specified)
- `VITE_BASE_PATH` - Optional Vite base path for deployment
- Environment variables read directly via `process.env`
- No `.env` file parsing library detected; relies on runtime environment

## Build Scripts

- `npm run dev` - Start server in development mode with tsx
- `npm run dev:client` - Start Vite dev server on port 3200
- `npm run check` - TypeScript type checking
- `npm run build` - Build client with Vite, bundle server with esbuild
- `npm run start` - Run production bundle
- `npm run db:push` - Push Drizzle migrations to database

## Deployment

- GitHub Pages (configured in `.github/workflows/deploy.yml`)
- Builds client-side static assets only
- SPA routing handled via `404.html` copy
- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Runs on: Node.js 22
- Steps: Install dependencies, build client, deploy to GitHub Pages

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase (e.g., `ProductCard.tsx`, `Hero.tsx`, `Layout.tsx`)
- Hooks: PascalCase with `use` prefix (e.g., `use-mobile.tsx`)
- Utilities: camelCase (e.g., `utils.ts`, `queryClient.ts`)
- Data files: camelCase (e.g., `products.ts`)
- Pages: PascalCase (e.g., `Shop.tsx`, `OurStory.tsx`, `Contact.tsx`)
- UI components: PascalCase (e.g., `dialog.tsx`, `button.tsx`, `card.tsx`)
- React components: PascalCase (e.g., `export default function ProductCard()`)
- Helper functions: camelCase (e.g., `getSoapImages()`, `getProductsByCategory()`)
- Handler functions: camelCase prefixed with `handle` (e.g., `handleCategoryChange()`, `onSelect()`)
- Utility functions: camelCase (e.g., `cn()` for className utilities)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `MOBILE_BREAKPOINT`, `INSTAGRAM_URL`, `EMAIL`, `BATCH_NOTE`)
- State variables: camelCase (e.g., `activeCategory`, `selectedProduct`, `activeIndex`)
- Destructured props: camelCase (e.g., `{ product, onSelect }`)
- Interfaces: PascalCase (e.g., `ProductCardProps`, `ProductDetailProps`, `Product`, `Category`, `CategoryInfo`)
- Type aliases: PascalCase (e.g., `Category = 'soap' | 'scrub' | 'cream'`)
- Discriminated types: camelCase for discriminant values (e.g., `on401: UnauthorizedBehavior`)

## Code Style

- No ESLint or Prettier configuration detected
- Code follows consistent patterns with:
- No linting configuration file present (.eslintrc, eslint.config.*, etc.)
- TypeScript strict mode enabled via `tsconfig.json` (`"strict": true`)
- Type checking enforced with `npm run check` (runs `tsc`)

## Import Organization

- `@/*` → `./client/src/*` (primary app code)
- `@shared/*` → `./shared/*` (shared schemas, types)
- `@assets/*` → `./attached_assets/*` (static assets)
- Import aliases defined in `tsconfig.json` and `vite.config.ts`

## Error Handling

- HTTP errors: Check response status and throw descriptive Error objects
- Hook validation errors: Throw descriptive errors if hooks used outside required context
- Build-time errors: Throw if required environment variables missing
- Server errors: Generic 500 handler catches unhandled errors and logs them

## Logging

- Server-side logging: Custom `log()` function in `server/index.ts` (lines 25-34)
- API request logging: Middleware in `server/index.ts` (lines 36-60)
- Client-side: No explicit logging detected in component code

## Comments

- Complex data transformations (e.g., in `products.ts` filter/sort logic)
- Intentional workarounds or non-obvious patterns
- Port and host configuration explanations (e.g., "ALWAYS serve the app on the port specified in the environment variable PORT")
- Not used; type annotations provide sufficient documentation
- Single-line comments used sparingly for clarification
- Section dividers used in data files: `// ─── SOAPS ───────────────────────────────────────────────`

## Function Design

- Small, focused functions preferred
- Helper functions 1-15 lines (e.g., `getSoapImages()`, `cn()`)
- React components typically 40-200 lines including JSX
- Props destructured inline for clarity
- Callback handlers passed as props, named with `on` or `handle` prefix
- React components return JSX (single root or Fragment)
- Helper functions return typed values explicitly
- Query functions return data or null (conditional on 401 behavior)

## Module Design

- Named exports for utilities and types: `export function getProductsByCategory()`, `export type Product`
- Default exports for React components: `export default function ProductCard()`
- Single named export for storage interface and implementation: `export { storage, MemStorage, IStorage }`
- Not used; direct imports from component paths
- UI components imported directly from `@/components/ui/dialog`, not a central index

## Component Patterns

- All React components are functional (no class components)
- React hooks used for state management (`useState`, `useEffect`)
- Custom hooks extracted for reuse (e.g., `useIsMobile()`)
- Heavy use of Tailwind utility classes directly in JSX
- Custom color theme variables via CSS custom properties (in `index.css`)
- No external CSS files; all styling via `className` attribute
- Example: `className="px-5 py-2.5 text-sm uppercase tracking-wider font-medium transition-colors duration-300 border"`

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Pages | Site routes (Home, Shop, OurStory, Contact, Questionnaire, NotFound) | `client/src/pages/*` |
| Layout | Wraps all pages with Navbar, Footer, scroll-to-top logic | `client/src/components/Layout.tsx` |
| Navbar | Navigation, social links (Instagram, YouTube, Email), mobile menu | `client/src/components/Navbar.tsx` |
| Footer | Site footer | `client/src/components/Footer.tsx` |
| ProductGrid | Featured product showcase with modal detail view | `client/src/components/ProductGrid.tsx` |
| ProductCard | Individual product card, triggers detail modal | `client/src/components/ProductCard.tsx` |
| ProductDetail | Modal view for product details (ingredients, benefits, usage) | `client/src/components/ProductDetail.tsx` |
| Hero | Full-screen hero banner with CTA buttons | `client/src/components/Hero.tsx` |
| UI Components | Radix UI primitive wrappers (Dialog, Sheet, Button, etc.) | `client/src/components/ui/*` |
| Query Client | React Query configuration with fetch-based apiRequest helper | `client/src/lib/queryClient.ts` |
| Toast Hook | Toast notification state management | `client/src/hooks/use-toast.ts` |
| Mobile Hook | Responsive breakpoint detection | `client/src/hooks/use-mobile.tsx` |
| Product Data | Static products, categories, featured selection | `client/src/data/products.ts` |
| Express Server | HTTP server, route registration, error handling, logging | `server/index.ts` |
| Routes Handler | API endpoint registration placeholder | `server/routes.ts` |
| Storage | In-memory user storage interface and implementation | `server/storage.ts` |
| Static Serving | Production SPA static asset serving with fallback to index.html | `server/static.ts` |
| Vite Dev | Development HMR and index.html transformation | `server/vite.ts` |
| Schema | Drizzle ORM table definitions, Zod validation | `shared/schema.ts` |

## Pattern Overview

- Single codebase for client and server (monorepo)
- React Router via Wouter (lightweight client-side routing)
- Tailwind CSS + Radix UI component library
- React Query for server state (ready but not yet wired to endpoints)
- Express server hosts both API and static assets
- Drizzle ORM prepared with PostgreSQL support
- Type-safe schema definitions shared between client and server
- Build process: Vite for client, esbuild for server Node bundle

## Layers

- Purpose: Render pages, handle user interactions, display products
- Location: `client/src/`
- Contains: React components (pages, layout, UI), static product data
- Depends on: Wouter (routing), React Query (API communication), Tailwind CSS, Radix UI, React Hook Form
- Used by: Browser
- Purpose: Manage product catalog, fetch behavior, form validation
- Location: `client/src/data/`, `client/src/lib/`, `client/src/hooks/`
- Contains: Product definitions with categories, Query client configuration, custom hooks
- Depends on: React Query, Zod schema types from shared
- Used by: Page and component layer
- Purpose: Route HTTP requests, log, handle errors, serve static files
- Location: `server/index.ts`, `server/routes.ts`, `server/static.ts`, `server/vite.ts`
- Contains: Express app setup, route registration placeholder, error middleware, request logging
- Depends on: Express, Vite (dev only), static file serving
- Used by: HTTP clients (browser)
- Purpose: Persist and retrieve user data
- Location: `server/storage.ts`
- Contains: In-memory MemStorage implementation, IStorage interface for user CRUD
- Depends on: Drizzle ORM types, shared schema
- Used by: Routes handler (when routes are implemented)
- Purpose: Type-safe, database-agnostic schema definitions
- Location: `shared/schema.ts`
- Contains: Drizzle ORM PostgreSQL table definitions, Zod schemas for validation
- Depends on: Drizzle ORM, Zod
- Used by: Server storage, client type inference

## Data Flow

### Primary Request Path (Product Browsing)

### Secondary Flow: Questionnaire Form Submission

### Development Server Flow

### Production Server Flow

## Key Abstractions

- Purpose: Abstract database layer for user data operations
- Examples: `server/storage.ts` — getUser, getUserByUsername, createUser
- Pattern: Interface-based dependency injection; allows swap from MemStorage to PostgreSQL/Drizzle implementation
- Purpose: Represent skincare product offerings with metadata
- Examples: `client/src/data/products.ts` — Product interface with name, benefits, ingredients, category
- Pattern: Static data array; getFeaturedProducts() helper for homepage selection
- Purpose: Centralized API communication and caching
- Examples: `client/src/lib/queryClient.ts` — apiRequest helper, React Query configuration
- Pattern: Fetch wrapper with error handling and credentials; React Query default options disable refetch
- Purpose: Reusable Radix UI wrappers with Tailwind styling
- Examples: `client/src/components/ui/*` — Button, Card, Dialog, Sheet, etc.
- Pattern: Headless component composites; CVA (class-variance-authority) for variant styling

## Entry Points

- Location: `client/src/main.tsx`
- Triggers: Browser loads `/`
- Responsibilities: Mount React app to DOM via createRoot, render App component
- Location: `server/index.ts`
- Triggers: `npm run dev` or `npm start`
- Responsibilities: Initialize Express app, register routes, setup Vite or static serving, listen on port 3200
- Location: App component (`client/src/App.tsx`)
- Triggers: Client side mount, URL changes
- Responsibilities: Wrap Router (Wouter), define all page routes, provide React Query context and toast provider
- Locations: `client/src/pages/Home.tsx`, `client/src/pages/Shop.tsx`, `client/src/pages/OurStory.tsx`, `client/src/pages/Contact.tsx`, `client/src/pages/Questionnaire.tsx`, `client/src/pages/not-found.tsx`
- Triggers: Wouter routing based on URL path
- Responsibilities: Render page-specific content within Layout wrapper

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; Express handles concurrent HTTP requests via libuv thread pool.
- **Global state:** MemStorage is a module-level singleton (`export const storage = new MemStorage()` in `server/storage.ts`); toast state managed as module-level reducer with listener array in `client/src/hooks/use-toast.ts`.
- **Circular imports:** None detected; shared schema imported by server storage and client types.
- **API Routes:** Currently empty placeholder (`server/routes.ts`); all endpoints must be registered here before connecting React Query calls.
- **Port binding:** Hard-wired to port 3200 (read from `process.env.PORT` with default 3200); other ports are firewalled.
- **Environment:** Development uses Vite HMR via WebSocket; production serves pre-built static files from `dist/public/`.

## Anti-Patterns

### Hardcoded Product Data in Client

### Disconnected API Infrastructure

### In-Memory Storage Without Persistence

## Error Handling

- Server catches errors in route handlers and logs to console
- Error middleware in `server/index.ts` checks `err.status` or `err.statusCode`, defaults to 500
- Returns JSON error response: `{ message: err.message }`
- Client-side: apiRequest in `client/src/lib/queryClient.ts` throws on non-2xx status, React Query catches and exposes via query state
- Toast notifications can display query errors in UI
- No centralized error logging service; logs go to stdout

## Cross-Cutting Concerns

- Server logs API requests with method, path, status code, duration, and response body (if JSON)
- Format: `HH:MM:SS [express] METHOD /path STATUS in Xms :: {response}`
- Client has no structured logging; browser console available
- Shared Zod schemas in `shared/schema.ts` define insertUserSchema for type safety
- Server should validate request bodies against schema before storage operations
- Client validates form inputs via React Hook Form + Zod resolvers (e.g., in Questionnaire form)
- No API request/response validation layer currently in place
- Passport.js dependency present in package.json but not wired
- No login/logout flow implemented
- Express session configured but no middleware registered
- Production use requires implementing authentication routes in `server/routes.ts` and session middleware in `server/index.ts`

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
