"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSendEmail, sendEmail, signupConfirmEmail } from "@/lib/email";
import { ensureWorkspace } from "@/lib/provision";

export type SignUpResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; error: string };

/** The address this request arrived on, so the link comes back to the same place. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Creates the account, and emails the confirmation as EDOS CRM.
 *
 * `admin.generateLink` creates the user and hands back the confirmation token
 * without sending anything, which leaves the message to us — see
 * lib/email.ts for why that is worth the extra step.
 *
 * Where this deployment has no mail configured, it falls back to
 * `supabase.auth.signUp()` so sign-up still works; the person then gets
 * Supabase's own stock email, or lands straight in the app if the project
 * does not require confirmation at all.
 *
 * The workspace itself is not created here — `edoscrm_provision_tenant` runs
 * as the calling user and there is no session yet. The organisation name is
 * parked in auth metadata and becomes a real tenant at the first moment a
 * session exists; see lib/provision.ts.
 */
export async function signUp(formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const tenantName = String(formData.get("tenant_name") ?? "").trim();

  if (!tenantName || !fullName || !email || !password) {
    return { ok: false, error: "Please fill in every field." };
  }
  if (!email.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (password.length < 8) {
    return { ok: false, error: "Please use at least 8 characters for your password." };
  }

  const base = await origin();
  const metadata = { full_name: fullName, pending_tenant_name: tenantName };

  if (canSendEmail()) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, error: "Sign-up isn't set up yet on this deployment. Please contact support." };
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: metadata,
        redirectTo: `${base}/auth/callback?next=/new-workspace`,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      // Unlike a password reset, this one has to say so: the person is trying
      // to create an account and needs to know it already exists. Signing in
      // reveals the same thing anyway.
      if (message.includes("already") || message.includes("registered")) {
        return { ok: false, error: "There is already an account with that email. Try signing in instead." };
      }
      return { ok: false, error: "We couldn't create your account. Please try again." };
    }

    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) return { ok: false, error: "We couldn't create your account. Please try again." };

    const link = `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=signup&next=/new-workspace`;
    const sent = await sendEmail({
      to: email,
      ...signupConfirmEmail({ link, name: fullName || null }),
    });

    if (!sent.sent) {
      console.error("EDOS CRM signup confirmation email failed:", sent.reason);
      return {
        ok: false,
        error:
          "Your account was created but we couldn't send the confirmation email. Use “Forgot your password?” on the sign-in page to get in.",
      };
    }

    return { ok: true, confirmed: false };
  }

  // ---- no mail configured: Supabase sends whatever it is set up to send ----
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) return { ok: false, error: error.message };

  // A project with confirmation switched off hands back a session here, which
  // is the earliest the workspace can be created.
  if (data.session && data.user) await ensureWorkspace(supabase, data.user);

  return { ok: true, confirmed: Boolean(data.session) };
}
