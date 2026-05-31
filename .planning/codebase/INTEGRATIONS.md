# External Integrations

**Analysis Date:** 2026-05-31

## APIs & External Services

**Social Media:**
- Instagram - Links to `https://www.instagram.com/sutravan.in` in navbar (`client/src/components/Navbar.tsx`)
- YouTube - Links to `https://youtube.com/@sutravan` in navbar (`client/src/components/Navbar.tsx`)

**Planned/Allowlisted (in build script):**
- Stripe - Listed in build allowlist (`script/build.ts`) but not yet integrated
- Google Generative AI - Listed in build allowlist (`script/build.ts`) but not yet integrated
- OpenAI - Listed in build allowlist (`script/build.ts`) but not yet integrated

## Data Storage

**Primary Database:**
- PostgreSQL
  - Connection: `DATABASE_URL` environment variable (required in `drizzle.config.ts`)
  - ORM: Drizzle ORM 0.39.3
  - Client: pg 8.16.3
  - Schema: `shared/schema.ts` (currently defines users table with id, username, password)
  - Migrations: Via Drizzle Kit - output to `migrations/` directory

**Session Storage:**
- PostgreSQL Session Store
  - Provider: connect-pg-simple 10.0.0
  - Configuration: `server/storage.ts` references session middleware
- In-Memory Fallback
  - Provider: memorystore 1.6.7
  - Use case: Development/testing when PostgreSQL unavailable

**Current Application Storage:**
- In-Memory Storage
  - Implementation: `server/storage.ts` uses `MemStorage` class
  - Stores: Users (Map-based)
  - Persistence: Lost on server restart

**File Storage:**
- Local filesystem only - No cloud storage integration detected

**Caching:**
- Client-side: React Query caching (stale time: Infinity by default)
- No server-side caching detected

## Authentication & Identity

**Auth Provider:**
- Custom local authentication

**Implementation Details:**
- Passport.js 0.7.0 - Pluggable authentication middleware
- passport-local 1.0.0 - Username/password strategy
- express-session 1.18.1 - Session management
- Configuration: `server/storage.ts` interface defines user CRUD operations

**Session Management:**
- `express-session` with PostgreSQL store (connect-pg-simple)
- Fallback to memorystore for development

**Current State:**
- Basic user schema with username/password (plaintext storage - NOT PRODUCTION READY)
- `server/storage.ts` provides user lookup via username
- Routes framework exists but no actual auth routes implemented in `server/routes.ts`

## Client-Server Communication

**HTTP Client:**
- Native Fetch API
- Wrapper: `client/src/lib/queryClient.ts` provides `apiRequest()` function
- Credentials: Cookies included in all requests (`credentials: "include"`)
- Content-Type: JSON

**Request Handling:**
- HTTP method support: GET, POST, PUT, DELETE (via queryClient wrapper)
- Error handling: Response status checked, non-OK responses throw with status code
- Routing prefix: All API routes prefixed with `/api` (`server/index.ts` logging)

**WebSocket:**
- ws 8.18.0 - WebSocket library available for real-time features (not yet integrated)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, LogRocket, or similar integration

**Logging:**
- Console-based logging in server (`server/index.ts`)
  - Logs all `/api` route requests with method, path, status code, duration, and response body
  - Formatted timestamps in 12-hour format
- No client-side logging framework detected

**Performance Monitoring:**
- None detected

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (static site deployment)
- Deployment trigger: Push to main branch or manual workflow dispatch
- Environment: ubuntu-latest runner

**Build Process:**
- GitHub Actions: `.github/workflows/deploy.yml`
- Steps:
  1. Checkout code
  2. Install Node.js 22 with npm caching
  3. Install dependencies: `npm ci`
  4. Build client: `npx vite build`
  5. SPA routing: Copy `index.html` to `404.html`
  6. Upload artifact and deploy to GitHub Pages

**Current Limitations:**
- Client-side only deployment (no server-side rendering)
- GitHub Pages serves static assets only
- Server-side API routes not deployed to GitHub Pages
- Must be paired with separate backend hosting for API functionality

## Environment Configuration

**Required Environment Variables:**

| Variable | Purpose | Location |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `drizzle.config.ts` |
| `NODE_ENV` | Environment mode (development/production) | `server/index.ts` |
| `PORT` | Server port (default: 3200) | `server/index.ts` |
| `VITE_BASE_PATH` | Deployment base path for routing | `vite.config.ts` (optional) |

**Secrets Management:**
- Stored via environment variables only
- No `.env` file parsing library detected
- No secrets vault integration

## API Architecture

**Express Server:**
- Entry: `server/index.ts` - Sets up Express app, middleware, and HTTP server
- Route registration: `server/routes.ts` - Currently empty, awaiting implementation
- Static serving: `server/static.ts` - Serves pre-built client from `dist/public/`
- Development: `server/vite.ts` - HMR-enabled Vite middleware in dev mode

**Middleware Stack:**
1. JSON body parser with raw body capture (`server/index.ts`)
2. URL-encoded form parser
3. Request logging middleware (duration, status, response)
4. Error handling middleware

**Development Mode:**
- Vite HMR enabled via `/vite-hmr` path
- Hot module replacement configured with `allowedHosts: true`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Third-Party Services Overview

| Service | Status | Use Case |
|---------|--------|----------|
| Instagram | Active | Social media links in navbar |
| YouTube | Active | Social media links in navbar |
| PostgreSQL | Required | Primary database |
| GitHub Pages | Active | Static deployment |
| Stripe | Allowlisted | Planned payment integration |
| Google Generative AI | Allowlisted | Planned AI features |
| OpenAI | Allowlisted | Planned AI features |

---

*Integration audit: 2026-05-31*
