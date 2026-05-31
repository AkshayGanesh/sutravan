# Codebase Structure

**Analysis Date:** 2026-05-31

## Directory Layout

```
project-root/
├── client/                    # React Vite frontend
│   ├── src/
│   │   ├── main.tsx          # React app entry point (DOM mount)
│   │   ├── App.tsx           # Root component with routing
│   │   ├── index.css         # Global styles (Tailwind imports)
│   │   ├── pages/            # Route-level page components
│   │   │   ├── Home.tsx
│   │   │   ├── Shop.tsx
│   │   │   ├── OurStory.tsx
│   │   │   ├── Contact.tsx
│   │   │   ├── Questionnaire.tsx
│   │   │   └── not-found.tsx
│   │   ├── components/        # Reusable React components
│   │   │   ├── Layout.tsx     # Page wrapper (Navbar + Footer)
│   │   │   ├── Navbar.tsx     # Navigation bar
│   │   │   ├── Footer.tsx     # Site footer
│   │   │   ├── Hero.tsx       # Full-screen hero banner
│   │   │   ├── ProductGrid.tsx # Featured products section
│   │   │   ├── ProductCard.tsx # Single product card
│   │   │   ├── ProductDetail.tsx # Product detail modal
│   │   │   └── ui/            # Radix UI primitive wrappers
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── sheet.tsx
│   │   │       ├── toast.tsx
│   │   │       ├── toaster.tsx
│   │   │       ├── tooltip.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── tabs.tsx
│   │   │       ├── slider.tsx
│   │   │       ├── alert-dialog.tsx
│   │   │       ├── pagination.tsx
│   │   │       ├── popover.tsx
│   │   │       ├── progress.tsx
│   │   │       ├── select.tsx
│   │   │       ├── separator.tsx
│   │   │       ├── aspect-ratio.tsx
│   │   │       └── [other UI components]
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── use-toast.ts   # Toast notification state
│   │   │   └── use-mobile.tsx # Responsive breakpoint hook
│   │   ├── lib/               # Utility functions and clients
│   │   │   ├── queryClient.ts # React Query config + apiRequest
│   │   │   └── utils.ts       # CSS class merging utilities
│   │   ├── data/              # Static data
│   │   │   └── products.ts    # Product catalog, categories
│   │   ├── assets/            # Images and media
│   │   │   ├── images/
│   │   │   │   ├── hero-bg.png
│   │   │   │   ├── product-*.png
│   │   │   │   └── products/
│   │   │   │       └── Soap/
│   │   │   │           ├── AloeVera/
│   │   │   │           ├── Charcoal/
│   │   │   │           └── [other soap types]
│   │   └── index.html         # HTML template
│   └── public/                # Static public assets
│
├── server/                    # Express backend
│   ├── index.ts              # Server entry point, Express app setup
│   ├── routes.ts             # API route registration (currently empty)
│   ├── storage.ts            # Storage interface and MemStorage impl
│   ├── static.ts             # Static file serving (production)
│   └── vite.ts               # Vite dev server setup (development)
│
├── shared/                    # Shared types and schemas
│   └── schema.ts             # Drizzle ORM tables, Zod validation
│
├── script/                    # Build scripts
│   └── build.ts              # Vite + esbuild build orchestration
│
├── dist/                      # Build output (generated)
│   ├── index.cjs             # Bundled Node.js server
│   └── public/               # Bundled React client
│
├── .github/                   # GitHub workflows
│   └── workflows/            # CI/CD pipeline files
│
├── .planning/                 # GSD planning documents
│   └── codebase/             # Architecture, structure, conventions, concerns
│
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
├── drizzle.config.ts         # Drizzle ORM configuration
│
└── [project files]           # Root-level markdown, config, etc.
```

## Directory Purposes

