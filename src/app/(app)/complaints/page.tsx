import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getComplaints, type Channel, type Severity } from "@/lib/data/complaints";
import { COMPLAINT_CATEGORIES } from "@/lib/domain/categories";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { SlaBadge } from "@/components/complaints/sla-badge";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaints" };

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; severity?: string; channel?: string; category?: string }>;
}) {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");
  const params = await searchParams;

  const [complaints, workflow, slaRules, canExport] = await Promise.all([
    getComplaints(session.tenant.id, {
      q: params.q,
      status: params.status,
      severity: params.severity as Severity | undefined,
      channel: params.channel as Channel | undefined,
      category: params.category,
    }),
    getDefaultWorkflowVersion(session.tenant.id),
    getSlaRules(session.tenant.id),
    hasPermission(session.tenant.id, "complaints.export"),
  ]);
  const stages = workflow?.definition.stages ?? [];
  const stageLabel = new Map(stages.map((s) => [s.key, s.label]));
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Complaints</h1>
        <div className="flex items-center gap-2">
          {canExport && (
            <a href={`/api/export/complaints${exportQuery ? `?${exportQuery}` : ""}`}>
              <Button variant="ghost">Export CSV</Button>
            </a>
          )}
          <Link href="/complaints/new">
            <Button>Log a complaint</Button>
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-ink-faint">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Case #, title, complainant, SKU, batch"
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium text-ink-faint">
            Stage
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="">All</option>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="severity" className="text-xs font-medium text-ink-faint">
            Severity
          </label>
          <select id="severity" name="severity" defaultValue={params.severity ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="">All</option>
            <option value="T1">T1</option>
            <option value="T2">T2</option>
            <option value="T3">T3</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="channel" className="text-xs font-medium text-ink-faint">
            Channel
          </label>
          <select id="channel" name="channel" defaultValue={params.channel ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="">All</option>
            <option value="internal">Internal</option>
            <option value="web">Website</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="walk_in">Walk-in</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-xs font-medium text-ink-faint">
            Category
          </label>
          <select id="category" name="category" defaultValue={params.category ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink">
            <option value="">All</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="ghost" className="h-9">
          Filter
        </Button>
        {(params.q || params.status || params.severity || params.channel || params.category) && (
          <Link href="/complaints" className="text-sm font-medium text-ink-faint hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      {complaints.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-faint">
          {params.q || params.status || params.severity || params.channel || params.category
            ? "No complaints match those filters."
            : "No complaints yet. Logging the first one seeds the activity that everything else — SLA status, dashboards, reports — will eventually read from."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2">Case</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">SLA</th>
                <th className="px-4 py-2">Opened</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => {
                const rule = slaRules[c.severity];
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-2">
                      <Link href={`/complaints/${c.id}`} className="font-medium text-brand hover:underline">
                        {c.case_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink">
                      {c.title}
                      {c.pending_information && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                          Pending info
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <ChannelBadge channel={c.source} />
                    </td>
                    <td className="px-4 py-2">
                      <SeverityBadge severity={c.severity} />
                    </td>
                    <td className="px-4 py-2 text-ink-faint">
                      {stageLabel.get(c.current_stage_key) ?? c.current_stage_key}
                    </td>
                    <td className="px-4 py-2">
                      {rule && (
                        <SlaBadge
                          status={computeSlaStatus({
                            createdAt: c.created_at,
                            currentStageKey: c.current_stage_key,
                            acknowledgementMinutes: rule.acknowledgement_minutes,
                            rcaMinutes: rule.rca_minutes,
                          })}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 text-ink-faint">{formatDate(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
