import { useState, useEffect } from "react";
import type { Product } from "@/data/products";
import { formatPrice } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";

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
  // D-20: the "Enquire on Instagram" CTA reads the live URL with a fallback.
  const { data } = useSiteContent();
  const instagramUrl = data?.instagram_url ?? SITE_CONTENT_DEFAULTS.instagram_url;

  useEffect(() => {
    setActiveIndex(0);
  }, [product]);

  if (!product) return null;

  const images = product.images;
  const hasMany = images.length > 1;

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
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <button
                    onClick={next}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
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
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col">
            <DialogTitle className="sr-only">{product.name}</DialogTitle>
            <p className="text-xs uppercase tracking-widest text-secondary mb-1.5">
              {product.category}
            </p>
            <h2 className="font-sans font-bold text-2xl text-primary mb-1">
              {product.name}
            </h2>
            <p className="text-sm text-foreground/60 mb-2">
              {product.subtitle}
            </p>
            <p className="text-xl font-semibold text-primary mb-4">
              {formatPrice(product.price)}
            </p>

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
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ingredients */}
            <div className="mb-3">
              <h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
                Ingredients
              </h3>
              <ul className="space-y-1">
                {product.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="text-sm text-foreground/70 pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-secondary before:font-bold"
                  >
                    {ing}
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
                      className="text-sm text-foreground/70 italic"
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Shelf life & batch note */}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1">
              <p className="text-xs text-foreground/50 italic">
                {product.batchNote} {product.shelfLife}.
              </p>
              <p className="text-xs text-foreground/40">
                Always patch test first.
              </p>
            </div>

            {/* CTA */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-full bg-primary text-primary-foreground py-3.5 text-sm uppercase tracking-wider font-medium text-center hover:bg-secondary hover:text-primary transition-colors duration-300"
            >
              Enquire on Instagram
            </a>

            <p className="text-center text-xs text-foreground/50 mt-3">
              Tell us your skin type &mdash; we&rsquo;ll customize the
              formulation for you.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