**client/src:**
- Purpose: React application source code (pages, components, utilities, data)
- Contains: TypeScript/TSX files for UI, hooks, static data, utility functions
- Key files: `main.tsx` (entry), `App.tsx` (root), `pages/*` (routes), `components/*` (UI), `data/products.ts` (catalog)

**client/src/pages:**
- Purpose: Page-level components, one per route
- Contains: Home, Shop, OurStory, Contact, Questionnaire, not-found
- Key files: All pages import Layout wrapper and render route-specific content

**client/src/components:**
- Purpose: Reusable UI components (Layout, Navbar, Hero, ProductGrid, ProductCard, ProductDetail)
- Contains: Feature components and Radix UI primitive wrappers in `ui/` subdirectory
- Key files: `Layout.tsx` (page wrapper), `Navbar.tsx` (navigation), `ProductCard.tsx` (list item)

**client/src/hooks:**
- Purpose: Custom React hooks for cross-cutting concerns
- Contains: `use-toast.ts` (notification state), `use-mobile.tsx` (responsive detection)
- Key files: Toast hook with reducer-based state management

**client/src/lib:**
- Purpose: Non-component utilities (query client, helpers)
- Contains: React Query setup with fetch-based apiRequest, CSS utility functions
- Key files: `queryClient.ts` (API client + React Query), `utils.ts` (class merging)

**client/src/data:**
- Purpose: Static application data (products, categories)
- Contains: Product definitions, category metadata, featured product selection
- Key files: `products.ts` (all product catalog data with image imports)

**client/src/assets:**
- Purpose: Static images and media files
- Contains: Hero background, product images, individual soap variant images by category
- Key files: Organized by product type; images imported as ES modules in data/

**server:**
- Purpose: Express HTTP server (routing, middleware, static serving)
- Contains: Server entry point, route handlers, storage interface, Vite dev setup
- Key files: `index.ts` (startup), `routes.ts` (API endpoints), `storage.ts` (data layer), `static.ts` (production serving), `vite.ts` (dev HMR)

**shared:**
- Purpose: Type-safe definitions shared between client and server
- Contains: Drizzle ORM PostgreSQL table definitions, Zod schemas, TypeScript types
- Key files: `schema.ts` (users table, insertUserSchema, inferred types)

**script:**
- Purpose: Build and automation scripts
- Contains: Vite client build + esbuild server bundler
- Key files: `build.ts` (orchestrates client Vite + server esbuild)

**dist:**
- Purpose: Build artifacts (generated, not committed)
- Contains: Compiled server (`index.cjs`), bundled client (`public/`)
- Key files: `index.cjs` (runnable Node.js server), `public/index.html` (SPA entry)

## Key File Locations

**Entry Points:**
- `client/src/main.tsx`: React app mount (createRoot + render)
- `server/index.ts`: Express server startup, port 3200 listener
- `client/src/App.tsx`: Route definitions and provider setup (Wouter, React Query, Toast)

