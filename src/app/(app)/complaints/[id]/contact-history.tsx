import Link from "next/link";
import { History, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { formatDate } from "@/lib/utils";
import type { Complaint } from "@/lib/data/complaints";

/**
 * Everything else this complainant has raised.
 *
 * This is the question a case tracker cannot answer and a CRM must: is this a
 * repeat complainant, or a repeat defect? Somebody on their fourth complaint
 * about the same product is a different conversation from somebody on their
 * first, and knowing which before replying is most of handling it well.
 *
 * Renders nothing when there is no history — an empty "no previous complaints"
 * panel on every first-time case would be noise on the screen people spend
 * the most time on.
 */
export function ContactHistory({ contactId, history }: { contactId: string | null; history: Complaint[] }) {
  if (!contactId || history.length === 0) return null;

  const open = history.filter((c) => c.current_stage_key !== "closed").length;

  return (
    <section className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <History className="h-4 w-4 text-warning" />
          This complainant has been here before
        </h2>
        <div className="flex items-center gap-1.5">
          <Badge tone="warning">
            {history.length} earlier {history.length === 1 ? "complaint" : "complaints"}
          </Badge>
          {open > 0 && <Badge tone="danger">{open} still open</Badge>}
          <Link href={`/contacts/${contactId}`} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            <UserRound className="h-3.5 w-3.5" />
            Full record
          </Link>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {history.slice(0, 5).map((c) => (
          <li key={c.id}>
            <Link
              href={`/complaints/${c.id}`}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface"
            >
              <span className="font-mono text-xs text-ink-faint">{c.case_number}</span>
              <SeverityBadge severity={c.severity} />
              <span className="min-w-0 flex-1 truncate text-ink">{c.title}</span>
              <span className="shrink-0 text-xs text-ink-faint">
                {c.current_stage_key === "closed" ? `closed ${c.closed_at ? formatDate(c.closed_at) : ""}` : "open"}
              </span>
              <span className="shrink-0 text-xs text-ink-faint">{formatDate(c.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {history.length > 5 && (
        <p className="mt-2 px-2 text-xs text-ink-faint">
          and {history.length - 5} more —{" "}
          <Link href={`/contacts/${contactId}`} className="font-semibold text-brand hover:underline">
            see the full record
          </Link>
        </p>
      )}
    </section>
  );
}
