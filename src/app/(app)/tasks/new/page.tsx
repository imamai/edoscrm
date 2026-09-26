import type { Metadata } from "next";
import { TaskForm } from "./task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ complaint_id?: string }>;
}) {
  const { complaint_id } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">New task</h1>
      <TaskForm complaintId={complaint_id} redirectTo={complaint_id ? `/complaints/${complaint_id}` : "/tasks"} />
    </div>
  );
}