**Configuration:**
- `package.json`: Dependencies, scripts (dev, build, start, check, db:push)
- `tsconfig.json`: Compiler options, path aliases (@/* for client/src, @shared/* for shared)
- `vite.config.ts`: Vite client build config, alias setup, server options
- `tailwind.config.js`: Tailwind CSS configuration
- `postcss.config.js`: PostCSS plugins for CSS processing
- `drizzle.config.ts`: Drizzle ORM database configuration

**Core Logic:**
- `client/src/data/products.ts`: Product catalog (static data, import.meta.glob for images)
- `client/src/lib/queryClient.ts`: React Query setup, apiRequest fetch wrapper
- `server/storage.ts`: IStorage interface, MemStorage implementation for user CRUD
- `shared/schema.ts`: Drizzle ORM users table, Zod validation schema

**Testing:**
- No test files currently present in codebase

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `ProductCard.tsx`, `Navbar.tsx`)
- Custom hooks: camelCase with `use-` prefix (e.g., `use-toast.ts`, `use-mobile.tsx`)
- Utility modules: camelCase (e.g., `queryClient.ts`, `utils.ts`)
- Pages: PascalCase matching route name (e.g., `Home.tsx`, `OurStory.tsx`), except `not-found.tsx` (kebab-case)
- UI primitives: kebab-case (e.g., `alert-dialog.tsx`, `button-group.tsx`)
- Data/config files: camelCase (e.g., `products.ts`, `schema.ts`)

**Directories:**
- Component directories: lowercase (e.g., `components/`, `pages/`, `hooks/`)
- Asset directories: lowercase by type (e.g., `assets/`, `images/`, `products/`)
- Feature directories: lowercase (e.g., `lib/`, `data/`, `ui/`)

**TypeScript Types & Interfaces:**
- Exported types: PascalCase (e.g., `Product`, `Category`, `User`, `ToasterToast`)
- Type imports/aliases: PascalCase (e.g., `type Product`, `type Request`)
- Constants: camelCase (e.g., `TOAST_LIMIT`, `navLinks`)

## Where to Add New Code

**New Page/Route:**
1. Create new file in `client/src/pages/` (e.g., `MyNewPage.tsx`)
2. Import and add route in `client/src/App.tsx` under the Switch component
3. Wrap page content with Layout component for Navbar + Footer

**New Feature Component:**
1. Create in `client/src/components/` (e.g., `MyComponent.tsx`)
2. Import and use in pages or other components
3. If component is reusable across multiple pages, place at top level of `components/`
4. If component is specific to one page, can co-locate or place in a feature subdirectory

**New API Endpoint:**
1. Create handler function in `server/routes.ts` (in the `registerRoutes` function)
2. Register with `app.post()`, `app.get()`, etc. with `/api/` prefix
3. Use `storage` interface to perform data operations (will need implementation swap from MemStorage to PostgreSQL when ready)
4. Validate request body against shared schema types
5. Return JSON response; errors caught by error middleware in `server/index.ts`

**New React Hook:**
1. Create in `client/src/hooks/` with `use-` prefix (e.g., `use-my-feature.ts`)
2. Export hook function with useState/useEffect/useContext/etc. as needed
3. Document return type and usage via TypeScript interface

**New UI Component (Primitive):**
1. Create in `client/src/components/ui/` (e.g., `my-component.tsx`)
2. Base on Radix UI primitive with Tailwind styling
3. Export as default function, accept className prop for customization
4. Optionally use CVA (class-variance-authority) for variant styling

**New Utility Function:**
1. Small utility: add to `client/src/lib/utils.ts`
2. Larger utility module: create new file in `client/src/lib/` (e.g., `math.ts`, `formatting.ts`)
3. Server-side utility: create in `server/` or add to appropriate module (e.g., `server/validation.ts`)

**New Static Data:**
1. Add to `client/src/data/` (e.g., `client/src/data/testimonials.ts`)
2. Define TypeScript interfaces for type safety
3. Export arrays or objects as constants
4. Import and use in pages/components

**Database Schema Changes:**
1. Edit `shared/schema.ts` to add/modify Drizzle ORM table definitions
2. Add corresponding Zod schema for validation
3. Update `server/storage.ts` interface with new CRUD methods
4. Update MemStorage implementation with new methods
5. Use drizzle-kit for migrations when PostgreSQL is active: `npm run db:push`

## Special Directories

**node_modules:**
- Purpose: Installed npm dependencies
- Generated: Yes (from package-lock.json)
- Committed: No (in .gitignore)

**dist:**
- Purpose: Build output from `npm run build`
- Generated: Yes (cleared and rebuilt on each build)
- Committed: No (in .gitignore)

**.git:**
- Purpose: Git version control metadata
- Generated: Yes (by git init)
- Committed: No (is itself the repo)

**.planning/codebase:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md)
- Generated: Manually by `/gsd-map-codebase` agent
- Committed: Yes (for team reference and orchestrator consumption)

---

*Structure analysis: 2026-05-31*
