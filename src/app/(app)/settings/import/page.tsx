import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { BackLink } from "@/components/ui/back-link";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import complaints" };

const COLUMNS = [
  "title", "description", "severity", "category", "product_name", "sku", "batch_number",
  "production_date", "expiry_date", "reporter_name", "reporter_email", "reporter_phone", "status",
];

export default async function ImportPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");
  const canImport = await hasPermission(session.tenant.id, "complaints.import");
  if (!canImport) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/settings" label="Settings" />
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-faint">
          You don&rsquo;t have permission to import complaints.
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <BackLink href="/settings" label="Settings" />
        <h1 className="text-xl font-semibold text-ink">Import complaints</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Bring in open and historical cases from the current InfoPath/spreadsheet process (brief §6 &ldquo;Data
          migration&rdquo;). Each row becomes its own case with a real case number — nothing is bulk-inserted silently.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-semibold text-ink">Expected columns (header row required)</p>
        <p className="rounded-lg bg-background p-2.5 font-mono text-xs text-ink-faint">{COLUMNS.join(",")}</p>
        <p className="mt-2 text-xs text-ink-faint">
          Only <code>title</code> is required. <code>severity</code> defaults to T3 if blank or invalid.{" "}
          <code>status</code> should match one of this workspace&rsquo;s stage keys (received, triage, investigating,
          rca, capa, resolution, communicate, closed) — anything else starts at the first stage.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <ImportForm />
      </div>
    </div>
  );
}
