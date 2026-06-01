import { Heart } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/auth/useAuth";
import { safeReturnTo } from "@/pages/Login";
import { useWishlist, useToggleWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  /** The products slug (= Product.id). The only identity the card/modal have. */
  productSlug: string;
  /** The products UUID if already known; the toggle resolves it by slug if "". */
  productId?: string;
  className?: string;
}

/**
 * Heart toggle shared by ProductCard and ProductDetail (D-09/D-13).
 *
 * Critical: on the card the click must NEVER trigger the card's open-detail
 * `onSelect` — so we `stopPropagation()` + `preventDefault()` FIRST (D-09 /
 * Pitfall 7). Both surfaces read/write the SAME ['wishlist'] cache via
 * useWishlist/useToggleWishlist, so the filled state stays in sync.
 *
 * Logged-out tap -> sign-in toast + redirect to /login?next=<current> via the
 * audited `safeReturnTo` sanitizer (D-10) — no new sanitizer.
 */
export default function WishlistButton({
  productSlug,
  productId = "",
  className,
}: WishlistButtonProps) {
  const { session } = useAuth();
  const [location, navigate] = useLocation();
  const { data } = useWishlist();
  const toggle = useToggleWishlist();

  const item = (data ?? []).find((i) => i.slug === productSlug);
  const saved = !!item;
  // Prefer the cached UUID; fall back to the prop (toggle resolves by slug if "").
  const resolvedId = item?.productId ?? productId;

  function handleClick(e: React.MouseEvent) {
    // Guard the card's open-detail handler FIRST (D-09 / Pitfall 7).
    e.stopPropagation();
    e.preventDefault();

    if (!session) {
      toast.error("Sign in to save your favourites.");
      navigate(`/login?next=${encodeURIComponent(safeReturnTo(location))}`);
      return;
    }
    // In-flight guard (WR-03): ignore a fast double-tap while a toggle is
    // already pending for this product, so the second `onMutate` can't snapshot
    // the already-mutated optimistic list and corrupt the rollback baseline.
    if (toggle.isPending) return;
    toggle.mutate({ productId: resolvedId, slug: productSlug, saved });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      className={cn(
        // 44x44 minimum hit area (UI-SPEC); icon renders smaller, button pads.
        "inline-flex h-11 w-11 items-center justify-center transition-colors duration-300",
        className,
      )}
    >
      <Heart
        size={20}
        strokeWidth={1.5}
        className={cn(
          "transition-colors duration-300",
          saved ? "fill-current text-secondary" : "text-foreground/60",
        )}
      />
    </button>
  );
}
