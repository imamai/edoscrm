"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, SelectField, TextareaField } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/domain/investigation";
import type { RootCause } from "@/lib/data/investigation";
import { upsertRootCause } from "./investigation-actions";

export function RootCauseSection({
  complaintId,
  rootCause,
  canManage,
}: {
  complaintId: string;
  rootCause: RootCause | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = new Map(ROOT_CAUSE_CATEGORIES.map((c) => [c.key, c.label]));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await upsertRootCause(complaintId, new FormData(event.currentTarget));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Root cause</h2>
        {canManage && !editing && (
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(true)}>
            {rootCause ? "Edit" : "Record root cause"}
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <SelectField label="Category" name="category" defaultValue={rootCause?.category ?? "machine"}>
            {ROOT_CAUSE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <TextareaField
            label="Description"
            name="description"
            defaultValue={rootCause?.description}
            required
            placeholder="What is the classified root cause?"
          />
          {error && <FieldError>{error}</FieldError>}
          <div className="flex gap-2">
            <Button type="submit" busy={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : rootCause ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {categoryLabel.get(rootCause.category)}
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink-faint">{rootCause.description}</p>
          <p className="text-xs text-ink-faint">Last updated {formatDate(rootCause.updated_at)}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No root cause recorded yet.</p>
      )}
    </div>
  );
}
