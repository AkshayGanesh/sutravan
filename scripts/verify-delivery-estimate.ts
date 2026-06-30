/**
 * Smoke harness for the deployed `delivery-estimate` Edge Function — proves the
 * five ROADMAP success criteria (SC1–SC4) against the LIVE linked project.
 *
 * Two run modes:
 *   1. Token-free (default — no secret swap, safe to run anytime):
 *        node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts
 *      Asserts SC2-format (bad pincode → 400), SC3 (no secret in bundle, CORS
 *      bad-origin not echoed, ALLOWED_ORIGINS + AbortController present), and
 *      SC4-deny-direct (anon cannot read delivery_estimate_cache).
 *
 *   2. Compute-path (requires the Cloudflare always-pass Turnstile TEST secret to
 *      be set on the function first — see the PLAN <human-check>):
 *        SMOKE_COMPUTE=1 node --env-file=.env.seed.local scripts/verify-delivery-estimate.ts
 *      Adds SC1 (serviceable integer cost) + SC2-serviceability (999999 →
 *      serviceable:false) + SC4-hit (write-then-hit via a TRANSIENT real-origin
 *      swap, restored in finally). After running, restore the REAL Turnstile
 *      secret — do NOT leave the test secret on production.
 *
 * The env file carries SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('FAIL: set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const FN_URL = `${url.replace(/\/$/, '')}/functions/v1/delivery-estimate`;
const PROD_ORIGIN = 'https://sutravan.in';
const FN_SOURCE = 'supabase/functions/delivery-estimate/index.ts';

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`PASS: ${msg}`);
}

type InvokeResult = { status: number; body: any; corsOrigin: string | null };

async function invoke(
  body: Record<string, unknown>,
  origin = PROD_ORIGIN,
): Promise<InvokeResult> {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      'apikey': anonKey!,
      'Authorization': `Bearer ${anonKey!}`,
    },
    body: JSON.stringify(body),
  });
  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return {
    status: res.status,
    body: parsed,
    corsOrigin: res.headers.get('access-control-allow-origin'),
  };
}

async function preflight(origin: string): Promise<string | null> {
  const res = await fetch(FN_URL, {
    method: 'OPTIONS',
    headers: { 'Origin': origin, 'Access-Control-Request-Method': 'POST' },
  });
  return res.headers.get('access-control-allow-origin');
}

// ─── Token-free assertions (run in every mode) ──────────────────────────────────

async function assertSC2Format(): Promise<void> {
  // Validation precedes Turnstile, so no token is needed: a malformed pincode is a
  // clean 400 bad_request, never a 500.
  for (const bad of ['12ab', '1234', '5600011', '']) {
    const r = await invoke({ token: 'no-token-needed', destPincode: bad });
    if (r.status !== 400) {
      fail(`SC2-format: destPincode=${JSON.stringify(bad)} expected HTTP 400, got ${r.status} body=${JSON.stringify(r.body)}`);
    }
    if (!r.body || r.body.error !== 'bad_request') {
      fail(`SC2-format: destPincode=${JSON.stringify(bad)} expected { error: 'bad_request' }, got ${JSON.stringify(r.body)}`);
    }
  }
  // A non-string destPincode must also be rejected pre-compute.
  const rNum = await invoke({ token: 'no-token-needed', destPincode: 560001 as unknown as string });
  if (rNum.status !== 400 || rNum.body?.error !== 'bad_request') {
    fail(`SC2-format: numeric destPincode expected 400 bad_request, got ${rNum.status} ${JSON.stringify(rNum.body)}`);
  }
  pass('SC2-format: malformed/non-6-digit/non-string destPincode → 400 bad_request (before Turnstile)');
}

function assertSC3Static(): void {
  // (a) No service_role secret leaks into the public bundle.
  let out = '';
  try {
    out = execSync('bash scripts/check-no-secret.sh', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e: any) {
    fail(`SC3: check-no-secret.sh failed — a secret may have leaked into dist/. ${e?.stdout ?? ''} ${e?.stderr ?? ''}`);
  }
  if (!/PASS: no service_role token in dist\//.test(out)) {
    fail(`SC3: check-no-secret.sh did not report a clean bundle. Output:\n${out}`);
  }

  // (b) The function source pins the CORS allowlist + an AbortController timeout.
  const src = readFileSync(FN_SOURCE, 'utf8');
  if (!/ALLOWED_ORIGINS/.test(src)) fail('SC3: ALLOWED_ORIGINS missing from the function source.');
  if (!/AbortController/.test(src)) fail('SC3: AbortController missing from the function source.');
  if (/VITE_/.test(src)) fail('SC3: a VITE_ reference is present in the function source (possible secret leak).');
  pass('SC3-static: no service_role in dist/; ALLOWED_ORIGINS + AbortController present; no VITE_ ref');
}

async function assertSC3Cors(): Promise<void> {
  // A disallowed Origin must NOT be echoed — the response defaults to prod, never
  // a wildcard, never the bad origin.
  const badOrigin = 'https://evil.example.com';
  const optionsEcho = await preflight(badOrigin);
  if (optionsEcho === badOrigin || optionsEcho === '*') {
    fail(`SC3-CORS: OPTIONS preflight echoed a disallowed origin: ${optionsEcho}`);
  }
  if (optionsEcho !== PROD_ORIGIN) {
    fail(`SC3-CORS: OPTIONS preflight expected Allow-Origin ${PROD_ORIGIN}, got ${optionsEcho}`);
  }
  // Also assert on the POST path (a malformed body still returns CORS headers).
  const postEcho = (await invoke({ token: 'x', destPincode: '12ab' }, badOrigin)).corsOrigin;
  if (postEcho === badOrigin || postEcho === '*') {
    fail(`SC3-CORS: POST echoed a disallowed origin: ${postEcho}`);
  }
  pass(`SC3-CORS: disallowed origin not echoed (defaults to ${PROD_ORIGIN}, no wildcard)`);
}

async function assertSC4DenyDirect(): Promise<void> {
  const { data, error } = await anon.from('delivery_estimate_cache').select('*');
  if (error) {
    if (!/permission|denied|not allowed|policy/i.test(error.message)) {
      fail(`SC4-deny-direct: anon cache select errored unexpectedly: ${error.message}`);
    }
  } else if ((data?.length ?? 0) !== 0) {
    fail(`SC4-deny-direct: anon read leaked ${data!.length} cache row(s) — NOT deny-direct`);
  }
  pass('SC4-deny-direct: anon cannot read delivery_estimate_cache (0 rows / permission denied)');
}

// ─── Compute-path assertions (SMOKE_COMPUTE=1, needs the Turnstile test secret) ──

async function assertSC1AndServiceability(): Promise<void> {
  // Origin is still the seeded 000000 placeholder here → originConfigured:false and
  // (per OQ2) these calls write NO cache row.
  const r = await invoke({ token: 'any-token', destPincode: '560001', weightG: 250 });
  if (r.status !== 200) fail(`SC1: serviceable 560001 expected 200, got ${r.status} body=${JSON.stringify(r.body)}`);
  const e = r.body;
  if (!e || e.serviceable !== true) fail(`SC1: 560001 expected serviceable:true, got ${JSON.stringify(e)}`);
  if (typeof e.cost !== 'number' || !Number.isInteger(e.cost)) fail(`SC1: cost must be an integer, got ${JSON.stringify(e.cost)}`);
  if (e.cost % 10 !== 0) fail(`SC1: cost must be a multiple of 10 (round-up), got ${e.cost}`);
  if (!e.etaDays || typeof e.etaDays.min !== 'number' || typeof e.etaDays.max !== 'number') {
    fail(`SC1: etaDays {min,max} missing, got ${JSON.stringify(e.etaDays)}`);
  }
  if (typeof e.codAvailable !== 'boolean') fail(`SC1: codAvailable must be boolean, got ${JSON.stringify(e.codAvailable)}`);
  if (e.originConfigured !== false) fail(`SC1: originConfigured expected false (000000 placeholder), got ${JSON.stringify(e.originConfigured)}`);
  if ('zone' in e) fail(`SC1: internal 'zone' leaked into the public response: ${JSON.stringify(e)}`);
  pass(`SC1: 560001 → serviceable, cost=${e.cost} (÷10), etaDays=${e.etaDays.min}-${e.etaDays.max}, originConfigured:false`);

  // SC2-serviceability: a 6-digit non-existent pincode → clean serviceable:false (not 500).
  const rNon = await invoke({ token: 'any-token', destPincode: '999999', weightG: 250 });
  if (rNon.status !== 200) fail(`SC2-serviceability: 999999 expected 200, got ${rNon.status} body=${JSON.stringify(rNon.body)}`);
  if (!rNon.body || rNon.body.serviceable !== false) {
    fail(`SC2-serviceability: 999999 expected serviceable:false, got ${JSON.stringify(rNon.body)}`);
  }
  pass('SC2-serviceability: 999999 (6-digit, not in pincodes) → serviceable:false, HTTP 200 (never a 500)');
}

async function assertSC4CacheHit(): Promise<void> {
  // The engine SKIPS the cache write while origin is 000000 (OQ2), so to exercise
  // write-then-hit we TRANSIENTLY swap delivery_origin_pincode to a real seeded
  // pincode, then restore 000000 + delete the provisional row in `finally`.
  const TEST_ORIGIN = '110001'; // New Delhi (Connaught Place) — present in pincodes
  const DEST = '560001';
  const BUCKET = 1; // weightG 250 → band 1

  // Read the current origin so we restore EXACTLY what was there.
  const { data: originRow, error: readErr } = await admin
    .from('site_content').select('value').eq('key', 'delivery_origin_pincode').maybeSingle();
  if (readErr) fail(`SC4-hit: could not read delivery_origin_pincode: ${readErr.message}`);
  const ORIGINAL_ORIGIN = (originRow?.value as string | null) ?? '000000';

  try {
    // Confirm the test origin is actually seeded/serviceable (else the test is meaningless).
    const { data: pin, error: pinErr } = await admin
      .from('pincodes').select('pincode, serviceable').eq('pincode', TEST_ORIGIN).maybeSingle();
    if (pinErr) fail(`SC4-hit: pincodes read for ${TEST_ORIGIN} errored: ${pinErr.message}`);
    if (!pin || pin.serviceable === false) fail(`SC4-hit: test origin ${TEST_ORIGIN} not present/serviceable in pincodes`);

    // Clean any stale cache row so the first call is a guaranteed compute/miss.
    await admin.from('delivery_estimate_cache').delete()
      .eq('origin_pincode', TEST_ORIGIN).eq('dest_pincode', DEST).eq('weight_bucket', BUCKET);

    // Swap in the real origin.
    const { error: swapErr } = await admin.from('site_content')
      .update({ value: TEST_ORIGIN }).eq('key', 'delivery_origin_pincode');
    if (swapErr) fail(`SC4-hit: could not swap delivery_origin_pincode to ${TEST_ORIGIN}: ${swapErr.message}`);

    // Call #1 — MISS → compute + cache write (originConfigured now true).
    const r1 = await invoke({ token: 'any-token', destPincode: DEST, weightG: 250 });
    if (r1.status !== 200 || r1.body?.serviceable !== true) {
      fail(`SC4-hit: call#1 expected serviceable 200, got ${r1.status} ${JSON.stringify(r1.body)}`);
    }
    if (r1.body.originConfigured !== true) {
      fail(`SC4-hit: call#1 expected originConfigured:true under real origin, got ${JSON.stringify(r1.body.originConfigured)}`);
    }

    const { data: afterFirst, error: c1Err } = await admin
      .from('delivery_estimate_cache')
      .select('id, fetched_at')
      .eq('origin_pincode', TEST_ORIGIN).eq('dest_pincode', DEST).eq('weight_bucket', BUCKET);
    if (c1Err) fail(`SC4-hit: cache read after call#1 errored: ${c1Err.message}`);
    if ((afterFirst?.length ?? 0) !== 1) fail(`SC4-hit: expected exactly 1 cache row after call#1, got ${afterFirst?.length ?? 0}`);
    const fetchedAt1 = afterFirst![0].fetched_at as string;

    // Call #2 — must be served from cache (no recompute → fetched_at unchanged).
    const r2 = await invoke({ token: 'any-token', destPincode: DEST, weightG: 250 });
    if (r2.status !== 200 || r2.body?.serviceable !== true) {
      fail(`SC4-hit: call#2 expected serviceable 200, got ${r2.status} ${JSON.stringify(r2.body)}`);
    }
    if (r2.body.cost !== r1.body.cost) {
      fail(`SC4-hit: call#2 cost ${r2.body.cost} != call#1 cost ${r1.body.cost}`);
    }

    const { data: afterSecond, error: c2Err } = await admin
      .from('delivery_estimate_cache')
      .select('id, fetched_at')
      .eq('origin_pincode', TEST_ORIGIN).eq('dest_pincode', DEST).eq('weight_bucket', BUCKET);
    if (c2Err) fail(`SC4-hit: cache read after call#2 errored: ${c2Err.message}`);
    if ((afterSecond?.length ?? 0) !== 1) fail(`SC4-hit: expected exactly 1 cache row after call#2, got ${afterSecond?.length ?? 0}`);
    const fetchedAt2 = afterSecond![0].fetched_at as string;

    if (fetchedAt1 !== fetchedAt2) {
      fail(`SC4-hit: fetched_at changed (${fetchedAt1} → ${fetchedAt2}) — call#2 RECOMPUTED instead of hitting the cache`);
    }
    pass(`SC4-hit: 2nd identical (origin,dest,bucket) within 24h served from cache (fetched_at unchanged ${fetchedAt1})`);
  } finally {
    // ALWAYS restore the placeholder origin + remove the provisional cache row so
    // Phase 9 still sees 000000 and no stale row lingers.
    const { error: restoreErr } = await admin.from('site_content')
      .update({ value: ORIGINAL_ORIGIN }).eq('key', 'delivery_origin_pincode');
    if (restoreErr) {
      console.error(`WARNING: could not restore delivery_origin_pincode to ${ORIGINAL_ORIGIN}: ${restoreErr.message}`);
      console.error('ACTION REQUIRED: manually set delivery_origin_pincode back to 000000 in site_content.');
    } else {
      console.log(`restored delivery_origin_pincode → ${ORIGINAL_ORIGIN}`);
    }
    const { error: delErr } = await admin.from('delivery_estimate_cache').delete()
      .eq('origin_pincode', TEST_ORIGIN).eq('dest_pincode', DEST).eq('weight_bucket', BUCKET);
    if (delErr) console.error(`WARNING: could not delete the provisional cache row: ${delErr.message}`);
    else console.log('removed the provisional cache row written during the SC4-hit test');
  }
}

export async function main(): Promise<void> {
  // Token-free assertions — always run.
  await assertSC2Format();
  assertSC3Static();
  await assertSC3Cors();
  await assertSC4DenyDirect();

  if (process.env.SMOKE_COMPUTE === '1') {
    console.log('\n── SMOKE_COMPUTE=1 → running compute-path assertions (requires the Turnstile TEST secret) ──');
    await assertSC1AndServiceability();
    await assertSC4CacheHit();
    console.log('\nALL PASS (token-free + compute-path). Remember to restore the REAL Turnstile secret.');
  } else {
    console.log('\nALL PASS (token-free). Set SMOKE_COMPUTE=1 (with the Turnstile TEST secret) for the compute path.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
