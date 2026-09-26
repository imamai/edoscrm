"use server";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { TASK_STATUSES, type TaskStatus } from "@/lib/domain/tasks";

export async function advanceTaskStatus(taskId: string, currentStatus: TaskStatus) {
  const currentIndex = TASK_STATUSES.findIndex((s) => s.key === currentStatus);
  const next = TASK_STATUSES[currentIndex + 1];
  if (!next) return { ok: false as const, error: "This task is already done." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.tasks)
    .update({
      status: next.key,
      completed_at: next.key === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) return { ok: false as const, error: "You don't have permission to update this task." };
  return { ok: true as const };
}
