import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Search as SearchIcon } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getComplaints, getComplaintEvents, stageDatesFromEvents, type Channel, type Complaint, type Severity } from "@/lib/data/complaints";
import { COMPLAINT_CATEGORIES } from "@/lib/domain/categories";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { getTenantMembers } from "@/lib/data/members";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { SlaBadge } from "@/components/complaints/sla-badge";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/permissions";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaints" };

type SearchParams = { q?: string; status?: string; severity?: string; channel?: string; category?: string; owner?: string; selected?: string };

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");
  const params = await searchParams;

  // Fetched without `status` so the chevron strip below always shows the
  // full stage distribution for the other active filters — narrowing to one
  // stage happens client-side from this same set, matching EDOSPMIS's
  // Requisitions pipeline (counts computed once, table filtered from it).
  const [allMatching, workflow, slaRules, canExport, members] = await Promise.all([
    getComplaints(session.tenant.id, {
      q: params.q,
      severity: params.severity as Severity | undefined,
      channel: params.channel as Channel | undefined,
      category: params.category,
      assignee: params.owner,
    }),
    getDefaultWorkflowVersion(session.tenant.id),
    getSlaRules(session.tenant.id),
    hasPermission(session.tenant.id, "complaints.export"),
    getTenantMembers(session.tenant.id),
  ]);
  const stages = workflow?.definition.stages ?? [];
  const stageLabel = new Map(stages.map((s) => [s.key, s.label]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const stageCounts = new Map<string, number>();
  for (const c of allMatching) stageCounts.set(c.current_stage_key, (stageCounts.get(c.current_stage_key) ?? 0) + 1);
  const complaints = params.status ? allMatching.filter((c) => c.current_stage_key === params.status) : allMatching;

  // Pipeline KPIs — the same slots EDOSPMIS's Requisitions pipeline leads
  // with (open / a headline number / mid-pipeline / done), adapted since a
  // complaint has no monetary "value": T1-open stands in for it as the
  // headline figure, and "in investigation" folds investigating/rca/capa
  // the way EDOSPMIS folds procurement+po_approval into "in sourcing & award".
  const open = allMatching.filter((c) => c.current_stage_key !== "closed");
  const t1Open = open.filter((c) => c.severity === "T1").length;
  const inInvestigation = allMatching.filter((c) => ["investigating", "rca", "capa"].includes(c.current_stage_key)).length;
  const closedCount = allMatching.filter((c) => c.current_stage_key === "closed").length;

  const buildHref = (overrides: Partial<Record<keyof SearchParams, string | null>>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | null | undefined> = { ...params, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const q = next.toString();
    return q ? `/complaints?${q}` : "/complaints";
  };

  const selectedId = params.selected && complaints.some((c) => c.id === params.selected) ? params.selected : null;
  const selected: Complaint | undefined = selectedId ? complaints.find((c) => c.id === selectedId) : undefined;
  const selectedStageDates = selected ? stageDatesFromEvents(await getComplaintEvents(selected.id)) : {};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Complaints</h1>
        <div className="flex items-center gap-2">
          {canExport && (
            <a href={`/api/export/complaints?${new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "selected") as [string, string][]).toString()}`}>
              <Button variant="ghost">Export CSV</Button>
            </a>
          )}
          <Link href="/complaints/new">
            <Button>Log a complaint</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open complaints" value={open.length} sub={`${open.length} awaiting resolution`} icon={ClipboardList} tone="brand" />
        <StatCard label="T1 critical open" value={t1Open} sub="Highest severity, unresolved" icon={AlertTriangle} tone={t1Open > 0 ? "danger" : "neutral"} />
        <StatCard label="In investigation" value={inInvestigation} sub="Investigating, RCA or CAPA" icon={SearchIcon} tone="info" />
        <StatCard label="Closed" value={closedCount} sub="Resolved and confirmed" icon={CheckCircle2} tone="good" />
      </div>

      {stages.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              Pipeline by stage <span className="font-normal text-ink-faint">· click a stage to filter</span>
            </p>
            {params.status && (
              <Link href={buildHref({ status: null })} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand">
                All stages
              </Link>
            )}
          </div>
          <div className="scroll-slim flex gap-0.5 overflow-x-auto">
            {stages.map((stage, i) => {
              const active = params.status === stage.key;
              const count = stageCounts.get(stage.key) ?? 0;
              const isFirst = i === 0;
              const isLast = i === stages.length - 1;
              const clipPath = isFirst
                ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                : isLast
                  ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)"
                  : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
              return (
                <Link
                  key={stage.key}
                  href={buildHref({ status: active ? null : stage.key, selected: null })}
                  aria-pressed={active}
                  style={{ clipPath }}
                  className={cn(
                    "flex h-[3.6rem] min-w-[6.5rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 px-4 transition-colors",
                    !isFirst && "-ml-2",
                    active ? "bg-brand text-white" : "bg-background text-ink-faint hover:bg-brand/10 hover:text-brand",
                  )}
                >
                  <span className="tnum text-lg leading-none font-bold">{count}</span>
                  <span className="text-[11px] font-semibold">{stage.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-border bg-background px-2.5 py-1 font-mono text-xs text-ink">{selected.case_number}</span>
            <span className="text-base font-semibold text-ink">{selected.title}</span>
            <span className="flex-1" />
            <span className="text-sm text-ink-faint">
              Now: <b className="text-ink">{stageLabel.get(selected.current_stage_key) ?? selected.current_stage_key}</b>
            </span>
          </div>
          <div className="rounded-xl border border-border bg-background p-2">
            <WorkflowStepper stages={stages.length > 0 ? stages : [{ key: "received", label: "Received" }]} currentKey={selected.current_stage_key} stageDates={selectedStageDates} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border bg-background px-3 py-2.5">
            <form method="get" className="flex flex-wrap items-center gap-2">
              {params.status && <input type="hidden" name="status" value={params.status} />}
              {params.severity && <input type="hidden" name="severity" value={params.severity} />}
              {params.channel && <input type="hidden" name="channel" value={params.channel} />}
              {params.category && <input type="hidden" name="category" value={params.category} />}
              {params.owner && <input type="hidden" name="owner" value={params.owner} />}
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Case #, title, complainant, SKU, batch"
                className="h-9 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
              />
              <button type="submit" aria-label="Search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-ink-faint hover:border-brand hover:text-brand">
                <SearchIcon className="h-4 w-4" />
              </button>
              <select name="severity" defaultValue={params.severity ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
                <option value="">All severities</option>
                <option value="T1">T1</option>
                <option value="T2">T2</option>
                <option value="T3">T3</option>
              </select>
              <select name="channel" defaultValue={params.channel ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
                <option value="">All channels</option>
                <option value="internal">Internal</option>
                <option value="web">Website</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="walk_in">Walk-in</option>
                <option value="social">Social media</option>
                <option value="sales_rep">Sales rep (trade)</option>
              </select>
              <select name="category" defaultValue={params.category ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
                <option value="">All categories</option>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {/* Owner — the brief names it as a search and reporting
                  dimension, and "what's on Jane's desk" is most of what
                  day-to-day supervision consists of. "Unassigned" is the more
                  useful of the two options: an unowned complaint is how things
                  go quiet. */}
              <select name="owner" defaultValue={params.owner ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
                <option value="">Any owner</option>
                <option value="unassigned">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {(params.q || params.severity || params.channel || params.category || params.owner) && (
                <Link href={buildHref({ q: null, severity: null, channel: null, category: null, owner: null, selected: null })} className="text-xs font-medium text-ink-faint hover:text-ink">
                  Clear filters
                </Link>
              )}
            </form>
          </div>

          {complaints.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-faint">
              {params.q || params.status || params.severity || params.channel || params.category
                ? "No complaints match those filters."
                : "No complaints yet. Logging the first one seeds the activity that everything else — SLA status, dashboards, reports — will eventually read from."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-32" />
                  <col />
                  <col className="w-24" />
                  <col className="w-32" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-background text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5">Case</th>
                    <th className="px-4 py-2.5">Title / Complainant</th>
                    <th className="px-4 py-2.5">Severity</th>
                    <th className="px-4 py-2.5">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((c) => {
                    const rowSelected = c.id === selectedId;
                    return (
                      <tr key={c.id} className={cn("border-b border-border last:border-0", rowSelected && "bg-good/10 shadow-[inset_3px_0_0_var(--color-good)]")}>
                        <td className="p-0">
                          <Link href={buildHref({ selected: c.id })} className="block truncate px-4 py-3 font-mono text-xs whitespace-nowrap text-ink">
                            {c.case_number}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link href={buildHref({ selected: c.id })} className="block px-4 py-3">
                            <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                              <ChannelBadge channel={c.source} />
                              {c.reporter_name ?? "—"}
                              {c.pending_information && <span className="ml-1 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Pending info</span>}
                            </p>
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link href={buildHref({ selected: c.id })} className="block px-4 py-3">
                            <SeverityBadge severity={c.severity} />
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link href={buildHref({ selected: c.id })} className="block px-4 py-3 text-ink-faint">
                            {stageLabel.get(c.current_stage_key) ?? c.current_stage_key}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected ? (
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-ink-faint">Severity</p>
                <p className="tnum text-2xl font-bold text-ink">{selected.severity}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <SeverityBadge severity={selected.severity} />
                {slaRules[selected.severity] && (
                  <SlaBadge
                    status={computeSlaStatus({
                      createdAt: selected.created_at,
                      currentStageKey: selected.current_stage_key,
                      acknowledgementMinutes: slaRules[selected.severity].acknowledgement_minutes,
                      rcaMinutes: slaRules[selected.severity].rca_minutes,
                      resolutionPlanMinutes: slaRules[selected.severity].resolution_plan_minutes,
                      acknowledgedAt: selected.acknowledged_at,
                    })}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border bg-background p-3">
              {[
                { k: "Complainant", v: selected.reporter_name ?? "—" },
                { k: "Assigned to", v: (selected.assignee_id && memberName.get(selected.assignee_id)) ?? "Unassigned" },
                { k: "Opened", v: formatDate(selected.created_at) },
                { k: "Channel", v: selected.source },
              ].map((f) => (
                <div key={f.k}>
                  <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{f.k}</p>
                  <p className="text-sm font-medium text-ink">{f.v}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink">Activity</p>
              {[...stages].reverse().map((stage) => {
                const idx = stages.findIndex((s) => s.key === stage.key);
                const currentIdx = stages.findIndex((s) => s.key === selected.current_stage_key);
                const reachedAt = selectedStageDates[stage.key];
                if (idx > currentIdx || !reachedAt) return null;
                const isNow = idx === currentIdx;
                return (
                  <div key={stage.key} className="grid grid-cols-[0.75rem_1fr_auto] items-start gap-2.5">
                    <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", isNow ? "bg-brand shadow-[0_0_0_4px_var(--color-brand)]/20" : "bg-good")} />
                    <p className="text-sm font-medium text-ink">
                      {isNow ? "Now in " : "Completed: "}
                      {stage.label}
                    </p>
                    <span className="tnum text-xs text-ink-faint">{formatDate(reachedAt)}</span>
                  </div>
                );
              })}
            </div>

            <Link href={`/complaints/${selected.id}`} className="mt-auto flex h-10 items-center justify-center rounded-lg border border-border text-sm font-medium text-ink hover:border-brand hover:text-brand">
              Open complaint
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-border bg-surface p-4 text-sm text-ink-faint">Select a complaint to see its detail.</div>
        )}
      </div>
    </div>
  );
}
