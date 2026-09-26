"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overrideSeverity } from "./actions";
import type { Severity } from "@/lib/data/complaints";

export function SeverityOverride({ complaintId, severity }: { complaintId: string; severity: Severity }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState<Severity>(severity);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await overrideSeverity(complaintId, next, reason);
      if (!result.ok) return setError(result.error);
      setError(null);
      setEditing(false);
      setReason("");
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand hover:underline">
        Override severity
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
      <select value={next} onChange={(e) => setNext(e.target.value as Severity)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
        <option value="T1">T1 — Critical</option>
        <option value="T2">T2 — Major</option>
        <option value="T3">T3 — Minor</option>
      </select>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is the severity changing?"
        rows={2}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
