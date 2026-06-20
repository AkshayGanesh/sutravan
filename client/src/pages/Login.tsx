import { useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { mapAuthError } from "@/lib/authErrors";
import { useToast } from "@/hooks/use-toast";
import TurnstileWidget, {
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Resolve a safe post-login destination from an untrusted `?next=` value
 * (open-redirect mitigation, RESEARCH Pitfall 6 / T-3-10, D-10).
 *
 * Only internal, leading-slash paths are allowed. Anything containing a scheme
 * (`://`) or starting with `//` (protocol-relative) is rejected to `/`.
 * Plan 04's guard writes the `?next=` value Login reads here.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("://")) return "/";
  return raw;
}

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
      // Submit is gated on a non-null token; ?? undefined satisfies the
      // supabase-js `captchaToken?: string` type.
      options: { captchaToken: captchaToken ?? undefined },
    });

    if (error) {
      // mapAuthError collapses invalid-credentials / email-not-found into one
      // generic message (anti-enumeration, D-14 / T-3-06). Reset the widget so
      // the single-use token is refreshed before the next attempt.
      setFormError(mapAuthError(error));
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    toast({ title: "Signed in" });

    // Session persistence across refresh/restart is automatic via supabase-js
    // persistSession/autoRefreshToken defaults (AUTH-02 / D-13) — no extra code.
    const next = new URLSearchParams(search).get("next");
    navigate(safeReturnTo(next));
  }

  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            Welcome Back
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-xl mx-auto">
            Log in to your Sutravan account.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl text-primary">
              Log in
            </CardTitle>
            <CardDescription>
              New to Sutravan?{" "}
              <Link href="/register" className="text-secondary hover:underline">
                Create an account
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="/reset-password"
                          className="text-[0.8rem] text-secondary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="Your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <TurnstileWidget
                  ref={turnstileRef}
                  onToken={setCaptchaToken}
                />

                {formError && (
                  <p
                    role="alert"
                    className="text-[0.8rem] font-medium text-destructive"
                  >
                    {formError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting || !captchaToken}
                >
                  {form.formState.isSubmitting ? "Signing in…" : "Log in"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
