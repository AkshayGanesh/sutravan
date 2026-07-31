---
phase: quick-260731-grz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/0019_products_badges.sql
  - client/src/data/products.ts
  - client/src/lib/variants.ts
  - client/src/lib/catalog.ts
  - client/src/lib/admin.ts
  - client/src/lib/badges.ts
  - client/src/components/ProductCard.tsx
  - client/src/components/ProductDetail.tsx
  - client/src/pages/admin/ProductForm.tsx
  - client/src/lib/admin.test.ts
  - client/src/lib/badges.test.ts
autonomous: true
requirements:
  - QUICK-260731-grz   # Owner-controlled product badges: Discount (real MRP mechanic), New, Most sold

must_haves:
  truths:
    - "Owner can set an Original price (MRP) on a product AND on each weight option in the admin form"
    - "Owner can flip Show discount / New product / Most sold switches per product, with no code change"
    - "A discounted product's Shop card shows a struck-through MRP before the price and a single '% OFF' chip"
    - "Exactly ONE badge renders per card, by priority: Out of stock > Discount > Most sold > New"
    - "Show discount ON with no valid MRP (missing or <= price) renders NO discount badge — priority falls through"
    - "In the detail modal, switching weight options re-renders that variant's MRP, price and % OFF"
    - "Untouched products render exactly as before — no badge, no strikethrough, same price string"
    - "npm run check and npm test pass with the live DB columns NOT yet applied"
  artifacts:
    - path: supabase/migrations/0019_products_badges.sql
      provides: "Additive DISPLAY columns: products.original_price/show_discount/is_new/is_best_seller + product_variants.original_price. Touches NO RLS policy."
      contains: "add column if not exists"
    - path: client/src/lib/badges.ts
      provides: "Pure badge derivation: activePricePoint + productBadge priority ladder; re-exports discountPercent"
      exports: ["activePricePoint", "productBadge", "discountPercent"]
    - path: client/src/lib/badges.test.ts
      provides: "Unit coverage for discountPercent, activePricePoint, productBadge priority incl. the invalid-MRP fall-through"
    - path: client/src/lib/variants.ts
      provides: "Variant.originalPrice, lowestPricedVariant, discountPercent, displayPricePair; displayPriceLabel reimplemented as prefix + current"
      contains: "displayPricePair"
  key_links:
    - from: "client/src/lib/catalog.ts fetchProducts SELECT"
      to: "products.show_discount / is_new / is_best_seller / original_price + product_variants.original_price"
      via: "columns added to the select string; NO .eq() filter added on any of them"
      pattern: "show_discount"
    - from: "client/src/components/ProductCard.tsx"
      to: "client/src/lib/badges.ts productBadge"
      via: "single chip rendered from productBadge(product)"
      pattern: "productBadge\\(product\\)"
    - from: "client/src/pages/admin/ProductForm.tsx"
      to: "client/src/lib/admin.ts fromProductForm / fromVariantForm"
      via: "four new form fields threaded into the existing useUpsertProduct payload"
      pattern: "showDiscount"
    - from: "client/src/lib/admin.ts diffVariants"
      to: "product_variants UPDATE"
      via: "change check includes prev.original_price !== s.originalPrice"
      pattern: "original_price !== s.originalPrice"
---

<objective>
Add three owner-controlled product badges — **Discount**, **New**, **Most sold** — plus a real
discount price mechanic (stored MRP, struck-through, computed "% OFF"), managed entirely from the
admin product form.

Purpose: today the Shop grid can only render one marker ("Out of stock"). The owner has no way to
merchandise a sale, a fresh launch, or a top seller. This closes that gap through the established
per-product-flag recipe (`in_stock` 0008, `show_patch_test_note` 0010) — no code changes, no
redeploy, per the milestone's core value.

Output: migration `0019_products_badges.sql`, a new pure `client/src/lib/badges.ts`, threaded
read/write mappers, badge + strikethrough rendering on ProductCard and ProductDetail, three
Switches + two MRP inputs in the admin form, and unit tests.

**The design in `/Users/akshayg/.claude/plans/hazy-chasing-karp.md` is LOCKED and user-approved.
Implement it; do not redesign it.**
</objective>

