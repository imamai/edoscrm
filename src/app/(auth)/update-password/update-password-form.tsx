"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { updatePassword, type UpdatePasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";

const initial: UpdatePasswordState = { error: null };

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  // The reset link carries this; an invitation link does not.
  const resetting = useSearchParams().get("type") === "recovery";

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        {resetting ? "Choose a new password" : "Set your password"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {resetting
          ? "Then you will be signed straight in."
          : "One password, and you are in — your workspace is already waiting."}
      </p>

      <form action={action} className="mt-7 flex flex-col gap-4">
        <Field
          label={resetting ? "New password" : "Password"}
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          minLength={8}
        />
        <p className="-mt-2 text-xs text-ink-faint">At least 8 characters</p>

        {state.error && <FieldError>{state.error}</FieldError>}

        <Button type="submit" busy={pending} className="h-12 w-full text-base">
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}
