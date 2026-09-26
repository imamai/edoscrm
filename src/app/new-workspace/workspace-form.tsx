"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { createWorkspace } from "./actions";

export function WorkspaceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await createWorkspace(new FormData(event.currentTarget));

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Workspace name" name="name" required autoFocus placeholder="Acme Foods Ltd" />
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit" busy={busy}>
        {busy ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