<execution_context>
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/akshayg/Downloads/Earthen-Luxury-Sutravan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# The approved design (authoritative)
@/Users/akshayg/.claude/plans/hazy-chasing-karp.md

# The migration header style to mirror (DISPLAY flag, not a visibility flag)
@supabase/migrations/0010_products_show_patch_test_note.sql

# Data layer
@client/src/data/products.ts
@client/src/lib/variants.ts
@client/src/lib/catalog.ts
@client/src/lib/admin.ts
@client/src/lib/format.ts

# UI
@client/src/components/ProductCard.tsx
@client/src/components/ProductDetail.tsx
@client/src/pages/admin/ProductForm.tsx

# Test style to mirror
@client/src/lib/admin.test.ts
@client/src/lib/variants.test.ts
</context>

<execution_notes>
**No worktree isolation.** Run this plan directly on the working tree so
`supabase/migrations/0019_products_badges.sql` lands where the owner's Supabase CLI can push it.

**Do NOT run `supabase db push`, `supabase migration up`, or any Supabase CLI command.** The agent
has no Supabase credentials. The live push is a human follow-up recorded at the bottom of this plan.

**Every gate in this plan must pass WITHOUT the live DB columns existing.** All defensive reads use
`?? false` / `?? null`, so the app keeps working against the un-migrated database.

**Interface contract for the whole plan** (Task 3 defines it; Tasks 4–6 consume it):

```
// client/src/lib/variants.ts
Variant                = { id; label; price: number|null; originalPrice: number|null; sortOrder }
lowestPricedVariant(variants: Variant[]): Variant | null
lowestVariantPrice(variants: Variant[]): number | null           // expressed via lowestPricedVariant
discountPercent(price: number|null, originalPrice: number|null): number | null
displayPricePair(p: { price; originalPrice; showDiscount; variants }):
    { prefix: '' | 'From '; original: string | null; current: string }
displayPriceLabel(productPrice, variants): string                // === prefix + current

// client/src/lib/badges.ts
BadgeKind        = 'oos' | 'discount' | 'bestSeller' | 'new'
activePricePoint(product): { price: number|null; originalPrice: number|null }
productBadge(product): { kind: BadgeKind; label: string } | null
discountPercent                                                   // re-exported from variants.ts
```

**Documented mechanics deviation (behaviour-identical, API-identical):** the approved design lists
`discountPercent` under `badges.ts`. It is *implemented* in `variants.ts` and **re-exported from
`badges.ts`**, because `displayPricePair` lives in `variants.ts` (locked constraint) and needs the
same MRP-validity math — defining it in `badges.ts` would create a `variants ↔ badges` import cycle.
`import { discountPercent } from "@/lib/badges"` works exactly as specified.
</execution_notes>

<tasks>

<task type="auto">
  <name>Task 1: Migration 0019 — additive badge + MRP columns</name>
  <files>supabase/migrations/0019_products_badges.sql</files>
  <action>
Create the migration. Highest existing migration is 0018, so this sorts last. Additive only:

`alter table public.products` adds, all with `add column if not exists`:
`original_price numeric(10,2)` (nullable, type matches `price` EXACTLY),
`show_discount boolean not null default false`,
`is_new boolean not null default false`,
`is_best_seller boolean not null default false`.

`alter table public.product_variants` adds `original_price numeric(10,2)` (nullable), so variant
products carry a correct MRP per weight.

Write a `--` header comment mirroring 0010's, stating the LOAD-BEARING INVARIANT: these are
**DISPLAY** columns, NOT visibility flags. `is_active` alone controls visibility (0005's RLS makes
drafts unreachable). A discounted / new / best-seller product's public readability is COMPLETELY
unchanged. Therefore this migration creates, drops or alters NO RLS policy and references these
columns in NO policy; `catalog.ts` selects them but applies NO `.eq(...)` filter on any of them. The
write path rides the EXISTING `products_admin_write` / `product_variants_admin_write` (FOR ALL,
`private.is_admin()`) policies — only admins can flip a flag or set an MRP.

