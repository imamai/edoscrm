import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The shared vocabulary the app was missing.
 *
 * Status colours, card chrome and table markup were previously re-written on
 * every page and had begun to drift — one page's "overdue" was a different red
 * from another's, and an undefined colour token sat in live code rendering
 * nothing at all, because a class referencing a token that does not exist
 * fails silently. Routing all of it through here means a status reads the same
 * everywhere and a change lands in one place.
 */

export type Tone = "neutral" | "good" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-background text-ink-faint",
  good: "border-good/30 bg-good/10 text-good",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-brand/30 bg-brand/10 text-brand",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border border-border bg-surface", className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

/**
 * An empty state that says what would be here and how to put something here —
 * rather than a bare "No results", which tells somebody nothing about whether
 * they filtered too hard or the feature has never been used.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <span className="text-ink-faint">{icon}</span>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-faint">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-brand-dark"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * A table in a container that scrolls sideways on its own, so a wide register
 * never makes the whole page scroll sideways on a phone.
 */
export function DataTable({
  header,
  children,
  empty,
}: {
  header: React.ReactNode[];
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasRows && empty) return <>{empty}</>;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="scroll-slim overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {header.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("border-b border-border last:border-0 odd:bg-background/40", className)}>{children}</tr>;
}

export function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 align-top text-ink", className)}>{children}</td>;
}

/** A labelled figure — the "12 of 40" / "3 open" pairs that sit above a list. */
export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={cn("tnum mt-0.5 text-lg font-semibold", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink")}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
