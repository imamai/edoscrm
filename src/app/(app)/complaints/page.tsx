import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getComplaints } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaints" };

export default async function ComplaintsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [complaints, workflow] = await Promise.all([
    getComplaints(session.tenant.id),
    getDefaultWorkflowVersion(session.tenant.id),
  ]);
  const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Complaints</h1>
        <Link href="/complaints/new">
          <Button>Log a complaint</Button>
        </Link>
      </div>

      {complaints.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-faint">
          No complaints yet. Logging the first one seeds the activity that everything else — SLA
          status, dashboards, reports — will eventually read from.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2">Case</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Opened</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-2">
                    <Link href={`/complaints/${c.id}`} className="font-medium text-brand hover:underline">
                      {c.case_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink">{c.title}</td>
                  <td className="px-4 py-2">
                    <SeverityBadge severity={c.severity} />
                  </td>
                  <td className="px-4 py-2 text-ink-faint">
                    {stageLabel.get(c.current_stage_key) ?? c.current_stage_key}
                  </td>
                  <td className="px-4 py-2 text-ink-faint">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