Do NOT write the words `create policy` / `drop policy` / `alter policy` outside a `--` comment line —
the grep gate below strips only `^--` lines before scanning.
  </action>
  <verify>
    <automated>test -f supabase/migrations/0019_products_badges.sql && ! grep -v '^--' supabase/migrations/0019_products_badges.sql | grep -qiE 'create policy|drop policy|alter policy' && [ "$(grep -v '^--' supabase/migrations/0019_products_badges.sql | grep -c 'add column if not exists')" = 5 ] && echo GATE-OK</automated>
  </verify>
  <done>Prints `GATE-OK`: the file exists, its non-comment body contains exactly 5 `add column if not exists` clauses and ZERO policy statements. No Supabase CLI was run.</done>
</task>

<task type="auto">
  <name>Task 2: Data layer — types, read mapper, write mappers, variant diff</name>
  <files>client/src/data/products.ts, client/src/lib/variants.ts, client/src/lib/catalog.ts, client/src/lib/admin.ts</files>
  <action>
Thread the five new columns through both boundaries. Field-for-field, no behaviour change yet.

**`client/src/data/products.ts`** — extend the `Product` interface (`:22-45`) with
`originalPrice: number | null` (MRP; null = no MRP on file), `showDiscount: boolean`,
`isNew: boolean`, `isBestSeller: boolean`. Comment them the way `showPatchTestNote` is commented:
display-only flags, all default false, NOT visibility flags.

**`client/src/lib/variants.ts`** — add `originalPrice: number | null` to the `Variant` interface
(`:13-18`) and map it in `toVariant` (`:21-28`) as a straight passthrough alongside `price`:
`originalPrice: row.original_price ?? null`.

**`client/src/lib/catalog.ts`** — add `original_price, show_discount, is_new, is_best_seller` to the
products column list in `fetchProducts`'s `.select(...)` (`:87`) and add `original_price` inside the
embedded `product_variants(...)` list. Map them in `toProduct` (`:42-68`) with the same defensive
defaults as the existing flags: `originalPrice: row.original_price ?? null`,
`showDiscount: row.show_discount ?? false`, `isNew: row.is_new ?? false`,
`isBestSeller: row.is_best_seller ?? false`. **Add NO `.eq(...)` filter on any of them** — extend the
existing "deliberately NO filter" comment to cover the badge columns.

**`client/src/lib/admin.ts`** — thread through every mapper:
- `ProductFormValues` (`:35-51`): `originalPrice: number | null`, `showDiscount`, `isNew`, `isBestSeller`.
- `ProductRow` (`:71-86`): `original_price: number | null`, `show_discount`, `is_new`, `is_best_seller`.
- `fromProductForm` (`:101-121`): `original_price: v.originalPrice ?? null`, the three booleans straight through.
- `VariantFormValues` (`:56-61`): `originalPrice: number | null`.
- `VariantRow` (`:127`) and `fromVariantForm` (`:130-132`): `original_price: v.originalPrice`.
- `ExistingVariant` (`:135-140`): `original_price: number | null`.
- `diffVariants` change check (`:180-183`): **add `|| prev.original_price !== s.originalPrice`.**
  Without this, editing ONLY an MRP silently no-ops — the single highest-risk regression in this change.
- `diffVariants`'s stale-id insert branch (`:177`) also carries `originalPrice: s.originalPrice`.
- `saveProductVariants` existing-row SELECT (`:209`): `"id, label, price, original_price, sort_order"`.
- `ADMIN_PRODUCT_COLUMNS` (`:340-341`): add the four product columns and `original_price` inside `product_variants(...)`.

