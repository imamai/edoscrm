import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getAuditLog,
  getAuditActions,
  type AuditFilters,
} from "@/lib/data/audit";
import { getTenantMembers } from "@/lib/data/members";
import { resolvePeriod, parseReportFilters } from "@/lib/data/report-filters";
import { BackLink } from "@/components/ui/back-link";
import { ExportLinks } from "@/components/ui/export-links";
import {
  FilterCard,
  FilterField,
  RecordCount,
  filterControl,
} from "@/components/ui/filter-card";
import {
  EmptyState,
  DataTable,
  Row,
  Cell,
  Badge,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

/** A value pair rendered as "was → now", which is the whole point of an audit
 * entry and the one thing a case event could never show. */
function Change({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  );
  if (!keys.length) return <span className="text-ink-faint">—</span>;

  return (
    <div className="flex flex-col gap-0.5">
      {keys.slice(0, 6).map((k) => {
        const b = before?.[k];
        const a = after?.[k];
        const fmt = (v: unknown) =>
          v === null || v === undefined || v === ""
            ? "—"
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
        return (
          <p key={k} className="text-xs">
            <span className="text-ink-faint">{k}: </span>
            {before && k in before ? (
              <>
                <span className="text-ink-faint line-through">{fmt(b)}</span>
                <span className="text-ink-faint"> → </span>
              </>
            ) : null}
            <span className="text-ink">{fmt(a)}</span>
          </p>
        );
      })}
      {keys.length > 6 && (
        <p className="text-xs text-ink-faint">and {keys.length - 6} more</p>
      )}
    </div>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  if (!(await hasPermission(session.tenant.id, "admin.audit.view"))) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/settings" label="Settings" />
        <EmptyState
          title="You don't have permission to view the audit log"
          description="The audit log records who changed what across the whole workspace, so it is restricted to administrators."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const period = resolvePeriod(parseReportFilters(sp));
  const filters: AuditFilters = {
    from: period.from,
    to: period.to,
    action: one("action") || undefined,
    q: one("q") || undefined,
  };

  const [entries, actions, members] = await Promise.all([
    getAuditLog(session.tenant.id, filters),
    getAuditActions(session.tenant.id),
    getTenantMembers(session.tenant.id),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const query = new URLSearchParams();
  for (const k of ["period", "from", "to", "action", "q"])
    if (one(k)) query.set(k, one(k));
  const qs = query.toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/settings" label="Settings" />
        <h1 className="text-xl font-semibold text-ink">Audit log</h1>
        <p className="text-sm text-ink-faint">
          Who changed what, from what to what, and why. The per-case timeline
          tells the story of a complaint; this is the record an auditor is
          handed — and it downloads as a file.
        </p>
      </div>

      {/* A plain GET form: an audit log is read, filtered and exported, and
          keeping the controls server-rendered means the export link is always
          exactly the query on screen. */}
      <form method="get">
        <FilterCard
          note={`${period.label}. Newest first, most recent 1,000 entries.`}
          actions={
            <>
              <button
                type="submit"
                className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink hover:bg-brand-dark"
              >
                Apply
              </button>
              <ExportLinks base={`/api/export/audit${qs ? `?${qs}` : ""}`} />
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Period" htmlFor="period">
              <select
                id="period"
                name="period"
                defaultValue={one("period") || "30d"}
                className={filterControl}
              >
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="mtd">This month</option>
                <option value="qtd">This quarter</option>
                <option value="ytd">This year</option>
              </select>
            </FilterField>
            <FilterField label="Action" htmlFor="action">
              <select
                id="action"
                name="action"
                defaultValue={one("action")}
                className={filterControl}
              >
                <option value="">Any action</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Search" htmlFor="q" className="sm:col-span-2">
              <input
                id="q"
                name="q"
                defaultValue={one("q")}
                placeholder="Action, record type or reason"
                className={filterControl}
              />
            </FilterField>
          </div>
        </FilterCard>
      </form>

      <div>
        {entries.length === 0 ? (
          <EmptyState
            title="Nothing recorded in this period"
            description="Changes to members, roles, workspace rules and complaint records appear here as they happen."
            icon={<ScrollText className="h-7 w-7" />}
          />
        ) : (
          <DataTable
            header={[
              "When",
              "Who",
              "Action",
              "Record",
              "What changed",
              "Reason",
            ]}
          >
            {entries.map((e) => (
              <Row key={e.id}>
                <Cell className="whitespace-nowrap text-ink-faint">
                  {formatDateTime(e.created_at)}
                </Cell>
                <Cell className="whitespace-nowrap">
                  {e.actor_id ? (
                    (nameById.get(e.actor_id) ?? "Former member")
                  ) : (
                    <span className="text-ink-faint">System</span>
                  )}
                </Cell>
                <Cell>
                  <Badge
                    tone={
                      e.action.includes("deleted") ||
                      e.action.includes("suspended")
                        ? "danger"
                        : "neutral"
                    }
                  >
                    {e.action}
                  </Badge>
                </Cell>
                <Cell className="whitespace-nowrap text-ink-faint">
                  {e.entity_type}
                </Cell>
                <Cell className="max-w-[24rem]">
                  <Change before={e.before} after={e.after} />
                </Cell>
                <Cell className="max-w-[16rem] text-ink-faint">
                  {e.reason ?? "—"}
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
        <RecordCount shown={entries.length} noun="entry" plural="entries" />
      </div>
    </div>
  );
}
