import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import type { TaskStatus, TaskPriority } from "@/lib/domain/tasks";

export type { TaskStatus, TaskPriority } from "@/lib/domain/tasks";

export type Task = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  complaint_id: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

export async function getTasks(tenantId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.tasks)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getTasksForComplaint(complaintId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.tasks)
    .select("*")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
