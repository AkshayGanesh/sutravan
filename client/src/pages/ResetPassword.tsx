import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
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

const requestSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});
type RequestValues = z.infer<typeof requestSchema>;

const newPasswordSchema = z
  .object({
    // D-07: 6-char minimum, matching the rest of the auth surface.
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirm: z.string().min(6, "Password must be at least 6 characters."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });
type NewPasswordValues = z.infer<typeof newPasswordSchema>;

/**
 * Build the base-aware redirect target for the reset email link.
 *
 * Must resolve to an EXACT entry on the hosted Supabase Redirect allowlist
 * (Plan 01 set `https://sutravan.in/reset-password`). Supabase only redirects
 * to exactly-allowlisted URLs (RESEARCH Pitfall 1 / T-3-04). Built from the
 * same `BASE_URL` mechanism App.tsx uses for the Wouter `base` prop so local
 * dev and the production custom domain both resolve correctly.
 */
function buildResetRedirect(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return new URL(`${base}/reset-password`, window.location.origin).toString();
}

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const newPasswordForm = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  // RECOVERY MODE: when the emailed link returns to /reset-password, supabase-js
  // auto-parses the `#access_token=...&type=recovery` hash (default
  // detectSessionInUrl) and fires PASSWORD_RECOVERY. Switch to the
  // set-new-password form. Subscription cleaned up on unmount.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function onRequest(values: RequestValues) {
    setRequestError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: buildResetRedirect(),
    });

    if (error) {
      // Map errors (incl. the 2/hr rate-limit message — Pitfall 5) to friendly
      // copy. Note: even on success we show a non-committal message below.
      setRequestError(mapAuthError(error));
      return;
    }

    // Anti-enumeration (D-14): never confirm whether the email is registered.
    toast({
      title: "Check your email",
      description: "If an account exists, a reset link has been sent.",
    });
    requestForm.reset();
  }

  async function onSetNewPassword(values: NewPasswordValues) {
    setUpdateError(null);
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setUpdateError(mapAuthError(error));
      return;
    }

    // Strip the recovery token from the URL/history so it does not linger
    // (Security Domain / T-3-14). Keep the path so a refresh stays on-page.
    window.history.replaceState(null, "", window.location.pathname);

    toast({
      title: "Password updated",
      description: "You can now log in with your new password.",
    });
    navigate("/login");
  }

  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            {recoveryMode ? "Set a New Password" : "Reset Your Password"}
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-xl mx-auto">
            {recoveryMode
              ? "Choose a new password for your Sutravan account."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto">
        <Card>
          {recoveryMode ? (
            <>
              <CardHeader>
                <CardTitle className="font-serif text-2xl text-primary">
                  New password
                </CardTitle>
                <CardDescription>
                  Enter your new password below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...newPasswordForm}>
                  <form
                    onSubmit={newPasswordForm.handleSubmit(onSetNewPassword)}
                    className="space-y-5"
                    noValidate
                  >
                    <FormField
                      control={newPasswordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="new-password"
                              placeholder="At least 6 characters"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newPasswordForm.control}
                      name="confirm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="new-password"
                              placeholder="Re-enter your new password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {updateError && (
                      <p
                        role="alert"
                        className="text-[0.8rem] font-medium text-destructive"
                      >
                        {updateError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={newPasswordForm.formState.isSubmitting}
                    >
                      {newPasswordForm.formState.isSubmitting
                        ? "Updating…"
                        : "Update password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="font-serif text-2xl text-primary">
                  Forgot your password?
                </CardTitle>
                <CardDescription>
                  Remembered it?{" "}
                  <Link
                    href="/login"
                    className="text-secondary hover:underline"
                  >
                    Back to log in
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...requestForm}>
                  <form
                    onSubmit={requestForm.handleSubmit(onRequest)}
                    className="space-y-5"
                    noValidate
                  >
                    <FormField
                      control={requestForm.control}
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

                    {requestError && (
                      <p
                        role="alert"
                        className="text-[0.8rem] font-medium text-destructive"
                      >
                        {requestError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={requestForm.formState.isSubmitting}
                    >
                      {requestForm.formState.isSubmitting
                        ? "Sending…"
                        : "Send reset link"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}
        </Card>
      </section>
    </Layout>
  );
}
