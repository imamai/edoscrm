"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeComplaint } from "./actions";

export function ClosureControl({ complaintId, capaVerified }: { complaintId: string; capaVerified: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await closeComplaint(complaintId, note);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  if (!capaVerified) {
    return (
      <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-ink-faint">
        This case can close once its CAPA is recorded and verified — that&rsquo;s the brief&rsquo;s closure control (§6): no
        closure without confirmed corrective action.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink">
        Close this case
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-ink">Written confirmation of the fix</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What was confirmed, by whom, and how the complainant was informed"
        rows={3}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink disabled:opacity-60">
          {pending ? "Closing…" : "Confirm and close"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
