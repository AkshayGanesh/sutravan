/**
 * Idempotent service-role catalog seed (DATA-03).
 *
 * Lands the 28-product catalog (13 soap + 10 scrub + 5 cream) and 3 categories
 * into the live Supabase project, uploads the existing soap images into the
 * `product-images` Storage bucket under `products/{slug}/{filename}`, and records
 * their Storage paths on the soap rows. Re-running converges (upsert on slug) —
 * 28 products / 3 categories, never duplicates.
 *
 * SECURITY: reads the service-role key from non-VITE_ `process.env` only; this
 * script is never imported by client code, so it never reaches the public bundle
 * (`scripts/check-no-secret.sh` enforces this against dist/).
 *
 * Native Node 22 runner (no tsx, no dotenv):
 *   node --env-file=.env.seed.local scripts/seed.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { productMeta, categoryMeta, SLUG_TO_SOAP_FOLDER } from '../client/src/data/catalog-data.ts';

const url = process.env.SUPABASE_URL; // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // non-VITE_, never committed

if (!url || !serviceKey) {
  console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOAP_ROOT = join(__dirname, '..', 'client', 'src', 'assets', 'images', 'products', 'Soap');

async function main(): Promise<void> {
  // 1. Categories first — products reference category_id.
  const { data: catRows, error: catErr } = await admin
    .from('categories')
    .upsert(
      categoryMeta.map((c) => ({
        slug: c.slug,
        label: c.label,
        description: c.description,
        sort_order: c.sortOrder,
      })),
      { onConflict: 'slug' },
    )
    .select('id, slug');

  if (catErr) {
    throw new Error(`categories upsert failed: ${catErr.message}`);
  }

  const catId: Record<string, string> = {};
  for (const row of catRows ?? []) {
    catId[row.slug] = row.id;
  }

  // 2. Upload soap images, collecting Storage paths keyed by slug.
  const imagePathsBySlug: Record<string, string[]> = {};
  let uploadedCount = 0;

  for (const product of productMeta) {
    if (product.category !== 'soap') continue;
    const folder = SLUG_TO_SOAP_FOLDER[product.slug];
    if (!folder) {
      throw new Error(`no soap folder mapped for slug ${product.slug}`);
    }
    const dir = join(SOAP_ROOT, folder);
    const files = readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.jpg'))
      .sort(); // stable display order (D-03)

    const paths: string[] = [];
    for (const file of files) {
      const storagePath = `products/${product.slug}/${file}`;
      const { data, error } = await admin.storage
        .from('product-images')
        .upload(storagePath, readFileSync(join(dir, file)), {
          contentType: 'image/jpeg', // MANDATORY — Buffer uploads default to application/json (Pitfall 4)
          upsert: true,
        });
      if (error) {
        throw new Error(`upload failed for ${storagePath}: ${error.message}`);
      }
      paths.push(data.path);
      uploadedCount += 1;
    }
    imagePathsBySlug[product.slug] = paths;
  }

  // 3 + 4. Upsert all products (scrub/cream get images: []; price null for every product, D-09).
  const { error: prodErr } = await admin.from('products').upsert(
    productMeta.map((p) => ({
      slug: p.slug,
      name: p.name,
      subtitle: p.subtitle,
      category_id: catId[p.category],
      price: null,
      benefits: p.benefits,
      ingredients: p.ingredients,
      tips: p.tips ?? [],
      shelf_life: p.shelfLife,
      batch_note: p.batchNote,
      images: imagePathsBySlug[p.slug] ?? [],
    })),
    { onConflict: 'slug' },
  );

  if (prodErr) {
    throw new Error(`products upsert failed: ${prodErr.message}`);
  }

  console.log(
    `OK: upserted ${catRows?.length ?? 0} categories, ${productMeta.length} products, uploaded ${uploadedCount} soap images.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
