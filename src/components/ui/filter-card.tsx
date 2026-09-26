import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filters, gathered into one panel instead of scattered above a table — the
 * same shape edos-poa gives its reports. Once a screen has a period, a
 * severity, a stage and a search box, loose rows stop reading as a group, and
 * on a phone they stack into an unlabelled pile of controls with no way to
 * tell which belong together.
 *
 * `print:hidden` because the filters describe the report; they aren't part of
 * it. What gets printed or downloaded is the table underneath.
 */
export function FilterCard({
  title = "Filters",
  actions,
  note,
  children,
  className,
}: {
  title?: string;
  /** Buttons under the controls — generate, export, print. */
  actions?: React.ReactNode;
  /** A quiet line beside the actions saying what the result covers. */
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-4 shadow-sm print:hidden", className)}>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        <SlidersHorizontal className="h-4 w-4 text-ink-faint" aria-hidden="true" />
        {title}
      </h2>

      <div className="mt-3 flex flex-col gap-3">{children}</div>

      {(actions || note) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {actions}
          {note && <p className="text-xs text-ink-faint">{note}</p>}
        </div>
      )}
    </section>
  );
}

/** A labelled control inside the card, so each one says what it narrows. */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-faint">
        {label}
      </label>
      {children}
    </div>
  );
}

/** "Displaying 10 rows." — the count edos-poa puts under a report's table. */
export function RecordCount({ shown, total, noun = "row" }: { shown: number; total?: number; noun?: string }) {
  const plural = shown === 1 ? noun : `${noun}s`;
  return (
    <p className="px-1 pt-3 text-xs text-ink-faint">
      {total !== undefined && total > shown
        ? `Displaying ${shown.toLocaleString("en-KE")} of ${total.toLocaleString("en-KE")} ${noun}s.`
        : `Displaying ${shown.toLocaleString("en-KE")} ${plural}.`}
    </p>
  );
}

/** The shared control styling, so every filter input matches. */
export const filterControl =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none";
