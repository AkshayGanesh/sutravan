import { createClient } from '@supabase/supabase-js';

// Module-level singleton (mirrors queryClient.ts) with env-or-throw guard
// (mirrors the deleted drizzle.config.ts DATABASE_URL precedent, adapted to
// browser/Vite env — uses import.meta.env, NOT process.env, like App.tsx:15).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);
