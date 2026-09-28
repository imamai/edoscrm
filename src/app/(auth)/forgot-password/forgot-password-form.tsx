"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { requestPasswordReset, type ResetState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";

const initial: ResetState = { error: null };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft p-7 text-center">
        <MailCheck className="h-8 w-8 text-brand" />
        <h2 className="font-display text-lg font-bold text-brand-darker">Check your email</h2>
        <p className="text-sm leading-relaxed text-brand-darker/80">
          If that address has an EDOS CRM account, a link to choose a new password
          is on its way. It works once, and expires shortly.
        </p>
        <Link href="/login" className="mt-1 text-sm font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" required autoFocus autoComplete="email" />

      {state.error && <FieldError>{state.error}</FieldError>}

      <Button type="submit" busy={pending} className="h-12 w-full text-base">
        {pending ? "Sending…" : "Email me a link"}
      </Button>

      <Link
        href="/login"
        className="text-center text-sm text-ink-soft hover:text-brand hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}
