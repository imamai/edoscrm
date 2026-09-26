import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { resolveSession } from "@/lib/data/session";

export const metadata: Metadata = { title: "Platform admin" };

/**
 * Honest placeholder, not a feature — ARCHITECTURE.md §14 step 10 defers the
 * platform admin/subscriptions console until there's real cross-tenant need.
 * This exists so the nav item a platform admin sees isn't a 404, and says
 * plainly that the console isn't built yet rather than pretending otherwise.
 */
export default async function PlatformPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");
  if (!session.isPlatformAdmin) redirect("/dashboard");

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
      <ShieldCheck className="h-8 w-8 text-ink-faint" />
      <h1 className="text-lg font-semibold text-ink">Platform admin console</h1>
      <p className="max-w-sm text-sm text-ink-faint">
        Not built yet — deferred per ARCHITECTURE.md §14 until there&rsquo;s a second tenant to actually administer
        cross-tenant.
      </p>
    </div>
  );
}
