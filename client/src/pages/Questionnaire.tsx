import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import Layout from "@/components/Layout";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/auth/useAuth";
import { supabase } from "@/lib/supabase";
import {
  useQuestionnaireQuestions,
  buildQuestionnaireSchema,
  buildDefaultValues,
  toSubmission,
  submitQuestionnaire,
  type QuestionnaireQuestion,
  type QuestionnaireValues,
} from "@/lib/questionnaire";
import { loadTurnstile } from "@/lib/turnstile";
import { CUSTOMIZATION_PRICING_CAVEAT } from "@/lib/copy";

// Wizard steps (auto-grouped): 0 = fixed "About you" (name/email), 1 = all
// configurable questions, 2 = review + submit, 3 = thank-you finale. The
// owner manages the QUESTIONS, not the step grouping.
const ABOUT_STEP = 0;
const QUESTIONS_STEP = 1;
const REVIEW_STEP = 2;
const THANKYOU_STEP = 3;
const TOTAL_INPUT_STEPS = 3; // shown in "Step n of total" (About / Questions / Review)

/** Branded intro section — shared by the loading/empty/form states. */
function Intro() {
  return (
    <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 text-center bg-card">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
          Customize your blend
        </h1>
        <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
        <p className="text-foreground/70 max-w-xl mx-auto">
          Tell us about your skin and what you're looking for — we craft each
          batch by hand to suit you.
        </p>
        <p className="text-xs text-foreground/50 mt-3 max-w-xl mx-auto">
          {CUSTOMIZATION_PRICING_CAVEAT}
        </p>
      </div>
    </section>
  );
}

export default function Questionnaire() {
  const { data, isLoading, isError, refetch } = useQuestionnaireQuestions();

  return (
    <Layout>
      <Intro />
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-foreground">
              Couldn&apos;t load the questionnaire. Check your connection and
              try again.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>The skin guide is being updated</EmptyTitle>
              <EmptyDescription>
                Please check back shortly — or reach out and we'll help you
                directly.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          // Mount the form ONLY once questions are loaded so the Zod schema +
          // defaults are built once from a stable question set (no dynamic
          // resolver churn). `key` re-inits if the set changes mid-session.
          <QuestionnaireForm key={data.length} questions={data} />
        )}
      </section>
    </Layout>
  );
}

