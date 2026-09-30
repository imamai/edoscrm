"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { signIn } from "./actions";

export function LoginForm({
  /** Arrived from the confirmation link, which deliberately does not sign anyone in. */
  confirmed = false,
  /** /auth/callback sends people back here when a link is spent or expired. */
  linkExpired = false,
}: {
  confirmed?: boolean;
  linkExpired?: boolean;
} = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(new FormData(event.currentTarget));

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    // /dashboard rather than "/", which is the public landing page now. The
    // app layout redirects anyone without a workspace on to /new-workspace.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      {confirmed && !error && (
        <p
          role="status"
          className="rounded-lg border border-good/30 bg-good/10 px-3 py-2.5 text-sm text-good"
        >
          Your email is confirmed. Sign in with the password you chose when you
          signed up.
        </p>
      )}

      {linkExpired && !error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          That link has expired or has already been used. Ask for a new one
          below.
        </p>
      )}

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" busy={busy} className="h-12 w-full text-base">
        {busy ? "Signing in…" : "Sign in"}
      </Button>

      <Link
        href="/forgot-password"
        className="text-center text-sm text-ink-soft hover:text-brand hover:underline"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
