import { ONBOARDING_NOTE, TRIAL_DAYS } from "@/lib/plans";
import type { Faq } from "@/components/marketing/faq-list";

/**
 * The questions a buyer asks before they sign up, answered once.
 *
 * Kept beside the plans rather than in the page so the landing page and the
 * pricing page cannot answer the same question two different ways — and so
 * the onboarding fee is described in exactly the words the price list uses.
 */
export const FAQS: Faq[] = [
  {
    question: "What does the one-off onboarding fee cover?",
    answer: ONBOARDING_NOTE,
  },
  {
    question: "Can we try it before paying anything?",
    answer: `Yes. Every workspace starts with ${TRIAL_DAYS} days free and no card. Log real complaints, run them to a real resolution, and see what the reports say about your own month before you decide.`,
  },
  {
    question: "Is this for customer complaints, or internal ones?",
    answer:
      "Both, and they behave the same way: something was raised, somebody owns it, a clock is running, and it ends in an outcome somebody can read back. Categories, queues and SLA targets are yours to set, so a service desk and a public-complaints office both fit.",
  },
  {
    question: "How do complaints get in?",
    answer:
      "Your team logs them directly, they arrive by email, or — on Pro — the public intake portal takes them from the complainant with a reference number they can quote back to you. However it arrives, it becomes the same case with the same clock.",
  },
  {
    question: "What stops a case quietly ageing?",
    answer:
      "Every case carries an SLA clock from the moment it is logged, and the dashboards are built around ageing and breach rather than volume. Escalation rules move a case on when it is about to breach, instead of waiting for somebody to notice.",
  },
  {
    question: "Who can see what?",
    answer:
      "Roles and permissions are enforced in the database, not in the interface. An agent sees the queues they belong to; a manager sees their teams; personal contact details are visible only to the roles entitled to them.",
  },
  {
    question: "Can we get our data out?",
    answer:
      "At any time, and without asking us. Every register and report exports to PDF, Excel or CSV, and the API on Pro reads the same data the screens do.",
  },
  {
    question: "How do we pay?",
    answer:
      "Monthly, by M-Pesa or bank transfer, against an invoice from EDOS Centre. The onboarding fee is quoted and invoiced separately, once, before the work starts.",
  },
];
