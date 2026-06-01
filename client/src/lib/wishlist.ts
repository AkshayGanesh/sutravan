// The single live Supabase data layer for the customer wishlist (CUST-01/02).
//
// Responsibilities (mirrors catalog.ts read split + admin.ts mutation idiom):
//  - fetch the caller's owner-scoped wishlist rows joined to products, mapping
//    the snake_case PostgREST shape -> the camelCase WishlistItem ONCE at this
//    boundary (never per component).
//  - resolve Storage image paths to public URLs via productImageUrls (reused
//    from catalog.ts) — never hand-build URLs.
//  - own the optimistic save/remove toggle against the SINGLE ['wishlist'] key
//    so the card, detail modal, /wishlist page and navbar badge all read the
//    same cache and stay in sync (D-13). `staleTime: Infinity` (queryClient.ts)
//    means the `onSettled` invalidate is the reconciliation point.
//
// slug vs productId duality — IMPORTANT:
//   The component-facing `Product` (from @/data/products) carries `id = slug`
//   (the text key the card/modal use for identity), NOT the products UUID.
//   The `wishlists` FK, however, references `products.id` — a UUID. So:
//     - WishlistItem carries BOTH `productId` (the UUID, used for delete
//       .eq('product_id', ...)) and `slug` (the Product.id used for UI identity
//       and `saved` derivation).
//     - The card only knows the slug. `useToggleWishlist` therefore resolves
//       the UUID server-side by slug (`products.select('id').eq('slug', slug)`)
//       on insert, and falls back to the same slug->UUID resolution on delete
//       when the cached `productId` is absent (un-cached delete).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { productImageUrls } from "./catalog";
import { mapWriteError } from "./adminErrors";

const WISHLIST_KEY = ["wishlist"] as const;

export interface WishlistItem {
  /** The products UUID (the wishlists FK) — used for delete .eq('product_id'). */
  productId: string;
  /** The products text slug (= Product.id) — used for UI identity / `saved`. */
  slug: string;
  name: string;
  subtitle: string;
  price: number | null;
  category: string;
  images: string[];
}

/**
 * Map a joined `wishlists`+`products` PostgREST row into a camelCase
 * WishlistItem. Pure (no I/O) so it is unit-testable. Binds the UUID
 * (`products.id`) to `productId` and the text slug to `slug`; resolves images
 * via productImageUrls (empty image set -> exactly one bundled placeholder).
 */
export function toWishlistItem(row: any): WishlistItem {
  const product = row.products;
  const category: string = product.categories?.slug ?? "";
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle ?? "",
    price: product.price, // number | null — formatPrice handles null
    category,
    images: productImageUrls(product.images ?? [], category),
  };
}

async function fetchWishlist(): Promise<WishlistItem[]> {
  const { data, error } = await supabase
    .from("wishlists")
    .select(
      "product_id, created_at, products(id, slug, name, subtitle, price, images, categories(slug))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []).map(toWishlistItem);
}

/** Owner-scoped wishlist read (RLS `wishlists_owner_read` scopes the rows). */
export function useWishlist() {
  return useQuery({ queryKey: WISHLIST_KEY, queryFn: fetchWishlist });
}

/**
 * Live count derived from the shared ['wishlist'] cache — NO separate count
 * query (D-12 / Pitfall 6). The navbar badge reads this so it stays in sync
 * with every toggle through the single cache.
 */
export function useWishlistCount(): number {
  return useWishlist().data?.length ?? 0;
}

/** Resolve a products UUID from its text slug (the card only knows the slug). */
async function resolveProductId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data.id as string;
}

interface ToggleArgs {
  /** The products UUID if known (from a cached WishlistItem); may be "". */
  productId: string;
  /** The products slug (= Product.id) — always known by the card/modal. */
  slug: string;
  /** Current saved state: true -> remove, false -> insert. */
  saved: boolean;
}

/**
 * Optimistic save/remove toggle on the single ['wishlist'] key (D-13,
 * RESEARCH Pattern 3): cancel in-flight -> snapshot -> optimistic setQueryData
 * -> rollback on error -> invalidate on settled (the reconciliation point).
 */
export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, slug, saved }: ToggleArgs) => {
      if (saved) {
        // Remove. Prefer the cached UUID; resolve by slug if absent.
        const id = productId || (await resolveProductId(slug));
        const { error } = await supabase
          .from("wishlists")
          .delete()
          .eq("product_id", id);
        if (error) throw error;
        return;
      }
      // Save. Resolve the UUID server-side, then insert under the caller's id.
      const id = productId || (await resolveProductId(slug));
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");
      // RLS `wishlists_owner_insert` WITH CHECK enforces user_id = auth.uid();
      // the client value is convenience only (T-05-02).
      const { error } = await supabase
        .from("wishlists")
        .insert({ user_id: user.id, product_id: id });
      if (error) throw error;
    },
    onMutate: async ({ productId, slug, saved }: ToggleArgs) => {
      await qc.cancelQueries({ queryKey: WISHLIST_KEY });
      const prev = qc.getQueryData<WishlistItem[]>(WISHLIST_KEY);
      qc.setQueryData<WishlistItem[]>(WISHLIST_KEY, (old) => {
        const list = old ?? [];
        if (saved) {
          // Optimistically remove by slug (the UI identity key).
          return list.filter((i) => i.slug !== slug);
        }
        // Optimistically append a stub; the onSettled invalidate fills it in.
        if (list.some((i) => i.slug === slug)) return list;
        const stub: WishlistItem = {
          productId,
          slug,
          name: "",
          subtitle: "",
          price: null,
          category: "",
          images: [],
        };
        return [stub, ...list];
      });
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(WISHLIST_KEY, ctx.prev);
      }
      toast.error(mapWriteError(e));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: WISHLIST_KEY });
    },
  });
}
