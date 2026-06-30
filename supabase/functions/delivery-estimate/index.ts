// supabase/functions/delivery-estimate/index.ts
// Phase 6 / Plan 03 / Task 1 — DLVR-05: the server-side delivery-estimate engine.
//
// Turns { destPincode, weightG? } into a normalized, vendor-agnostic Estimate
//   { serviceable, cost, etaDays:{min,max}, codAvailable, originConfigured }
// computed from the seeded zone-weight slab grid. The courier-specific shape (if a
// live aggregator is wired in DLVR-F1) NEVER leaks past `callCourierAdapter()`.
//
// CLONED VERBATIM from verify-and-submit (RESEARCH Pattern 1):
//   ALLOWED_ORIGINS allowlist + corsHeadersFor(origin); OPTIONS preflight; the
//   generic try/catch → { error: 'bad_request' } 400; the Turnstile siteverify POST
//   to challenges.cloudflare.com/turnstile/v0/siteverify reading TURNSTILE_SECRET_KEY
//   from Deno.env; the never-reflect-raw-Postgres-errors posture (console.error
//   server-side, generic body). verify_jwt = false in config.toml so anon visitors
//   reach the body — Turnstile is the gate (Pitfall 1 / D-21).
//
// KEY DIVERGENCE from verify-and-submit (RESEARCH Pattern 1 — DO NOT "fix" this):
//   verify-and-submit deliberately uses the ANON key scoped to the caller's JWT
//   because customization_submissions has a per-user ownership invariant that RLS
//   must enforce (Pitfall 4 / T-05-06). delivery-estimate has NO ownership invariant
//   — the cache rows are GLOBAL and identical for every visitor — so it LEGITIMATELY
//   uses the SERVICE-ROLE key (SUPABASE_SERVICE_ROLE_KEY, already in the function env)
//   for cache + settings + pincode + slab access. No RLS guarantee is bypassed; the
//   function being the SOLE writer of the deny-direct delivery_estimate_cache is
//   exactly what prevents client cache-poisoning (T-6-01). This is NOT the Pitfall-4
//   anti-pattern — a future reader must NOT swap this to the anon key.
//
// LOCKED PLANNER DISPOSITIONS (RESEARCH Open Questions):
//   OQ1 / A4 — the engine ADDS dispatch_lead_days to the slab transit range:
//     etaDays = { min: slab.eta_min_days + lead, max: slab.eta_max_days + lead }
//     (single source of truth; Phase 9 SC2 requires lead to flow into estimates).
//   OQ2 — when origin is the '000000' placeholder, originConfigured=false and the
//     engine writes NO delivery_estimate_cache row at all (serviceable or not), so
//     no stale provisional rows linger after the owner sets a real origin in Phase 9.
//     The originConfigured=false cache-write SKIP takes precedence over all other
//     cache rules. (000000 is the only seeded origin in Phase 6 → the cache is never
//     written during normal Phase-6 operation; the SC4 cache-hit smoke temporarily
//     swaps in a real origin to exercise the write-then-hit path.)

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ── CORS (cloned verbatim from verify-and-submit) ───────────────────────────────
const ALLOWED_ORIGINS = new Set<string>([
  'https://sutravan.in',
  'http://localhost:3200',
  'http://localhost:5173',
])

