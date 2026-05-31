<!-- refreshed: 2026-05-31 -->
# Architecture

**Analysis Date:** 2026-05-31

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite)                          │
├──────────────────┬──────────────────┬──────────────────┐         │
│   Pages          │   Components     │   UI Primitives  │         │
│  `client/src/    │  `client/src/    │  `client/src/    │         │
│   pages/*`       │   components/*`  │   components/ui/*`        │
└────────┬─────────┴────────┬─────────┴────────┬─────────┘         │
         │                  │                   │                   │
         ▼                  ▼                   ▼                   │
┌──────────────────────────────────────────────────────────────────┤
│                     React Context & Query                         │
│         `client/src/lib/queryClient.ts`                           │
│         `client/src/hooks/*`                                      │
└────────┬───────────────────────────────────────────────────────┘ │
         │                                                          │
         ▼                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │           Static Data & Product Definitions                 │ │
│ │         `client/src/data/products.ts`                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Express HTTP Server                            │
├──────────────────┬──────────────────┬──────────────────────────┤
│  Routes/API      │  Static Serving  │  Vite Dev Server Setup   │
│ `server/routes.ts`│ `server/static.ts`│ `server/vite.ts`        │
└──────────────────┴──────────┬───────┴──────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Storage Interface  │
                   │ `server/storage.ts` │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Shared Schema      │
                   │ `shared/schema.ts`  │
                   └─────────────────────┘
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

**Overall:** Full-Stack TypeScript SPA with Express backend and React Vite frontend - Monorepo structure.

**Key Characteristics:**
- Single codebase for client and server (monorepo)
- React Router via Wouter (lightweight client-side routing)
- Tailwind CSS + Radix UI component library
- React Query for server state (ready but not yet wired to endpoints)
- Express server hosts both API and static assets
- Drizzle ORM prepared with PostgreSQL support
- Type-safe schema definitions shared between client and server
- Build process: Vite for client, esbuild for server Node bundle

## Layers

**Presentation (Client):**
- Purpose: Render pages, handle user interactions, display products
- Location: `client/src/`
- Contains: React components (pages, layout, UI), static product data
- Depends on: Wouter (routing), React Query (API communication), Tailwind CSS, Radix UI, React Hook Form
- Used by: Browser

**Business Logic & Data (Client):**
- Purpose: Manage product catalog, fetch behavior, form validation
- Location: `client/src/data/`, `client/src/lib/`, `client/src/hooks/`
- Contains: Product definitions with categories, Query client configuration, custom hooks
- Depends on: React Query, Zod schema types from shared
- Used by: Page and component layer

**API Gateway (Server):**
- Purpose: Route HTTP requests, log, handle errors, serve static files
- Location: `server/index.ts`, `server/routes.ts`, `server/static.ts`, `server/vite.ts`
- Contains: Express app setup, route registration placeholder, error middleware, request logging
- Depends on: Express, Vite (dev only), static file serving
- Used by: HTTP clients (browser)

**Storage & Data (Server):**
- Purpose: Persist and retrieve user data
- Location: `server/storage.ts`
- Contains: In-memory MemStorage implementation, IStorage interface for user CRUD
- Depends on: Drizzle ORM types, shared schema
- Used by: Routes handler (when routes are implemented)

**Shared Definitions:**
- Purpose: Type-safe, database-agnostic schema definitions
- Location: `shared/schema.ts`
- Contains: Drizzle ORM PostgreSQL table definitions, Zod schemas for validation
- Depends on: Drizzle ORM, Zod
- Used by: Server storage, client type inference

## Data Flow

### Primary Request Path (Product Browsing)

1. User loads homepage or navigates to `/shop` (`client/src/pages/Home.tsx`, `client/src/pages/Shop.tsx`)
2. Pages render with static product data from `client/src/data/products.ts` (no API call yet)
3. Products displayed in grid via `ProductGrid.tsx` → `ProductCard.tsx` components
4. User clicks product card → `setSelectedProduct()` state update
5. `ProductDetail.tsx` modal renders with selected product information
6. User returns to browsing or navigates via `Navbar.tsx` using Wouter links

**State Management:** Local component state (useState) for selected product, local page state for active category filter.

### Secondary Flow: Questionnaire Form Submission

1. User visits `/questionnaire` page (`client/src/pages/Questionnaire.tsx`)
2. Form fields populated with React Hook Form
3. User submits form → calls `apiRequest()` to `/api/questionnaire` (endpoint not yet implemented)
4. Response handled by React Query mutation
5. Success/error toast shown via `useToast()` hook

**State Management:** Form state via React Hook Form, async state via React Query mutations, UI notifications via toast reducer.

### Development Server Flow

1. `npm run dev` runs `tsx server/index.ts`
2. Express server initialized on port 3200
3. In development, `setupVite()` registers Vite middleware for HMR
4. Client requests to non-`/api` paths served by Vite dev server
5. Changes to React components trigger HMR refresh in browser

**State Management:** Vite tracks component changes, HMR updates DOM in-place, browser WebSocket connects to `/vite-hmr`.

### Production Server Flow

1. `npm run build` compiles:
   - Client via Vite → `dist/public/`
   - Server via esbuild → `dist/index.cjs`
2. `npm start` runs `node dist/index.cjs`
3. Express serves static files from `dist/public/`
4. All non-API routes fall back to `index.html` for SPA routing
5. API routes (currently empty) would be handled by `/api` prefix

**State Management:** Client-side React state, no persistent session state (MemStorage resets on restart).

## Key Abstractions

**IStorage Interface:**
- Purpose: Abstract database layer for user data operations
- Examples: `server/storage.ts` — getUser, getUserByUsername, createUser
- Pattern: Interface-based dependency injection; allows swap from MemStorage to PostgreSQL/Drizzle implementation

**Product Catalog:**
- Purpose: Represent skincare product offerings with metadata
- Examples: `client/src/data/products.ts` — Product interface with name, benefits, ingredients, category
- Pattern: Static data array; getFeaturedProducts() helper for homepage selection

**Query Client:**
- Purpose: Centralized API communication and caching
- Examples: `client/src/lib/queryClient.ts` — apiRequest helper, React Query configuration
- Pattern: Fetch wrapper with error handling and credentials; React Query default options disable refetch

**UI Primitives:**
- Purpose: Reusable Radix UI wrappers with Tailwind styling
- Examples: `client/src/components/ui/*` — Button, Card, Dialog, Sheet, etc.
- Pattern: Headless component composites; CVA (class-variance-authority) for variant styling

## Entry Points

**Client Entry:**
- Location: `client/src/main.tsx`
- Triggers: Browser loads `/`
- Responsibilities: Mount React app to DOM via createRoot, render App component

**Server Entry:**
- Location: `server/index.ts`
- Triggers: `npm run dev` or `npm start`
- Responsibilities: Initialize Express app, register routes, setup Vite or static serving, listen on port 3200

**Route Entry:**
- Location: App component (`client/src/App.tsx`)
- Triggers: Client side mount, URL changes
- Responsibilities: Wrap Router (Wouter), define all page routes, provide React Query context and toast provider

**Page Entries:**
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

**What happens:** Product catalog is imported as static JSON-like data in `client/src/data/products.ts` with inline image imports. No API to fetch products.

**Why it's wrong:** Product catalog cannot be updated without rebuilding client; search/filtering happens in JavaScript on static array; no server-side product management; images must be bundled at build time.

**Do this instead:** Create `/api/products` endpoint in `server/routes.ts` that queries database via storage layer. Move product images to static asset directory referenced by image paths. Client queries products via React Query in `Shop.tsx` and `ProductGrid.tsx`, caches via React Query, and re-syncs when needed.

### Disconnected API Infrastructure

**What happens:** Storage interface, Drizzle schema, and React Query client are all set up, but `server/routes.ts` is empty. No endpoints actually wired.

**Why it's wrong:** Features that need backend state (user profiles, form submissions, cart) cannot be implemented. Forms like Questionnaire have nowhere to send data.

**Do this instead:** Implement endpoints in `server/routes.ts` that use the storage interface. Example: `app.post('/api/questionnaire', (req, res) => { /* validate with shared schema, store, respond */ })`. Export functions from `server/routes.ts` for each logical feature (users, products, forms).

### In-Memory Storage Without Persistence

**What happens:** MemStorage stores all data in JavaScript Map objects. Data is lost when server restarts.

**Why it's wrong:** User registrations, form submissions, and profile data vanish on restart. Not suitable for production.

**Do this instead:** Create a PostgreSQL-backed storage implementation (e.g., `PostgresStorage` class extending `IStorage`). Use Drizzle ORM to query/insert into database tables. Swap `export const storage = new MemStorage()` to `export const storage = new PostgresStorage()` when ready. Drizzle schema is already defined in `shared/schema.ts`.

## Error Handling

**Strategy:** Middleware-based error catching with error object inspection.

**Patterns:**
- Server catches errors in route handlers and logs to console
- Error middleware in `server/index.ts` checks `err.status` or `err.statusCode`, defaults to 500
- Returns JSON error response: `{ message: err.message }`
- Client-side: apiRequest in `client/src/lib/queryClient.ts` throws on non-2xx status, React Query catches and exposes via query state
- Toast notifications can display query errors in UI
- No centralized error logging service; logs go to stdout

## Cross-Cutting Concerns

**Logging:**
- Server logs API requests with method, path, status code, duration, and response body (if JSON)
- Format: `HH:MM:SS [express] METHOD /path STATUS in Xms :: {response}`
- Client has no structured logging; browser console available

**Validation:**
- Shared Zod schemas in `shared/schema.ts` define insertUserSchema for type safety
- Server should validate request bodies against schema before storage operations
- Client validates form inputs via React Hook Form + Zod resolvers (e.g., in Questionnaire form)
- No API request/response validation layer currently in place

**Authentication:**
- Passport.js dependency present in package.json but not wired
- No login/logout flow implemented
- Express session configured but no middleware registered
- Production use requires implementing authentication routes in `server/routes.ts` and session middleware in `server/index.ts`

---

*Architecture analysis: 2026-05-31*
