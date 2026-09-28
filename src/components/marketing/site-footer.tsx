import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "The system",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#capabilities", label: "Capabilities" },
      { href: "/#sla", label: "SLA & escalation" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/pricing#faq", label: "Questions" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Create a workspace" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              Every complaint gets an owner, a clock and an ending — and you get
              to see which of them keep coming back.
            </p>
            <p className="mt-4 text-sm text-ink-faint">
              <a href="mailto:info@edoscentre.co.ke" className="hover:text-brand">
                info@edoscentre.co.ke
              </a>
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">
                {col.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-ink-soft hover:text-brand">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} EDOS Centre. All rights reserved.
          </p>
          <p className="text-xs text-ink-faint">
            Built in Kenya for teams who answer to the people they serve.
          </p>
        </div>
      </div>
    </footer>
  );
}