`npm run check` will fail at the end of this task because `ProductForm.tsx` does not yet supply the
new required `ProductFormValues` / `VariantFormValues` fields, and `admin.test.ts`'s fixtures are
stale — that is expected and is closed by Tasks 5 and 6. Verify this task structurally instead.
  </action>
  <verify>
    <automated>grep -q "original_price !== s.originalPrice" client/src/lib/admin.ts && grep -q "id, label, price, original_price, sort_order" client/src/lib/admin.ts && [ "$(grep -c 'original_price' client/src/lib/catalog.ts)" -ge 2 ] && grep -q "show_discount" client/src/lib/catalog.ts && ! grep -qE "\.eq\('(show_discount|is_new|is_best_seller)'" client/src/lib/catalog.ts && grep -q "originalPrice" client/src/lib/variants.ts && grep -q "isBestSeller" client/src/data/products.ts && echo GATE-OK</automated>
  </verify>
  <done>Prints `GATE-OK`: the MRP-only variant change is detected by `diffVariants`, the variant SELECT reads `original_price`, `catalog.ts` selects the badge columns with NO `.eq()` filter on them, and both type surfaces carry the new fields.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Pricing primitives + pure badges module</name>
  <files>client/src/lib/variants.ts, client/src/lib/badges.ts</files>
  <behavior>
    - `discountPercent(400, 500)` -> 20; `discountPercent(null, 500)` / `(400, null)` -> null
    - `discountPercent(500, 500)` and `discountPercent(500, 400)` -> null (MRP must EXCEED price)
    - `discountPercent(333, 500)` -> 33 (Math.round)
    - `lowestVariantPrice` keeps every existing behaviour in `variants.test.ts` byte-for-byte
    - `displayPriceLabel` outputs stay byte-identical for all five existing cases
    - `productBadge` priority: out of stock beats discount beats bestSeller beats new
    - `showDiscount: true` with no valid MRP -> discount SKIPPED, priority falls through
  </behavior>
  <action>
**`client/src/lib/variants.ts`** — keep the module PURE (it may import only `formatPrice`; it must
NOT import `badges.ts` or `@/data/products`). Add:

`lowestPricedVariant(variants: Variant[]): Variant | null` — the variant with the lowest NON-null
price, tie-broken by the lowest `sortOrder`; null when there are no variants or every price is null.

Re-express the existing `lowestVariantPrice` as `lowestPricedVariant(variants)?.price ?? null` so the
min logic exists in exactly one place. Its exported signature and behaviour are unchanged.

`discountPercent(price: number | null, originalPrice: number | null): number | null` — null unless
BOTH are numbers AND `originalPrice > price`; otherwise `Math.round((1 - price / originalPrice) * 100)`.

`displayPricePair(p: { price: number | null; originalPrice: number | null; showDiscount: boolean; variants: Variant[] }): { prefix: '' | 'From '; original: string | null; current: string }`.
Take a STRUCTURAL parameter type (declare it locally, do not import `Product`) — `Product` is
structurally assignable, and this keeps the module free of the `data/products.ts` asset imports.
Rules: zero variants -> `prefix: ''`, `current: formatPrice(p.price)`; variants with at least one
priced row -> `prefix: 'From '` and the LOWEST-PRICED variant's pair; variants but all prices null ->
`prefix: ''`, `current: formatPrice(null)`. `original` is non-null ONLY when `p.showDiscount` is true
AND `discountPercent` for that same price point is non-null, in which case it is
`formatPrice(<that price point's originalPrice>)`. Always render rupees through `formatPrice`.

Reimplement `displayPriceLabel(productPrice, variants)` as
`const { prefix, current } = displayPricePair({ price: productPrice, originalPrice: null, showDiscount: false, variants }); return prefix + current;`
Its exported signature, its "the ONLY place that prepends 'From '" doc invariant, and all five
existing tests stay untouched and green.

**`client/src/lib/badges.ts`** — new pure module, doc-commented in `variants.ts`'s style. It imports
`import type { Product } from "@/data/products"` (type-only, so it is erased at runtime and the unit
test stays side-effect-free) plus `discountPercent, lowestPricedVariant` from `@/lib/variants`, and
re-exports `discountPercent` (see the mechanics deviation in execution_notes). Exports:

`export type BadgeKind = 'oos' | 'discount' | 'bestSeller' | 'new'`.

`activePricePoint(product: Product): { price: number | null; originalPrice: number | null }` — for a
product WITH variants, the lowest-PRICED variant's `{ price, originalPrice }` pair (or
`{ price: null, originalPrice: null }` when every variant price is null); otherwise the product's own
`{ price, originalPrice }`.

