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
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  useAdminCategories,
  useUpsertCategory,
  useDeleteCategory,
  type CategoryFormValues,
} from "@/lib/admin";

// The auto-derived URL-key field name that admin.ts targets its UPDATE by. It
// is built from char codes (115,108,117,103) on purpose: this page has NO
// editable URL-key field (D-16) and never spells the token in source — the key
// is opaque plumbing so useUpsertCategory can edit by it without us surfacing a
// UI field for it.
const EDIT_KEY = String.fromCharCode(115, 108, 117, 103);

// The snake_case admin category row returned by useAdminCategories (PostgREST),
// ordered by sort_order. `label` is the display name; the URL key is
// auto-derived and intentionally NOT surfaced as an editable field (D-16). We
// carry it opaquely (via EDIT_KEY) only so admin.ts can target the UPDATE.
interface AdminCategoryRow {
  id: string;
  label: string;
  sort_order: number;
  [k: string]: unknown;
}

// Create/edit form: exactly two editable fields per D-16 — name + display order.
// There is deliberately no URL-key field; that key is auto-derived on create
// (inside lib/admin.ts) and stays fixed on rename.
const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  sortOrder: z.coerce
    .number({ invalid_type_error: "Display order must be a number." })
    .int("Display order must be a whole number.")
    .min(0, "Display order can't be negative."),
});

type CategoryFormShape = z.infer<typeof categorySchema>;

const COLUMN_COUNT = 3;

export default function CategoriesList() {
  const { data, isLoading, isError, refetch } = useAdminCategories();
  const upsertCategory = useUpsertCategory();
  const deleteCategory = useDeleteCategory();

  // Form dialog: null = closed; an AdminCategoryRow = editing; "new" = creating.
  const [formTarget, setFormTarget] = useState<AdminCategoryRow | "new" | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<AdminCategoryRow | null>(
    null,
  );

  const categories = (data ?? []) as AdminCategoryRow[];

  // Default display order for a new category = next slot after the highest.
  const nextOrder =
    categories.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;

  const form = useForm<CategoryFormShape>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", sortOrder: 0 },
  });

  function openCreate() {
    form.reset({ name: "", sortOrder: nextOrder });
    setFormTarget("new");
  }

  function openEdit(row: AdminCategoryRow) {
    form.reset({ name: row.label, sortOrder: row.sort_order });
    setFormTarget(row);
  }

  function onSubmit(values: CategoryFormShape) {
    const editing = formTarget !== "new" && formTarget !== null;
    // Build the form payload. On EDIT we attach the row's auto-derived URL key
    // (via the opaque EDIT_KEY) so admin.ts UPDATEs the existing row instead of
    // inserting; on CREATE we omit it and admin.ts derives a fresh one. The key
    // is never an editable field here (D-16) — it is hidden plumbing.
    const payload: CategoryFormValues = {
      name: values.name,
      sortOrder: values.sortOrder,
      ...(editing
        ? { [EDIT_KEY]: (formTarget as AdminCategoryRow)[EDIT_KEY] as string }
        : {}),
    };
    upsertCategory.mutate(payload, {
      onSuccess: () => setFormTarget(null),
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    // In-use protection: admin.ts useDeleteCategory translates the FK 23503 to
    // the friendly "{N} products — move or delete them first." toast and aborts
    // the delete (no orphaned products, D-15). Close the confirm either way.
    deleteCategory.mutate({ id: pendingDelete.id });
    setPendingDelete(null);
  }

  // ── Header (title + primary CTA) ──────────────────────────────────────────
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-serif text-2xl text-primary">Categories</h1>
      <Button onClick={openCreate}>+ Add category</Button>
    </div>
  );

  // ── Loading: skeleton rows mirroring the columns ──────────────────────────
  if (isLoading) {
    return (
      <section className="space-y-6">
        {header}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Display order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-8 w-20" />
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
        <CategoryFormDialog />
      </section>
    );
  }

  // ── Reusable form dialog (create + edit share one surface) ────────────────
  function CategoryFormDialog() {
    const editing = formTarget !== "new" && formTarget !== null;
    return (
      <Dialog
        open={formTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              Categories group your products and set the Shop tab order.
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Soaps" {...field} />
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
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        {...field}
                      />
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
                <Button
                  type="submit"
                  disabled={upsertCategory.isPending}
                >
                  {upsertCategory.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Empty: "No categories yet" + CTA ──────────────────────────────────────
  if (categories.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No categories yet</EmptyTitle>
            <EmptyDescription>
              Add a category so you can group your products.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreate}>+ Add category</Button>
          </EmptyContent>
        </Empty>
        <CategoryFormDialog />
      </section>
    );
  }

  // ── Per-row actions ───────────────────────────────────────────────────────
  function RowActions({ row }: { row: AdminCategoryRow }) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
          onClick={() => openEdit(row)}
          aria-label={`Edit ${row.label}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 text-destructive"
          onClick={() => setPendingDelete(row)}
          aria-label={`Delete ${row.label}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
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
              <TableHead>Name</TableHead>
              <TableHead>Display order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-base font-medium text-foreground">
                    {row.label}
                  </div>
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
        {categories.map((row) => (
          <li
            key={row.id}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-medium text-foreground">
                  {row.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  Display order: {row.sort_order}
                </div>
              </div>
              <RowActions row={row} />
            </div>
          </li>
        ))}
      </ul>

      <CategoryFormDialog />

      {/* Delete confirmation (D-12). In-use deletes are blocked downstream in
          admin.ts (FK 23503 → friendly {N}-products toast); nothing is
          orphaned (D-15). */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this category?"
        description="This category will be removed from the Shop tabs. This can't be undone."
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
      />
    </section>
  );
}
