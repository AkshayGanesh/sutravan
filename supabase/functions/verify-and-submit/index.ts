// supabase/functions/verify-and-submit/index.ts
// Phase 5 / Plan 02 / Task 2 — the project's FIRST Supabase Edge Function (D-03).
//
// Flow (RESEARCH Pattern 2):
//   1. Verify the Cloudflare Turnstile token server-side via siteverify
//      (the TURNSTILE_SECRET_KEY lives ONLY in this function's env — set via
//      `supabase secrets set`, NEVER a VITE_ var / bundled / committed — T-05-09).
//   2. Insert the submission under the CALLER'S JWT (their Authorization header),
//      NOT the service-role key. This keeps the 0007 INSERT RLS WITH CHECK as the
//      real ownership gate (anon -> user_id null; authenticated -> own uid only).
//      Using the service-role key here would bypass RLS and break the invariant
//      (Pitfall 4 / T-05-06) — so this function deliberately uses only the anon key
//      scoped to the caller's JWT, never the elevated key.
//   3. BEST-EFFORT admin notification email (quick task 260602-co6). After the
//      insert succeeds, send ONE email to ADMIN_NOTIFY_EMAIL via the Resend HTTP
//      API. RESEND_API_KEY + ADMIN_NOTIFY_EMAIL live ONLY in this function's env
//      (same T-05-09 pattern as TURNSTILE_SECRET_KEY — never VITE_/bundled). The
//      send is wrapped in its own try/catch and MUST NEVER regress the submission:
//      any email failure (missing secret, non-2xx, network error) is logged
//      server-side only and the function still returns { ok: true } (T-CO6-03).
//
// CORS: Access-Control-Allow-Origin is restricted to the production site origin
// (https://sutravan.in) plus localhost dev — never a wildcard (Pitfall 2 /
// T-05-10). The OPTIONS preflight is handled explicitly.
//
// verify_jwt = false is set for this function in config.toml (Pitfall 1): anon
// submitters must reach the function body — Turnstile + the 0007 INSERT RLS are
// the real gates, not platform-edge JWT verification.
//
// SECURITY POSTURE — Open Question 1 disposition (T-05-08, ACCEPTED):
//   Turnstile is enforced on the UI path through this function. A client CAN still
//   call PostgREST `.from('customization_submissions').insert(...)` directly,
//   skipping Turnstile. With 0007's policy every such row is STILL user_id-correct
//   (RLS holds) and rate-limitable. For a small handmade brand with no payments the
//   residual "spam without Turnstile, but owner-scoped" risk is accepted; revisit
//   (e.g. function-only insert path) if spam actually appears. This is intentional —
//   do NOT "fix" it by switching to a service-role insert (that would remove the RLS
//   ownership guarantee entirely; see RESEARCH Anti-Patterns).

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Allowed browser origins (production GitHub Pages site + local dev).
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

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get('Origin'))

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const { token, submission } = await req.json()

    // Shape guard: the body's `submission` MUST be a plain object. A
    // string/array/null reaching PostgREST would otherwise be reflected back as
    // a raw error (CR-01). Reject early with a generic 400.
    if (
      typeof submission !== 'object' ||
      submission === null ||
      Array.isArray(submission)
    ) {
      return new Response(JSON.stringify({ error: 'bad_request' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    // 1. Verify the Turnstile token server-side (secret never leaves the function).
    const verify = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
          response: token,
          // optional: remoteip: req.headers.get('x-forwarded-for'),
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

    // 2. Insert under the CALLER'S JWT so 0007's RLS WITH CHECK enforces user_id
    //    ownership. For anon submitters there is no Authorization header → RLS
    //    treats it as anon → the row must carry user_id = null (the client must
    //    NOT send a user_id for anon). NOT the service-role key (Pitfall 4).
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // Server-side field allow-list (CR-01). The wizard's `toSubmission`
    // (client/src/lib/questionnaire.ts) legitimately writes ONLY these columns;
    // every other client-supplied key (e.g. created_at, id) is dropped so the
    // server is no longer a pure pass-through. user_id is passed through because
    // the 0007 INSERT RLS WITH CHECK remains the real ownership gate.
    const ALLOWED = new Set([
      'name',
      'email',
      'skin_type',
      'message',
      'payload',
      'user_id',
    ])
    const clean: Record<string, unknown> = {}
    for (const key of Object.keys(submission as Record<string, unknown>)) {
      if (ALLOWED.has(key)) {
        clean[key] = (submission as Record<string, unknown>)[key]
      }
    }

    const { error } = await supabase
      .from('customization_submissions')
      .insert(clean)
    if (error) {
      // Never reflect the raw Postgres/PostgREST error to the client (it leaks
      // column names / constraint text). Log server-side, return generic 400.
      console.error('verify-and-submit insert failed', error)
      return new Response(JSON.stringify({ error: 'submission_failed' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    // 3. BEST-EFFORT admin notification email (quick task 260602-co6).
    //    Runs ONLY on the insert-success path. Secrets are read from the function
    //    env (Deno.env) — NEVER VITE_/bundled (T-05-09 pattern). The whole send is
    //    wrapped in its own try/catch: on ANY failure (missing secret, non-2xx
    //    from Resend, network error) we console.error server-side and continue, so
    //    the customer's submission still returns { ok: true }. This MUST NOT change
    //    the 200 success contract questionnaire.ts depends on (T-CO6-03).
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      const adminEmail = Deno.env.get('ADMIN_NOTIFY_EMAIL')
      if (!resendKey || !adminEmail) {
        // Pre-secrets / misconfig: skip gracefully so the function keeps working
        // before the human deploys the secrets (quick task Task 4).
        console.warn(
          'verify-and-submit: RESEND_API_KEY/ADMIN_NOTIFY_EMAIL unset — skipping admin email',
        )
      } else {
        const name = (clean.name as string | undefined) ?? 'Anonymous'
        const email = (clean.email as string | undefined) ?? '—'
        const skinType = (clean.skin_type as string | undefined) ?? '—'
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Resend onboarding sender works before a domain is verified; switch
            // to a verified-domain sender once the owner sets one up.
            from: 'Sutravan <onboarding@resend.dev>',
            to: adminEmail,
            subject: 'New skin care guide submission',
            html:
              `<p>A customer submitted the skin care guide questionnaire.</p>` +
              `<ul>` +
              `<li><strong>Name:</strong> ${name}</li>` +
              `<li><strong>Email:</strong> ${email}</li>` +
              `<li><strong>Skin type:</strong> ${skinType}</li>` +
              `</ul>` +
              `<p><a href="https://sutravan.in/admin/submissions">Open the submissions inbox</a></p>`,
          }),
        })
        if (!res.ok) {
          // Non-2xx from Resend — log and continue; submission already succeeded.
          console.error(
            'verify-and-submit: Resend send failed',
            res.status,
            await res.text().catch(() => ''),
          )
        }
      }
    } catch (mailErr) {
      // Network/other error — best-effort, never block the submission.
      console.error('verify-and-submit: admin email error', mailErr)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }
})
