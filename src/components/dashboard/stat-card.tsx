import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ported from edos-poa's components/ui/stat-card.tsx: a small lift and a
 * deeper shadow on hover, plus the icon nudging larger — the effect that
 * makes a row of figures feel like a surface rather than a printout.
 * `motion-safe:` keeps it still for anyone who's asked for less motion.
 */
const TONES = {
  brand: "bg-brand/10 text-brand",
  neutral: "bg-background text-ink-faint",
  good: "bg-good/10 text-good",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group/stat min-w-0 rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-[translate,box-shadow,border-color] duration-200 hover:border-brand/30 hover:shadow-md motion-safe:hover:-translate-y-0.5 sm:p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.6875rem] font-medium tracking-wide text-ink-faint uppercase sm:text-xs">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 motion-safe:group-hover/stat:scale-110 sm:h-8 sm:w-8",
              TONES[tone],
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="tnum mt-2 truncate text-lg leading-none font-semibold text-ink sm:text-xl lg:text-2xl">{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}
