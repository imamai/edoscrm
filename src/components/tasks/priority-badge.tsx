import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/data/tasks";

const STYLES: Record<TaskPriority, string> = {
  high: "bg-danger/10 text-danger border-danger/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-border/40 text-ink-faint border-border",
};

const LABEL: Record<TaskPriority, string> = { high: "High", medium: "Medium", low: "Low" };

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", STYLES[priority])}>
      {LABEL[priority]}
    </span>
  );
}
