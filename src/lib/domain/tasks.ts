/**
 * Pure types/constants for tasks — no server-only imports, safe to pull into
 * a Client Component. `lib/data/tasks.ts` (which does the actual querying,
 * and does carry a server-only Supabase import) re-exports these for server
 * code; client components like `task-card.tsx` import straight from here so
 * bundling a real value (not just an erased type) from this module never
 * drags the server-only chain into the browser bundle.
 */
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

/** The board's fixed column set (see migration 0005 for why this is a fixed
 * list rather than a per-tenant workflow like complaints get). */
export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];
