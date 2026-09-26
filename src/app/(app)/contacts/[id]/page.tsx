import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getContact, getContactComplaints } from "@/lib/data/contacts";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardHeader, CardBody, DataTable, Row, Cell, Badge, Stat, EmptyState } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Contact" };

const TYPE_LABEL: Record<string, string> = {
  consumer: "Consumer",
  trade: "Trade customer",
  distributor: "Distributor",
};

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const contact = await getContact(session.tenant.id, id);
  if (!contact) notFound();

  const complaints = await getContactComplaints(session.tenant.id, id);
  const open = complaints.filter((c) => c.current_stage_key !== "closed");
  const t1 = complaints.filter((c) => c.severity === "T1");

  // Which products this person keeps having trouble with — the thing that
  // turns a list of complaints into a pattern worth acting on.
  const byProduct = new Map<string, number>();
  for (const c of complaints) {
    const key = c.product_name?.trim();
    if (!key) continue;
    byProduct.set(key, (byProduct.get(key) ?? 0) + 1);
  }
  const repeated = [...byProduct.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

  const satisfactionScores = complaints
    .map((c) => c.satisfaction_rating)
    .filter((r): r is number => typeof r === "number");
  const avgSatisfaction = satisfactionScores.length
    ? (satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <BackLink href="/contacts" label="Contacts" />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">{contact.full_name ?? "Unnamed contact"}</h1>
          <Badge tone={contact.type === "consumer" ? "neutral" : "info"}>{TYPE_LABEL[contact.type] ?? contact.type}</Badge>
        </div>
        <p className="text-sm text-ink-faint">
          {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details on file"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Complaints" value={complaints.length} />
        <Stat label="Still open" value={open.length} tone={open.length > 2 ? "danger" : open.length > 0 ? "warning" : undefined} />
        <Stat label="T1 critical" value={t1.length} tone={t1.length > 0 ? "danger" : undefined} />
        <Stat label="Avg. satisfaction" value={avgSatisfaction ? `${avgSatisfaction} / 5` : "—"} />
      </div>

      {repeated.length > 0 && (
        <Card>
          <CardHeader
            title="Repeated products"
            subtitle="Products this contact has complained about more than once — worth checking before replying."
          />
          <CardBody className="flex flex-wrap gap-1.5">
            {repeated.map(([name, n]) => (
              <Badge key={name} tone="warning">
                {name} · {n}
              </Badge>
            ))}
          </CardBody>
        </Card>
      )}

      {complaints.length === 0 ? (
        <EmptyState title="No complaints on this record" description="This contact exists but has no complaints against it yet." />
      ) : (
        <DataTable header={["Case no.", "Title", "Severity", "Channel", "Stage", "Opened", "Satisfaction"]}>
          {complaints.map((c) => (
            <Row key={c.id}>
              <Cell className="whitespace-nowrap">
                <Link href={`/complaints/${c.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                  {c.case_number}
                </Link>
              </Cell>
              <Cell className="max-w-[24rem] truncate">{c.title}</Cell>
              <Cell>
                <SeverityBadge severity={c.severity} />
              </Cell>
              <Cell>
                <ChannelBadge channel={c.source} />
              </Cell>
              <Cell>
                <Badge tone={c.current_stage_key === "closed" ? "good" : "neutral"}>{c.current_stage_key}</Badge>
              </Cell>
              <Cell className="whitespace-nowrap text-ink-faint">{formatDate(c.created_at)}</Cell>
              <Cell className="tnum">{c.satisfaction_rating ? `${c.satisfaction_rating} / 5` : <span className="text-ink-faint">—</span>}</Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
