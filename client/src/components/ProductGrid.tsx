import { useState } from "react";
import { Link } from "wouter";
import { getFeaturedProducts, type Product } from "@/data/products";
import ProductCard from "./ProductCard";
import ProductDetail from "./ProductDetail";

export default function ProductGrid() {
  const featured = getFeaturedProducts();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-background">
      <div className="text-center mb-16">
        <h2 className="font-sans font-bold text-4xl md:text-5xl text-primary mb-4">
          Curated Essentials
        </h2>
        <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
        <p className="text-foreground/70 max-w-2xl mx-auto">
          Our introductory collection of earthen luxury. Each formulation is
          carefully crafted to harmonize with your skin&rsquo;s natural balance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featured.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={setSelectedProduct}
          />
        ))}
      </div>

      <div className="text-center mt-12">
        <Link
          href="/shop"
          className="inline-block bg-transparent border border-primary text-primary px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
        >
          View All Products
        </Link>
      </div>

      <ProductDetail
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  );
}
