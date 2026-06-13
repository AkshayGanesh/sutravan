// The single live Supabase WRITE layer for the admin portal — the symmetric
// mirror of catalog.ts (which is the public READ layer).
//
// Responsibilities:
//  - map the camelCase, component-facing form shapes -> snake_case DB rows ONCE
//    at this boundary (the exact reverse of catalog.ts toProduct; Phase 2
//    decision: map once at the data-layer boundary, never per component).
//  - own product / category / site-content CRUD and Storage image upload/remove,
//    including slug-collision handling (D-07/Pitfall 6) and orphan cleanup
//    (Pitfall 2).
//  - INVARIANT: every mutation MUST call
//    queryClient.invalidateQueries({ queryKey: ['catalog'] }) (and ['siteContent']
//    for content) on success — queryClient.ts sets staleTime: Infinity, so
//    nothing refetches on its own and the public Shop would otherwise stay stale
//    after an admin edit (the milestone's "no redeploy, updates live" core value).
//  - The admin READ path differs from the public one: it does NOT add
//    .eq('is_active', true) — admins see and manage drafts (Pitfall 4). RLS
//    (migrations 0002/0003 + CR-01 0005) is the real gate; this layer is
//    convenience only.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { slugify } from "./slug";
import { mapWriteError } from "./adminErrors";
import type { QuestionFieldType } from "./questionnaire";
// Re-export the public image-URL resolvers so admin thumbnails resolve Storage
// paths the SAME way the public Shop does — never hand-build URLs (Pitfall 3).
export { productImageUrls } from "./catalog";

// ── Form value contracts (imported by every Wave-3 feature plan) ─────────────

// slug is present only when EDITING (it stays fixed on rename, D-07); on CREATE
// it is generated from the name via slugify + collision suffix.
export type ProductFormValues = {
  name: string;
  subtitle?: string;
  category: string; // category slug; resolved to category_id on write
  price: number | null; // blank price -> null -> "Price on request" (D-09)
  benefits: string[];
  ingredients: string[];
  tips: string[];
  shelfLife?: string;
  batchNote?: string;
  isActive: boolean; // draft (false) / published (true) (ADMIN-08)
  inStock: boolean; // in stock (true) / out of stock (false). NOT a visibility flag.
  showPatchTestNote: boolean; // shows "Always patch test first." on the public detail. Display-only, opt-in (default false).
  imagePaths: string[]; // Storage paths, NOT URLs (D-03)
  variants: VariantFormValues[]; // weight/price SKUs (QUICK-VAR-01); [] = unchanged single-price path
  slug?: string;
};

// A single weight/price variant row in the admin product form. `id` is present
// only for an EXISTING row (loaded from the DB); a new row has no id (the diff
// uses its absence to mean "insert").
export type VariantFormValues = {
  id?: string;
  label: string;
  price: number | null;
  sortOrder: number;
};

export type CategoryFormValues = {
  name: string; // the display label
  sortOrder: number;
  slug?: string; // present only when editing (stable on rename, D-07)
};

// The snake_case products row this layer writes. Mirrors the columns in
// supabase/migrations/0001_init_schema.sql (products table).
export type ProductRow = {
  slug: string;
  name: string;
  subtitle: string | null;
  category_id: string;
  price: number | null;
  benefits: string[];
  ingredients: string[];
  tips: string[];
  shelf_life: string | null;
  batch_note: string | null;
  images: string[];
  is_active: boolean;
  in_stock: boolean;
  show_patch_test_note: boolean;
};

// ── Mapping boundary: camelCase form -> snake_case row (reverse of toProduct) ─

/**
 * Map a camelCase ProductFormValues to its snake_case DB row.
 *
 * The exact symmetric reverse of catalog.ts toProduct: blank subtitle /
 * shelfLife / batchNote collapse to null (catalog.ts reads them back with
 * `?? ''`), price flows through untouched (number | null), and imagePaths
 * become the ordered `images` Storage-path array.
 *
 * @param v - the camelCase form values.
 * @param categoryId - the category UUID resolved from v.category (slug -> id).
 */
