# Codebase Concerns

**Analysis Date:** 2026-05-31

## Tech Debt

**Empty API Routes Layer:**
- Issue: The `server/routes.ts` file is a stub with no actual API endpoints implemented. All routes are commented placeholders.
- Files: `server/routes.ts`
- Impact: Backend infrastructure is prepared but non-functional. No data persistence for user operations despite database setup (Drizzle ORM configured with PostgreSQL).
- Fix approach: Implement actual API endpoints for product queries, orders, and user management. Start with GET `/api/products` endpoint that uses the storage interface.

**In-Memory Storage in Production Context:**
- Issue: `server/storage.ts` uses `MemStorage` (in-memory Map) as the singleton storage implementation. Data is lost on server restart.
- Files: `server/storage.ts` (lines 13-38)
- Impact: No data persistence. All user data, sessions, or orders are ephemeral. Critical for e-commerce (no order history, no user accounts actually work).
- Fix approach: Replace `MemStorage` with actual database implementation using Drizzle ORM that's already configured. Implement `IStorage` interface methods with database queries.

**Unused Drizzle ORM Setup:**
- Issue: Database schema defined in `shared/schema.ts` with users table, Drizzle ORM and migrations configured, but never connected to storage layer.
- Files: `shared/schema.ts`, `server/storage.ts`, `drizzle.config.ts`, `server/index.ts`
- Impact: Code bloat, developer confusion about whether backend persistence works. Database credentials required in environment but unused.
- Fix approach: Wire up Drizzle ORM client initialization and update `MemStorage` implementation to use actual database queries.

## Missing Critical Features

**No Authentication System:**
- Problem: Passport.js and passport-local are in dependencies but never instantiated or configured. Schema has user table but no login/registration endpoints.
- Files: `server/index.ts`, `server/routes.ts`, `shared/schema.ts`
- Blocks: User accounts, customization tracking, order history, personalized recommendations.

**No Product Ordering/Cart System:**
- Problem: Product display is read-only frontend (Shop, Home components). No cart, no checkout, no order placement despite being an e-commerce site.
- Files: `client/src/pages/Shop.tsx`, `client/src/components/ProductDetail.tsx`, `server/routes.ts`
- Blocks: Actual revenue generation. Currently only Instagram DMs for inquiries.

**No Customization Workflow:**
- Problem: UI mentions "Tell us your skin type & we'll customize" but no form, no backend to capture custom requests.
- Files: `client/src/pages/Shop.tsx` (line 114-120), `client/src/components/ProductDetail.tsx` (line 189-192)
- Blocks: Cannot fulfill the core value proposition of customizable formulations.

## Fragile Areas

**Hard-Coded Asset Paths with Missing Fallbacks:**
- Files: `client/src/data/products.ts` (lines 5-16)
- Why fragile: `getSoapImages()` function dynamically imports from `../assets/images/products/Soap/{folder}/` using glob patterns. If folder names don't match product IDs exactly, falls back to single placeholder image. No error reporting.
- Safe modification: Add validation for expected image counts per product. Log warnings if image count differs from expected. Consider pre-generating image manifests.
- Test coverage: No tests for image loading behavior.

**Unused Image Asset (product-toner.png):**
- Files: `client/src/assets/images/product-toner.png` (955.4KB)
- Why fragile: Image exists but never referenced in product data or components. Wastes bandwidth in builds.
- Safe modification: Verify not needed, then remove from repo.
- Test coverage: No asset inventory tracking.

**Hardcoded Instagram URL:**
- Files: `client/src/pages/Shop.tsx` (line 114), `client/src/components/ProductDetail.tsx` (line 15, 181)
- Why fragile: Instagram handle duplicated in at least 2 places. If account changes, must update multiple files.
- Safe modification: Move to config/constants file. Use environment variable for production flexibility.
- Test coverage: No tests for external link destinations.

**Type-Based Category Matching (potential data drift):**
- Files: `client/src/data/products.ts` (line 18), `client/src/pages/Shop.tsx` (line 19-22)
- Why fragile: Product category is literal type `'soap' | 'scrub' | 'cream'`. If new category added, must update type and all category checks. No runtime validation against categories array.
- Safe modification: Make Category type derived from categories array. Add schema validation to Product type.
- Test coverage: No tests validating all products have valid categories.

**Missing Product Price Field:**
- Files: `client/src/data/products.ts` (all products have `price: ''`)
- Why fragile: Price is empty string in all products (68 products). Component renders price but it's always blank. Sign of incomplete implementation.
- Impact: Cannot display pricing, impossible to implement ordering without adding this.
- Safe modification: Populate prices or remove price display logic entirely until ready.

## Error Handling

**Strategy:** Minimal error handling. Server has express error middleware, but client has almost no error boundaries or try-catch blocks.

**Patterns:**
- Server: Single error handler at bottom of `server/index.ts` (lines 65-76) catches all unhandled errors and returns JSON error response.
- Client: Global fetch error handler in `client/src/lib/queryClient.ts` throws errors from failed API calls. No UI error boundaries or fallback pages for failed states.
- Missing: Client-side error boundaries. No error recovery for failed image loads, failed navigation, or failed API calls.

## Security Considerations

**Session Storage Configuration:**
- Risk: `express-session` is installed but not configured. Memorystore is installed as session store (in-memory, lost on restart).
- Files: `server/index.ts` (no session middleware setup)
- Current mitigation: Sessions don't exist in current code.
- Recommendations: If authentication is implemented, migrate from memorystore to connect-pg-simple (already in dependencies) which persists sessions to PostgreSQL.

