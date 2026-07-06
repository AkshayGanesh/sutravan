// Site-content editor (ADMIN-05/06, D-18/D-19). The owner edits hero copy, the
// Our Story body (rich text), the contact email and the social URLs here; saving
// upserts all seven site_content keys and invalidates ['siteContent'] so the
// public Navbar/Footer/Contact/ProductDetail/Shop/Hero/Our Story reflect the
// change live, with no redeploy (D-20 single source of truth).
import { Suspense, lazy, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { useSaveSiteContent } from "@/lib/admin";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";

// TipTap is heavy and admin-only — load it lazily so it code-splits into the
// admin chunk and never enters the public bundle (RESEARCH Pitfall 5).
const RichTextEditor = lazy(
  () => import("@/components/admin/RichTextEditor"),
);

const contentSchema = z.object({
  hero_title: z.string().trim().min(1, "Enter a hero title."),
  hero_subtitle: z.string().trim().min(1, "Enter a hero subtitle."),
  hero_cta: z.string().trim().min(1, "Enter the call-to-action label."),
  our_story_body: z.string(),
  email: z.string().trim().email("Enter a valid email address."),
  instagram_url: z
    .string()
    .trim()
    .url("Enter a valid web address (starting with https://)"),
  youtube_url: z
    .string()
    .trim()
    .url("Enter a valid web address (starting with https://)"),
  questionnaire_title: z.string().trim().min(1, "Enter the Skin Guide heading."),
  questionnaire_subtitle: z
    .string()
    .trim()
    .min(1, "Enter the Skin Guide subtext."),
  questionnaire_caveat: z
    .string()
    .trim()
    .min(1, "Enter the pricing caveat shown under the Skin Guide."),
  questionnaire_thankyou_title: z
    .string()
    .trim()
    .min(1, "Enter the thank-you heading."),
  questionnaire_thankyou_body: z
    .string()
    .trim()
    .min(1, "Enter the thank-you message."),
});

type ContentValues = z.infer<typeof contentSchema>;

// Pull the current live value for a key, falling back to the code default so the
// editor is never prefilled blank (D-20).
function valueFor(
  data: Record<string, string> | undefined,
  key: keyof ContentValues,
): string {
  return data?.[key] ?? SITE_CONTENT_DEFAULTS[key] ?? "";
}

export default function SiteContent() {
  const { data, isLoading } = useSiteContent();
  const save = useSaveSiteContent();

  const form = useForm<ContentValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      hero_title: SITE_CONTENT_DEFAULTS.hero_title,
      hero_subtitle: SITE_CONTENT_DEFAULTS.hero_subtitle,
      hero_cta: SITE_CONTENT_DEFAULTS.hero_cta,
      our_story_body: SITE_CONTENT_DEFAULTS.our_story_body,
      email: SITE_CONTENT_DEFAULTS.email,
      instagram_url: SITE_CONTENT_DEFAULTS.instagram_url,
      youtube_url: SITE_CONTENT_DEFAULTS.youtube_url,
      questionnaire_title: SITE_CONTENT_DEFAULTS.questionnaire_title,
      questionnaire_subtitle: SITE_CONTENT_DEFAULTS.questionnaire_subtitle,
      questionnaire_caveat: SITE_CONTENT_DEFAULTS.questionnaire_caveat,
      questionnaire_thankyou_title:
        SITE_CONTENT_DEFAULTS.questionnaire_thankyou_title,
      questionnaire_thankyou_body:
        SITE_CONTENT_DEFAULTS.questionnaire_thankyou_body,
    },
  });

  const { reset } = form;

  // Re-seed the form with live values once the query resolves (prefill).
  useEffect(() => {
    if (isLoading) return;
    reset({
      hero_title: valueFor(data, "hero_title"),
      hero_subtitle: valueFor(data, "hero_subtitle"),
      hero_cta: valueFor(data, "hero_cta"),
      our_story_body: valueFor(data, "our_story_body"),
      email: valueFor(data, "email"),
      instagram_url: valueFor(data, "instagram_url"),
      youtube_url: valueFor(data, "youtube_url"),
      questionnaire_title: valueFor(data, "questionnaire_title"),
      questionnaire_subtitle: valueFor(data, "questionnaire_subtitle"),
      questionnaire_caveat: valueFor(data, "questionnaire_caveat"),
      questionnaire_thankyou_title: valueFor(data, "questionnaire_thankyou_title"),
      questionnaire_thankyou_body: valueFor(data, "questionnaire_thankyou_body"),
    });
  }, [data, isLoading, reset]);

  function onSubmit(values: ContentValues) {
    save.mutate({
      hero_title: values.hero_title,
      hero_subtitle: values.hero_subtitle,
      hero_cta: values.hero_cta,
      our_story_body: values.our_story_body,
      email: values.email,
      instagram_url: values.instagram_url,
      youtube_url: values.youtube_url,
      questionnaire_title: values.questionnaire_title,
      questionnaire_subtitle: values.questionnaire_subtitle,
      questionnaire_caveat: values.questionnaire_caveat,
      questionnaire_thankyou_title: values.questionnaire_thankyou_title,
      questionnaire_thankyou_body: values.questionnaire_thankyou_body,
    });
  }

  const { errors } = form.formState;

  if (isLoading) {
    return (
      <section className="flex items-center justify-center py-24">
        <Spinner className="size-6" />
      </section>
    );
  }

  return (
    <section className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Site content</h1>
        <p className="text-muted-foreground">
          Edit the homepage hero, Our Story, contact email, social links and the
          Skin Guide copy. Changes go live across the site immediately — no
          redeploy.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Hero */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground/80">
            Homepage hero
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="hero_title">Hero title</Label>
            <Input id="hero_title" {...form.register("hero_title")} />
            {errors.hero_title && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.hero_title.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hero_subtitle">Hero subtitle</Label>
            <Textarea id="hero_subtitle" rows={3} {...form.register("hero_subtitle")} />
            {errors.hero_subtitle && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.hero_subtitle.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hero_cta">Call-to-action label</Label>
            <Input id="hero_cta" {...form.register("hero_cta")} />
            {errors.hero_cta && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.hero_cta.message}
              </p>
            )}
          </div>
        </fieldset>

        {/* Our Story rich text */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground/80">
            Our Story
          </legend>
          <Controller
            control={form.control}
            name="our_story_body"
            render={({ field }) => (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center rounded-md border border-input py-12">
                    <Spinner className="size-5" />
                  </div>
                }
              >
                <RichTextEditor value={field.value} onChange={field.onChange} />
              </Suspense>
            )}
          />
        </fieldset>

        {/* Contact + social */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground/80">
            Contact &amp; social
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="email">Contact email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {errors.email && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instagram_url">Instagram URL</Label>
            <Input
              id="instagram_url"
              type="url"
              {...form.register("instagram_url")}
            />
            {errors.instagram_url && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.instagram_url.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="youtube_url">YouTube URL</Label>
            <Input id="youtube_url" type="url" {...form.register("youtube_url")} />
            {errors.youtube_url && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.youtube_url.message}
              </p>
            )}
          </div>
        </fieldset>

        {/* Skin Guide (/questionnaire) framing + thank-you copy */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground/80">
            Skin Guide
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="questionnaire_title">Intro heading</Label>
            <Input
              id="questionnaire_title"
              {...form.register("questionnaire_title")}
            />
            {errors.questionnaire_title && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.questionnaire_title.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="questionnaire_subtitle">Intro subtext</Label>
            <Textarea
              id="questionnaire_subtitle"
              rows={3}
              {...form.register("questionnaire_subtitle")}
            />
            {errors.questionnaire_subtitle && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.questionnaire_subtitle.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="questionnaire_caveat">Pricing caveat</Label>
            <Textarea
              id="questionnaire_caveat"
              rows={3}
              {...form.register("questionnaire_caveat")}
            />
            {errors.questionnaire_caveat && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.questionnaire_caveat.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="questionnaire_thankyou_title">
              Thank-you heading
            </Label>
            <Input
              id="questionnaire_thankyou_title"
              {...form.register("questionnaire_thankyou_title")}
            />
            {errors.questionnaire_thankyou_title && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.questionnaire_thankyou_title.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="questionnaire_thankyou_body">
              Thank-you message
            </Label>
            <Textarea
              id="questionnaire_thankyou_body"
              rows={3}
              {...form.register("questionnaire_thankyou_body")}
            />
            {errors.questionnaire_thankyou_body && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.questionnaire_thankyou_body.message}
              </p>
            )}
          </div>
        </fieldset>

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? (
            <>
              <Spinner className="size-4" />
              Saving…
            </>
          ) : (
            "Save content"
          )}
        </Button>
      </form>
    </section>
  );
}
