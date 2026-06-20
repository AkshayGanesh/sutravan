import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
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
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import RepeatableRows from "@/components/admin/RepeatableRows";
import {
  useAdminQuestions,
  useAdminSections,
  useUpsertQuestion,
  useDeleteQuestion,
  type QuestionFormValues,
} from "@/lib/admin";
import type { QuestionFieldType } from "@/lib/questionnaire";

// The snake_case admin question row returned by useAdminQuestions (PostgREST),
// ordered by sort_order.
interface AdminQuestionRow {
  id: string;
  label: string;
  help_text: string | null;
  field_type: QuestionFieldType;
  options: string[];
  placeholder: string | null;
  required: boolean;
  sort_order: number;
  section_id: string | null;
}

// Section <Select> can't use "" as a value (Radix reserves it), so a sentinel
// represents "no section" in the form; it maps to null at the write boundary.
const NO_SECTION = "__none__";

interface AdminSectionOption {
  id: string;
  title: string;
  sort_order: number;
}

// Human labels for the four field types (admin-facing).
const FIELD_TYPE_LABELS: Record<QuestionFieldType, string> = {
  single_select: "Single choice",
  multi_select: "Multiple choice",
  short_text: "Short text",
  long_text: "Long text",
};

const isSelectType = (t: QuestionFieldType) =>
  t === "single_select" || t === "multi_select";

const questionSchema = z
  .object({
    label: z.string().trim().min(1, "Question text is required."),
    helpText: z.string().trim().optional(),
    fieldType: z.enum([
      "single_select",
      "multi_select",
      "short_text",
      "long_text",
    ]),
    options: z.array(z.string()),
    placeholder: z.string().trim().optional(),
    sectionId: z.string(), // NO_SECTION sentinel or a real section id
    required: z.boolean(),
    sortOrder: z.coerce
      .number({ invalid_type_error: "Display order must be a number." })
      .int("Display order must be a whole number.")
      .min(0, "Display order can't be negative."),
  })
  .superRefine((v, ctx) => {
    // Choice questions need at least one non-empty option.
    if (isSelectType(v.fieldType)) {
      const filled = v.options.filter((o) => o.trim() !== "");
      if (filled.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Add at least one option for a choice question.",
        });
      }
    }
  });

type QuestionFormShape = z.infer<typeof questionSchema>;

const COLUMN_COUNT = 4;

