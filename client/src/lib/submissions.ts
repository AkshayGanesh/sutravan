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

// Shared SELECT column list — the admin inbox and the customer's own history
// read the exact same row shape (SubmissionRow), so the projection lives once.
const SUBMISSION_SELECT = 'id, name, email, skin_type, message, payload, created_at';

async function fetchSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('customization_submissions')
    .select(SUBMISSION_SELECT)
    .order('created_at', { ascending: false }); // newest first (ADMIN-07)
  if (error) throw error; // surfaces to useQuery isError -> Retry
  return (data ?? []) as SubmissionRow[];
}

export function useSubmissions() {
  return useQuery({ queryKey: ['submissions'], queryFn: fetchSubmissions });
}

// Owner-scoped read for the customer's OWN history (CUST-04). No explicit
// caller filter is needed: the existing customization_submissions_admin_or_owner_read
// RLS (migration 0002) returns only the caller's rows for a non-admin, so this
// uses the SAME SELECT/order as the admin read and lets RLS do the scoping.
async function fetchMySubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('customization_submissions')
    .select(SUBMISSION_SELECT)
    .order('created_at', { ascending: false }); // newest first
  if (error) throw error;
  return (data ?? []) as SubmissionRow[];
}

// The distinct ['my-submissions'] query key keeps the customer's owner-scoped
// view in a separate cache slot from the admin ['submissions'] view, so the two
// never bleed into each other when both pages have been visited in one session.
export function useMySubmissions() {
  return useQuery({ queryKey: ['my-submissions'], queryFn: fetchMySubmissions });
}

/**
 * One-line message snippet for a list row. Pure (no React, no I/O) so both the
 * admin Submissions page and the customer Profile history reuse the SAME logic
 * and this slice gets automated coverage (lib/submissions.test.ts).
 *
 * Returns '—' for null/empty, collapses internal whitespace to single spaces,
 * and truncates to 80 chars with an ellipsis for longer messages.
 */
export function submissionSnippet(message: string | null): string {
  const text = message?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text) return '—';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}
