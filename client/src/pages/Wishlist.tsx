import { X } from "lucide-react";
import { Link } from "wouter";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useWishlist, useToggleWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/format";

// Mirror the Shop product grid classes exactly so the skeleton -> populated
// transition has no layout shift (UI-SPEC).
const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8";

const header = (
  <h1 className="font-serif text-2xl text-primary">Your wishlist</h1>
);

/**
 * Auth-gated saved-products grid (CUST-02 / D-11). The route is wrapped in
 * AuthGuard in App.tsx; this page renders the loading/error/empty/populated
 * trio mirroring Submissions.tsx, and an instant optimistic remove (no
 * ConfirmDialog — D-13) that reconciles through the shared ['wishlist'] cache.
 */
export default function Wishlist() {
  const { data, isLoading, isError, refetch } = useWishlist();
  const toggle = useToggleWishlist();
  const items = data ?? [];

  return (
    <Layout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 space-y-6">
        {header}

        {/* Loading: skeleton grid mirroring the real layout (no shift). */}
        {isLoading && (
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-square mb-5 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error: inline block + Retry calling refetch() (mirror Submissions). */}
        {!isLoading && isError && (
          <div className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-foreground">
              Couldn&apos;t load your wishlist. Check your connection and try
              again.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty: explicit empty-state with a route back to the Shop. */}
        {!isLoading && !isError && items.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No saved items yet</EmptyTitle>
              <EmptyDescription>
                Tap the heart on any product to save it here.
              </EmptyDescription>
            </EmptyHeader>
            <Link
              href="/shop"
              className="text-sm font-medium text-primary underline-offset-4 hover:text-secondary hover:underline transition-colors"
            >
              Browse the shop
            </Link>
          </Empty>
        )}

        {/* Populated: saved-product tiles + instant optimistic remove. */}
        {!isLoading && !isError && items.length > 0 && (
          <div className={GRID}>
            {items.map((item) => (
              <div key={item.slug} className="group">
                <div className="relative aspect-square mb-5 overflow-hidden bg-card">
                  <img
                    src={item.images[0] ?? ""}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => {
                      toggle.mutate({
                        productId: item.productId,
                        slug: item.slug,
                        saved: true,
                      });
                    }}
                    className="absolute top-2 right-2 z-10 inline-flex h-11 w-11 items-center justify-center bg-background/80 backdrop-blur-sm text-foreground/70 hover:bg-background/90 hover:text-primary transition-colors duration-300"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest text-foreground/50 mb-1.5">
                    {item.category}
                  </p>
                  <h3 className="font-sans font-medium text-lg text-primary mb-1 leading-snug">
                    {item.name}
                  </h3>
                  <p className="text-sm font-medium">{formatPrice(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
