import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2 } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  useAdminSections,
  useUpsertSection,
  useDeleteSection,
  type SectionFormValues,
} from "@/lib/admin";

// The snake_case admin section row returned by useAdminSections, ordered by
// sort_order.
interface AdminSectionRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

const sectionSchema = z.object({
  title: z.string().trim().min(1, "Section title is required."),
  description: z.string().trim().optional(),
  sortOrder: z.coerce
    .number({ invalid_type_error: "Display order must be a number." })
    .int("Display order must be a whole number.")
    .min(0, "Display order can't be negative."),
});

type SectionFormShape = z.infer<typeof sectionSchema>;

const COLUMN_COUNT = 3;

export default function SectionsList() {
  const { data, isLoading, isError, refetch } = useAdminSections();
  const upsertSection = useUpsertSection();
  const deleteSection = useDeleteSection();

  // null = closed; an AdminSectionRow = editing; "new" = creating.
  const [formTarget, setFormTarget] = useState<AdminSectionRow | "new" | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<AdminSectionRow | null>(
    null,
  );

  const sections = (data ?? []) as AdminSectionRow[];

  // Default display order for a new section = next slot after the highest.
  const nextOrder =
    sections.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

  const form = useForm<SectionFormShape>({
    resolver: zodResolver(sectionSchema),
    defaultValues: { title: "", description: "", sortOrder: 0 },
  });

  function openCreate() {
    form.reset({ title: "", description: "", sortOrder: nextOrder });
    setFormTarget("new");
  }

  function openEdit(row: AdminSectionRow) {
    form.reset({
      title: row.title,
      description: row.description ?? "",
      sortOrder: row.sort_order,
    });
    setFormTarget(row);
  }

  function onSubmit(values: SectionFormShape) {
    const editing = formTarget !== "new" && formTarget !== null;
    const payload: SectionFormValues = {
      title: values.title,
      description: values.description,
      sortOrder: values.sortOrder,
      ...(editing ? { id: (formTarget as AdminSectionRow).id } : {}),
    };
    upsertSection.mutate(payload, {
      onSuccess: () => setFormTarget(null),
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteSection.mutate({ id: pendingDelete.id });
    setPendingDelete(null);
  }

  // ── Header (title + primary CTA) ──────────────────────────────────────────
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl text-primary">Skin Guide Sections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Group questions into sections. Customers see one section at a time.
          Questions without a section appear in a final “More questions” step.
        </p>
      </div>
      <Button onClick={openCreate}>+ Add section</Button>
    </div>
  );

  // ── Reusable form dialog (create + edit share one surface) ────────────────
  // Rendered by CALLING this (`{renderSectionFormDialog()}`), never mounted as
  // `<… />` — a nested component gets a new identity per render and would remount
  // the dialog (stealing input focus) on each keystroke. It uses no hooks.
  function renderSectionFormDialog() {
    const editing = formTarget !== "new" && formTarget !== null;
    return (
      <Dialog
        open={formTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit section" : "Add section"}
            </DialogTitle>
            <DialogDescription>
              Sections group the Skin Guide questions into steps.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
              noValidate
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Basic Information" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="e.g. Tell us a little about yourself."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display order</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertSection.isPending}>
                  {upsertSection.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Per-row actions ───────────────────────────────────────────────────────
  function RowActions({ row }: { row: AdminSectionRow }) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
          onClick={() => openEdit(row)}
          aria-label={`Edit ${row.title}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 text-destructive"
          onClick={() => setPendingDelete(row)}
          aria-label={`Delete ${row.title}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="space-y-6">
        {header}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
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
        {renderSectionFormDialog()}
      </section>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (sections.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No sections yet</EmptyTitle>
            <EmptyDescription>
              Add a section, then assign questions to it from the Skin Guide
              page. Until then, all questions show in one step.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreate}>+ Add section</Button>
          </EmptyContent>
        </Empty>
        {renderSectionFormDialog()}
      </section>
    );
  }

  // ── Populated ─────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6">
      {header}

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-base font-medium text-foreground">
                    {row.title}
                  </div>
                  {row.description && (
                    <div className="text-sm text-muted-foreground">
                      {row.description}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{row.sort_order}</TableCell>
                <TableCell className="text-right">
                  <RowActions row={row} />
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
        {sections.map((row) => (
          <li
            key={row.id}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-medium text-foreground">
                  {row.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  order {row.sort_order}
                </div>
              </div>
              <RowActions row={row} />
            </div>
          </li>
        ))}
      </ul>

      {renderSectionFormDialog()}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this section?"
        description="Its questions won't be deleted — they'll move to the final “More questions” step until you reassign them. This can't be undone."
        confirmLabel="Delete section"
        onConfirm={confirmDelete}
      />
    </section>
  );
}
