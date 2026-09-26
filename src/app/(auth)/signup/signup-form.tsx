"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { signUp } from "./actions";

export function SignupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signUp(new FormData(event.currentTarget));

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    if (!result.confirmed) {
      setBusy(false);
      setCheckEmail(true);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <p className="text-center text-sm text-ink-faint">
        Check your email for a confirmation link, then{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          sign in
        </Link>{" "}
        to set up your workspace.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Full name" name="full_name" required autoFocus autoComplete="name" />
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field label="Password" name="password" type="password" required autoComplete="new-password" minLength={8} />

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" busy={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-faint">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
