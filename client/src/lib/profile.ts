// Self-service account-management layer for the customer Profile page (CUST-04).
//
// Three credential/profile mutations, mirroring the admin.ts mutation shape
// (mutationFn throws on Supabase error -> onError toast; onSuccess toast):
//
//   - useUpdateName     -> profiles.update({ name }) for the caller's own row.
//       The Phase-3 enforce_profile_role_lock BEFORE UPDATE trigger (migration
//       0004) blocks any `role` change regardless of client payload, so a
//       self-update of `name` is safe and allowed (T-05-16).
//   - useUpdateEmail    -> supabase.auth.updateUser({ email }). This is a
//       PENDING flow: "Secure email change" is ON in Supabase Auth, so the
//       login address does NOT change until the user clicks the emailed
//       confirmation link. The success toast therefore says "check your inbox",
//       NEVER "email changed" (D-14 / RESEARCH Pitfall 5 / T-05-17). The
//       confirmation redirect lands on a route the SPA already handles
//       base-aware, same as the Phase-3 reset-password flow.
//   - useUpdatePassword -> supabase.auth.updateUser({ password }). IMMEDIATE —
//       the new password is effective right away; the toast confirms success.
//
// Passwords/emails go straight to GoTrue over TLS via updateUser; no app-side
// crypto and nothing is stored/logged client-side (T-05-19, accepted).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabase";

// Verbatim from the UI-SPEC Profile copy contract.
const GENERIC_ERROR = "Couldn't save that change. Please try again.";

/**
 * Read the caller's own display name from `profiles`, scoped by the
 * owner-or-admin RLS to the current user. Used to seed the name form's default.
 * Returns null when the user has no name set yet.
 */
async function fetchMyProfileName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return (data?.name as string | null) ?? null;
}

export function useMyProfileName(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-profile-name", userId],
    queryFn: () => fetchMyProfileName(userId as string),
    enabled: !!userId,
  });
}

/**
 * Update the caller's own display name (profiles.name). The role-lock trigger
 * guarantees only `name` can change here even if the payload were tampered with.
 */
export function useUpdateName(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ name })
        .eq("id", userId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile-name"] });
      toast.success("Name updated.");
    },
    onError: () => toast.error(GENERIC_ERROR),
  });
}

/**
 * Result of an email-change attempt. `unchanged` means the submitted address
 * equalled the current one, so no GoTrue call was made (WR-05) — the caller
 * surfaces a "no change" affordance instead of the pending-confirmation notice.
 * `pending` means the change was started and the confirmation email was sent.
 */
export type EmailUpdateResult = "unchanged" | "pending";

/**
 * Begin an email change. PENDING by design (Secure email change ON): the toast
 * tells the user to confirm via their inbox — it MUST NOT claim the change is
 * complete, because the login address stays the same until the link is clicked.
 *
 * WR-05: skip firing `supabase.auth.updateUser({ email })` when the new email
 * equals the current one. The form is seeded with the current address, so an
 * unchanged re-submit would otherwise start a GoTrue email-change flow and burn
 * the rate-limited confirmation-email budget (config.toml email_sent = 2/hr).
 * The `currentEmail` is compared case-insensitively after trimming.
 */
export function useUpdateEmail(currentEmail: string | undefined) {
  return useMutation<EmailUpdateResult, unknown, { email: string }>({
    mutationFn: async ({ email }) => {
      const next = email.trim();
      const current = (currentEmail ?? "").trim();
      if (current && next.toLowerCase() === current.toLowerCase()) {
        return "unchanged";
      }
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      return "pending";
    },
    onSuccess: (result) => {
      if (result === "unchanged") {
        toast.info("That's already your email — nothing to change.");
        return;
      }
      toast.success("Check your inbox to confirm your new email.");
    },
    onError: () => toast.error(GENERIC_ERROR),
  });
}

/**
 * Change the password. IMMEDIATE — effective as soon as GoTrue accepts it.
 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Password updated."),
    onError: () => toast.error(GENERIC_ERROR),
  });
}
