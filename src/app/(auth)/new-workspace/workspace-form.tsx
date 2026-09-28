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

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" busy={busy} className="h-12 w-full text-base">
        {busy ? "Creating your workspace…" : "Create my workspace"}
      </Button>
    </form>
  );
}
