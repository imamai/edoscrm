import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MessageSquareWarning,
  ListTodo,
  BarChart3,
  LineChart,
  Settings,
  ShieldCheck,
  Upload,
  Sparkles,
  Users,
  UserRound,
  PackageX,
  Inbox,
  FileCheck2,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; permission?: string };
export type NavGroup = { label: string; items: NavItem[]; platformOnly?: boolean };

/**
 * Grouped from the start (EDOSPMIS pattern) — a new area adds itself here
 * rather than restructuring `SidebarNav`. Platform is filtered out for anyone
 * whose session isn't `isPlatformAdmin`.
 *
 * `permission` hides a destination from people who could not use it anyway.
 * It is a tidiness measure, never a security one: access is enforced by RLS in
 * the database and re-checked on every page, so a hidden link that somebody
 * types in by hand still gets refused.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Complaints",
    items: [
      { label: "All complaints", href: "/complaints", icon: MessageSquareWarning },
      { label: "Contacts", href: "/contacts", icon: UserRound },
      { label: "Email inbox", href: "/inbox", icon: Inbox, permission: "complaints.create" },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Product actions", href: "/product-actions", icon: PackageX },
      { label: "RCA summaries", href: "/rca-summaries", icon: FileCheck2, permission: "investigations.manage" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Trends", href: "/analytics", icon: LineChart },
      { label: "edos.ai", href: "/assistant", icon: Sparkles },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Overview", href: "/reports", icon: BarChart3 }],
  },
  {
    label: "Settings",
    items: [
      { label: "Workspace", href: "/settings", icon: Settings },
      { label: "Members & roles", href: "/settings/members", icon: Users, permission: "admin.users.manage" },
      { label: "Rules & categories", href: "/settings/rules", icon: SlidersHorizontal, permission: "admin.settings.manage" },
      { label: "Audit log", href: "/settings/audit", icon: ScrollText, permission: "admin.audit.view" },
      { label: "Import complaints", href: "/settings/import", icon: Upload, permission: "complaints.import" },
    ],
  },
  {
    label: "Platform",
    platformOnly: true,
    items: [{ label: "Admin console", href: "/platform", icon: ShieldCheck }],
  },
];
