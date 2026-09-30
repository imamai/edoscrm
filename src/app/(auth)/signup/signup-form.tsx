"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { signUp } from "./actions";
import { ONBOARDING_NOTE } from "@/lib/plans";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import type { ProviderId } from "@/lib/auth/providers";

export function SignupForm({ providers }: { providers: ProviderId[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const result = await signUp(form);

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    if (!result.confirmed) {
      setBusy(false);
      setConfirmSent(email);
      return;
    }

    // The workspace already exists by now where the project confirms nothing;
    // /new-workspace settles anyone it did not, then moves them on.
    router.push("/new-workspace");
    router.refresh();
  }

  if (confirmSent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft p-7 text-center">
        <MailCheck className="h-8 w-8 text-brand" />
        <h2 className="font-display text-lg font-bold text-brand-darker">
          Check your email
        </h2>
        <p className="text-sm leading-relaxed text-brand-darker/80">
          We sent a confirmation link to <strong>{confirmSent}</strong>. Open it
          and you will land straight in your new workspace.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SocialSignIn
        label="or fill this in"
        divider="below"
        enabled={providers}
        intent="signup"
      />
      <Field
        label="Organisation name"
        name="tenant_name"
        required
        autoFocus
        autoComplete="organization"
        placeholder="e.g. Acme Foods Ltd"
      />
      <p className="-mt-2 text-xs text-ink-faint">
        This names your workspace — you can change it later
      </p>

      <Field
        label="Your full name"
        name="full_name"
        required
        autoComplete="name"
      />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        minLength={8}
      />
      <p className="-mt-2 text-xs text-ink-faint">At least 8 characters</p>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" busy={busy} className="h-12 w-full text-base">
        {busy ? "Creating your workspace…" : "Create my workspace"}
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        {ONBOARDING_NOTE} Nothing is charged while you are trialling, and your
        records stay yours — isolated from every other organisation, and
        exportable at any time.
      </p>
    </form>
  );
}
