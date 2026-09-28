import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/marketing/sections";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FaqList } from "@/components/marketing/faq-list";
import { FAQS } from "@/lib/marketing-content";
import { priceLabel, TRIAL_DAYS } from "@/lib/plans";
import { getPlans } from "@/lib/data/billing";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  // The description quotes real prices, so it is generated from the same rows
  // the table renders rather than from a second copy of the figures.
  const plans = await getPlans();
  const list = plans.map((p) => `${p.name} ${priceLabel(p)}`).join(", ");
  return {
    title: "Pricing",
    description: `EDOS CRM pricing: ${list} a month, plus a one-off onboarding fee quoted with your plan. ${TRIAL_DAYS} days free.`,
    alternates: { canonical: "/pricing" },
  };
}

export default async function PricingPage() {
  const plans = await getPlans();

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
          <SectionHeading
            eyebrow="Pricing"
            title="Priced for the organisation, not per seat"
            lead={`Three plans. Every one of them starts with ${TRIAL_DAYS} days free and no card, and carries a one-off onboarding fee we quote in writing before you commit.`}
          />
          <div className="mt-10">
            <PricingTable plans={plans} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- what changes -- */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Choosing"
          title="Which one is actually yours"
          lead="The honest version, rather than a feature matrix with ticks in every column."
        />

        <div className="mt-10 flex flex-col gap-4">
          {[
            {
              name: "Starter",
              who: "One team answering complaints that arrive by phone and email today.",
              why: "You get the record, the owner and the clock — the part that stops a complaint being forgotten. Routing is still something a person does each morning.",
            },
            {
              name: "Growth",
              who: "A desk busy enough that deciding who takes what is itself a job.",
              why: "This is where routing, escalation, root-cause summaries and complainant updates live. Most organisations that were going to buy at all end up here.",
            },
            {
              name: "Pro",
              who: "Several teams, a public you answer to, and somebody who asks for the quarterly numbers.",
              why: "The intake portal, the corrective-action register, cross-team routing and the reports that show what keeps recurring — plus the audit log that proves what you did about it.",
            },
          ].map((row) => (
            <div key={row.name} className="rounded-xl border border-border bg-surface p-6 shadow-card">
              <h3 className="font-display text-lg font-bold text-ink">{row.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink">{row.who}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{row.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ -- */}
      <section id="faq" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Questions" title="Before you commit" />
          <div className="mt-8">
            <FaqList faqs={FAQS} />
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-[0.9375rem] font-semibold text-brand-ink transition-colors hover:bg-brand-dark"
            >
              Start your {TRIAL_DAYS} days
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="text-sm text-ink-soft hover:text-brand">
              Or ask us a question first
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
