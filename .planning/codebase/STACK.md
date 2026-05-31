# Technology Stack

**Analysis Date:** 2026-05-31

## Languages

**Primary:**
- TypeScript 5.6.3 - Used for both client (`client/src/`) and server (`server/`)
- JavaScript - Node.js runtime for server-side execution

**Secondary:**
- CSS - Tailwind CSS with custom components

## Runtime

**Environment:**
- Node.js 22 (specified in GitHub Actions, `.github/workflows/deploy.yml`)

**Package Manager:**
- npm - Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 - Client-side UI framework
- Express 5.0.1 - Server-side HTTP framework
- Vite 7.1.9 - Frontend build tool and dev server
- Tailwind CSS 4.1.14 - Utility-first CSS framework

**UI Components:**
- Radix UI (multiple packages) - Unstyled, accessible component primitives
  - @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tabs, etc.
- shadcn/ui - Styled component library built on Radix UI (components in `client/src/components/ui/`)

**Routing:**
- Wouter 3.3.5 - Lightweight client-side router (`client/src/App.tsx`)

**State Management & Data:**
- TanStack React Query 5.60.5 - Server state management (`client/src/lib/queryClient.ts`)
- Zod 3.25.76 - Runtime type validation

**Forms & Input:**
- React Hook Form 7.66.0 - Form state management
- @hookform/resolvers 3.10.0 - Validation resolvers for form integration

**Animation & Motion:**
- Framer Motion 12.23.24 - Animation library
- Embla Carousel 8.6.0 - Carousel/slider component (`client/src/components/ui/carousel.tsx`)

**UI Utilities:**
- Lucide React 0.545.0 - Icon library
- Sonner 2.0.7 - Toast notifications
- Class Variance Authority 0.7.1 - Component variant generation
- clsx 2.1.1 - Conditional className utility
- Tailwind Merge 3.3.1 - Merges Tailwind classes intelligently

## Testing

**Test Framework:**
- Not detected in current configuration

## Build & Dev Tools

**Build:**
- esbuild 0.25.0 - JavaScript bundler for server build (`script/build.ts`)
- Vite 7.1.9 - Client build and dev server
- tsx 4.20.5 - TypeScript execution for Node.js
- @vitejs/plugin-react 5.0.4 - React support for Vite
- @tailwindcss/vite 4.1.14 - Tailwind CSS Vite plugin

**Type Checking:**
- TypeScript 5.6.3 - Configured in `tsconfig.json`

**CSS Processing:**
- PostCSS 8.5.6 - CSS transformation framework
- Autoprefixer 10.4.21 - CSS vendor prefixing

## Database

**ORM/Query Builder:**
- Drizzle ORM 0.39.3 - Type-safe SQL query builder
- Drizzle Kit 0.31.4 - Database migration tool
- pg 8.16.3 - PostgreSQL client

**Schema Location:**
- `shared/schema.ts` - Shared database schema definitions
- `drizzle.config.ts` - Drizzle configuration with PostgreSQL dialect

## Key Dependencies

**Critical:**
- drizzle-orm 0.39.3 - Core ORM for database operations
- pg 8.16.3 - PostgreSQL connectivity
- express 5.0.1 - HTTP server framework
- react 19.2.0 - React framework
- @tanstack/react-query 5.60.5 - Server state management

**Infrastructure:**
- express-session 1.18.1 - Session middleware
- connect-pg-simple 10.0.0 - PostgreSQL session store
- memorystore 1.6.7 - In-memory session store fallback
- passport 0.7.0 - Authentication middleware
- passport-local 1.0.0 - Local authentication strategy
- ws 8.18.0 - WebSocket support
- date-fns 3.6.0 - Date utilities
- nanoid (via build allowlist) - Unique ID generation

**Validation:**
- zod 3.25.76 - Runtime schema validation
- drizzle-zod 0.7.0 - Zod integration for Drizzle
- zod-validation-error 3.4.0 - Improved Zod error messages

**Charts & Visualization:**
- recharts 2.15.4 - React charting library

## Configuration Files

**TypeScript:**
- `tsconfig.json` - Compiler options with `strict: true`, path aliases for `@/*` and `@shared/*`

**Build:**
- `vite.config.ts` - Vite configuration with React and Tailwind plugins
- `drizzle.config.ts` - Database migration configuration

**Server:**
- `server/index.ts` - Express app setup
- `server/routes.ts` - Route registration
- `server/storage.ts` - Storage interface (currently in-memory)
- `server/vite.ts` - Development Vite middleware integration
- `server/static.ts` - Production static file serving

**Client:**
- `client/src/main.tsx` - Entry point
- `client/src/App.tsx` - Root component with routing

**CSS:**
- `postcss.config.js` - PostCSS configuration
- `client/src/index.css` - Global styles
- `components.json` - shadcn/ui configuration

**Package Management:**
- `package.json` - Dependencies and scripts

## Environment Configuration

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (required by `drizzle.config.ts`)
- `NODE_ENV` - Development or production mode
- `PORT` - Server port (defaults to 3200 if not specified)
- `VITE_BASE_PATH` - Optional Vite base path for deployment

**Configuration Approach:**
- Environment variables read directly via `process.env`
- No `.env` file parsing library detected; relies on runtime environment

## Build Scripts

**Development:**
- `npm run dev` - Start server in development mode with tsx
- `npm run dev:client` - Start Vite dev server on port 3200
- `npm run check` - TypeScript type checking

**Production:**
- `npm run build` - Build client with Vite, bundle server with esbuild
  - Client: Vite build outputs to `dist/public/`
  - Server: esbuild bundles to `dist/index.cjs` with optimized node_modules (allowlist in `script/build.ts`)
- `npm run start` - Run production bundle

**Database:**
- `npm run db:push` - Push Drizzle migrations to database

## Deployment

**Hosting:**
- GitHub Pages (configured in `.github/workflows/deploy.yml`)
- Builds client-side static assets only
- SPA routing handled via `404.html` copy

**CI Pipeline:**
- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Runs on: Node.js 22
- Steps: Install dependencies, build client, deploy to GitHub Pages

---

*Stack analysis: 2026-05-31*
