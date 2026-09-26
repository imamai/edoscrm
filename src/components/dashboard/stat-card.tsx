import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
