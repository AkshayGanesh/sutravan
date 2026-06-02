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
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { useAuth } from "@/auth/useAuth";
import { supabase } from "@/lib/supabase";
import {
  questionnaireSchema,
  toSubmission,
  submitQuestionnaire,
  STEP_FIELDS,
  type QuestionnaireValues,
} from "@/lib/questionnaire";
import { loadTurnstile } from "@/lib/turnstile";
import { CUSTOMIZATION_PRICING_CAVEAT } from "@/lib/copy";

// ── Static field option sets (D-04: designed fresh, brand-styled) ────────────
const SKIN_TYPES = [
  { value: "normal", label: "Normal" },
  { value: "dry", label: "Dry" },
  { value: "oily", label: "Oily" },
  { value: "combination", label: "Combination" },
  { value: "sensitive", label: "Sensitive" },
];

const CONCERN_OPTIONS = [
  "Acne / breakouts",
  "Dryness",
  "Dullness",
  "Pigmentation",
  "Ageing / fine lines",
  "Sensitivity / redness",
];

// Wizard steps: 0..2 collect input (per STEP_FIELDS), 3 is review + submit,
// 4 is the thank-you finale (D-06 / D-07).
const STEP_TITLES = [
  "About you",
  "Your skin",
  "What you're looking for",
  "Review & send",
];
const TOTAL_INPUT_STEPS = STEP_TITLES.length; // 4 (steps shown in "Step n of total")
const REVIEW_STEP = 3;
const THANKYOU_STEP = 4;

export default function Questionnaire() {
  const { session, user } = useAuth();
  const isLoggedIn = !!session;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const turnstileToken = useRef<string | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const form = useForm<QuestionnaireValues>({
    resolver: zodResolver(questionnaireSchema),
    defaultValues: {
      name: "",
      email: isLoggedIn ? (user?.email ?? "") : "",
      skinType: "",
      concerns: [],
      productInterest: "",
      allergies: "",
      message: "",
    },
  });

  // Prefill + lock name/email for logged-in users (D-08). Email comes straight
  // from the account; the display name is read from the profile, falling back
  // to the email if no name is set. Anon users type these themselves (D-02).
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

  // Lazy-load the Turnstile script and render the widget when the review step
  // mounts (bundle discipline, D-03). The token is captured via the callback;
  // the widget is reset after a failed submit (tokens are single-use / 300s).
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

  // Advance only when the current step's fields validate (D-06).
  async function next() {
    const fields = STEP_FIELDS[step];
    const ok = fields ? await form.trigger(fields) : true;
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

  return (
    <Layout>
      {/* Branded intro — the serif Display heading is the route's focal point */}
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

      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        {step === THANKYOU_STEP ? (
          <div className="text-center space-y-6 py-8">
            <h2 className="font-serif text-4xl text-primary">
              Thank you — your request is in.
            </h2>
            <p className="text-foreground/70 max-w-md mx-auto">
              We'll review your customization request and get back to you by
              email.
            </p>
            {isLoggedIn ? (
              <Button asChild>
                <Link href="/profile">View my requests</Link>
              </Button>
            ) : (
              <p className="text-sm text-foreground/60">
                <Link
                  href="/register"
                  className="text-secondary hover:underline"
                >
                  Create an account to track this request and save your
                  favourites.
                </Link>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Step counter eyebrow */}
            <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
              Step {step + 1} of {TOTAL_INPUT_STEPS}
            </p>
            <h2 className="font-serif text-2xl text-primary mb-6">
              {STEP_TITLES[step]}
            </h2>

            <Form {...form}>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-6"
                noValidate
              >
                {/* Step 0 — About you */}
                {step === 0 && (
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

                {/* Step 1 — Your skin */}
                {step === 1 && (
                  <>
                    <FormField
                      control={form.control}
                      name="skinType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Skin type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="grid grid-cols-2 gap-3"
                            >
                              {SKIN_TYPES.map((opt) => (
                                <Label
                                  key={opt.value}
                                  className="flex items-center gap-2 border border-border/60 p-3 cursor-pointer font-normal hover:bg-card/60"
                                >
                                  <RadioGroupItem value={opt.value} />
                                  {opt.label}
                                </Label>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="concerns"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Skin concerns</FormLabel>
                          <FormDescription>
                            Choose any that apply.
                          </FormDescription>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {CONCERN_OPTIONS.map((concern) => {
                              const checked = field.value?.includes(concern);
                              return (
                                <Label
                                  key={concern}
                                  className="flex items-center gap-2 border border-border/60 p-3 cursor-pointer font-normal hover:bg-card/60"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(isChecked) => {
                                      const curr = field.value ?? [];
                                      field.onChange(
                                        isChecked
                                          ? [...curr, concern]
                                          : curr.filter((c) => c !== concern),
                                      );
                                    }}
                                  />
                                  {concern}
                                </Label>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Step 2 — What you're looking for */}
                {step === 2 && (
                  <>
                    <FormField
                      control={form.control}
                      name="productInterest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What are you looking for?</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. a gentle cream, a clarifying soap…"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Allergies or ingredients to avoid
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. nuts, fragrance…"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anything else? (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder="Tell us anything else that would help us craft your blend."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Step 3 — Review & send */}
                {step === REVIEW_STEP && (
                  <div className="space-y-4">
                    <dl className="space-y-3 text-sm">
                      <ReviewRow label="Name" value={values.name} />
                      <ReviewRow label="Email" value={values.email} />
                      <ReviewRow label="Skin type" value={values.skinType} />
                      <ReviewRow
                        label="Concerns"
                        value={
                          values.concerns?.length
                            ? values.concerns.join(", ")
                            : "—"
                        }
                      />
                      <ReviewRow
                        label="Looking for"
                        value={values.productInterest || "—"}
                      />
                      <ReviewRow
                        label="Allergies / avoid"
                        value={values.allergies || "—"}
                      />
                      <ReviewRow
                        label="Message"
                        value={values.message || "—"}
                      />
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
                  {step > 0 ? (
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
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Sending…" : "Send my request"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </>
        )}
      </section>
    </Layout>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/40 pb-2">
      <dt className="text-xs uppercase tracking-wide text-foreground/50">
        {label}
      </dt>
      <dd className="font-medium text-foreground/90 break-words">{value}</dd>
    </div>
  );
}
