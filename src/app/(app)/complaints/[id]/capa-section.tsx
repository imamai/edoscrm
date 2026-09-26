"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, SelectField, TextareaField } from "@/components/ui/field";
import { cn, formatDate } from "@/lib/utils";
import { CAPA_STATUSES } from "@/lib/domain/investigation";
import type { Capa } from "@/lib/data/investigation";
import { upsertCapa } from "./investigation-actions";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-border/40 text-ink-faint border-border",
  in_progress: "bg-info/10 text-info border-info/30",
  verified: "bg-good/10 text-good border-good/30",
  closed: "bg-good/10 text-good border-good/30",
};

export function CapaSection({
  complaintId,
  capa,
  canManage,
}: {
  complaintId: string;
  capa: Capa | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = new Map(CAPA_STATUSES.map((s) => [s.key, s.label]));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await upsertCapa(complaintId, new FormData(event.currentTarget));
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
        <h2 className="text-sm font-semibold text-ink">CAPA</h2>
        {canManage && !editing && (
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(true)}>
            {capa ? "Edit" : "Record CAPA"}
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <TextareaField
            label="Corrective action"
            name="corrective_action"
            defaultValue={capa?.corrective_action}
            required
            autoFocus
            placeholder="What fixes this specific occurrence?"
          />
          <TextareaField
            label="Preventive action"
            name="preventive_action"
            defaultValue={capa?.preventive_action ?? ""}
            placeholder="What stops this from happening again?"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Due date" name="due_date" type="date" defaultValue={capa?.due_date ?? ""} />
            <SelectField label="Status" name="status" defaultValue={capa?.status ?? "open"}>
              {CAPA_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </SelectField>
          </div>
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
      ) : capa ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                STATUS_STYLES[capa.status],
              )}
            >
              {statusLabel.get(capa.status)}
            </span>
            {capa.due_date && <span className="text-xs text-ink-faint">Due {formatDate(capa.due_date)}</span>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Corrective action</p>
            <p className="whitespace-pre-wrap text-sm text-ink-faint">{capa.corrective_action}</p>
          </div>
          {capa.preventive_action && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Preventive action</p>
              <p className="whitespace-pre-wrap text-sm text-ink-faint">{capa.preventive_action}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No CAPA recorded yet.</p>
      )}
    </div>
  );
}
