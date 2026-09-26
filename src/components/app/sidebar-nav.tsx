import Link from "next/link";
import { NAV_GROUPS } from "@/lib/nav-items";

export function SidebarNav() {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {group.label}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-background"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
