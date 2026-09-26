import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, MessageSquareWarning } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Grouped from the start (EDOSPMIS pattern) — later phases (Tasks, Reports,
 * Settings) add their own groups without restructuring `SidebarNav` itself,
 * only this list.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Complaints",
    items: [{ label: "All complaints", href: "/complaints", icon: MessageSquareWarning }],
  },
];
