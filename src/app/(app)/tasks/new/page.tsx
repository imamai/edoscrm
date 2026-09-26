import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { TaskForm } from "./task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ complaint_id?: string }>;
}) {
  const { complaint_id } = await searchParams;
  // Back goes wherever the form's own redirect goes, so cancelling and
  // saving land the viewer in the same place.
  const parent = complaint_id ? `/complaints/${complaint_id}` : "/tasks";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href={parent} label={complaint_id ? "Complaint" : "Tasks"} />
        <h1 className="text-xl font-semibold text-ink">New task</h1>
      </div>
      <TaskForm complaintId={complaint_id} redirectTo={parent} />
    </div>
  );
}
