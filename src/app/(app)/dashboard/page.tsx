import type { Metadata } from "next";
import { resolveSession } from "@/lib/data/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await resolveSession();
  const name = session.kind === "ok" ? session.tenant.name : "";

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold text-ink">Welcome to {name}</h1>
      <p className="text-sm text-ink-faint">
        The foundation is in place — cases, tasks and the rest of the workflow arrive in the
        next build phases (see ARCHITECTURE.md §14).
      </p>
    </div>
  );
}
