"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, SelectField, TextareaField } from "@/components/ui/field";
import { createTask } from "./actions";

export function TaskForm({ complaintId, redirectTo }: { complaintId?: string; redirectTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await createTask(new FormData(event.currentTarget));

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      {complaintId && <input type="hidden" name="complaint_id" value={complaintId} />}
      <Field label="Title" name="title" required autoFocus />
      <TextareaField label="Description" name="description" />
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Priority" name="priority" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </SelectField>
        <Field label="Due date" name="due_date" type="date" />
      </div>

      {error && <FieldError>{error}</FieldError>}

      <div>
        <Button type="submit" busy={busy}>
          {busy ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
