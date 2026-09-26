"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/app/(app)/sign-out-button";

function NavLink({ item, activeHref }: { item: NavItem; activeHref: string | null }) {
  const active = item.href === activeHref;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-brand-mid text-white" : "text-brand-soft/80 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-good" : "bg-transparent")} />
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{item.label}</span>
    </Link>
  );
}

/**
 * Dark sidebar shell ported from EDOSPMIS (theme comment in globals.css):
 * `bg-brand-darker` / `text-brand-soft`, active row `bg-brand-mid` + a green
 * dot, unlike EDOSPMIS's `hidden md:flex` this stays visible at every width
 * since there's no mobile nav here yet — hiding it below `md:` would leave
 * phone users with no navigation at all.
 */
export function SidebarNav({ tenantName, isPlatformAdmin }: { tenantName: string; isPlatformAdmin: boolean }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.filter((g) => !g.platformOnly || isPlatformAdmin);

  // The longest href that matches the current path wins — otherwise a
  // parent route like /settings reads as "active" on every one of its own
  // child routes (e.g. /settings/import) alongside the child itself.
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const activeHref =
    allHrefs
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-brand-darker text-brand-soft">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-lg font-semibold text-white">EDOS CRM</p>
        <p className="mt-0.5 truncate text-xs text-brand-soft/70">{tenantName}</p>
      </div>
      <nav className="scroll-slim flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-soft/50">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} activeHref={activeHref} />
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <SignOutButton
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-soft/80 hover:bg-white/[0.07] hover:text-white"
          icon={<LogOut className="h-4 w-4" />}
        />
      </div>
    </aside>
  );
}
