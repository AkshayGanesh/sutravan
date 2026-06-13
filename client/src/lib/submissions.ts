// Read layer for the admin submissions inbox (ADMIN-07).
// Reads customer customization submissions through the existing admin-read RLS
// (customization_submissions_admin_or_owner_read, migration 0002) — no extra
// auth code here. The table is empty until Phase 5 ships the questionnaire
// (CUST-03), so callers must handle the empty case as the normal path.
//
// Mirrors lib/catalog.ts: a plain fetch function (errors thrown -> useQuery
// isError -> Retry) split from the useQuery hook, snake_case stays snake_case
// (the component owns its row shape, like ProductsList's AdminProductRow).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  // Unread flag (migration 0009). NOT NULL with a default of 'new', so the
  // literal union is correct here (never null).
  status: 'new' | 'read';
}

// Shared SELECT column list — the admin inbox and the customer's own history
// read the exact same row shape (SubmissionRow), so the projection lives once.
const SUBMISSION_SELECT =
  'id, name, email, skin_type, message, payload, created_at, status';

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

/**
 * The single shared "is this row unread?" predicate. Pure (no React, no I/O) so
 * the inbox highlight + mark-on-open (Submissions.tsx) and the unread-count
 * badge all decide unread from ONE source of truth (and it gets unit coverage).
 */
export function isUnread(row: Pick<SubmissionRow, 'status'>): boolean {
  return row.status === 'new';
}

// ── Unified answer rendering (new snapshot shape + legacy fallback) ───────────
//
// A submission's answers are displayed identically in the admin inbox and the
// customer Profile history. Two shapes exist in the wild:
//   NEW: payload.answers = [{ question_id, label, field_type, value }] — the
//        question label + answer are SNAPSHOTTED at submit time (migration 0012
//        questionnaire), so they render verbatim and survive question edits.
//   LEGACY: the skin_type column + payload.{concerns,productInterest,allergies}
//        + the message column (the pre-0012 hard-coded form). Mapped to the same
//        label/value pairs so old rows keep rendering correctly.
// Pure (no React, no I/O) so both pages share one source of truth + get coverage.

export interface DisplayAnswer {
  label: string;
  value: string;
}

function joinValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return value == null ? '' : String(value);
}

/**
 * The label→value pairs to render for a submission. New rows map straight from
 * payload.answers; legacy rows are reconstructed from the old columns/payload.
 * Values may be '' (an unanswered optional question) — the UI shows '—' for those.
 */
export function submissionAnswers(
  row: Pick<SubmissionRow, 'skin_type' | 'message' | 'payload'>,
): DisplayAnswer[] {
  const payload = row.payload;

  // NEW shape: payload.answers is an array of snapshotted answers.
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { answers?: unknown }).answers)
  ) {
    const answers = (payload as { answers: unknown[] }).answers;
    return answers
      .map((a) => {
        const entry = a as { label?: unknown; value?: unknown };
        return {
          label: typeof entry.label === 'string' ? entry.label : '',
          value: joinValue(entry.value),
        };
      })
      .filter((a) => a.label !== '');
  }

  // LEGACY shape: skin_type column + payload object + message column.
  const out: DisplayAnswer[] = [];
  if (row.skin_type) out.push({ label: 'Skin type', value: row.skin_type });
  if (payload && typeof payload === 'object') {
    const legacy = payload as Record<string, unknown>;
    if (Array.isArray(legacy.concerns) && legacy.concerns.length > 0) {
      out.push({ label: 'Concerns', value: joinValue(legacy.concerns) });
    }
    if (
      typeof legacy.productInterest === 'string' &&
      legacy.productInterest.trim()
    ) {
      out.push({ label: 'Looking for', value: legacy.productInterest });
    }
    if (typeof legacy.allergies === 'string' && legacy.allergies.trim()) {
      out.push({ label: 'Allergies / avoid', value: legacy.allergies });
    }
  }
  if (row.message && row.message.trim()) {
    out.push({ label: 'Message', value: row.message });
  }
  return out;
}

/**
 * The raw preview string for a list row (truncate it with submissionSnippet).
 * New rows have a null `message` column, so fall back to the first non-empty
 * snapshotted answer value; returns '' when nothing is fillable (-> '—').
 */
export function submissionPreview(
  row: Pick<SubmissionRow, 'skin_type' | 'message' | 'payload'>,
): string {
  if (row.message && row.message.trim()) return row.message;
  const firstFilled = submissionAnswers(row).find(
    (a) => a.value.trim() !== '',
  );
  return firstFilled?.value ?? '';
}

// ── Unread badge + mark-read (admin only) ────────────────────────────────────
//
// Both mirror the admin.ts conventions: a plain fetch split from the hook, and a
// mutation that invalidates on success. queryClient.ts sets staleTime: Infinity,
// so onSuccess invalidation is MANDATORY for the badge + inbox to refresh with no
// redeploy. The unread count lives under its own ['submissions','unread-count']
// key so the badge and the inbox list refresh independently.

async function fetchUnreadSubmissionsCount(): Promise<number> {
  // Admins read all rows via customization_submissions_admin_or_owner_read (0002);
  // head:true + count:'exact' avoids pulling row bodies just to count.
  const { count, error } = await supabase
    .from('customization_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) throw error;
  return count ?? 0;
}

/** Unread-count for the admin Submissions nav badge (rows with status='new'). */
export function useUnreadSubmissionsCount() {
  return useQuery({
    queryKey: ['submissions', 'unread-count'],
    queryFn: fetchUnreadSubmissionsCount,
  });
}

/**
 * Mark one submission row read (admin only). Writes status='read' by id under the
 * admin-only UPDATE RLS (migration 0009). On success it invalidates BOTH the
 * inbox list (['submissions']) AND the badge count (['submissions','unread-count'])
 * so both reflect the change without a redeploy.
 */
export function useMarkSubmissionRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customization_submissions')
        .update({ status: 'read' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] });
      qc.invalidateQueries({ queryKey: ['submissions', 'unread-count'] });
    },
    // Silent on error: marking read is a passive UX nicety, not a user action
    // worth a toast — the row simply stays unread and will retry on next open.
  });
}
