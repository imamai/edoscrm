import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/data/complaints";

const STYLES: Record<Severity, string> = {
  T1: "bg-danger/10 text-danger border-danger/30",
  T2: "bg-warning/10 text-warning border-warning/30",
  T3: "bg-info/10 text-info border-info/30",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        STYLES[severity],
      )}
    >
      {severity}
    </span>
  );
}
