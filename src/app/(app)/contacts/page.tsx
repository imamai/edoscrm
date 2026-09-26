import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound, Search } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getContacts } from "@/lib/data/contacts";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { FilterCard, FilterField, RecordCount, filterControl } from "@/components/ui/filter-card";
import { DataTable, Row, Cell, Badge, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

const TYPE_LABEL: Record<string, string> = {
  consumer: "Consumer",
  trade: "Trade customer",
  distributor: "Distributor",
};

/**
 * The people who have complained.
 *
 * Complainant details used to live as free text on each case, so the same
 * person complaining three times was three unrelated records with three
 * spellings of their name. Nothing could answer "has this customer been here
 * before" or "which distributors generate the most complaints" — which is the
 * difference between a CRM and a case tracker.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  const contacts = await getContacts(session.tenant.id, q);

  // Complaint counts per contact, in one query rather than one per row.
  const supabase = await createClient();
  const { data: counts } = await supabase
    .from(TABLES.complaints)
    .select("contact_id, current_stage_key")
    .eq("tenant_id", session.tenant.id)
    .not("contact_id", "is", null);

  const totals = new Map<string, { total: number; open: number }>();
  for (const row of counts ?? []) {
    const id = row.contact_id as string;
    const entry = totals.get(id) ?? { total: 0, open: 0 };
    entry.total++;
    if ((row.current_stage_key as string) !== "closed") entry.open++;
    totals.set(id, entry);
  }

  // Most complaints first — the people worth knowing about are the repeats.
  const ordered = [...contacts].sort((a, b) => (totals.get(b.id)?.total ?? 0) - (totals.get(a.id)?.total ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Contacts</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Everyone who has raised a complaint, with their whole history in one place. A contact is created
          automatically when a complaint arrives with an email address or a phone number.
        </p>
      </div>

      <form method="get">
        <FilterCard note="Matched on name, email or phone number.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FilterField label="Search" htmlFor="q">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or phone" className={`${filterControl} pl-9`} />
              </div>
            </FilterField>
          </div>
        </FilterCard>
      </form>

      <div>
        {ordered.length === 0 ? (
          <EmptyState
            title={q ? "Nobody matches that search" : "No contacts yet"}
            description={
              q
                ? "Try a partial name, or part of an email address or phone number."
                : "A contact appears here as soon as a complaint is logged with an email address or a phone number."
            }
            icon={<UserRound className="h-7 w-7" />}
          />
        ) : (
          <DataTable header={["Name", "Type", "Contact", "Complaints", "Open", "First seen"]}>
            {ordered.map((c) => {
              const t = totals.get(c.id) ?? { total: 0, open: 0 };
              return (
                <Row key={c.id}>
                  <Cell>
                    <Link href={`/contacts/${c.id}`} className="font-medium text-brand hover:underline">
                      {c.full_name ?? "Unnamed"}
                    </Link>
                  </Cell>
                  <Cell>
                    <Badge tone={c.type === "consumer" ? "neutral" : "info"}>{TYPE_LABEL[c.type] ?? c.type}</Badge>
                  </Cell>
                  <Cell className="text-ink-faint">
                    {c.email && <span className="block">{c.email}</span>}
                    {c.phone && <span className="block">{c.phone}</span>}
                    {!c.email && !c.phone && "—"}
                  </Cell>
                  <Cell className="tnum">{t.total}</Cell>
                  <Cell className="tnum">
                    {t.open > 0 ? <Badge tone={t.open > 2 ? "danger" : "warning"}>{t.open}</Badge> : <span className="text-ink-faint">—</span>}
                  </Cell>
                  <Cell className="whitespace-nowrap text-ink-faint">{formatDate(c.created_at)}</Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
        <RecordCount shown={ordered.length} noun="contact" />
      </div>
    </div>
  );
}
