// Read layer for the admin submissions inbox (ADMIN-07).
// Reads customer customization submissions through the existing admin-read RLS
// (customization_submissions_admin_or_owner_read, migration 0002) — no extra
// auth code here. The table is empty until Phase 5 ships the questionnaire
// (CUST-03), so callers must handle the empty case as the normal path.
//
// Mirrors lib/catalog.ts: a plain fetch function (errors thrown -> useQuery
// isError -> Retry) split from the useQuery hook, snake_case stays snake_case
// (the component owns its row shape, like ProductsList's AdminProductRow).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

// The snake_case row returned by PostgREST for the submissions inbox.
export interface SubmissionRow {
  id: string;
  name: string | null;
  email: string | null;
  skin_type: string | null;
  message: string | null;
  payload: unknown; // jsonb field bag for the evolving questionnaire
  created_at: string; // ISO timestamp
}

async function fetchSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('customization_submissions')
    .select('id, name, email, skin_type, message, payload, created_at')
    .order('created_at', { ascending: false }); // newest first (ADMIN-07)
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []) as SubmissionRow[];
}

export function useSubmissions() {
  return useQuery({ queryKey: ['submissions'], queryFn: fetchSubmissions });
}
