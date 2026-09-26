import { cn } from "@/lib/utils";
import type { SlaStatus } from "@/lib/domain/sla";

const STYLES = {
  good: "bg-good/10 text-good border-good/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

const DOT = { good: "bg-good", warning: "bg-warning", danger: "bg-danger" };

export function SlaBadge({ status }: { status: SlaStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        STYLES[status.level],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status.level])} />
      {status.label}
    </span>
  );
}
