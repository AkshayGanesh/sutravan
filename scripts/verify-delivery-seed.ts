/**
 * Service-role + anon verification of the Phase 6 delivery schema (SC5 + SC4).
 *
 * Proves, against the LIVE linked project, that:
 *  - the 5 delivery site_content keys are seeded (SC5)
 *  - delivery_rate_slabs holds exactly 20 rows AND the cost grid is strictly
 *    MONOTONIC (across zones per band, and across bands per zone) (SC5)
 *  - profiles.default_pincode is selectable (SC5)
 *  - delivery_estimate_cache is DENY-DIRECT: an anon `.select('*')` returns 0 rows
 *    or is permission-denied — never leaks a row (SC4 schema half)
 *  - pincodes is seeded (>= 15000 rows) — SKIPPED when PINCODES_OPTIONAL=1, so
 *    Plan 01's pre-seed push can run this; Plan 02 runs it WITHOUT the flag for the
 *    full gate.
 *
 * Native Node 22 runner (no tsx, no dotenv):
 *   node --env-file=.env.seed.local scripts/verify-delivery-seed.ts
 *   PINCODES_OPTIONAL=1 node --env-file=.env.seed.local scripts/verify-delivery-seed.ts
 *
 * The env file carries SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('FAIL: set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const DELIVERY_KEYS = [
  'delivery_origin_pincode',
  'delivery_default_weight_g',
  'delivery_dispatch_lead_days',
  'delivery_cod_rules',
  'delivery_free_ship_threshold',
];

const ZONE_ORDER = ['local', 'regional', 'metro', 'national', 'remote'];

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  // ── SC5: the five delivery site_content keys must all be present ───────────
  const { data: settings, error: settingsErr } = await admin
    .from('site_content')
    .select('key')
    .in('key', DELIVERY_KEYS);
  if (settingsErr) fail(`site_content select errored: ${settingsErr.message}`);
  const presentKeys = new Set((settings ?? []).map((r) => r.key));
  const missingKeys = DELIVERY_KEYS.filter((k) => !presentKeys.has(k));
  if (missingKeys.length > 0) fail(`missing delivery site_content keys: ${missingKeys.join(', ')}`);

  // ── SC5: delivery_rate_slabs == 20 rows, strictly monotonic cost grid ──────
  const { data: slabs, error: slabErr } = await admin
    .from('delivery_rate_slabs')
    .select('zone, weight_band, cost');
  if (slabErr) fail(`delivery_rate_slabs select errored: ${slabErr.message}`);
  if (!slabs || slabs.length !== 20) fail(`expected 20 slab rows, got ${slabs?.length ?? 0}`);

  // cost[zone][band]
  const cost: Record<string, Record<number, number>> = {};
  for (const row of slabs) {
    (cost[row.zone] ??= {})[row.weight_band] = row.cost;
  }
  for (const zone of ZONE_ORDER) {
    if (!cost[zone]) fail(`slab grid missing zone "${zone}"`);
    for (let band = 1; band <= 4; band++) {
      if (typeof cost[zone][band] !== 'number') fail(`slab grid missing ${zone} band ${band}`);
    }
  }
  // Monotonic across zones (per band).
  for (let band = 1; band <= 4; band++) {
    for (let z = 1; z < ZONE_ORDER.length; z++) {
      const prev = cost[ZONE_ORDER[z - 1]][band];
      const cur = cost[ZONE_ORDER[z]][band];
      if (!(cur > prev)) {
        fail(`band ${band} not monotonic across zones: ${ZONE_ORDER[z - 1]}(${prev}) !< ${ZONE_ORDER[z]}(${cur})`);
      }
    }
  }
  // Monotonic across bands (per zone).
  for (const zone of ZONE_ORDER) {
    for (let band = 2; band <= 4; band++) {
      if (!(cost[zone][band] > cost[zone][band - 1])) {
        fail(`zone ${zone} not monotonic across bands: band${band - 1}(${cost[zone][band - 1]}) !< band${band}(${cost[zone][band]})`);
      }
    }
  }

  // ── SC5: profiles.default_pincode must be selectable (column exists) ────────
  const { error: profErr } = await admin
    .from('profiles')
    .select('default_pincode')
    .limit(1);
  if (profErr) fail(`profiles.default_pincode not selectable: ${profErr.message}`);

  // ── SC4: delivery_estimate_cache is DENY-DIRECT (anon sees 0 rows / denied) ─
  const { data: cacheRows, error: cacheErr } = await anon
    .from('delivery_estimate_cache')
    .select('*');
  if (cacheErr) {
    // permission-denied is an acceptable deny-direct outcome.
    if (!/permission|denied|not allowed|policy/i.test(cacheErr.message)) {
      fail(`anon delivery_estimate_cache select errored unexpectedly: ${cacheErr.message}`);
    }
  } else if ((cacheRows?.length ?? 0) !== 0) {
    fail(`delivery_estimate_cache leaked ${cacheRows!.length} row(s) to anon — NOT deny-direct`);
  }

  // ── SC5: pincodes seeded (>= 15000) — skippable for the pre-seed push ──────
  if (process.env.PINCODES_OPTIONAL === '1') {
    console.log('NOTE: PINCODES_OPTIONAL=1 — skipping the pincodes count assertion (pre-seed push mode).');
  } else {
    const { count: pinCount, error: pinErr } = await admin
      .from('pincodes')
      .select('pincode', { count: 'exact', head: true });
    if (pinErr) fail(`pincodes count errored: ${pinErr.message}`);
    if ((pinCount ?? 0) < 15000) fail(`expected >= 15000 pincodes, got ${pinCount}`);
  }

  console.log('PASS: 5 settings keys; slabs=20 monotonic; profiles.default_pincode selectable; cache deny-direct'
    + (process.env.PINCODES_OPTIONAL === '1' ? ' (pincodes skipped)' : '; pincodes seeded'));
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