`productBadge(product: Product): { kind: BadgeKind; label: string } | null` — the fixed priority
ladder, returning at most one badge:
1. `!product.inStock` -> `{ kind: 'oos', label: 'Out of stock' }`
2. `product.showDiscount` AND `discountPercent(activePricePoint(product))` is non-null ->
   `{ kind: 'discount', label: `${pct}% OFF` }`
3. `product.isBestSeller` -> `{ kind: 'bestSeller', label: 'Most sold' }`
4. `product.isNew` -> `{ kind: 'new', label: 'New' }`
5. otherwise `null`.

Document the locked edge case in the ladder: when `showDiscount` is on but the displayed price point
has no valid MRP, the discount badge is SKIPPED and priority falls through to Most sold / New — a
sale is never advertised without a real number behind it.
  </action>
  <verify>
    <automated>npx vitest run client/src/lib/variants.test.ts</automated>
  </verify>
  <done>Every pre-existing `variants.test.ts` assertion passes unchanged (proving `displayPriceLabel` and `lowestVariantPrice` are byte-identical), and `client/src/lib/badges.ts` exports `activePricePoint`, `productBadge`, `BadgeKind` and `discountPercent`.</done>
</task>

<task type="auto">
  <name>Task 4: Public UI — badge chip + struck MRP on card and detail</name>
  <files>client/src/components/ProductCard.tsx, client/src/components/ProductDetail.tsx</files>
  <action>
**`client/src/components/ProductCard.tsx`** — replace the `!product.inStock` block (`:29-34`) with a
SINGLE chip driven by `productBadge(product)` (render nothing when it returns null). Keep the exact
existing chip shell: `absolute top-2 left-2 z-10 … px-2.5 py-1 text-[10px] uppercase tracking-wider
font-medium`. Square corners are deliberate (`--radius: 0rem`) — add no rounding. Top-right stays the
`WishlistButton`. Palette from a local `Record<BadgeKind, string>`, existing tokens only:
`oos` -> `bg-background/90 backdrop-blur text-primary` (unchanged from today);
`discount` -> `bg-secondary text-secondary-foreground` (the loudest, reserved for money);
`bestSeller` and `new` -> `bg-primary text-primary-foreground`.

Replace the price line (`:57-60`) with `displayPricePair(product)` output:
`{pair.prefix}`, then `{pair.original && <span className="line-through text-foreground/40 mr-1.5">{pair.original}</span>}`,
then `{pair.current}` — inside the existing `<p className="text-sm font-medium">`. `pair.prefix`
carries its own trailing space; do not add another. `displayPriceLabel` is no longer imported here.

**`client/src/components/ProductDetail.tsx`** — after the `if (!product) return null` guard, next to
the existing `selectedVariant` derivation (`:62-63`), compute the SELECTED price point:
`const shownPrice = hasVariants ? selectedVariant?.price ?? null : product.price;`
`const shownOriginal = hasVariants ? selectedVariant?.originalPrice ?? null : product.originalPrice;`
`const shownPercent = product.showDiscount ? discountPercent(shownPrice, shownOriginal) : null;`
and `const badge = productBadge(product);`.

Rewrite the price line (`:194-198`) inside its existing `<p className="text-xl font-semibold
text-primary mb-2">`: when `shownPercent != null`, a
`<span className="line-through text-foreground/40 text-base mr-2">{formatPrice(shownOriginal)}</span>`
first; then `{formatPrice(shownPrice)}`; then, again only when `shownPercent != null`, an inline chip
`<span className="ml-2 align-middle bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium">{shownPercent}% OFF</span>`.
Because this reads the SELECTED variant, switching 70gm -> 100gm re-renders both the MRP and the
percentage.

The existing "Currently unavailable" chip (`:199-205`) stays EXACTLY as-is and keeps top priority.
Directly after it, when `product.inStock` and `badge?.kind` is `'bestSeller'` or `'new'`, render that
label in the same treatment as the unavailable chip:
`<p className="mb-2 inline-block self-start bg-muted text-foreground/70 px-2.5 py-1 text-xs uppercase tracking-wider font-medium">{badge.label}</p>`.
Leave the `{product.inStock && <div className="mb-2" />}` spacer and the `DeliveryEstimate` block
untouched.

