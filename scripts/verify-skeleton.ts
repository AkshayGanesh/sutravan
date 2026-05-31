/**
 * Walking-skeleton verification (failing-test-first artifact).
 *
 * Proves the end-to-end Supabase path: an anonymous (anon-key) client can run a
 * public SELECT on `products` with no RLS error. This is the GREEN target for
 * Plan 03 — it FAILS here in Plan 01 because the schema/RLS does not yet exist
 * on a live project. That failure is expected.
 *
 * This is a Node script (NOT bundled), so it reads non-VITE_ env vars supplied
 * explicitly at runtime:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx scripts/verify-skeleton.ts
 *
 * PASS = error is null (an empty rows array still passes — it proves the public
 * read policy allows the anon select). FAIL = any error (exit non-zero).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('FAIL: set SUPABASE_URL and SUPABASE_ANON_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug')
    .limit(1);

  if (error) {
    console.error(`FAIL: anon select on products errored: ${error.message}`);
    process.exit(1);
  }

  console.log(`PASS: anon select on products returned ${data?.length ?? 0} row(s) with no RLS error.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
