import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreditCard,
  KeyRound,
  ScrollText,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Settings" };

/**
 * One place that lists everything configurable.
 *
 * The sidebar used to carry each of these as its own row, and /settings was
 * the workspace form rather than a way in — so there was no "settings", only
 * six separate things that happened to be filed near each other. The
 * workspace form now lives at /settings/workspace like everything else, and
 * this is the front door.
 *
 * Each entry says what it is *for* rather than repeating its name. "Rules &
 * categories" tells nobody whether that is where complaint routing is set.
 *
 * Entries the viewer's role cannot reach are left out rather than shown and
 * refused: a dead link is worse than no link.
 */

interface Entry {
  href: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  permission?: string;
}

interface Section {
  title: string;
  blurb: string;
  entries: Entry[];
}

const SECTIONS: Section[] = [
  {
    title: "Your account",
    blurb: "Things that are yours alone, whatever your role.",
    entries: [
      {
        href: "/settings/password",
        label: "Password",
        blurb: "Change the password you sign in with.",
        icon: KeyRound,
      },
    ],
  },
  {
    title: "Workspace",
    blurb: "How this organisation is set up and what it is billed.",
    entries: [
      {
        href: "/settings/workspace",
        label: "Workspace details",
        blurb:
          "Name, timezone, currency and logo — what appears across the app and on what it sends.",
        icon: SettingsIcon,
        permission: "admin.org.manage",
      },
      {
        href: "/settings/billing",
        label: "Billing & plan",
        blurb: "Your EDOS CRM subscription and invoices.",
        icon: CreditCard,
        permission: "admin.org.manage",
      },
    ],
  },
  {
    title: "People and access",
    blurb: "Who is in this workspace and what each of them may do.",
    entries: [
      {
        href: "/settings/members",
        label: "Members & roles",
        blurb: "Invite people, set their role, suspend an account.",
        icon: Users,
        permission: "admin.users.manage",
      },
      {
        href: "/settings/audit",
        label: "Audit log",
        blurb: "Who did what, and when.",
        icon: ScrollText,
        permission: "admin.audit.view",
      },
    ],
  },
  {
    title: "How complaints are handled",
    blurb: "The routing and vocabulary every complaint is filed against.",
    entries: [
      {
        href: "/settings/rules",
        label: "Rules & categories",
        blurb:
          "What a complaint is filed under, and where each kind is routed.",
        icon: SlidersHorizontal,
        permission: "admin.settings.manage",
      },
      {
        href: "/settings/import",
        label: "Import complaints",
        blurb: "Bring in a backlog from a spreadsheet.",
        icon: Upload,
        permission: "complaints.import",
      },
    ],
  },
];

export default async function SettingsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  // Resolved once per distinct permission rather than per entry — several
  // entries share one, and each check is a round trip.
  const keys = [
    ...new Set(
      SECTIONS.flatMap((s) => s.entries.map((e) => e.permission)).filter(
        Boolean,
      ),
    ),
  ] as string[];
  const allowed = new Set(
    (
      await Promise.all(
        keys.map(async (k) =>
          (await hasPermission(session.tenant.id, k)) ? k : null,
        ),
      )
    ).filter(Boolean) as string[],
  );

  const sections = SECTIONS.map((section) => ({
    ...section,
    entries: section.entries.filter(
      (e) => !e.permission || allowed.has(e.permission),
    ),
  })).filter((section) => section.entries.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-ink-faint">
          Everything configurable in {session.tenant.name}. Only what your role
          can reach is shown.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
            <p className="text-xs text-ink-faint">{section.blurb}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.entries.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="group flex gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand"
              >
                <entry.icon
                  className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint group-hover:text-brand"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">
                    {entry.blurb}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