function corsHeadersFor(origin: string | null): Record<string, string> {
  // Echo the origin back only if it is allow-listed; default to the production site.
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://sutravan.in'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ── Normalized estimate contract (RESEARCH Pattern 2) ───────────────────────────
// The frontend, the cache schema, and Phases 7–10 only ever see this shape.
type Zone = 'local' | 'regional' | 'metro' | 'national' | 'remote'

type Estimate = {
  serviceable: boolean
  cost: number | null // rounded integer ₹ (D-13); null when !serviceable
  etaDays: { min: number; max: number } | null
  codAvailable: boolean
  originConfigured: boolean // false when origin is '000000'/unknown (D-18)
  zone?: Zone | null
}

type CodRules = { enabled: boolean; fee?: number; valueCap?: number | null }

type DeliverySettings = {
  originPincode: string
  defaultWeightG: number
  dispatchLeadDays: number
  codRules: CodRules
  freeShipThreshold: number | null
}

type PincodeRow = {
  pincode: string
  state: string
  first3?: string
  is_metro: boolean
  is_remote: boolean
  serviceable: boolean
}

// ── Zone derivation (D-15 / RESEARCH "Zone-Derivation Algorithm") ────────────────
// In-file TS constants — no DB round-trip for adjacency. State names are the
// canonical title-case / "and" form the pincodes seed normalized to (Pitfall A).
const METRO_PREFIXES = new Set<string>([
  '110', // Delhi
  '400', // Mumbai
  '700', // Kolkata
  '600', // Chennai
  '560', // Bengaluru
  '500', // Hyderabad
  '380', // Ahmedabad
  '411', // Pune
])

const REMOTE_STATES = new Set<string>([
  'Arunachal Pradesh',
  'Assam',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Sikkim',
  'Jammu and Kashmir',
  'Ladakh',
  'Andaman and Nicobar Islands',
  'Lakshadweep',
])

const ADJACENT: Record<string, string[]> = {
  'Delhi': ['Haryana', 'Uttar Pradesh'],
  'Haryana': ['Delhi', 'Punjab', 'Himachal Pradesh', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand', 'Chandigarh'],
  'Punjab': ['Haryana', 'Himachal Pradesh', 'Rajasthan', 'Jammu and Kashmir', 'Chandigarh'],
  'Rajasthan': ['Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Gujarat'],
  'Uttar Pradesh': ['Delhi', 'Haryana', 'Rajasthan', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'Bihar', 'Uttarakhand', 'Himachal Pradesh'],
  'Uttarakhand': ['Himachal Pradesh', 'Haryana', 'Uttar Pradesh'],
  'Himachal Pradesh': ['Jammu and Kashmir', 'Ladakh', 'Punjab', 'Haryana', 'Uttarakhand'],
  'Madhya Pradesh': ['Rajasthan', 'Uttar Pradesh', 'Chhattisgarh', 'Maharashtra', 'Gujarat'],
  'Gujarat': ['Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Dadra and Nagar Haveli and Daman and Diu'],
  'Maharashtra': ['Gujarat', 'Madhya Pradesh', 'Chhattisgarh', 'Telangana', 'Karnataka', 'Goa'],
  'Chhattisgarh': ['Madhya Pradesh', 'Maharashtra', 'Telangana', 'Odisha', 'Jharkhand', 'Uttar Pradesh'],
  'Telangana': ['Maharashtra', 'Chhattisgarh', 'Andhra Pradesh', 'Karnataka'],
  'Andhra Pradesh': ['Telangana', 'Odisha', 'Chhattisgarh', 'Karnataka', 'Tamil Nadu'],
  'Karnataka': ['Maharashtra', 'Goa', 'Telangana', 'Andhra Pradesh', 'Tamil Nadu', 'Kerala'],
  'Goa': ['Maharashtra', 'Karnataka'],
  'Kerala': ['Karnataka', 'Tamil Nadu'],
  'Tamil Nadu': ['Kerala', 'Karnataka', 'Andhra Pradesh', 'Puducherry'],
  'Odisha': ['West Bengal', 'Jharkhand', 'Chhattisgarh', 'Andhra Pradesh'],
  'Jharkhand': ['Bihar', 'Uttar Pradesh', 'Chhattisgarh', 'Odisha', 'West Bengal'],
  'Bihar': ['Uttar Pradesh', 'Jharkhand', 'West Bengal'],
  'West Bengal': ['Bihar', 'Jharkhand', 'Odisha', 'Sikkim', 'Assam'],
  'Sikkim': ['West Bengal'],
  'Assam': ['West Bengal', 'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Meghalaya', 'Mizoram', 'Tripura'],
  'Arunachal Pradesh': ['Assam', 'Nagaland'],
  'Nagaland': ['Assam', 'Arunachal Pradesh', 'Manipur'],
  'Manipur': ['Assam', 'Nagaland', 'Mizoram'],
  'Mizoram': ['Assam', 'Manipur', 'Tripura'],
  'Meghalaya': ['Assam'],
  'Tripura': ['Assam', 'Mizoram'],
  'Jammu and Kashmir': ['Ladakh', 'Himachal Pradesh', 'Punjab'],
  'Ladakh': ['Jammu and Kashmir', 'Himachal Pradesh'],
}

function first3Of(pincode: string): string {
  return pincode.substring(0, 3)
}

function isMetroRow(row: PincodeRow): boolean {
  // Prefer the seeded flag; fall back to the prefix set so a missing flag still
  // resolves the same metro lane.
  return row.is_metro || METRO_PREFIXES.has(row.first3 ?? first3Of(row.pincode))
}

// deriveZone — evaluate in THIS order; order is load-bearing (RESEARCH D-15).
//   1. remote overrides all   2. same sorting district → local
//   3. metro↔metro → metro    4. same/adjacent state → regional   5. else national
function deriveZone(origin: PincodeRow, dest: PincodeRow): Zone {
  if (dest.is_remote || REMOTE_STATES.has(dest.state)) return 'remote'
  const oFirst3 = origin.first3 ?? first3Of(origin.pincode)
  const dFirst3 = dest.first3 ?? first3Of(dest.pincode)
  if (dFirst3 === oFirst3) return 'local'
  if (isMetroRow(origin) && isMetroRow(dest)) return 'metro'
  if (
    dest.state === origin.state ||
    (ADJACENT[origin.state] ?? []).includes(dest.state)
  ) {
    return 'regional'
  }
  return 'national'
}

// ── Pure helpers (D-11 / RESEARCH "Seed Slab Grid → weightBucket") ──────────────
const roundUpTo10 = (n: number): number => Math.ceil(n / 10) * 10

function weightBucket(g: number): number {
  if (g <= 250) return 1
  if (g <= 500) return 2
  if (g <= 1000) return 3
  return 4 // clamp everything above 1000g into band 4
}

// ── Settings (RESEARCH Pattern 3 — site_content text key/value) ─────────────────
async function readSettings(admin: SupabaseClient): Promise<DeliverySettings> {
  const keys = [
    'delivery_origin_pincode',
    'delivery_default_weight_g',
    'delivery_dispatch_lead_days',
    'delivery_cod_rules',
    'delivery_free_ship_threshold',
  ]
  const { data, error } = await admin
    .from('site_content')
    .select('key, value')
    .in('key', keys)
  if (error) {
    console.error('delivery-estimate: site_content read failed', error)
    throw new Error('settings_read_failed')
  }
  const map = new Map<string, string | null>()
  for (const row of data ?? []) map.set(row.key as string, row.value as string | null)

  let codRules: CodRules = { enabled: false }
  const codRaw = map.get('delivery_cod_rules')
  if (codRaw) {
    try {
      const parsed = JSON.parse(codRaw) as CodRules
      codRules = { enabled: !!parsed.enabled, fee: parsed.fee, valueCap: parsed.valueCap ?? null }
    } catch (e) {
      // Malformed JSON in the text column → COD off; never throw (never a 500).
      console.error('delivery-estimate: delivery_cod_rules JSON parse failed', e)
    }
  }

  const freeShipRaw = map.get('delivery_free_ship_threshold')
  const freeShipThreshold =
    freeShipRaw === null || freeShipRaw === undefined || freeShipRaw === ''
      ? null
      : Number(freeShipRaw)

  return {
    originPincode: (map.get('delivery_origin_pincode') ?? '000000') || '000000',
    defaultWeightG: Number(map.get('delivery_default_weight_g') ?? '250') || 250,
    dispatchLeadDays: Number(map.get('delivery_dispatch_lead_days') ?? '0') || 0,
    codRules,
    freeShipThreshold:
      freeShipThreshold !== null && Number.isFinite(freeShipThreshold) ? freeShipThreshold : null,
  }
}

// ── The swappable courier seam (Pitfall 12 / DLVR-F1) ───────────────────────────
// In Phase 6 the body is the table-backed compute. In DLVR-F1 the body is replaced
// with a live aggregator call mapped to the IDENTICAL Estimate — no other file
// changes. The courier-specific JSON shape never leaves this function.
async function callCourierAdapter(
  admin: SupabaseClient,
  origin: string,
  dest: string,
  weightG: number,
  settings: DeliverySettings,
  signal: AbortSignal,
): Promise<Estimate> {
  const originConfigured = origin !== '000000'

  // (a) Serviceability — dest must be a member of pincodes AND serviceable=true
  //     (Pitfall D: a 6-digit-but-nonexistent pincode → clean serviceable:false).
  const { data: destRow, error: destErr } = await admin
    .from('pincodes')
    .select('pincode, state, is_metro, is_remote, serviceable')
    .eq('pincode', dest)
    .abortSignal(signal)
    .maybeSingle()
  if (destErr) {
    console.error('delivery-estimate: pincodes(dest) read failed', destErr)
    throw new Error('serviceability_read_failed')
  }
  if (!destRow || destRow.serviceable === false) {
    return {
      serviceable: false,
      cost: null,
      etaDays: null,
      codAvailable: false,
      originConfigured,
      zone: null,
    }
  }

  // (b) deriveZone — origin '000000'/absent → originConfigured:false + default zone
  //     'national' (D-18 / Pitfall B); never let an undefined origin row throw.
  let zone: Zone = 'national'
  if (originConfigured) {
    const { data: originRow, error: originErr } = await admin
      .from('pincodes')
      .select('pincode, state, is_metro, is_remote, serviceable')
      .eq('pincode', origin)
      .abortSignal(signal)
      .maybeSingle()
    if (originErr) {
      console.error('delivery-estimate: pincodes(origin) read failed', originErr)
      throw new Error('origin_read_failed')
    }
    if (originRow) {
      zone = deriveZone(originRow as PincodeRow, destRow as PincodeRow)
    }
    // originRow absent (configured value not in directory) → keep national lane.
  }

  // (c) slab lookup by (zone, weight_band = bucket)
  const bucket = weightBucket(weightG)
  const { data: slab, error: slabErr } = await admin
    .from('delivery_rate_slabs')
    .select('cost, eta_min_days, eta_max_days')
    .eq('zone', zone)
    .eq('weight_band', bucket)
    .abortSignal(signal)
    .maybeSingle()
  if (slabErr) {
    console.error('delivery-estimate: delivery_rate_slabs read failed', slabErr)
    throw new Error('slab_read_failed')
  }
  if (!slab) {
    // The 20-row grid is a full cartesian (5 zones × 4 bands); a miss means a
    // seed gap. Treat defensively as non-serviceable rather than a 500.
    console.error('delivery-estimate: no slab for', { zone, bucket })
    return {
      serviceable: false,
      cost: null,
      etaDays: null,
      codAvailable: false,
      originConfigured,
      zone,
    }
  }

  // (d) cost = round-UP-to-₹10 of the slab base cost (D-11/D-13)
  const cost = roundUpTo10(slab.cost as number)
  // (e) etaDays adds dispatch_lead_days to the slab transit range (D-20 / A4)
  const lead = settings.dispatchLeadDays
  const etaDays = {
    min: (slab.eta_min_days as number) + lead,
    max: (slab.eta_max_days as number) + lead,
  }
  // (f) codAvailable from cod_rules.enabled (D-08)
  const codAvailable = settings.codRules.enabled

  return { serviceable: true, cost, etaDays, codAvailable, originConfigured, zone }
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get('Origin'))

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const { token, destPincode, weightG } = await req.json()

    // VALIDATE destPincode /^\d{6}$/ BEFORE any compute or Turnstile (D-21 / SC2).
    // A non-6-digit / non-numeric / non-string pincode is a clean 400 bad_request —
    // never a slab miss or a 500.
    if (typeof destPincode !== 'string' || !/^\d{6}$/.test(destPincode)) {
      return new Response(JSON.stringify({ error: 'bad_request' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    // Turnstile siteverify — secret never leaves the function (TURNSTILE_SECRET_KEY
    // reused from verify-and-submit; read via Deno.env, never a client-bundled env var).
    const verify = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
          response: token,
        }),
      },
    )
    const outcome = await verify.json()
    if (!outcome.success) {
      return new Response(JSON.stringify({ error: 'captcha_failed' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    // Service-role client (see header — legitimate divergence, NOT Pitfall 4).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Bound all upstream work with an AbortController timeout so a hung dependency
    // cannot stall the request (SC3 / Pitfall 7).
    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 8000)

    try {
      const settings = await readSettings(admin)
      const origin = settings.originPincode
      const effectiveWeightG = typeof weightG === 'number' && weightG > 0
        ? weightG
        : settings.defaultWeightG
      const bucket = weightBucket(effectiveWeightG)

      // Cache read on (origin, dest, bucket) where expires_at > now() → HIT (SC4).
      const nowIso = new Date().toISOString()
      const { data: hit, error: cacheReadErr } = await admin
        .from('delivery_estimate_cache')
        .select('serviceable, cost, eta_min_days, eta_max_days, cod_available, zone')
        .eq('origin_pincode', origin)
        .eq('dest_pincode', destPincode)
        .eq('weight_bucket', bucket)
        .gt('expires_at', nowIso)
        .abortSignal(ac.signal)
        .maybeSingle()
      if (cacheReadErr) {
        // A cache read failure must not break the request — log and recompute.
        console.error('delivery-estimate: cache read failed', cacheReadErr)
      }
      if (hit) {
        // Cache hit — return the SAME normalized contract (zone stays internal).
        const cachedEstimate = {
          serviceable: hit.serviceable as boolean,
          cost: (hit.cost as number | null) ?? null,
          etaDays:
            hit.eta_min_days !== null && hit.eta_max_days !== null
              ? { min: hit.eta_min_days as number, max: hit.eta_max_days as number }
              : null,
          codAvailable: hit.cod_available as boolean,
          originConfigured: origin !== '000000',
        }
        return new Response(JSON.stringify(cachedEstimate), {
          status: 200,
          headers: jsonHeaders,
        })
      }

      // MISS → compute behind the swappable courier seam.
      const estimate = await callCourierAdapter(
        admin,
        origin,
        destPincode,
        effectiveWeightG,
        settings,
        ac.signal,
      )

      // Cache write — upsert with expires_at = now()+24h, keyed by
      // (origin, dest, weight_bucket). SKIP entirely when originConfigured === false
      // (OQ2): no provisional 000000 rows linger after Phase 9 sets a real origin.
      if (estimate.originConfigured) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const { error: cacheWriteErr } = await admin
          .from('delivery_estimate_cache')
          .upsert(
            {
              origin_pincode: origin,
              dest_pincode: destPincode,
              weight_bucket: bucket,
              serviceable: estimate.serviceable,
              cost: estimate.cost,
              eta_min_days: estimate.etaDays?.min ?? null,
              eta_max_days: estimate.etaDays?.max ?? null,
              cod_available: estimate.codAvailable,
              zone: estimate.zone ?? null,
              fetched_at: new Date().toISOString(),
              expires_at: expiresAt,
            },
            { onConflict: 'origin_pincode,dest_pincode,weight_bucket' },
          )
        if (cacheWriteErr) {
          // A cache write failure must not break the response — log and return.
          console.error('delivery-estimate: cache write failed', cacheWriteErr)
        }
      }

      // Strip the internal `zone` field from the public response — the contract is
      // { serviceable, cost, etaDays, codAvailable, originConfigured }.
      const { zone: _zone, ...publicEstimate } = estimate
      return new Response(JSON.stringify(publicEstimate), {
        status: 200,
        headers: jsonHeaders,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    // Never reflect raw Postgres/PostgREST errors (column/constraint text). Log
    // server-side, return a generic 400.
    console.error('delivery-estimate: request failed', err)
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }
})