export default function QuestionsList() {
  const { data, isLoading, isError, refetch } = useAdminQuestions();
  const { data: sectionData } = useAdminSections();
  const upsertQuestion = useUpsertQuestion();
  const deleteQuestion = useDeleteQuestion();

  const sectionOptions = (sectionData ?? []) as AdminSectionOption[];

  // Form dialog: null = closed; an AdminQuestionRow = editing; "new" = creating.
  const [formTarget, setFormTarget] = useState<
    AdminQuestionRow | "new" | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<AdminQuestionRow | null>(
    null,
  );

  const questions = (data ?? []) as AdminQuestionRow[];

  // Default display order for a new question = next slot after the highest.
  const nextOrder =
    questions.reduce((max, q) => Math.max(max, q.sort_order), -1) + 1;

  const form = useForm<QuestionFormShape>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      label: "",
      helpText: "",
      fieldType: "single_select",
      options: [],
      placeholder: "",
      sectionId: NO_SECTION,
      required: false,
      sortOrder: 0,
    },
  });

  // useWatch (not form.watch) so subscribing to fieldType does NOT force a root
  // re-render of this list on every keystroke — that re-render is what used to
  // remount the dialog and steal input focus after the first character.
  const fieldType = useWatch({ control: form.control, name: "fieldType" });

  function openCreate() {
    form.reset({
      label: "",
      helpText: "",
      fieldType: "single_select",
      options: [],
      placeholder: "",
      sectionId: NO_SECTION,
      required: false,
      sortOrder: nextOrder,
    });
    setFormTarget("new");
  }

  function openEdit(row: AdminQuestionRow) {
    form.reset({
      label: row.label,
      helpText: row.help_text ?? "",
      fieldType: row.field_type,
      options: row.options ?? [],
      placeholder: row.placeholder ?? "",
      sectionId: row.section_id ?? NO_SECTION,
      required: row.required,
      sortOrder: row.sort_order,
    });
    setFormTarget(row);
  }

  function onSubmit(values: QuestionFormShape) {
    const editing = formTarget !== "new" && formTarget !== null;
    const payload: QuestionFormValues = {
      label: values.label,
      helpText: values.helpText,
      fieldType: values.fieldType,
      options: values.options,
      placeholder: values.placeholder,
      required: values.required,
      sortOrder: values.sortOrder,
      sectionId: values.sectionId === NO_SECTION ? null : values.sectionId,
      ...(editing ? { id: (formTarget as AdminQuestionRow).id } : {}),
    };
    upsertQuestion.mutate(payload, {
      onSuccess: () => setFormTarget(null),
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteQuestion.mutate({ id: pendingDelete.id });
    setPendingDelete(null);
  }

  // ── Header (title + primary CTA) ──────────────────────────────────────────
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl text-primary">Skin Guide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Questions customers answer on the Skin Guide form. Name and email are
          always asked first.
        </p>
      </div>
      <Button onClick={openCreate}>+ Add question</Button>
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
              <TableHead>Question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
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
        {renderQuestionFormDialog()}
      </section>
    );
  }

  // ── Reusable form dialog (create + edit share one surface) ────────────────
  // Rendered by CALLING this (`{renderQuestionFormDialog()}`), never mounted as
  // `<… />`. A nested component gets a new function identity on every parent
  // render, which made React remount the whole dialog (and steal input focus)
  // on the first keystroke. Calling it inlines the JSX so React reconciles the
  // <Dialog> in place. It uses no hooks, so a plain call is safe.
  function renderQuestionFormDialog() {
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
              {editing ? "Edit question" : "Add question"}
            </DialogTitle>
            <DialogDescription>
              This question appears on the public Skin Guide form.
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
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Skin type" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="helpText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Help text (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Choose any that apply."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fieldType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Answer type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          Object.keys(FIELD_TYPE_LABELS) as QuestionFieldType[]
                        ).map((t) => (
                          <SelectItem key={t} value={t}>
                            {FIELD_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SECTION}>
                          No section (“More questions”)
                        </SelectItem>
                        {sectionOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Which step this question appears in on the public form.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Options — only for the choice types */}
              {isSelectType(fieldType) && (
                <FormField
                  control={form.control}
                  name="options"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RepeatableRows
                          label="Options"
                          addLabel="+ Add option"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Placeholder — only for the text types */}
              {!isSelectType(fieldType) && (
                <FormField
                  control={form.control}
                  name="placeholder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placeholder (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. e.g. a gentle cream…"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="required"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Required</FormLabel>
                      <FormDescription>
                        Customers must answer before continuing.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                <Button type="submit" disabled={upsertQuestion.isPending}>
                  {upsertQuestion.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Empty: "No questions yet" + CTA ───────────────────────────────────────
  if (questions.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No questions yet</EmptyTitle>
            <EmptyDescription>
              Add a question so customers can tell you about their skin.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreate}>+ Add question</Button>
          </EmptyContent>
        </Empty>
        {renderQuestionFormDialog()}
      </section>
    );
  }

  // ── Per-row actions ───────────────────────────────────────────────────────
  function RowActions({ row }: { row: AdminQuestionRow }) {
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
              <TableHead>Question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-foreground">
                      {row.label}
                    </span>
                    {row.required && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  {row.help_text && (
                    <div className="text-sm text-muted-foreground">
                      {row.help_text}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {FIELD_TYPE_LABELS[row.field_type]}
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
        {questions.map((row) => (
          <li
            key={row.id}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-medium text-foreground">
                    {row.label}
                  </span>
                  {row.required && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {FIELD_TYPE_LABELS[row.field_type]} · order {row.sort_order}
                </div>
              </div>
              <RowActions row={row} />
            </div>
          </li>
        ))}
      </ul>

      {renderQuestionFormDialog()}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this question?"
        description="It will be removed from the Skin Guide form. Past answers stay saved on existing submissions. This can't be undone."
        confirmLabel="Delete question"
        onConfirm={confirmDelete}
      />
    </section>
  );
}