Home needs NO change — `ProductGrid.tsx` reuses `ProductCard`, so badges appear there automatically.
  </action>
  <verify>
    <automated>grep -q "productBadge(product)" client/src/components/ProductCard.tsx && grep -q "displayPricePair" client/src/components/ProductCard.tsx && grep -q "line-through" client/src/components/ProductCard.tsx && grep -q "bg-secondary text-secondary-foreground" client/src/components/ProductCard.tsx && grep -q "% OFF" client/src/components/ProductDetail.tsx && grep -q "Currently unavailable" client/src/components/ProductDetail.tsx && echo GATE-OK</automated>
  </verify>
  <done>Prints `GATE-OK`: the card renders exactly one `productBadge`-driven chip plus a `displayPricePair` price line with strikethrough support, the detail modal renders a per-selected-variant "% OFF" chip, and the "Currently unavailable" chip survives untouched.</done>
</task>

<task type="auto">
  <name>Task 5: Admin ProductForm — three Switches, two MRP inputs, MRP > price validation</name>
  <files>client/src/pages/admin/ProductForm.tsx</files>
  <action>
**Zod schema (`:42-100`).** Add `originalPrice` to the product object using the SAME
`z.preprocess` blank->null coercion as `price` (int, nonnegative, nullable), and the same
`originalPrice` field inside the `variants` row object. Add the three booleans `showDiscount`,
`isNew`, `isBestSeller` as `z.boolean()`, commented like `showPatchTestNote` (display-only, opt-in,
default false).

Then chain a `.superRefine((v, ctx) => …)` on the object (values are post-preprocess, so prices are
`number | null`):
- product level: if `v.price != null && v.originalPrice != null && v.originalPrice <= v.price`, add a
  custom issue at `path: ["originalPrice"]`, message "MRP must be higher than the price."
- per variant row `i`: same condition on `row.price` / `row.originalPrice`, but add the issue at
  `path: ["variants"]` (the ARRAY root, not the nested index) with the message
  `` `Weight option ${i + 1}: MRP must be higher than the price.` ``. Rationale: the Weight options
  field renders ONE `<FormMessage />` for the whole array, so a nested per-index path would be
  invisible and the form would silently refuse to submit.
A same-or-lower MRP is a data-entry error, not a 0% badge.

`type ProductFormSchema = z.input<typeof productSchema>` still works through the resulting
`ZodEffects`; leave that line as-is.

**Prefill (`:131-171`).** Add `originalPrice: existing.original_price ?? null`,
`showDiscount: existing.show_discount ?? false`, `isNew: existing.is_new ?? false`,
`isBestSeller: existing.is_best_seller ?? false`. In the `variantRows` map, widen the inline
`product_variants` cast type with `original_price: number | null` and map
`originalPrice: vr.original_price ?? null`. If TypeScript objects to a new column on `existing`,
reuse the local-cast idiom already used there for `product_variants` — do not weaken the shared types.

**Create defaults (`:172-188`).** `originalPrice: null`, and all three booleans `false`.

**onSubmit payload (`:205-221`).** Add `originalPrice: parsed.originalPrice`,
`showDiscount: parsed.showDiscount`, `isNew: parsed.isNew`, `isBestSeller: parsed.isBestSeller`.
No new mutation hook — `useUpsertProduct` already writes the product row and calls
`saveProductVariants`.

**Product MRP input.** Wrap the existing Price FormField (`:314-339`) and a new `originalPrice`
FormField together in `<div className="grid gap-4 sm:grid-cols-2">` so the MRP sits beside the price.
Clone the price Input verbatim (`type="number" inputMode="numeric" min={0} step={1}`, blank->`""`
value, `onChange={(e) => field.onChange(e.target.value)}`). Label "Original price (MRP) (₹)",
FormDescription: "Optional. Shown struck-through with a % OFF badge when Show discount is on."

**Per-variant MRP input.** In the Weight options sub-editor (`:344-436`) add a FOURTH input between
the price and sort-order cells, `<div className="w-28">`, `aria-label={`Variant ${i + 1} MRP`}`,
`placeholder="₹ MRP"`, `value={row.originalPrice == null ? "" : String(row.originalPrice)}`, and an
onChange threading through the existing `updateRow(i, { originalPrice: e.target.value === "" ? null : Number(e.target.value) })`.
Extend `addRow` to seed `originalPrice: null`.

