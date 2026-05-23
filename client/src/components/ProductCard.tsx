import type { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <div
      className="group cursor-pointer"
      onClick={() => onSelect(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(product);
      }}
    >
      <div className="relative aspect-square mb-5 overflow-hidden bg-card">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
          <span className="block w-full bg-background/90 backdrop-blur text-primary py-3 text-sm uppercase tracking-wider font-medium text-center hover:bg-primary hover:text-background transition-colors duration-300">
            View Details
          </span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-foreground/50 mb-1.5">
          {product.category}
        </p>
        <h3 className="font-sans font-medium text-lg text-primary mb-1 group-hover:text-secondary transition-colors duration-300 leading-snug">
          {product.name}
        </h3>
        <p className="text-xs text-foreground/60 mb-2">{product.subtitle}</p>
        <p className="text-sm font-medium">{product.price}</p>
      </div>
    </div>
  );
}
