import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";

import { Hero } from "@/components/marketing/hero";
import { FeatureBlock, SectionHeading } from "@/components/marketing/sections";
import { BrowserFrame, LaptopFrame, PhoneFrame } from "@/components/marketing/device-frames";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FaqList } from "@/components/marketing/faq-list";
import { FAQS } from "@/lib/marketing-content";
import { priceLabel, TRIAL_DAYS } from "@/lib/plans";
import { getPlans } from "@/lib/data/billing";

export const metadata: Metadata = {
  // Absolute: the root template appends "· EDOS CRM", which on the page that
  // already says EDOS CRM reads as a stutter.
  title: { absolute: "EDOS CRM — every complaint, answered and accounted for" },
  description:
    "Capture every complaint, give it an owner and an SLA clock, drive it to a root cause and a fix, tell the person what happened, and see what keeps coming back. Built in Kenya.",
  alternates: { canonical: "/" },
};

const TRUST = [
  { icon: Inbox, label: "One record per complaint", note: "Not a call log, an inbox and a memory" },
  { icon: Timer, label: "A clock on every case", note: "Ageing and breach, not just volume" },
  { icon: Users, label: "Roles enforced in the database", note: "Not hidden buttons in the interface" },
  { icon: ShieldCheck, label: "An answer you can show", note: "What was decided, by whom, and when" },
];

/** The path a complaint takes, in the order the product takes it. */
const STAGES = [
  { icon: MessageSquareWarning, title: "Raised", note: "By your team, by email, or by the complainant themselves" },
  { icon: UserCheck, title: "Owned", note: "Assigned to a person and a queue, with a due time" },
  { icon: Search, title: "Investigated", note: "Evidence, notes and a root cause on the record" },
  { icon: ClipboardList, title: "Acted on", note: "Tasks and corrective actions somebody has to finish" },
  { icon: CheckCircle2, title: "Resolved", note: "An outcome written in words the complainant will read" },
  { icon: Bell, title: "Told", note: "The person who raised it hears what happened" },
  { icon: BarChart3, title: "Counted", note: "It joins the pattern the reports are watching" },
];

// The price list is a database read, so the page revalidates hourly rather
// than being frozen at build time: a price change appears within the hour
// without a redeploy.
export const revalidate = 3600;

