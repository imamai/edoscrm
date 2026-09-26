"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, ChevronRight } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/app/(app)/sign-out-button";

/**
 * A nav row as a chevron: the active one is cut into an arrow pointing at the
 * content beside it, the same `clip-path` language the workflow stepper and
 * the complaints stage strip use. It reads as "you are here, and here is what
 * it opens" rather than as a highlighted rectangle, and it ties the navigation
 * to the pipeline styling used everywhere else in the product.
 *
 * Only the active row is clipped. Clipping every row would turn the sidebar
 * into a column of arrows with nothing to distinguish the current one.
 */
function NavLink({ item, activeHref, onNavigate }: { item: NavItem; activeHref: string | null; onNavigate?: () => void }) {
  const active = item.href === activeHref;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      style={active ? { clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)" } : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg py-2 pl-3 text-sm font-medium transition-colors",
        active ? "rounded-r-none bg-brand-mid pr-5 text-white" : "pr-3 text-brand-soft/80 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{item.label}</span>
      {!active && (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60" />
      )}
    </Link>
  );
}

function NavBody({
  tenantName,
  groups,
  activeHref,
  onNavigate,
}: {
  tenantName: string;
  groups: typeof NAV_GROUPS;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
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
              <NavLink key={item.href} item={item} activeHref={activeHref} onNavigate={onNavigate} />
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
    </>
  );
}

/**
 * Dark sidebar shell ported from EDOSPMIS: `bg-brand-darker` /
 * `text-brand-soft`, active row `bg-brand-mid`.
 *
 * Below `md:` it collapses to a drawer behind a menu button. A fixed 256px
 * sidebar left roughly a third of a phone screen for content, which broke the
 * brief's "mobile-friendly, no desktop-only dependency" requirement for
 * exactly the users it most wanted to reach — Sales representatives and
 * distributors logging trade complaints from the field.
 */
export function SidebarNav({
  tenantName,
  isPlatformAdmin,
  allowedHrefs,
}: {
  tenantName: string;
  isPlatformAdmin: boolean;
  /** Destinations this person can actually use. Undefined means "no filtering". */
  allowedHrefs?: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating closes the drawer; without this it stays open over the page it
  // just opened, which on a phone looks like the tap did nothing.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The drawer is a layer over the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const allowed = allowedHrefs ? new Set(allowedHrefs) : null;
  const groups = NAV_GROUPS.filter((g) => !g.platformOnly || isPlatformAdmin)
    .map((g) => ({ ...g, items: g.items.filter((i) => !allowed || !i.permission || allowed.has(i.href)) }))
    .filter((g) => g.items.length > 0);

  // The longest href that matches the current path wins — otherwise a parent
  // route like /settings reads as "active" on every one of its child routes.
  const activeHref =
    groups
      .flatMap((g) => g.items.map((i) => i.href))
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <>
      {/* Phone: a bar with the menu button, since there is no room for a rail. */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-brand-darker px-4 text-white md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">EDOS CRM</p>
          <p className="truncate text-[11px] leading-tight text-brand-soft/70">{tenantName}</p>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-darker text-brand-soft shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            <NavBody tenantName={tenantName} groups={groups} activeHref={activeHref} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col bg-brand-darker text-brand-soft md:flex">
        <NavBody tenantName={tenantName} groups={groups} activeHref={activeHref} />
      </aside>
    </>
  );
}
