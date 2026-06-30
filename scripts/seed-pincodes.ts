/**
 * Idempotent service-role pincode serviceability seed (DLVR-05 / SC5,
 * Phase 6 Plan 02 Task 3).
 *
 * Loads the committed, normalized `scripts/data/pincodes.ndjson` (~19.5k unique
 * pincodes produced by scripts/transform-pincodes.ts) into `public.pincodes` via
 * a chunked PostgREST upsert. The connection pooler has no password, so psql/COPY
 * are unavailable (live-ops memory) — bulk load rides PostgREST `.upsert(...)`.
 *
 * Idempotent: `onConflict: 'pincode'` (the primary key) means re-running converges
 * to the same ~19.5k rows and never duplicates. `serviceable` is intentionally NOT
 * set — it defaults true in the table (D-16) so the owner can switch a real pincode
 * off later without a migration; the seed only ever upserts the directory facts.
 *
 * SECURITY (T-6-03): the service-role key is read from non-VITE_ `process.env`
 * only (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`); this script is never imported
 * by client code so it never reaches the public bundle (scripts/check-no-secret.sh
 * enforces). Mirrors the proven scripts/seed.ts posture.
 *
 * Native Node 22 runner (no tsx, no dotenv):
 *   node --env-file=.env.seed.local scripts/seed-pincodes.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL; // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // non-VITE_, never committed

if (!url || !serviceKey) {
  console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const __dirname = dirname(fileURLToPath(import.meta.url));
const NDJSON_PATH = join(__dirname, 'data', 'pincodes.ndjson');

const CHUNK_SIZE = 1000; // ~1000 rows/batch (06-RESEARCH "Pincode Seed Strategy" step 3)

interface PincodeRow {
  pincode: string;
  state: string;
  district: string | null;
  circle: string | null;
  region: string | null;
  is_metro: boolean;
  is_remote: boolean;
}

async function main(): Promise<void> {
  const raw = readFileSync(NDJSON_PATH, 'utf8');
  const rows: PincodeRow[] = raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const r = JSON.parse(line) as PincodeRow;
      // Map ONLY the directory facts — let `serviceable` default true (D-16).
      return {
        pincode: r.pincode,
        state: r.state,
        district: r.district,
        circle: r.circle,
        region: r.region,
        is_metro: r.is_metro,
        is_remote: r.is_remote,
      };
    });

  if (rows.length === 0) {
    console.error('FAIL: pincodes.ndjson is empty — run scripts/transform-pincodes.ts first');
    process.exit(1);
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const batch = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await admin.from('pincodes').upsert(batch, { onConflict: 'pincode' });
    if (error) {
      throw new Error(`pincodes upsert failed at chunk starting ${i}: ${error.message}`);
    }
    upserted += batch.length;
  }

  console.log(`OK: upserted ${upserted} pincodes (idempotent, onConflict: pincode).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