function QuestionnaireForm({ questions }: { questions: QuestionnaireQuestion[] }) {
  const { session, user } = useAuth();
  const isLoggedIn = !!session;

  const [step, setStep] = useState(ABOUT_STEP);
  const [submitting, setSubmitting] = useState(false);
  const turnstileToken = useRef<string | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const form = useForm<QuestionnaireValues>({
    resolver: zodResolver(buildQuestionnaireSchema(questions)),
    defaultValues: buildDefaultValues(
      questions,
      isLoggedIn ? (user?.email ?? "") : "",
    ),
  });

  // Prefill + lock name/email for logged-in users. Email comes straight from
  // the account; the display name is read from the profile, falling back to the
  // email if no name is set. Anon users type these themselves.
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    let active = true;
    form.setValue("email", user.email ?? "");
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!active) return;
        const name = (data?.name as string | null) || user.email || "";
        form.setValue("name", name);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.id]);

  // Lazy-load Turnstile and render the widget when the review step mounts. The
  // token is captured via the callback; the widget is reset after a failed
  // submit (tokens are single-use / 300s).
  useEffect(() => {
    if (step !== REVIEW_STEP) return;
    let active = true;
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
      | string
      | undefined;
    loadTurnstile()
      .then(() => {
        if (!active || !window.turnstile || !sitekey) return;
        const container = document.getElementById("cf-turnstile-widget");
        if (!container) return;
        container.innerHTML = "";
        turnstileWidgetId.current = window.turnstile.render(container, {
          sitekey,
          callback: (token: string) => {
            turnstileToken.current = token;
          },
          "expired-callback": () => {
            turnstileToken.current = null;
          },
          "error-callback": () => {
            turnstileToken.current = null;
          },
        });
      })
      .catch(() => {
        if (active) {
          toast.error(
            "We couldn't verify you're human. Please complete the check and try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [step]);

  function resetTurnstile() {
    turnstileToken.current = null;
    if (window.turnstile && turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current);
    }
  }

  // Per-step field groups: step 0 validates the fixed contact fields; the
  // questions step validates every configurable field (keyed by question id).
  const stepFields: Record<number, string[]> = {
    [ABOUT_STEP]: ["name", "email"],
    [QUESTIONS_STEP]: questions.map((q) => q.id),
  };

  // Advance only when the current step's fields validate.
  async function next() {
    const fields = stepFields[step];
    const ok = fields
      ? await form.trigger(fields as Parameters<typeof form.trigger>[0])
      : true;
    if (ok) setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSubmit() {
    const token = turnstileToken.current;
    if (!token) {
      toast.error(
        "We couldn't verify you're human. Please complete the check and try again.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const submission = toSubmission(
        form.getValues(),
        questions,
        isLoggedIn && user ? user.id : null,
      );
      await submitQuestionnaire(token, submission);
      setStep(THANKYOU_STEP);
    } catch {
      toast.error(
        "Couldn't send your request. Please check your connection and try again.",
      );
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  const values = form.getValues();
  const stepTitle =
    step === ABOUT_STEP
      ? "About you"
      : step === QUESTIONS_STEP
        ? "Tell us about your skin"
        : "Review & send";

  if (step === THANKYOU_STEP) {
    return (
      <div className="text-center space-y-6 py-8">
        <h2 className="font-serif text-4xl text-primary">
          Thank you — your request is in.
        </h2>
        <p className="text-foreground/70 max-w-md mx-auto">
          We'll review your customization request and get back to you by email.
        </p>
        {isLoggedIn ? (
          <Button asChild>
            <Link href="/profile">View my requests</Link>
          </Button>
        ) : (
          <p className="text-sm text-foreground/60">
            <Link href="/register" className="text-secondary hover:underline">
              Create an account to track this request and save your favourites.
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
        Step {step + 1} of {TOTAL_INPUT_STEPS}
      </p>
      <h2 className="font-serif text-2xl text-primary mb-6">{stepTitle}</h2>

      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-6"
          noValidate
        >
          {/* Step 0 — About you (fixed contact fields) */}
          {step === ABOUT_STEP && (
            <>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        readOnly={isLoggedIn}
                        disabled={isLoggedIn}
                        autoComplete="name"
                        {...field}
                        value={field.value as string}
                      />
                    </FormControl>
                    {isLoggedIn && (
                      <FormDescription>
                        Using your account details
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        readOnly={isLoggedIn}
                        disabled={isLoggedIn}
                        autoComplete="email"
                        {...field}
                        value={field.value as string}
                      />
                    </FormControl>
                    {isLoggedIn && (
                      <FormDescription>
                        Using your account details
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Step 1 — configurable questions */}
          {step === QUESTIONS_STEP && (
            <>
              {questions.map((q) => (
                <QuestionField key={q.id} question={q} form={form} />
              ))}
            </>
          )}

          {/* Step 2 — Review & send */}
          {step === REVIEW_STEP && (
            <div className="space-y-4">
              <dl className="space-y-3 text-sm">
                <ReviewRow label="Name" value={String(values.name || "—")} />
                <ReviewRow label="Email" value={String(values.email || "—")} />
                {questions.map((q) => (
                  <ReviewRow
                    key={q.id}
                    label={q.label}
                    value={formatAnswer(values[q.id])}
                  />
                ))}
              </dl>

              <p className="text-xs text-foreground/50">
                {CUSTOMIZATION_PRICING_CAVEAT}
              </p>

              {/* Turnstile widget — discreet block above the final CTA */}
              <div className="pt-2">
                <div id="cf-turnstile-widget" />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            {step > ABOUT_STEP ? (
              <Button type="button" variant="ghost" onClick={back}>
                Back
              </Button>
            ) : (
              <span />
            )}

            {step < REVIEW_STEP ? (
              <Button type="button" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Sending…" : "Send my request"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </>
  );
}

/** Render one configurable question by its field_type, reusing the brand markup. */
function QuestionField({
  question,
  form,
}: {
  question: QuestionnaireQuestion;
  form: ReturnType<typeof useForm<QuestionnaireValues>>;
}) {
  return (
    <FormField
      control={form.control}
      name={question.id}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{question.label}</FormLabel>
          {question.help_text && (
            <FormDescription>{question.help_text}</FormDescription>
          )}
          <FormControl>
            {question.field_type === "single_select" ? (
              <RadioGroup
                value={(field.value as string) ?? ""}
                onValueChange={field.onChange}
                className="grid grid-cols-2 gap-3"
              >
                {question.options.map((opt) => (
                  <Label
                    key={opt}
                    className="flex items-center gap-2 border border-border/60 p-3 cursor-pointer font-normal hover:bg-card/60"
                  >
                    <RadioGroupItem value={opt} />
                    {opt}
                  </Label>
                ))}
              </RadioGroup>
            ) : question.field_type === "multi_select" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {question.options.map((opt) => {
                  const current = (field.value as string[]) ?? [];
                  const checked = current.includes(opt);
                  return (
                    <Label
                      key={opt}
                      className="flex items-center gap-2 border border-border/60 p-3 cursor-pointer font-normal hover:bg-card/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(isChecked) =>
                          field.onChange(
                            isChecked
                              ? [...current, opt]
                              : current.filter((c) => c !== opt),
                          )
                        }
                      />
                      {opt}
                    </Label>
                  );
                })}
              </div>
            ) : question.field_type === "long_text" ? (
              <Textarea
                rows={4}
                placeholder={question.placeholder ?? ""}
                {...field}
                value={(field.value as string) ?? ""}
              />
            ) : (
              <Input
                placeholder={question.placeholder ?? ""}
                {...field}
                value={(field.value as string) ?? ""}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Human-readable answer for the review step (arrays join; empty -> em dash). */
function formatAnswer(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return value && value.trim() ? value : "—";
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/40 pb-2">
      <dt className="text-xs uppercase tracking-wide text-foreground/50">
        {label}
      </dt>
      <dd className="font-medium text-foreground/90 break-words whitespace-pre-line">
        {value}
      </dd>
    </div>
  );
}
