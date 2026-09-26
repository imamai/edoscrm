"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, SelectField, TextareaField } from "@/components/ui/field";
import { createComplaint } from "./actions";

export function ComplaintForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await createComplaint(new FormData(event.currentTarget));

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    router.push(`/complaints/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label="Title" name="title" required autoFocus placeholder="What happened, in a few words" />
      <TextareaField
        label="Description"
        name="description"
        placeholder="Everything known so far — what, when, who reported it"
      />
      <SelectField label="Severity" name="severity" defaultValue="T3">
        <option value="T1">T1 — Critical</option>
        <option value="T2">T2 — Major</option>
        <option value="T3">T3 — Minor</option>
      </SelectField>

      {error && <FieldError>{error}</FieldError>}

      <div>
        <Button type="submit" busy={busy}>
          {busy ? "Logging…" : "Log complaint"}
        </Button>
      </div>
    </form>
  );
}