**No CSRF Protection:**
- Risk: No CSRF tokens implemented for state-changing operations. If API routes added without CSRF protection, forms vulnerable to cross-site attacks.
- Files: `server/index.ts`, `server/routes.ts`
- Current mitigation: No POST/PUT/DELETE endpoints exist yet.
- Recommendations: Add CSRF middleware (e.g., `csurf`) before implementing state-changing endpoints.

**Database Credentials in Environment:**
- Risk: `DATABASE_URL` required by `drizzle.config.ts` must be in environment. If leaked, full database access compromised.
- Files: `drizzle.config.ts` (line 3-5)
- Current mitigation: Code throws error if DATABASE_URL missing (good). Never exposed to client.
- Recommendations: Add to CI/CD secrets, document in `.env.example` (not checked in), never log DATABASE_URL.

**API Logging Exposes Response Bodies:**
- Risk: `server/index.ts` (lines 36-60) logs full JSON response bodies for all `/api/*` requests to console. If responses contain sensitive data (passwords, tokens, PII), they'll be in server logs.
- Files: `server/index.ts` (lines 51-52)
- Impact: Server logs could contain sensitive information if API returns user data without sanitization.
- Fix approach: Only log response bodies for non-sensitive endpoints or implement a logging filter.

## Performance Bottlenecks

**Glob Import of All Soap Images at Bundle Time:**
- Problem: `client/src/data/products.ts` uses `import.meta.glob()` with eager loading. All product images are imported into the bundle upfront, not lazily.
- Files: `client/src/data/products.ts` (lines 5-8)
- Cause: Vite glob with `{ eager: true }` forces static analysis and immediate bundling. If hundreds of images exist, this could significantly increase bundle size.
- Current impact: Manageable now (only Soap images), but will become a problem if scrubs/creams images added.
- Improvement path: Switch to dynamic glob import without eager flag, or use a manifest file listing image paths. Implement image lazy-loading in carousel.

**ImageCarousel Re-renders on Every Index Change:**
- Problem: `client/src/components/ProductDetail.tsx` (line 44) has `key={activeIndex}` on image element. This forces DOM unmount/remount instead of updating src attribute.
- Files: `client/src/components/ProductDetail.tsx` (line 44)
- Cause: Using array index as key and key changes cause React to destroy and recreate img element.
- Performance cost: Unnecessary DOM manipulation, potential image re-download on each carousel click.
- Improvement path: Remove key or use stable ID, update img src directly.

**No Image Optimization:**
- Problem: No image compression, resizing, or modern format support (WebP, AVIF). All PNG/JPG files served at full resolution.
- Files: `client/src/assets/images/` (product-soap.png 1.3MB, product-cream.png 1.2MB, etc.)
- Cause: Static assets committed as-is without build optimization.
- Impact: 5-10MB+ of images per page load on slow connections.
- Improvement path: Use Vite's image optimization, or external image CDN with responsive sizing.

## Scaling Limits

**In-Memory Storage Capacity:**
- Current capacity: Limited by server RAM. With MemStorage, thousands of users/orders exhaust available memory.
- Limit: Typically 1000+ concurrent records before memory pressure.
- Scaling path: Migrate to PostgreSQL (already configured). Connection pooling with pg module.

**Single Server Instance:**
- Current capacity: No horizontal scaling. Single Node.js process on port 3200.
- Limit: ~1000 concurrent requests before hitting process limits.
- Scaling path: Add load balancer + multiple instances behind reverse proxy. Requires session migration to persistent store.

**Static Build Per Deployment:**
- Current capacity: `script/build.ts` generates dist/public bundle. No incremental builds or edge caching.
- Limit: Deploy times increase with codebase size.
- Scaling path: Consider static site generation or CDN with edge caching for client bundle.

## Dependencies at Risk

**Passport.js Without Configuration:**
- Risk: Installed but unused. Dead code creates confusion and potential security liability.
- Impact: If misused later, could introduce authentication bugs.
- Migration plan: Either implement authentication properly using Passport or remove it entirely.

**Outdated TypeScript (5.6.3):**
- Risk: Published August 2024. Not latest LTS. Minor breaking changes possible in dependent libraries.
- Impact: Type safety gaps in newer React/Vite versions.
- Migration plan: Consider upgrading to TypeScript 5.7+ when dependencies stabilize.

**Unmaintained Node.js Versions Risk:**
- Risk: No `.nvmrc` or Node version lock file visible. npm will use whatever Node is installed locally.
- Impact: CI/CD and team members may use different Node versions, causing inconsistent builds.
- Migration plan: Add `.nvmrc` file specifying Node 20 LTS or 22 LTS.

## Test Coverage Gaps

**No Tests:**
- What's not tested: Entire codebase (server and client).
- Files: All source files (`client/src/**`, `server/**`, `shared/**`)
- Risk: Changes risk breaking functionality undetected. No regression protection. No behavior documentation.
- Priority: High - critical before adding authentication, payments, or data operations.

**Specific high-risk untested areas:**
- Product image loading and fallback behavior (`client/src/data/products.ts`)
- Product filtering by category (`client/src/pages/Shop.tsx` lines 29-31)
- Image carousel navigation logic (`client/src/components/ProductDetail.tsx` lines 33-34)
- API error handling in query client (`client/src/lib/queryClient.ts` lines 3-7)
- Server error middleware behavior (`server/index.ts` lines 65-76)

---

*Concerns audit: 2026-05-31*
