"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { formatDate } from "@/lib/utils";
import { advanceTaskStatus } from "@/app/(app)/tasks/actions";
import { TASK_STATUSES } from "@/lib/domain/tasks";
import type { Task } from "@/lib/data/tasks";

export function TaskCard({ task, complaintLabel }: { task: Task; complaintLabel?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const currentIndex = TASK_STATUSES.findIndex((s) => s.key === task.status);
  const next = TASK_STATUSES[currentIndex + 1];

  async function onAdvance() {
    setBusy(true);
    await advanceTaskStatus(task.id, task.status);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.description && <p className="line-clamp-2 text-xs text-ink-faint">{task.description}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
        {task.due_date && <span>Due {formatDate(task.due_date)}</span>}
        {complaintLabel && (
          <Link href={`/complaints/${task.complaint_id}`} className="text-brand hover:underline">
            {complaintLabel}
          </Link>
        )}
      </div>
      {next && (
        <Button variant="ghost" onClick={onAdvance} busy={busy} className="h-8 self-start px-2 text-xs">
          {busy ? "Moving…" : `Move to ${next.label}`}
        </Button>
      )}
    </div>
  );
}