**Three Switches.** Directly after the `showPatchTestNote` block (`:574-599`), clone it three times —
same `FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-4"`
shell, same `<Switch checked/onCheckedChange/aria-label>` — for:
- `showDiscount`, label "Show discount", description ON: "Shows the MRP struck through with a % OFF badge." OFF: "Hidden — no discount badge, even if an MRP is set."
- `isNew`, label "New product", description ON: 'Shows a "New" badge on the shop card.' OFF: "Hidden — no New badge."
- `isBestSeller`, label "Most sold", description ON: 'Shows a "Most sold" badge on the shop card.' OFF: "Hidden — no Most sold badge."
Keep them inside the existing `<fieldset disabled={pending}>`.
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>`npm run check` passes with zero errors — the form supplies every new required `ProductFormValues` / `VariantFormValues` field, and the three Switches, both MRP inputs and the `superRefine` MRP>price rule are wired.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Tests — admin mapper regressions + badges unit coverage</name>
  <files>client/src/lib/admin.test.ts, client/src/lib/badges.test.ts</files>
  <behavior>
    - `fromProductForm` maps `originalPrice` -> `original_price` for both a number and null
    - `fromProductForm` maps all three booleans -> `show_discount` / `is_new` / `is_best_seller`, true AND false
    - `fromVariantForm` maps `originalPrice` -> `original_price` (number and null)
    - `diffVariants` flags an MRP-ONLY change as an update (the key regression)
    - `diffVariants` still reports no-op when nothing (including the MRP) changed
    - `discountPercent`: null price, null MRP, MRP == price, MRP < price, rounding
    - `activePricePoint`: single-price product vs variant product (lowest-priced wins) vs all-null variants
    - `productBadge`: full priority ladder + "showDiscount on, no valid MRP -> falls through"
    - `displayPricePair`: prefix behaviour, `original` present only when the discount is active
    - `displayPriceLabel` outputs are byte-identical to the pre-change strings
  </behavior>
  <action>
**`client/src/lib/admin.test.ts`** — extend, do not restructure. Add the four new fields to the
`baseForm` fixture (`:13-32`: `originalPrice: null, showDiscount: false, isNew: false,
isBestSeller: false`) and add `originalPrice` to any `VariantFormValues` fixture. Then add cases:
`fromProductForm` maps `original_price` for a number and for null and maps the three booleans in both
polarities; `fromVariantForm` maps `original_price`; and — most important — a `diffVariants` case
where the submitted row differs from the existing row ONLY by `originalPrice` and MUST land in
`toUpdate` (plus a companion case asserting a fully identical row is still a no-op). Mirror the
existing describe/it prose style.

**`client/src/lib/badges.test.ts`** — new file mirroring `variants.test.ts`'s structure
(`describe` per export, a small typed fixture builder). Import from `@/lib/badges` and `@/lib/variants`.
Build `Product` fixtures with a `product(overrides)` helper covering every field the badge ladder
reads. Cover every case in `<behavior>` above, including: `discountPercent(333, 500) === 33`;
`activePricePoint` on a two-variant product returns the LOWEST-PRICED variant's pair (not the first
row's); `productBadge` returns `oos` even when a valid discount exists; returns `discount` over
`bestSeller`/`new`; returns `bestSeller` over `new`; returns `null` when nothing applies; and returns
`bestSeller` when `showDiscount` is true but the price point has no valid MRP.
For `displayPricePair`, assert the `From ` prefix for variant products, `''` for single-price, and
`original: null` whenever `showDiscount` is false even with a valid MRP on file.
  </action>
  <verify>
    <automated>npm run check && npm test</automated>
  </verify>
  <done>`npm run check` and `npm test` both pass — every pre-existing suite stays green and the new coverage proves the MRP-only variant diff and the full badge priority ladder. No Supabase CLI command was run; no live DB column is required.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| anon browser -> PostgREST (`products`, `product_variants`) | Public read of the five new columns |
