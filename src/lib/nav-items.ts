import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Grouped from the start (EDOSPMIS pattern), even with one item — later
 * phases add Cases/Tasks/Reports/Settings groups without restructuring
 * `SidebarNav` itself, only this list.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
];
