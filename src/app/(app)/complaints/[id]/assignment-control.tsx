"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignComplaint } from "./actions";
import type { Member } from "@/lib/data/members";

export function AssignmentControl({ complaintId, members, assigneeId }: { complaintId: string; members: Member[]; assigneeId: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(assigneeId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: string) {
    setValue(next);
    startTransition(async () => {
      const result = await assignComplaint(complaintId, next || null);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
