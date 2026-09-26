import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await resolveSession();
  if (session.kind === "anon") redirect("/login");
  if (session.kind === "no_tenant") redirect("/new-workspace");

  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
          <p className="text-sm font-medium text-ink">{session.tenant.name}</p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink-faint">{session.user.email}</p>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
