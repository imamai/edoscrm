import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getTasks } from "@/lib/data/tasks";
import { TASK_STATUSES } from "@/lib/domain/tasks";
import { getComplaints } from "@/lib/data/complaints";
import { Board } from "@/components/board/board";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [tasks, complaints] = await Promise.all([getTasks(session.tenant.id), getComplaints(session.tenant.id)]);
  const caseNumberById = new Map(complaints.map((c) => [c.id, c.case_number]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Tasks</h1>
        <Link href="/tasks/new">
          <Button>New task</Button>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-faint">
          No tasks yet.
        </p>
      ) : (
        <Board
          columns={TASK_STATUSES}
          items={tasks}
          columnKey={(task) => task.status}
          renderCard={(task) => (
            <TaskCard task={task} complaintLabel={task.complaint_id ? caseNumberById.get(task.complaint_id) : undefined} />
          )}
        />
      )}
    </div>
  );
}
