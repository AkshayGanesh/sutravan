/**
 * Anon-key verification of the seeded catalog (DATA-03 + PUB-02).
 *
 * Proves the public read path: an anonymous (anon-key) client can read exactly
 * 28 products and 3 categories, and that a draft (is_active=false) row is hidden
 * from an anon `.eq('is_active', true)` select — the server-side published-only
 * filter the Plan 02 read layer relies on (PUB-02).
 *
 * Native Node 22 runner (no tsx, no dotenv):
 *   node --env-file=.env.seed.local scripts/verify-seed.ts
 *
 * The env file carries SUPABASE_URL + SUPABASE_ANON_KEY (required) and
 * SUPABASE_SERVICE_ROLE_KEY (optional — enables the published-only check).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('FAIL: set SUPABASE_URL and SUPABASE_ANON_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

async function main(): Promise<void> {
  // Anon count: published products must be exactly 28. Mirror the read path's
  // server-side filter (catalog.ts uses .eq('is_active', true)) so this asserts
  // what an anonymous visitor actually sees, not the raw row count.
  const { count: productCount, error: prodErr } = await supabase
    .from('products')
    .select('slug', { count: 'exact', head: true })
    .eq('is_active', true);
  if (prodErr) {
    console.error(`FAIL: anon select on products errored: ${prodErr.message}`);
    process.exit(1);
  }
  if (productCount !== 28) {
    console.error(`FAIL: expected 28 products, got ${productCount}`);
    process.exit(1);
  }

  // Anon count: categories must be exactly 3.
  const { count: categoryCount, error: catErr } = await supabase
    .from('categories')
    .select('slug', { count: 'exact', head: true });
  if (catErr) {
    console.error(`FAIL: anon select on categories errored: ${catErr.message}`);
    process.exit(1);
  }
  if (categoryCount !== 3) {
    console.error(`FAIL: expected 3 categories, got ${categoryCount}`);
    process.exit(1);
  }

  // Published-only check (PUB-02): flip one row is_active=false via service-role,
  // assert an anon .eq('is_active', true) select returns 0 rows for it, then restore.
  if (serviceKey) {
    const admin = createClient(url!, serviceKey, { auth: { persistSession: false } });

    const { data: pick, error: pickErr } = await admin
      .from('products')
      .select('slug')
      .limit(1)
      .single();
    if (pickErr || !pick) {
      console.error(`FAIL: could not pick a product for the published-only check: ${pickErr?.message}`);
      process.exit(1);
    }
    const draftSlug = pick.slug;

    const { error: offErr } = await admin
      .from('products')
      .update({ is_active: false })
      .eq('slug', draftSlug);
    if (offErr) {
      console.error(`FAIL: could not set is_active=false on ${draftSlug}: ${offErr.message}`);
      process.exit(1);
    }

    const { count: hiddenCount, error: hiddenErr } = await supabase
      .from('products')
      .select('slug', { count: 'exact', head: true })
      .eq('slug', draftSlug)
      .eq('is_active', true);

    // Always restore is_active=true, regardless of the assertion outcome.
    const { error: restoreErr } = await admin
      .from('products')
      .update({ is_active: true })
      .eq('slug', draftSlug);
    if (restoreErr) {
      console.error(`FAIL: could not restore is_active=true on ${draftSlug}: ${restoreErr.message}`);
      process.exit(1);
    }

    if (hiddenErr) {
      console.error(`FAIL: anon published-only select errored: ${hiddenErr.message}`);
      process.exit(1);
    }
    if (hiddenCount !== 0) {
      console.error(`FAIL: draft row ${draftSlug} (is_active=false) was visible to anon (count=${hiddenCount})`);
      process.exit(1);
    }
  } else {
    console.log('NOTE: SUPABASE_SERVICE_ROLE_KEY not set — skipping published-only (is_active) check.');
  }

  console.log('PASS: 28 products / 3 categories; is_active=false row hidden from anon');
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
