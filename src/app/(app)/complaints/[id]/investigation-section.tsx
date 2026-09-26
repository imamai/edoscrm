"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, TextareaField } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import type { Investigation } from "@/lib/data/investigation";
import { upsertInvestigation } from "./investigation-actions";

export function InvestigationSection({
  complaintId,
  investigation,
  canManage,
}: {
  complaintId: string;
  investigation: Investigation | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await upsertInvestigation(complaintId, new FormData(event.currentTarget));
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
        <h2 className="text-sm font-semibold text-ink">Investigation</h2>
        {canManage && !editing && (
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(true)}>
            {investigation ? "Edit" : "Record findings"}
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <TextareaField
            label="Findings"
            name="findings"
            defaultValue={investigation?.findings}
            required
            autoFocus
            placeholder="What did the investigation find?"
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
      ) : investigation ? (
        <div className="flex flex-col gap-1">
          <p className="whitespace-pre-wrap text-sm text-ink-faint">{investigation.findings}</p>
          <p className="text-xs text-ink-faint">Last updated {formatDate(investigation.updated_at)}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No investigation recorded yet.</p>
      )}
    </div>
  );
}
