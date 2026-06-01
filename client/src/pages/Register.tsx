import { useState } from "react";
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

// Password minimum mirrors the Supabase default (D-07).
const registerSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    // name flows to new.raw_user_meta_data->>'name', consumed by the Plan 01
    // handle_new_user trigger which provisions the customer profile row (D-06).
    // role is NEVER passed in metadata — it is server-assigned.
    const { name, email, password } = values;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      // Let signUp surface the error; map it — no pre-flight email-exists check.
      setFormError(mapAuthError(error));
      return;
    }

    // Confirm-email is OFF, so data.session is non-null and the user is logged
    // in immediately (D-01).
    toast({
      title: "Account created",
      description: "You're signed in.",
    });

    // Account creation always lands on home; return-to is a login concern.
    void data;
    navigate("/");
  }

  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            Create Account
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-xl mx-auto">
            Join Sutravan to save your preferences and request custom
            formulations.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl text-primary">
              Sign up
            </CardTitle>
            <CardDescription>
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-secondary hover:underline"
              >
                Log in
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="name"
                          placeholder="Your name"
                          {...field}
                        />
                      </FormControl>
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
                      <FormLabel>Password</FormLabel>
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
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting
                    ? "Creating account…"
                    : "Create account"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
