import { useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import RepeatableRows from "@/components/admin/RepeatableRows";
import ImageDropzone from "@/components/admin/ImageDropzone";
import {
  useAdminProducts,
  useUpsertProduct,
  type ProductFormValues,
} from "@/lib/admin";
import { useAdminCategories } from "@/lib/admin";
import { slugify } from "@/lib/slug";

// ── Zod schema (T-04-14: name/category required, price coerced to a non-negative
// integer or null per D-09). Field validation is INLINE (FormMessage); the write
// success/failure toast comes from useUpsertProduct (Sonner) — never duplicated.
const productSchema = z.object({
  name: z.string().trim().min(1, "Please enter a product name."),
  subtitle: z.string().trim().optional(),
  category: z.string().min(1, "Please choose a category."),
  benefits: z.array(z.string()),
  ingredients: z.array(z.string()),
  tips: z.array(z.string()),
  shelfLife: z.string().trim().optional(),
  batchNote: z.string().trim().optional(),
  // Blank price -> null (D-09). Accept '' / null / a whole-rupee number.
  price: z.preprocess(
    (raw) => {
      if (raw === "" || raw === null || raw === undefined) return null;
      if (typeof raw === "string") {
        const n = Number(raw.trim());
        return Number.isNaN(n) ? raw : n;
      }
      return raw;
    },
    z
      .number({ invalid_type_error: "Enter a whole rupee amount, or leave blank." })
      .int("Enter a whole rupee amount (no paise).")
      .nonnegative("Price can't be negative.")
      .nullable(),
  ),
  isActive: z.boolean(),
  // Carried hidden value (like isActive) so create/edit never resets stock; the
  // visible stock toggle lives on the products list, not in this form.
  inStock: z.boolean(),
  // Visible toggle (below) — when true, the public detail shows "Always patch
  // test first." Opt-in: defaults false for new products (QUICK-PTN-01).
  showPatchTestNote: z.boolean(),
  imagePaths: z.array(z.string()),
});

// The form's working value type. price is `unknown` on input (the raw field
// value) and resolves to `number | null` after the zod preprocess.
type ProductFormSchema = z.input<typeof productSchema>;

/**
 * Full-page product create/edit form (D-04). The route param `:slug` (Wouter
 * useParams) decides create vs edit: on edit we prefill from useAdminProducts
 * (which includes drafts, so drafts stay editable) and the slug stays fixed
 * (D-07 — never written back). New products default to draft (isActive=false,
 * D-08). Blank price flows through to null (D-09).
 */
export default function ProductForm() {
  const params = useParams<{ slug?: string }>();
  const [, navigate] = useLocation();
  const editSlug = params.slug; // present only on the /admin/products/:slug route

  const { data: products } = useAdminProducts();
  const { data: categories } = useAdminCategories();
  const upsert = useUpsertProduct();

  const isEdit = Boolean(editSlug);

  // Prefill values from the admin product list when editing.
  const existing = useMemo(
    () => products?.find((p) => p.slug === editSlug),
    [products, editSlug],
  );

  const defaultValues: ProductFormSchema = useMemo(() => {
    if (existing) {
      // PostgREST types the embedded to-one `categories` relation as an array;
      // at runtime it's a single object. Normalize either shape to the slug.
      const cat = Array.isArray(existing.categories)
        ? existing.categories[0]
        : existing.categories;
      return {
        name: existing.name ?? "",
        subtitle: existing.subtitle ?? "",
        category: (cat as { slug?: string } | undefined)?.slug ?? "",
        benefits: existing.benefits ?? [],
        ingredients: existing.ingredients ?? [],
        tips: existing.tips ?? [],
        shelfLife: existing.shelf_life ?? "",
        batchNote: existing.batch_note ?? "",
        price: existing.price ?? null,
        isActive: existing.is_active ?? false,
        inStock: existing.in_stock ?? true,
        showPatchTestNote: existing.show_patch_test_note ?? false,
        imagePaths: existing.images ?? [],
      };
    }
    return {
      name: "",
      subtitle: "",
      category: "",
      benefits: [],
      ingredients: [],
      tips: [],
      shelfLife: "",
      batchNote: "",
      price: null,
      isActive: false, // D-08: new products start as draft
      inStock: true, // new products start in stock
      showPatchTestNote: false, // opt-in: note hidden until the owner enables it
      imagePaths: [],
    };
  }, [existing]);

  const form = useForm<ProductFormSchema>({
    resolver: zodResolver(productSchema),
    values: defaultValues, // re-syncs when the edit row loads in
  });

  // The image folder slug: on edit it's the fixed route slug (D-07, never
  // changes on rename); on create it's derived live from the name so the
  // ImageDropzone (Plan 09) can upload into the product's PERMANENT folder
  // (products/{slug}/) before the first save.
  const watchedName = form.watch("name");
  const formSlug = editSlug ?? slugify(watchedName ?? "");

  function onSubmit(values: ProductFormSchema) {
    // values are post-zod-parse here, so price is number | null.
    const parsed = productSchema.parse(values);
    const payload: ProductFormValues = {
      name: parsed.name,
      subtitle: parsed.subtitle,
      category: parsed.category,
      benefits: parsed.benefits,
      ingredients: parsed.ingredients,
      tips: parsed.tips,
      shelfLife: parsed.shelfLife,
      batchNote: parsed.batchNote,
      price: parsed.price,
      isActive: parsed.isActive,
      inStock: parsed.inStock,
      showPatchTestNote: parsed.showPatchTestNote,
      imagePaths: parsed.imagePaths,
      slug: editSlug, // undefined on create -> insert with a unique slug
    };
    upsert.mutate(payload, {
      onSuccess: () => navigate("/admin/products"),
    });
  }

  const pending = upsert.isPending;
  const ctaLabel = isEdit ? "Save changes" : "Save product";

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl text-primary">
          {isEdit ? "Edit product" : "New product"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEdit
            ? "Update this product. Your changes appear on the Shop right away."
            : "Add a product. It starts as a draft until you publish it."}
        </p>
      </header>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-3xl space-y-6"
          noValidate
        >
          <fieldset disabled={pending} className="space-y-6">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Rose Clay Soap" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subtitle */}
            <FormField
              control={form.control}
              name="subtitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subtitle</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A short tagline (optional)"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price (whole rupees, blank-allowed -> null per D-09) */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="Leave blank for “Price on request”"
                      {...field}
                      value={field.value == null ? "" : String(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Whole rupees only. Leave blank to show “Price on request”.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Benefits / Ingredients / Tips (D-06 repeatable rows) */}
            <FormField
              control={form.control}
              name="benefits"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RepeatableRows
                      label="Benefits"
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ingredients"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RepeatableRows
                      label="Ingredients"
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tips"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RepeatableRows
                      label="Usage tips"
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Shelf life */}
            <FormField
              control={form.control}
              name="shelfLife"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shelf life</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 12 months (optional)"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Batch note */}
            <FormField
              control={form.control}
              name="batchNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch note</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Made in small batches (optional)"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photos (image slot — Plan 09 fills the upload pipeline; passing a
                real name-derived slug is what lets the dropzone upload to
                products/{slug}/ during create, D-07). */}
            <FormField
              control={form.control}
              name="imagePaths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photos</FormLabel>
                  <FormControl>
                    <ImageDropzone
                      value={field.value ?? []}
                      onChange={field.onChange}
                      slug={formSlug}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Published toggle (D-13). New products default OFF/draft (D-08). */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Published</FormLabel>
                    <FormDescription>
                      {field.value
                        ? "Published — live on the Shop."
                        : "Draft — hidden from the public site."}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Published"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Show patch-test note toggle (QUICK-PTN-01). Opt-in: defaults OFF.
                When ON, the public detail shows the fixed "Always patch test
                first." line; when OFF, no note renders. */}
            <FormField
              control={form.control}
              name="showPatchTestNote"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Show patch-test note</FormLabel>
                    <FormDescription>
                      {field.value
                        ? 'Shows "Always patch test first." on the product page.'
                        : "Hidden — no patch-test note shown."}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Show patch-test note"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </fieldset>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              {ctaLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/admin/products")}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