export default async function LandingPage() {
  const plans = await getPlans();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "EDOS Centre",
        url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        email: "info@edoscentre.co.ke",
        areaServed: "KE",
      },
      {
        "@type": "SoftwareApplication",
        name: "EDOS CRM",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Complaint management and customer relationship platform: intake, assignment, SLA tracking, root-cause analysis, corrective actions, feedback and reporting.",
        offers: plans.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: (p.priceCents / 100).toFixed(2),
          priceCurrency: p.currency,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero />

      {/* ---------------------------------------------------- trust bar -- */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-center text-sm font-medium text-ink-soft">
            Built for teams who answer to the people they serve.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, label, note }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-faint">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- how it works -- */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading
          eyebrow="How it works"
          title="Seven steps, and a complaint can only be at one of them"
          lead="The stage is not a label somebody types. It moves when the work moves — when it is assigned, when a cause is recorded, when the person is told — so the register is the truth rather than a summary of it."
        />

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map(({ icon: Icon, title, note }, i) => (
            <li
              key={title}
              className="mk-lift relative flex flex-col rounded-xl border border-border bg-surface p-5 shadow-card"
            >
              <span className="absolute top-4 right-4 font-display text-xs font-bold text-ink-faint tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-snug text-ink-soft">{note}</p>
            </li>
          ))}

          <li className="flex flex-col justify-center rounded-xl border border-dashed border-border p-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              Reopen a case, escalate it, or hand it to another team at any step —
              and the timeline keeps every one of those decisions, with the name
              against it.
            </p>
          </li>
        </ol>
      </section>

      {/* --------------------------------------------- real screenshots -- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="The actual product"
            title="This is the software, not an illustration"
            lead="Real screens from a working demonstration workspace. A supervisor sees the whole desk; an agent sees the cases sitting with them."
          />

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
            <LaptopFrame
              src="/images/app/desk-complaints.png"
              alt="The EDOS CRM complaints register: open, critical, in investigation and closed counts, a stage-by-stage pipeline, filters, and the list of complaints with severity and stage"
              caption="All complaints — what is open, what is critical, and what stage each case is at."
            />

            <div className="grid grid-cols-2 gap-6">
              <PhoneFrame
                src="/images/app/phone-complaints.png"
                alt="The complaints register on a phone, with the figures stacked above the case list"
              />
              <PhoneFrame
                src="/images/app/phone-tasks.png"
                alt="The task board on a phone, showing what is to do and what is in progress"
              />
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <BrowserFrame
              src="/images/app/desk-dashboard.png"
              alt="The EDOS CRM dashboard, showing open complaints, SLA overdue, quality KPIs and complaints by severity"
              caption="The dashboard: what needs attention now, and how the desk is performing."
            />
            <BrowserFrame
              src="/images/app/desk-analytics.png"
              alt="EDOS CRM analytics, charting complaints over time, by severity, by channel and by stage"
              caption="Analytics: volume over time, and which categories keep returning."
            />
          </div>

          <p className="mt-8 text-center text-sm text-ink-soft">
            Every new workspace opens on the same screens, empty and waiting for your
            first case.{" "}
            <Link href="/signup" className="font-medium text-brand hover:underline">
              Start one
            </Link>
          </p>
        </div>
      </section>

      {/* -------------------------------------------------- SLA section -- */}
      <section id="sla" className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
          <div>
            <SectionHeading
              align="left"
              tone="dark"
              eyebrow="SLA & escalation"
              title="A case that is about to breach should not need you to notice it"
              lead="Every complaint carries a due time from the moment it is logged, set by its category and priority rather than by whoever picked it up. As that time approaches, the case escalates on its own — to a supervisor, to another queue, to whoever you said."
            />
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-white"
            >
              What each plan includes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mk-glass rounded-2xl p-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              Today · Open cases by age
            </p>

            <dl className="mt-5 flex flex-col gap-3">
              {[
                ["Within target", "184 cases", 78, "good"],
                ["Due today", "31 cases", 13, "warn"],
                ["Breached", "7 cases", 3, "bad"],
                ["Awaiting the complainant", "14 cases", 6, "mute"],
              ].map(([label, figure, pct, tone]) => (
                <div key={label as string} className="flex items-center gap-3">
                  <dt className="w-44 shrink-0 text-xs text-white/65">{label}</dt>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={
                        tone === "good"
                          ? "h-full rounded-full bg-good"
                          : tone === "warn"
                            ? "h-full rounded-full bg-accent"
                            : tone === "bad"
                              ? "h-full rounded-full bg-danger"
                              : "h-full rounded-full bg-white/35"
                      }
                      style={{ width: `${pct as number}%` }}
                    />
                  </div>
                  <dd className="w-20 shrink-0 text-right text-xs text-white tabular-nums">
                    {figure}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
              <p className="text-sm font-semibold text-white">Escalated 20 minutes ago</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                CMP-2026-000914 passed 80% of its target with no first response.
                It moved to the supervisor queue, and the clock kept running —
                escalating is not the same as starting again.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- capabilities -- */}
      <section
        id="capabilities"
        className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 lg:gap-24 lg:py-24"
      >
        <FeatureBlock
          id="capture"
          eyebrow="Capture"
          title="However it arrives, it becomes the same case"
          body="Someone walks in, calls, emails, or files it themselves on your intake page. All four end up as one record with a reference number, a category and a clock — not four habits in three different places."
          points={[
            "Logged by your team, by email, or by the complainant directly",
            "A reference number the person can quote back to you",
            "Contact history, so a repeat complaint is visibly a repeat",
            "Attachments and evidence kept with the case, not in an inbox",
          ]}
          image="/images/marketing/intake.jpg"
          alt="Someone taking a call at their laptop, writing down what is said"
        />

        <FeatureBlock
          id="ownership"
          eyebrow="Triage & ownership"
          title="Assigned to a person, not to a department"
          body="Routing follows the category, the queue and who is actually on duty — so a case has a name against it within minutes, and a manager can see at a glance what is sitting with whom."
          points={[
            "Automatic assignment by category, queue and workload",
            "Priority and due time set by rule, not by mood",
            "Reassign and escalate without losing the original clock",
            "Personal workload visible to the person carrying it",
          ]}
          image="/images/marketing/triage.jpg"
          alt="An agent working a case at her desk on the support floor"
          flip
        />

        <FeatureBlock
          id="root-cause"
          eyebrow="Root cause & action"
          title="Why it happened, and what was done about it"
          body="A resolution that does not say what caused the problem is a case closed, not a problem solved. Each complaint carries its cause and the corrective actions that came out of it — and those actions are tasks somebody has to finish."
          points={[
            "Root-cause summary recorded on the case, not in a meeting",
            "Corrective and product actions tracked to completion",
            "Linked cases, so a pattern is visible as a pattern",
            "Nothing closes with an action still open behind it",
          ]}
          image="/images/marketing/root-cause.jpg"
          alt="Two colleagues working a problem through at a whiteboard"
        />

        <FeatureBlock
          id="feedback"
          eyebrow="Resolution & feedback"
          title="Tell the person what happened"
          body="The complainant hears the outcome in plain words, by email or SMS, and gets the chance to say whether it actually resolved anything. Satisfaction is measured on the case it belongs to, not in a survey nobody links back."
          points={[
            "Outcome written for the complainant, not for the file",
            "Updates by email and SMS at the moments that matter",
            "Feedback captured against the case that prompted it",
            "Reopen from feedback, keeping the original history",
          ]}
          image="/images/marketing/resolution.jpg"
          alt="A case handed between colleagues at a support desk"
          flip
        />

        <FeatureBlock
          id="reporting"
          eyebrow="Reporting"
          title="Which problems keep coming back"
          body="Volume tells you how busy you were. Recurrence tells you what to fix. The reports are built around categories that repeat, causes that repeat and cases that breach — the three things worth a meeting."
          points={[
            "Volume, ageing, breach and backlog on one dashboard",
            "Recurring categories and causes, ranked",
            "Team and individual performance against the same targets",
            "Board-ready exports to PDF, Excel or CSV",
          ]}
          image="/images/marketing/insight.jpg"
          alt="Someone reading a report on a laptop at a quiet desk"
        />
      </section>

      {/* ------------------------------------------------------ pricing -- */}
      <section id="pricing" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="Pricing"
            title={`From ${priceLabel(plans[0])} a month`}
            lead={`Three plans, priced per organisation rather than per seat band you have to guess at. ${TRIAL_DAYS} days free to start, and a one-off onboarding fee quoted with whichever plan you take.`}
          />
          <div className="mt-10">
            <PricingTable plans={plans} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ -- */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="Questions" title="What teams ask us first" />
        <div className="mt-8">
          <FaqList faqs={FAQS} />
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA -- */}
      <section className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <MessageSquareWarning className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
          <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Every complaint, answered and accounted for.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Start a workspace, log a real complaint, and watch it run to a cause, a
            fix and an answer before you pay anything.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-[0.9375rem] font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-white hover:text-brand-darker"
            >
              Create your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-[0.9375rem] font-medium text-white transition-colors hover:bg-white/10"
            >
              Talk to our team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
