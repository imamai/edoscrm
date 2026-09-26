import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const EVENT_LABEL: Record<string, string> = {
  "complaint.created": "Complaint logged",
  "stage.changed": "Stage advanced",
  "investigation.recorded": "Investigation recorded",
  "root_cause.recorded": "Root cause classified",
  "capa.recorded": "CAPA recorded",
};

export default async function DashboardPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const data = await getDashboardData(session.tenant.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{session.tenant.name}</h1>
        <p className="text-sm text-ink-faint">What needs attention right now.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open complaints" value={data.openCount} />
        <StatCard label="T1 open" value={data.t1Count} tone={data.t1Count > 0 ? "danger" : "neutral"} />
        <StatCard label="SLA overdue" value={data.overdueCount} tone={data.overdueCount > 0 ? "danger" : "neutral"} />
        <StatCard
          label="Tasks overdue"
          value={data.tasksOverdueCount}
          tone={data.tasksOverdueCount > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Needs attention</h2>
          {data.attention.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing at risk or overdue right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.attention.map(({ complaint, reason }) => (
                <Link
                  key={complaint.id}
                  href={`/complaints/${complaint.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 hover:bg-background"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{complaint.title}</span>
                    <span className="text-xs text-ink-faint">{complaint.case_number}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SeverityBadge severity={complaint.severity} />
                    <span
                      className={reason.includes("overdue") ? "text-xs text-danger" : "text-xs text-warning"}
                    >
                      {reason}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing has happened yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.recentEvents.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">
                    <Link href={`/complaints/${event.complaint_id}`} className="text-brand hover:underline">
                      {event.case_number}
                    </Link>{" "}
                    — {EVENT_LABEL[event.event_type] ?? event.event_type}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">{formatDateTime(event.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
