import { useState } from "react";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useSubmissions,
  useMarkSubmissionRead,
  submissionSnippet,
  isUnread,
  type SubmissionRow,
} from "@/lib/submissions";

const COLUMN_COUNT = 3;

/** Name with email fallback — submissions may be anon (name/email nullable). */
function displayName(row: SubmissionRow): string {
  return row.name?.trim() || row.email?.trim() || "Anonymous";
}

/** Human date for the list/detail; created_at is an ISO string. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "PP");
}

const header = (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h1 className="font-serif text-2xl text-primary">Submissions</h1>
  </div>
);

export default function Submissions() {
  const { data, isLoading, isError, refetch } = useSubmissions();
  const markRead = useMarkSubmissionRead();
  const [selected, setSelected] = useState<SubmissionRow | null>(null);

  const submissions = (data ?? []) as SubmissionRow[];

  // Open a submission and mark it read on open (CONTEXT: opening marks read).
  // Guarded by isUnread so an already-read row never fires a needless write.
  function openSubmission(row: SubmissionRow) {
    setSelected(row);
    if (isUnread(row)) markRead.mutate(row.id);
  }

  // ── Loading: skeleton rows mirroring the columns ──────────────────────────
  if (isLoading) {
    return (
      <section className="space-y-6">
        {header}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead className="w-32">Date</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-56" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    );
  }

  // ── Error: inline block + Retry calling refetch() ─────────────────────────
  if (isError) {
    return (
      <section className="space-y-6">
        {header}
        <div className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-foreground">
            Couldn&apos;t load this. Check your connection and try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  // ── Empty: read-only, NO CTA (the questionnaire writes this in Phase 5) ────
  if (submissions.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No submissions yet</EmptyTitle>
            <EmptyDescription>
              Customer customization requests will appear here once the
              questionnaire is live.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  // ── Reusable detail field row ─────────────────────────────────────────────
  function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    );
  }

  // ── Populated: table on md+, stacked cards on mobile ──────────────────────
  return (
    <section className="space-y-6">
      {header}

      {/* Desktop / tablet: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead className="w-32">Date</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => openSubmission(row)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        isUnread(row)
                          ? "text-base font-semibold text-foreground"
                          : "text-base font-medium text-foreground"
                      }
                    >
                      {displayName(row)}
                    </span>
                    {isUnread(row) && (
                      <Badge variant="secondary" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  {row.email && (
                    <div className="text-sm text-muted-foreground">
                      {row.email}
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(row.created_at)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {submissionSnippet(row.message)}
                </TableCell>
              </TableRow>
            ))}
            {/* COLUMN_COUNT referenced so the constant documents the column set */}
            <TableRow className="hidden" aria-hidden="true">
              <TableCell colSpan={COLUMN_COUNT} />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {submissions.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => openSubmission(row)}
              className="w-full space-y-1 rounded-md border border-border p-4 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={
                      isUnread(row)
                        ? "truncate text-base font-semibold text-foreground"
                        : "truncate text-base font-medium text-foreground"
                    }
                  >
                    {displayName(row)}
                  </span>
                  {isUnread(row) && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      New
                    </Badge>
                  )}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {submissionSnippet(row.message)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {/* Detail view — full submission, read-only (no edit/delete/status, D-17) */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{displayName(selected)}</DialogTitle>
                <DialogDescription>
                  {formatDate(selected.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selected.email && (
                  <Field label="Email" value={selected.email} />
                )}
                {selected.skin_type && (
                  <Field
                    label="Skin type"
                    value={<Badge variant="outline">{selected.skin_type}</Badge>}
                  />
                )}
                <Field
                  label="Message"
                  value={
                    <p className="whitespace-pre-wrap">
                      {selected.message?.trim() || "—"}
                    </p>
                  }
                />
                {selected.payload != null && (
                  <Field
                    label="Details"
                    value={
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        {JSON.stringify(selected.payload, null, 2)}
                      </pre>
                    }
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
