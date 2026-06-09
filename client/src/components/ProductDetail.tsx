import { useState, useEffect } from "react";
import { Link } from "wouter";
import type { Product } from "@/data/products";
import { formatPrice } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";
import { CUSTOMIZATION_PRICING_CAVEAT } from "@/lib/copy";
import { normalizeMultiline } from "@/lib/multiline";
import WishlistButton from "@/components/WishlistButton";

interface ProductDetailProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export default function ProductDetail({
  product,
  open,
  onClose,
}: ProductDetailProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Selected weight option (QUICK-VAR-01). null when the product has no variants.
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  // D-20: the "Enquire on Instagram" CTA reads the live URL with a fallback.
  const { data } = useSiteContent();
  const instagramUrl = data?.instagram_url ?? SITE_CONTENT_DEFAULTS.instagram_url;

  useEffect(() => {
    setActiveIndex(0);
    // Default selection to the LOWEST-PRICE variant (tie-break: lowest sortOrder).
    // Variants arrive already sorted by sortOrder from catalog.ts.
    const variants = product?.variants ?? [];
    if (variants.length === 0) {
      setSelectedVariantId(null);
      return;
    }
    const withPrice = variants.filter((v) => v.price != null);
    const pool = withPrice.length > 0 ? withPrice : variants;
    const lowest = pool.reduce((best, v) => {
      if (best == null) return v;
      const bp = best.price ?? Infinity;
      const vp = v.price ?? Infinity;
      if (vp < bp) return v;
      if (vp === bp && v.sortOrder < best.sortOrder) return v;
      return best;
    }, pool[0]);
    setSelectedVariantId(lowest.id);
  }, [product]);

  if (!product) return null;

  const images = product.images;
  const hasMany = images.length > 1;
  const variants = product.variants;
  const hasVariants = variants.length > 0;
  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? null;

  const prev = () => setActiveIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setActiveIndex((i) => (i + 1) % images.length);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-background p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Image carousel */}
          <div className="flex flex-col bg-card">
            <div className="aspect-square relative overflow-hidden">
              <img
                key={activeIndex}
                src={images[activeIndex] ?? ""}
                alt={`${product.name} ${activeIndex + 1}`}
                className="w-full h-full object-cover"
              />
              {hasMany && (
                <>
                  <button
                    onClick={prev}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={next}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {hasMany && (
              <div className="flex justify-center gap-1.5 py-2.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    aria-label={`Go to image ${i + 1}`}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === activeIndex ? "bg-primary" : "bg-primary/25"
                    }`}
                  />
                ))}
              </div>
            )}
            {/* Handmade-variation disclaimer — images are illustrative only. */}
            <p className="px-4 py-3 text-xs text-foreground/50 italic leading-relaxed">
              ✨ Images are for reference only. As each product is freshly
              handmade in small batches using natural ingredients, slight
              variations in color, texture &amp; appearance may occur.
            </p>
            {/* Customization pricing caveat — moved to the left column. */}
            <p className="mt-auto px-4 pb-4 text-xs text-foreground/50 leading-relaxed">
              {CUSTOMIZATION_PRICING_CAVEAT}
            </p>
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col">
            <DialogTitle className="sr-only">{product.name}</DialogTitle>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-secondary mb-1.5">
                  {product.category}
                </p>
                <h2 className="font-sans font-bold text-2xl text-primary mb-1">
                  {product.name}
                </h2>
              </div>
              {/* Same toggle, same ['wishlist'] cache as the card — stays in sync (D-13). */}
              <WishlistButton
                productSlug={product.id}
                className="-mr-2 -mt-1 shrink-0"
              />
            </div>
            <p className="text-sm text-foreground/60 mb-2 whitespace-pre-line">
              {product.subtitle}
            </p>

            {/* Weight-option selector (QUICK-VAR-01). Shown only when variants
                exist; the price line then reflects the SELECTED variant. With 0
                variants this is unchanged — the single product.price renders. */}
            {hasVariants && (
              <div className="flex flex-wrap gap-2 mb-3">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider font-medium border transition-colors duration-300 ${
                      v.id === selectedVariantId
                        ? "bg-primary text-background border-primary"
                        : "border-border text-foreground/70 hover:border-primary"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xl font-semibold text-primary mb-2">
              {hasVariants
                ? formatPrice(selectedVariant?.price ?? null)
                : formatPrice(product.price)}
            </p>
            {/* Out-of-stock marker — the product is still shown; just not buyable now. */}
            {!product.inStock && (
              <p className="mb-4 inline-block self-start bg-muted text-foreground/70 px-2.5 py-1 text-xs uppercase tracking-wider font-medium">
                Currently unavailable
              </p>
            )}
            {product.inStock && <div className="mb-2" />}

            {/* Benefits */}
            <div className="mb-3">
              <h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
                Benefits
              </h3>
              <ul className="space-y-1.5">
                {product.benefits.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-foreground/80"
                  >
                    <span className="text-secondary mt-0.5 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22c4-4 8-9.5 8-14a8 8 0 1 0-16 0c0 4.5 4 10 8 14z" />
                        <path d="M12 22V12" />
                      </svg>
                    </span>
                    <span className="whitespace-pre-line">
                      {normalizeMultiline(b)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ingredients */}
            <div className="mb-3">
              <h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
                Ingredients
              </h3>
              <ul className="space-y-1.5">
                {product.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-foreground/70"
                  >
                    <span className="text-secondary mt-0.5 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 20h10" />
                        <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
                        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
                      </svg>
                    </span>
                    <span className="whitespace-pre-line">
                      {normalizeMultiline(ing)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tips */}
            {product.tips && product.tips.length > 0 && (
              <div className="mb-3">
                <h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
                  Tips
                </h3>
                <ul className="space-y-1">
                  {product.tips.map((tip, i) => (
                    <li
                      key={i}
                      className="text-sm text-foreground/70 italic whitespace-pre-line"
                    >
                      {normalizeMultiline(tip)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Shelf life & batch note */}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1">
              {product.batchNote && (
                <p className="text-xs text-foreground/50 italic whitespace-pre-line">
                  {product.batchNote}
                </p>
              )}
              {product.shelfLife && (
                <p className="text-xs text-foreground/50 italic whitespace-pre-line">
                  {product.shelfLife}
                </p>
              )}
              {/* Opt-in safety note (QUICK-PTN-01): shown only when the owner
                  enables it per product; hidden by default. */}
              {product.showPatchTestNote && (
                <p className="text-xs text-foreground/40">
                  Always patch test first
                </p>
              )}
            </div>

            {/* CTA — out of stock keeps the Instagram enquiry available but the
                label makes clear it can't be bought right now (it still exists). */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-full bg-primary text-primary-foreground py-3.5 text-sm uppercase tracking-wider font-medium text-center hover:bg-secondary hover:text-primary transition-colors duration-300"
            >
              {product.inStock
                ? "Enquire on Instagram"
                : "Currently unavailable — enquire on Instagram"}
            </a>

            <Link
              href="/questionnaire"
              onClick={onClose}
              className="mt-3 flex w-full items-center justify-center gap-2 border border-primary text-primary py-3 text-sm uppercase tracking-wider font-medium text-center hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
            >
              Customize this for your skin
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
            <p className="text-xs text-foreground/50 mt-2 text-center">
              Share your skin type, concerns, allergies &amp; preferences, and
              we&rsquo;ll create a personalized Sutravan product using natural
              ingredients selected just for you.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
