import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

import Layout from "@/components/Layout";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import { useAuth } from "@/auth/useAuth";
import {
  useMySubmissions,
  submissionSnippet,
  submissionPreview,
  submissionAnswers,
  type SubmissionRow,
} from "@/lib/submissions";
import {
  useMyProfileName,
  useUpdateName,
  useUpdateEmail,
  useUpdatePassword,
} from "@/lib/profile";

// ── Submission-history helpers (mirror admin Submissions.tsx, no admin chrome) ─

/** Name with email fallback — own rows may still be name-less. */
function displayName(row: SubmissionRow): string {
  return row.name?.trim() || row.email?.trim() || "Anonymous";
}

/** Human date for the list/detail; created_at is an ISO string. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "PP");
}

/** Read-only detail field row (same shape as the admin detail dialog). */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

// ── Account-management form schemas ───────────────────────────────────────────

const nameSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name."),
});
const emailSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});
const passwordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type NameValues = z.infer<typeof nameSchema>;
type EmailValues = z.infer<typeof emailSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

// ── Account management ────────────────────────────────────────────────────────

function AccountSection() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: currentName } = useMyProfileName(userId);

  const updateName = useUpdateName(userId);
  const updateEmail = useUpdateEmail(user?.email);
  const updatePassword = useUpdatePassword();

  // Track that an email change was submitted so we render the PENDING notice
  // (a "check your inbox" line, NOT a completion claim — D-14).
  const [emailPending, setEmailPending] = useState(false);

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  });
  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  // Seed the name field once the current profile name loads.
  useEffect(() => {
    if (currentName != null) nameForm.reset({ name: currentName });
  }, [currentName, nameForm]);

  // Seed the email field with the current login address.
  useEffect(() => {
    if (user?.email) emailForm.reset({ email: user.email });
  }, [user?.email, emailForm]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Display name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display name</CardTitle>
          <CardDescription>The name shown on your requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...nameForm}>
            <form
              onSubmit={nameForm.handleSubmit((v) => updateName.mutate(v))}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={nameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateName.isPending}>
                {updateName.isPending ? "Saving…" : "Save name"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email</CardTitle>
          <CardDescription>
            Changing your email needs confirmation from your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...emailForm}>
            <form
              onSubmit={emailForm.handleSubmit((v) => {
                updateEmail.mutate(v, {
                  // Only show the "check your inbox" notice when a change was
                  // actually started; an unchanged re-submit is a no-op (WR-05).
                  onSuccess: (result) =>
                    setEmailPending(result === "pending"),
                });
              })}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateEmail.isPending}>
                {updateEmail.isPending ? "Sending…" : "Update email"}
              </Button>
              {emailPending && (
                <p className="text-sm text-muted-foreground" role="status">
                  Check your inbox to confirm your new email. Your current email
                  stays active until you click the confirmation link.
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>
            Choose a new password. It takes effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit((v) =>
                updatePassword.mutate(
                  { password: v.password },
                  { onSuccess: () => passwordForm.reset() },
                ),
              )}
              className="grid gap-4 sm:grid-cols-2"
              noValidate
            >
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <Button type="submit" disabled={updatePassword.isPending}>
                  {updatePassword.isPending ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Submission history (own rows, owner-scoped by RLS) ────────────────────────

function HistorySection() {
  const { data, isLoading, isError, refetch } = useMySubmissions();
  const [selected, setSelected] = useState<SubmissionRow | null>(null);

  const submissions = (data ?? []) as SubmissionRow[];

  const heading = (
    <h2 className="font-serif text-xl text-primary">Your requests</h2>
  );

  if (isLoading) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-4">
        {heading}
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

  if (submissions.length === 0) {
    return (
      <section className="space-y-4">
        {heading}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No requests yet</EmptyTitle>
            <EmptyDescription>
              When you send a customization request, it&apos;ll show up here.
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/questionnaire">Start a request</Link>
          </Button>
        </Empty>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {heading}

      {/* Desktop / tablet: simple list rows */}
      <ul className="hidden divide-y divide-border rounded-md border md:block">
        {submissions.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setSelected(row)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {submissionSnippet(submissionPreview(row))}
              </span>
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(row.created_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Mobile: stacked bordered cards */}
      <ul className="space-y-3 md:hidden">
        {submissions.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setSelected(row)}
              className="w-full space-y-1 rounded-md border border-border p-4 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {submissionSnippet(submissionPreview(row))}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {/* Read-only detail — own request, no admin chrome (D-15) */}
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
                {submissionAnswers(selected).map((answer, i) => (
                  <Field
                    key={`${answer.label}-${i}`}
                    label={answer.label}
                    value={
                      <p className="whitespace-pre-wrap">
                        {answer.value.trim() || "—"}
                      </p>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function Profile() {
  return (
    <Layout>
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-2">
            <h1 className="font-serif text-2xl text-primary">Your account</h1>
            <div className="h-0.5 w-16 bg-secondary" />
          </header>

          <AccountSection />
          <HistorySection />
        </div>
      </section>
    </Layout>
  );
}
