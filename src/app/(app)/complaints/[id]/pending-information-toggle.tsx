"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPendingInformation } from "./actions";

export function PendingInformationToggle({ complaintId, pending: isPending, reason }: { complaintId: string; pending: boolean; reason: string | null }) {
  const router = useRouter();
  const [prompting, setPrompting] = useState(false);
  const [reasonInput, setReasonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function clear() {
    startTransition(async () => {
      const result = await setPendingInformation(complaintId, false, "");
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await setPendingInformation(complaintId, true, reasonInput);
      if (!result.ok) return setError(result.error);
      setPrompting(false);
      setReasonInput("");
      router.refresh();
    });
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
        <span>Pending information{reason ? ` — ${reason}` : ""}</span>
        <button type="button" onClick={clear} disabled={busy} className="font-medium underline disabled:opacity-60">
          Clear
        </button>
      </div>
    );
  }

  if (!prompting) {
    return (
      <button type="button" onClick={() => setPrompting(true)} className="text-xs font-medium text-brand hover:underline">
        Mark pending information
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
      <textarea
        value={reasonInput}
        onChange={(e) => setReasonInput(e.target.value)}
        placeholder="What's needed from the complainant?"
        rows={2}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink disabled:opacity-60">
          Save
        </button>
        <button type="button" onClick={() => setPrompting(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
