import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, MessageSquareWarning, ListTodo, BarChart3, LineChart, Settings, ShieldCheck, Upload } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[]; platformOnly?: boolean };

/**
 * Grouped from the start (EDOSPMIS pattern) — later phases add their own
 * groups without restructuring `SidebarNav` itself, only this list. Platform
 * is filtered out in `SidebarNav` for anyone whose session isn't
 * `isPlatformAdmin` (mirrors EDOSPMIS's `platformOnly` group flag).
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
  {
    label: "Tasks",
    items: [{ label: "All tasks", href: "/tasks", icon: ListTodo }],
  },
  {
    label: "Analytics",
    items: [{ label: "Trends", href: "/analytics", icon: LineChart }],
  },
  {
    label: "Reports",
    items: [{ label: "Overview", href: "/reports", icon: BarChart3 }],
  },
  {
    label: "Settings",
    items: [
      { label: "Workspace", href: "/settings", icon: Settings },
      { label: "Import complaints", href: "/settings/import", icon: Upload },
    ],
  },
  {
    label: "Platform",
    platformOnly: true,
    items: [{ label: "Admin console", href: "/platform", icon: ShieldCheck }],
  },
];
