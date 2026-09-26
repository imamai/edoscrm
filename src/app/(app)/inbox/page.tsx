import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getCategories } from "@/lib/data/settings";
import { EmptyState } from "@/components/ui/primitives";
import { InboxClient, type InboundEmail } from "./inbox-client";

export const metadata: Metadata = { title: "Email inbox" };

export default async function InboxPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  if (!(await hasPermission(session.tenant.id, "complaints.create"))) {
    return (
      <EmptyState
        title="You don't have permission to handle the inbox"
        description="Turning an inbound message into a complaint is part of logging complaints."
      />
    );
  }

  const supabase = await createClient();
  const [{ data: emails }, categories] = await Promise.all([
    supabase
      .from(TABLES.inboundEmails)
      .select("id, from_email, from_name, subject, body, status, complaint_id, created_at")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false })
      .limit(200),
    getCategories(session.tenant.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Email inbox</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Messages forwarded to the complaints address. Nothing becomes a case on its own — somebody decides, which is
          what keeps auto-replies and newsletters out of the complaint register and out of the batch pattern counts.
        </p>
      </div>

      <InboxClient emails={(emails ?? []) as InboundEmail[]} categories={categories.map((c) => c.name)} />
    </div>
  );
}
