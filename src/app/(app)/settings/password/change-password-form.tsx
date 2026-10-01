"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { changeOwnPassword, type ChangePasswordState } from "./actions";

const initial: ChangePasswordState = { error: null, ok: null };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initial);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  // Only once there is something in the second box to disagree with.
  const mismatch = confirm.length > 0 && confirm !== next;

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <PasswordField
        label="Current password"
        name="current_password"
        autoComplete="current-password"
        required
      />

      <PasswordField
        label="New password"
        name="password"
        required
        minLength={8}
        hint="At least 8 characters"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />

      <PasswordField
        label="Type the new password again"
        name="password_confirm"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? "These don't match yet." : null}
      />

      {state.error && <FieldError>{state.error}</FieldError>}
      {state.ok && (
        <p
          role="status"
          className="rounded-lg bg-good/10 px-3 py-2 text-sm text-good"
        >
          {state.ok}
        </p>
      )}

      <div>
        <Button
          type="submit"
          busy={pending}
          disabled={next.length < 8 || confirm !== next}
        >
          {pending ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
