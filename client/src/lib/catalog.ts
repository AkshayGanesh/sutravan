// The single live Supabase read layer for the public catalog.
// Responsibilities (RESEARCH Architectural Responsibility Map):
//  - fetch published-only products/categories with a SERVER-SIDE is_active filter
//  - map snake_case DB rows -> the camelCase component-facing Product/CategoryInfo
//    shapes ONCE at the boundary (never per component)
//  - resolve Storage image paths to public URLs via getPublicUrl (never hand-built)
//  - expose loading/error/refetch via TanStack Query (Retry button in Plan 03)
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import soapImg from '@/assets/images/product-soap.png';
import scrubImg from '@/assets/images/product-scrub.png';
import creamImg from '@/assets/images/product-cream.png';
import type { Product, Category, CategoryInfo } from '@/data/products';

// Bundled category placeholders for empty image sets (scrub/cream are seeded with
// images: []) and for the category showcase tiles.
const placeholderByCategory: Record<string, string> = {
  soap: soapImg,
  scrub: scrubImg,
  cream: creamImg,
};

/**
 * Resolve seeded Storage paths to public URLs (D-03 / D-04).
 * - Empty paths -> exactly ONE bundled category placeholder so ProductDetail's
 *   `hasMany` stays false for scrub/cream (D-03).
 * - Non-empty -> getPublicUrl per path. Never hand-concatenate: filenames carry
 *   spaces/parens; getPublicUrl encodes them and survives bucket/ref changes
 *   (RESEARCH Don't Hand-Roll, Pitfall 3).
 */
export function productImageUrls(paths: string[], category: string): string[] {
  if (paths.length === 0) {
    return [placeholderByCategory[category] ?? soapImg];
  }
  return paths.map(
    (p) => supabase.storage.from('product-images').getPublicUrl(p).data.publicUrl
  );
}

// snake_case row (with embedded category) -> component-facing Product.
function toProduct(row: any): Product {
  const categorySlug = row.categories?.slug as Category;
  return {
    id: row.slug,
    name: row.name,
    subtitle: row.subtitle ?? '',
    category: categorySlug,
    price: row.price, // number | null — formatPrice handles null
    benefits: row.benefits ?? [],
    ingredients: row.ingredients ?? [],
    tips: row.tips ?? [],
    shelfLife: row.shelf_life ?? '',
    batchNote: row.batch_note ?? '',
    images: productImageUrls(row.images ?? [], categorySlug),
  };
}

// snake_case category row -> component-facing CategoryInfo. The live `categories`
// table has no bundled image asset, so map the slug to the bundled placeholder PNG
// for the showcase tile (planner discretion — keeps Home's category banners).
function toCategory(row: any): CategoryInfo {
  const slug = row.slug as Category;
  return {
    id: slug,
    label: row.label,
    description: row.description ?? '',
    image: placeholderByCategory[slug] ?? soapImg,
  };
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'slug, name, subtitle, price, benefits, ingredients, tips, shelf_life, batch_note, images, categories(slug, label, sort_order)'
    )
    .eq('is_active', true) // PUB-02: published-only filter lives SERVER-SIDE
    .order('slug', { ascending: true }); // D-08: deterministic featured ordering
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []).map(toProduct);
}

async function fetchCategories(): Promise<CategoryInfo[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('slug, label, description, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCategory);
}

export function useProducts() {
  return useQuery({ queryKey: ['catalog', 'products'], queryFn: fetchProducts });
}

export function useCategories() {
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: fetchCategories });
}
