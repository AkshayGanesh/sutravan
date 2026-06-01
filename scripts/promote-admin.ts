/**
 * Out-of-band first-admin bootstrap (D-03 / success criterion #5).
 *
 * The owner registers normally (the Plan 01 signup trigger gives them a
 * role='customer' profile row), then runs THIS local script with the
 * service-role key to flip that email's `profiles.role` to 'admin'. There is
 * NO self-serve UI/code path to admin — promotion happens only here, in a
 * trusted local context. Re-running is an idempotent no-op (role already admin).
 *
 * The service-role caller has no JWT, so `auth.uid()` is null and Plan 01's
 * `enforce_profile_role_lock` BEFORE UPDATE trigger carve-out permits this
 * update (Pitfall 4) — instead of blocking it as a self-escalation.
 *
 * SECURITY: reads the service-role key from non-VITE_ `process.env` only; this
 * script is never imported by client code, so it never reaches the public bundle
 * (`scripts/check-no-secret.sh` enforces this against dist/). Store the key in a
 * gitignored `.env.promote.local` (root/supabase `.gitignore` cover `.env*.local`).
 *
 * Native Node 22 runner (no tsx, no dotenv):
 *   node --env-file=.env.promote.local scripts/promote-admin.ts owner@example.com
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL; // non-VITE_, runtime only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // non-VITE_, never committed

if (!url || !serviceKey) {
  console.error('FAIL: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error('FAIL: usage: promote-admin <email>');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main(): Promise<void> {
  // Idempotent: set role='admin' for the profile matching the email. A re-run is
  // a no-op (role already admin). The service-role caller's null auth.uid() lets
  // Plan 01's enforce_profile_role_lock carve-out permit this change (Pitfall 4).
  const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('email', email);

  if (error) {
    throw new Error(`promote failed for ${email}: ${error.message}`);
  }

  console.log(`OK: ${email} is now admin (idempotent).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
