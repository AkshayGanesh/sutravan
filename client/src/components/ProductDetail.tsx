import type { Product } from "@/data/products";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductDetailProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

const INSTAGRAM_URL = "https://www.instagram.com/sutravan.in";

export default function ProductDetail({
  product,
  open,
  onClose,
}: ProductDetailProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="aspect-square bg-card">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="p-6 md:p-8 flex flex-col">
            <DialogTitle className="sr-only">{product.name}</DialogTitle>
            <p className="text-xs uppercase tracking-widest text-secondary mb-2">
              {product.category}
            </p>
            <h2 className="font-sans font-bold text-2xl text-primary mb-1">
              {product.name}
            </h2>
            <p className="text-sm text-foreground/60 mb-3">
              {product.subtitle}
            </p>
            <p className="text-xl font-semibold text-primary mb-6">
              {product.price}
            </p>

            {/* Benefits */}
            <div className="mb-5">
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
            <div className="mb-5">
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
              <div className="mb-5">
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
            <div className="mt-auto pt-4 border-t border-border/50 space-y-1">
              <p className="text-xs text-foreground/50 italic">
                {product.batchNote} {product.shelfLife}.
              </p>
              <p className="text-xs text-foreground/40">
                Always patch test first.
              </p>
            </div>

            {/* CTA */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block w-full bg-primary text-primary-foreground py-3.5 text-sm uppercase tracking-wider font-medium text-center hover:bg-secondary hover:text-primary transition-colors duration-300"
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
