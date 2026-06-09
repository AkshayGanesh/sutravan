import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts, useCategories } from "@/lib/catalog";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";
import type { Product, Category } from "@/data/products";

const allTab = { id: "all" as const, label: "All Products" };

export default function Shop() {
  const params = useParams<{ category?: string }>();
  const [, setLocation] = useLocation();

  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useProducts();
  const {
    data: categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useCategories();

  // Seed from the URL param directly so deep links like /shop/soap activate the
  // right tab on first render (categories load async — we can't validate yet).
  const [activeCategory, setActiveCategory] = useState<Category | null>(
    (params.category as Category | undefined) ?? null
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // D-20: the "Message Us on Instagram" CTA reads the live URL with a fallback.
  const { data: siteContent } = useSiteContent();
  const instagramUrl =
    siteContent?.instagram_url ?? SITE_CONTENT_DEFAULTS.instagram_url;

  // Once categories load, drop the active filter if the URL param wasn't a real
  // category (e.g. /shop/bogus) so we fall back to All Products.
  useEffect(() => {
    if (
      activeCategory &&
      categories &&
      !categories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory(null);
    }
  }, [categories, activeCategory]);

  const isLoading = productsLoading || categoriesLoading;
  const isError = productsError || categoriesError;
  const refetch = () => {
    refetchProducts();
    refetchCategories();
  };

  const allProducts = products ?? [];
  const filteredProducts = activeCategory
    ? allProducts.filter((p) => p.category === activeCategory)
    : allProducts;

  const handleCategoryChange = (catId: Category | null) => {
    setActiveCategory(catId);
    if (catId) {
      setLocation(`/shop/${catId}`, { replace: true });
    } else {
      setLocation("/shop", { replace: true });
    }
  };

  const categoryCount = (catId: Category) =>
    allProducts.filter((p) => p.category === catId).length;

  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            Our Collection
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-2xl mx-auto">
            Each formulation is handcrafted with natural, earth-inspired
            ingredients.
            <br />
            Simple. Honest. Made with care.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <button
            onClick={() => handleCategoryChange(null)}
            className={`px-5 py-2.5 text-sm uppercase tracking-wider font-medium transition-colors duration-300 border ${
              activeCategory === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-foreground/70 border-border hover:border-primary hover:text-primary"
            }`}
          >
            {allTab.label} ({allProducts.length})
          </button>
          {(categories ?? []).map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-5 py-2.5 text-sm uppercase tracking-wider font-medium transition-colors duration-300 border ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-foreground/70 border-border hover:border-primary hover:text-primary"
              }`}
            >
              {cat.label} ({categoryCount(cat.id)})
            </button>
          ))}
        </div>

        {/* Loading: skeleton grid mirroring the products grid (no layout shift) */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-square mb-5 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error: inline message + Retry, user stays on the page */}
        {!isLoading && isError && (
          <div className="text-center py-16">
            <p className="text-foreground/70 mb-6">
              We couldn&rsquo;t load the collection. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="inline-block bg-primary text-primary-foreground px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-secondary hover:text-primary transition-colors duration-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && !isError && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={setSelectedProduct}
                />
              ))}
            </div>

            {filteredProducts.length === 0 &&
              (allProducts.length === 0 ? (
                <p className="text-center text-foreground/50 py-16">
                  No products available yet.
                </p>
              ) : (
                <p className="text-center text-foreground/50 py-16">
                  No products found in this category.
                </p>
              ))}
          </>
        )}

        {/* Custom formulation CTA */}
        <div className="mt-20 text-center bg-card py-12 px-6">
          <h2 className="font-sans font-bold text-2xl text-primary mb-3">
            Can&rsquo;t find what you need?
          </h2>
          <p className="text-foreground/70 max-w-lg mx-auto mb-6">
            Tell us your skin type, concern, or purpose &mdash; we&rsquo;ll
            customize the formulation accordingly.
          </p>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-primary-foreground px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-secondary hover:text-primary transition-colors duration-300"
          >
            Message Us on Instagram
          </a>
        </div>
      </section>

      {/* Product Detail Modal */}
      <ProductDetail
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </Layout>
  );
}