export function fromProductForm(
  v: ProductFormValues,
  categoryId: string,
): ProductRow {
  return {
    slug: v.slug ?? "",
    name: v.name,
    subtitle: v.subtitle || null,
    category_id: categoryId,
    price: v.price ?? null,
    benefits: v.benefits,
    ingredients: v.ingredients,
    tips: v.tips,
    shelf_life: v.shelfLife || null,
    batch_note: v.batchNote || null,
    images: v.imagePaths,
    is_active: v.isActive,
    in_stock: v.inStock,
    show_patch_test_note: v.showPatchTestNote,
  };
}

// ── Variant write helpers (product_variants table) ───────────────────────────

// The snake_case product_variants payload this layer writes (sans id/product_id;
// the caller adds product_id, and update keys off the existing id).
type VariantRow = { label: string; price: number | null; sort_order: number };

/** Map a camelCase VariantFormValues -> its snake_case row (reverse of toVariant). */
export function fromVariantForm(v: VariantFormValues): VariantRow {
  return { label: v.label, price: v.price, sort_order: v.sortOrder };
}

// The existing-row shape diffVariants compares against (straight from PostgREST).
type ExistingVariant = {
  id: string;
  label: string;
  price: number | null;
  sort_order: number;
};

/**
 * PURE diff of submitted variant rows against the existing DB rows.
 *  - submitted row with no id            -> toInsert
 *  - submitted id matches but a field    -> toUpdate
 *    (label/price/sortOrder) differs
 *  - submitted id matches and unchanged  -> no-op (neither array)
 *  - existing id absent from submitted   -> toDelete (its id)
 *
 * No Supabase calls here — saveProductVariants applies the result under RLS.
 */
export function diffVariants(
  existing: ExistingVariant[],
  submitted: VariantFormValues[],
): {
  toInsert: VariantFormValues[];
  toUpdate: VariantFormValues[];
  toDelete: string[];
} {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const submittedIds = new Set(
    submitted.filter((s) => s.id != null).map((s) => s.id as string),
  );

  const toInsert: VariantFormValues[] = [];
  const toUpdate: VariantFormValues[] = [];

  for (const s of submitted) {
    if (s.id == null) {
      toInsert.push(s);
      continue;
    }
    const prev = existingById.get(s.id);
    if (!prev) {
      // An id that isn't in the existing set (shouldn't normally happen) — treat
      // as an insert of a brand-new row (drop the stale id at the call site).
      toInsert.push({ label: s.label, price: s.price, sortOrder: s.sortOrder });
      continue;
    }
    const changed =
      prev.label !== s.label ||
      prev.price !== s.price ||
      prev.sort_order !== s.sortOrder;
    if (changed) toUpdate.push(s);
  }

  const toDelete = existing
    .filter((e) => !submittedIds.has(e.id))
    .map((e) => e.id);

  return { toInsert, toUpdate, toDelete };
}

/**
 * Persist a product's variants via the diff path under admin RLS
 * (product_variants_admin_write). Fetches the existing rows, diffs against the
 * submitted set, then inserts new / updates changed-by-id / deletes removed.
 * Skips the no-op arrays (no empty insert/delete calls). Throws on any error so
 * useUpsertProduct's onError toast fires.
 *
 * @param productId - the products UUID (NOT the slug; resolve it before calling).
 */
export async function saveProductVariants(
  productId: string,
  submitted: VariantFormValues[],
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("product_variants")
    .select("id, label, price, sort_order")
    .eq("product_id", productId);
  if (readError) throw readError;

  const { toInsert, toUpdate, toDelete } = diffVariants(
    (existing ?? []) as ExistingVariant[],
    submitted,
  );

  if (toInsert.length > 0) {
    const rows = toInsert.map((v) => ({
      ...fromVariantForm(v),
      product_id: productId,
    }));
    const { error } = await supabase.from("product_variants").insert(rows);
    if (error) throw error;
  }

  for (const v of toUpdate) {
    const { error } = await supabase
      .from("product_variants")
      .update({ ...fromVariantForm(v), updated_at: new Date().toISOString() })
      .eq("id", v.id as string);
    if (error) throw error;
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .in("id", toDelete);
    if (error) throw error;
  }
}

