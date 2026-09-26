import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { getNotifications, getUnreadCount } from "@/lib/data/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await resolveSession();
  if (session.kind === "anon") redirect("/login");
  if (session.kind === "no_tenant") redirect("/new-workspace");

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ]);

  // Same pattern as EDOSPMIS: a tenant's accent color tints buttons/links in
  // the content area only, via the --color-brand custom property — the
  // sidebar keeps its fixed navy shell regardless.
  const accent = session.tenant.branding.accent_color;

  return (
    <div className="flex min-h-dvh">
      <SidebarNav tenantName={session.tenant.name} isPlatformAdmin={session.isPlatformAdmin} />
      <div className="flex flex-1 flex-col" style={accent ? ({ "--color-brand": accent } as React.CSSProperties) : undefined}>
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border bg-surface px-6">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          <p className="text-sm text-ink-faint">{session.user.email}</p>
        </header>
        {/* Canvas width matched to EDOSPMIS's dominant page wrapper
            (max-w-[1600px], mx-auto) — applied once here so every page gets
            it uniformly, rather than EDOSPMIS's own per-page repetition. */}
        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