| admin browser -> PostgREST write | Owner sets MRPs and flips the three flags |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-grz-01 | Elevation of Privilege | `products` / `product_variants` write | mitigate | Migration 0019 adds NO policy; writes ride the existing `products_admin_write` / `product_variants_admin_write` (`private.is_admin()`) policies. Task 1's grep gate proves zero policy statements. |
| T-grz-02 | Information Disclosure | `catalog.ts` public read | accept | The five columns are non-sensitive merchandising data intended for public display. `is_active` remains the sole visibility gate; no `.eq()` filter is added on any badge column (Task 2 gate), so drafts stay unreachable and published products stay readable exactly as before. |
| T-grz-03 | Tampering | Client-rendered discount percentage | mitigate | The percentage is ALWAYS computed from stored `price`/`original_price` by `discountPercent` — never typed, never stored. A missing or `<= price` MRP yields no badge at all (unit-tested), so a bogus "% OFF" cannot be produced by data entry. `superRefine` rejects `MRP <= price` at the admin form. |
| T-grz-SC | Tampering | npm/pip/cargo installs | mitigate | **No new dependencies.** Nothing is installed; the package-legitimacy gate is not engaged. |
</threat_model>

<verification>
1. Task 1 gate: `0019_products_badges.sql` exists, 5 additive columns, ZERO policy statements.
2. Task 2 gate: `diffVariants` detects an MRP-only change; `catalog.ts` selects the badge columns
   with no `.eq()` filter on them.
3. `npx vitest run client/src/lib/variants.test.ts` — every pre-existing assertion green, proving
   `displayPriceLabel` behaviour is byte-identical after the rewrite.
4. `npm run check` — clean.
5. `npm test` — all suites green, including the new `badges.test.ts` and the extended `admin.test.ts`.
6. All of the above pass WITHOUT the live DB columns existing.
</verification>

<success_criteria>
- Migration `0019_products_badges.sql` is on the working tree (NOT pushed), additive only, no RLS policy touched.
- `client/src/lib/badges.ts` exists as a pure module exporting `activePricePoint`, `productBadge`, `BadgeKind` and `discountPercent`.
- `displayPricePair` lives in `variants.ts`; `displayPriceLabel` is `prefix + current` and its five existing tests pass unmodified.
- ProductCard renders at most ONE badge, by priority `Out of stock > Discount > Most sold > New`, plus a struck-through MRP when a discount is active.
- ProductDetail's price line and "% OFF" chip track the SELECTED variant; the "Currently unavailable" chip is unchanged and keeps top priority.
- The admin product form exposes three Switches, a product MRP input and a per-variant MRP input, and refuses to save an MRP that is not strictly greater than its price.
- `npm run check` and `npm test` pass with the live DB columns absent.
- No Supabase CLI command was executed by the agent.
</success_criteria>

<human_followup>
## BLOCKING — human runs the live push

Not a task. After all code is committed and green, the owner runs (see the `supabase-live-ops` memory):

```bash
echo y | ./node_modules/.bin/supabase db push --linked
```

Then `npm run dev:client` and walk the approved verification:

1. `/admin` -> a **single-price** product: price ₹400, MRP ₹500, **Show discount** ON -> Save.
   Shop card shows a gold **20% OFF** chip and `~~₹500~~ ₹400`; the detail modal matches.
2. A **variant** product (70gm ₹400/MRP ₹500, 100gm ₹560/MRP ₹700), discount ON -> card shows
   `From ~~₹500~~ ₹400` + **20% OFF**; in the modal, switching to 100gm re-renders
   `~~₹700~~ ₹560` + **20% OFF**.
3. Toggle **Most sold** and **New** on a third product — exactly one badge renders; marking that
   product out of stock replaces it with "Out of stock" (priority check).
4. **Show discount** ON for a product with NO MRP -> no discount badge (or the next-priority badge),
   price line unchanged.
5. Untouched products render exactly as before (no badge, no strikethrough), and a draft product is
   still absent from Shop — no visibility regression.
</human_followup>

<output>
Create `.planning/quick/260731-grz-product-badges-discount-new-most-sold/260731-grz-SUMMARY.md` when done.
</output>