// ── Storage image helpers (product-images bucket) ────────────────────────────

const BUCKET = "product-images";

/**
 * Build the canonical Storage object path for a product image (D-08).
 * The folder is keyed by the product slug and stays stable on rename (D-07).
 */
export function imageStoragePath(slug: string, filename: string): string {
  return `products/${slug}/${filename}`;
}

/**
 * Upload (or replace) a single product image and return its Storage path.
 *
 * upsert:true is the "replace" mechanic — re-uploading the same path overwrites
 * in place (D-11). The returned path is what gets persisted in products.images,
 * NOT a public URL (resolve URLs at render via productImageUrls).
 */
export async function uploadProductImage(
  slug: string,
  blob: Blob,
  filename: string,
): Promise<string> {
  const path = imageStoragePath(slug, filename);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/**
 * Remove product image objects from Storage (orphan cleanup, Pitfall 2).
 *
 * Deleting a product row does NOT cascade to Storage — call this with the row's
 * image paths on product delete and on single-image removal. No-ops on an empty
 * list so callers needn't guard.
 */
export async function removeProductImages(
  _slug: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

// ── Slug-collision insert (D-07 / Pitfall 6) ─────────────────────────────────

// PostgREST surfaces a unique-violation as code '23505' when the generated slug
// already exists. We retry with -2, -3, ... until the insert lands. The DB
// `slug unique` constraint is the real guard; this is the UX suffix.
const MAX_SLUG_ATTEMPTS = 50;

/**
 * Insert a product row, deriving a unique slug from the name on collision.
 *
 * Generates `slugify(name)`, attempts the insert, and on a 23505 unique
 * violation retries with `-2`, `-3`, ... The persisted slug is then fixed for
 * the product's life (D-07: stable on later rename).
 *
 * @param row - the snake_case row from fromProductForm (its `slug` is ignored;
 *   the base slug is derived from `name` here).
 * @returns the slug that was successfully inserted.
 */
export async function insertProductWithUniqueSlug(
  row: ProductRow,
): Promise<string> {
  const base = slugify(row.name);
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { error } = await supabase
      .from("products")
      .insert({ ...row, slug });
    if (!error) return slug;
    // 23505 = unique violation on slug -> try the next suffix.
    if ((error as { code?: string }).code === "23505") continue;
    throw error; // any other error is real — surface it (mapped by the caller)
  }
  // Exhausted suffixes — surface a friendly error via the shared mapper.
  throw new Error(mapWriteError({ code: "23505" }));
}

// ── Query + mutation hooks ───────────────────────────────────────────────────
//
// The existing public read keys are ['catalog','products'] and
// ['catalog','categories']; invalidating the ['catalog'] PREFIX refreshes both
// the admin lists and the public Shop. Content writes use the ['siteContent']
// key family. Because queryClient.ts sets staleTime: Infinity + retry:false,
// invalidation in onSuccess is MANDATORY, not optional (Pitfall 1).

// The admin product/category row shapes returned by the list queries (snake_case
// straight from PostgREST; the admin tables render these directly).
const ADMIN_PRODUCT_COLUMNS =
  "slug, name, subtitle, price, benefits, ingredients, tips, shelf_life, batch_note, images, is_active, in_stock, show_patch_test_note, categories(slug, label, sort_order), product_variants(id, label, price, sort_order)";

async function fetchAdminProducts() {
  // NOTE: no .eq('is_active', true) here — admins manage drafts too (Pitfall 4).
  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .order("slug", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Admin product list — includes drafts (no is_active filter), key distinct from public. */
export function useAdminProducts() {
  return useQuery({
    queryKey: ["catalog", "admin-products"],
    queryFn: fetchAdminProducts,
  });
}

async function fetchAdminCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, label, description, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Admin category list ordered by sort_order. */
export function useAdminCategories() {
  return useQuery({
    queryKey: ["catalog", "admin-categories"],
    queryFn: fetchAdminCategories,
  });
}

// Resolve a category slug to its UUID (products store category_id, not slug).
async function categoryIdForSlug(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Create or update a product.
 * - CREATE (no v.slug): resolve category, then insert with a unique slug.
 * - EDIT (v.slug set): update by the fixed slug — slug never changes on rename (D-07).
 */
export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ProductFormValues) => {
      const categoryId = await categoryIdForSlug(v.category);
      const row = fromProductForm(v, categoryId);
      const isCreate = !v.slug;
      // The product's fixed slug — known up front on edit, returned by the
      // unique-slug insert on create. product_variants.product_id is the products
      // UUID (NOT the slug), so we resolve the UUID by slug before writing variants.
      let productSlug: string;
      if (isCreate) {
        productSlug = await insertProductWithUniqueSlug(row);
      } else {
        // slug stays fixed; do not write it back as a changeable column.
        const { slug, ...changes } = row;
        const { error } = await supabase
          .from("products")
          .update(changes)
          .eq("slug", v.slug);
        if (error) throw error;
        productSlug = v.slug as string;
      }
      // Resolve the products UUID by slug, then persist the variant diff under
      // product_variants_admin_write RLS.
      const { data: prod, error: idError } = await supabase
        .from("products")
        .select("id")
        .eq("slug", productSlug)
        .single();
      if (idError) throw idError;
      await saveProductVariants((prod as { id: string }).id, v.variants);
      return { isCreate };
    },
    onSuccess: ({ isCreate }) => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(isCreate ? "Product saved." : "Changes saved.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/** Flip a product's draft/published flag (ADMIN-08). */
export function useToggleProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, isActive }: { slug: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: isActive })
        .eq("slug", slug);
      if (error) throw error;
      return { isActive };
    },
    onSuccess: ({ isActive }) => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(
        isActive
          ? "Product is now live on the Shop."
          : "Product hidden from the Shop.",
      );
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/**
 * Flip a product's in_stock flag (QUICK-OOS-01).
 *
 * Deliberately NOT a visibility toggle: an out-of-stock product STAYS on the
 * public Shop (is_active is untouched here, catalog.ts applies no in_stock
 * filter) and is merely rendered as "unavailable". The toasts therefore must
 * NOT reuse the is_active "hidden from the Shop" copy — that would be wrong and
 * misleading. ['catalog'] invalidation is MANDATORY (staleTime: Infinity) so the
 * public Shop reflects the change with no redeploy.
 */
export function useToggleProductInStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, inStock }: { slug: string; inStock: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ in_stock: inStock })
        .eq("slug", slug);
      if (error) throw error;
      return { inStock };
    },
    onSuccess: ({ inStock }) => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(
        inStock
          ? "Product marked in stock."
          : "Product marked out of stock. It stays visible on the Shop.",
      );
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/** Delete a product row, then clean up its Storage images (orphan cleanup, Pitfall 2). */
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slug,
      imagePaths,
    }: {
      slug: string;
      imagePaths: string[];
    }) => {
      const { error } = await supabase.from("products").delete().eq("slug", slug);
      if (error) throw error;
      await removeProductImages(slug, imagePaths);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Product deleted.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/**
 * Create or update a category.
 * - CREATE (no v.slug): slug auto-derived from the name via slugify.
 * - EDIT (v.slug set): update by the fixed slug (stable on rename, D-07).
 */
export function useUpsertCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: CategoryFormValues) => {
      const isCreate = !v.slug;
      if (isCreate) {
        const { error } = await supabase.from("categories").insert({
          slug: slugify(v.name),
          label: v.name,
          sort_order: v.sortOrder,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .update({ label: v.name, sort_order: v.sortOrder })
          .eq("slug", v.slug);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Category saved.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/**
 * Delete a category by id. The category_id FK rejects deleting a category whose
 * products still reference it (PostgREST 23503) — translate that to the friendly
 * D-15 in-use message, including the product count {N} (D-15), instead of a raw
 * DB error.
 */
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) {
        if ((error as { code?: string }).code === "23503") {
          // Fill the {N} product count for the friendly in-use message (D-15).
          const { count } = await supabase
            .from("products")
            .select("slug", { count: "exact", head: true })
            .eq("category_id", id);
          const n = count ?? 0;
          throw new Error(
            `This category has ${n} product${n === 1 ? "" : "s"} — move or delete them first.`,
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Category deleted.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

// ── Questionnaire question CRUD (questionnaire_questions, migration 0012) ─────
//
// The admin-configurable Skin Guide questions. Mirrors the category hooks but
// lives under its OWN ['questionnaire'] query-key family (never ['catalog']) so
// it does not collide with the product/category cache. Mutations invalidate the
// ['questionnaire'] prefix so the public form (['questionnaire','questions'])
// reflects edits with no redeploy (staleTime: Infinity → invalidation is
// MANDATORY). Answers are snapshotted into submissions, so deletes need no
// in-use/FK guard.

// The camelCase form shape edited by QuestionsList. `id` is present only on EDIT.
export type QuestionFormValues = {
  label: string;
  helpText?: string;
  fieldType: QuestionFieldType;
  options: string[]; // ignored (stored as []) for the text types
  placeholder?: string;
  required: boolean;
  sortOrder: number;
  id?: string;
};

const ADMIN_QUESTION_COLUMNS =
  "id, label, help_text, field_type, options, placeholder, required, sort_order";

async function fetchAdminQuestions() {
  const { data, error } = await supabase
    .from("questionnaire_questions")
    .select(ADMIN_QUESTION_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Admin question list ordered by sort_order (distinct key from the public read). */
export function useAdminQuestions() {
  return useQuery({
    queryKey: ["questionnaire", "admin-questions"],
    queryFn: fetchAdminQuestions,
  });
}

// Select types carry their options; text types store [] (no options to render).
function optionsForType(v: QuestionFormValues): string[] {
  return v.fieldType === "single_select" || v.fieldType === "multi_select"
    ? v.options.filter((o) => o.trim() !== "")
    : [];
}

/**
 * Create or update a question.
 * - CREATE (no v.id): insert a new row.
 * - EDIT (v.id set): update by id.
 */
export function useUpsertQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: QuestionFormValues) => {
      const row = {
        label: v.label,
        help_text: v.helpText?.trim() ? v.helpText : null,
        field_type: v.fieldType,
        options: optionsForType(v),
        placeholder: v.placeholder?.trim() ? v.placeholder : null,
        required: v.required,
        sort_order: v.sortOrder,
      };
      if (!v.id) {
        const { error } = await supabase
          .from("questionnaire_questions")
          .insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("questionnaire_questions")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", v.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questionnaire"] });
      toast.success("Question saved.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/**
 * Delete a question by id. No in-use guard is needed: each submission snapshots
 * its answers (label + value) into payload, so deleting a question never
 * orphans or corrupts historical submissions.
 */
export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("questionnaire_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questionnaire"] });
      toast.success("Question deleted.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}

/**
 * Upsert site_content key/value rows (hero copy, Our Story body, email, socials).
 * Invalidates the ['siteContent'] family so the public Navbar/Footer/Contact/
 * Hero/Our Story reflect the change without a redeploy.
 */
export function useSaveSiteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
      const { error } = await supabase
        .from("site_content")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["siteContent"] });
      toast.success("Site content updated.");
    },
    onError: (e) => toast.error(mapWriteError(e)),
  });
}
