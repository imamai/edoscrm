import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { NAV_GROUPS } from "@/lib/nav-items";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { getNotifications, getUnreadCount } from "@/lib/data/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await resolveSession();
  if (session.kind === "anon") redirect("/login");
  if (session.kind === "no_tenant") redirect("/new-workspace");

  // Which permission-gated destinations this person can use. Checked here once
  // rather than inside the nav, which is a client component and has no way to
  // ask the database anything.
  const gated = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.permission);
  const [notifications, unreadCount, ...allowedFlags] = await Promise.all([
    getNotifications(session.user.id),
    getUnreadCount(session.user.id),
    ...gated.map((i) => hasPermission(session.tenant.id, i.permission!)),
  ]);
  const allowedHrefs = gated.filter((_, i) => allowedFlags[i]).map((i) => i.href);

  // Same pattern as EDOSPMIS: a tenant's accent color tints buttons/links in
  // the content area only, via the --color-brand custom property — the
  // sidebar keeps its fixed navy shell regardless.
  const accent = session.tenant.branding.accent_color;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SidebarNav
        tenantName={session.tenant.name}
        isPlatformAdmin={session.isPlatformAdmin}
        allowedHrefs={allowedHrefs}
      />
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={accent ? ({ "--color-brand": accent } as React.CSSProperties) : undefined}
      >
        {/* The desktop header. On a phone the nav bar above already carries
            the workspace name, so this only needs to hold the bell. */}
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border bg-surface px-4 md:px-6">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          <p className="hidden truncate text-sm text-ink-faint sm:block">{session.user.email}</p>
        </header>
        {/* Canvas width matched to EDOSPMIS's dominant page wrapper
            (max-w-[1600px], mx-auto) — applied once here so every page gets
            it uniformly, rather than EDOSPMIS's own per-page repetition. */}
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
