/**
 * What EDOS CRM costs, and what a workspace is actually on.
 *
 * The price list itself lives in the database (`edoscrm_plans`, migration
 * 0019) so the public pricing page and the subscription a workspace is billed
 * on read the same row and cannot drift. This module is the pure half: the
 * types both sides share, and the arithmetic — what state a subscription is
 * really in today, how many days of trial are left, how to render a price.
 *
 * Client-safe: no database access, no `server-only`.
 */

export type PlanCode = "starter" | "growth" | "pro";

/**
 * How long a new workspace runs free.
 *
 * Sign-up does not read this — a new workspace's trial is set by the
 * `edoscrm_tenants_start_trial` trigger, in SQL, where the row is written.
 * This is the same figure for the places TypeScript decides it, chiefly the
 * copy that talks about it, so the two stay in step by being written down
 * together: change one and change `edoscrm_trial_days()` in migration 0019.
 */
export const TRIAL_DAYS = 14;

export const CURRENCY = "KES";

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  tagline: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: "month" | "year";
  /** Null means the fee is quoted per organisation rather than published. */
  onboardingFeeCents: number | null;
  maxUsers: number | null;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
}

/** The recorded state, straight from the column. */
export type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

export interface Subscription {
  planId: string;
  planCode: PlanCode;
  planName: string;
  priceCents: number;
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  startedAt: string;
}

export interface Payment {
  id: string;
  kind: "subscription" | "onboarding";
  provider: "mpesa" | "bank" | "cash" | "other";
  reference: string | null;
  amountCents: number;
  currency: string;
  months: number | null;
  coversFrom: string | null;
  coversTo: string | null;
  note: string | null;
  paidAt: string;
}

/**
 * What the subscription is today, which is not always what the column says.
 *
 * A trial that has run out is still recorded as `trialing` — nothing runs at
 * midnight to flip it, and a nightly job that can fail is a worse source of
 * truth than a date comparison that cannot. Same for a paid period that has
 * ended: the row still says `active`, and the truth is that it is past due.
 */
export type EffectiveStatus =
  | "trialing"
  | "trial_over"
  | "active"
  | "past_due"
  | "cancelled";

export function effectiveStatus(sub: Subscription, now: Date = new Date()): EffectiveStatus {
  if (sub.status === "cancelled") return "cancelled";

  if (sub.status === "trialing" || sub.status === "expired") {
    const ends = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
    if (!ends) return "trialing";
    return ends.getTime() > now.getTime() ? "trialing" : "trial_over";
  }

  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  if (!end) return "active";
  return end.getTime() > now.getTime() ? "active" : "past_due";
}

/** Whole days remaining, floored at zero. Today counts as a day. */
export function daysUntil(iso: string | null, now: Date = new Date()): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** `KES 4,500` — one formatting of a price, used by every surface that shows one. */
export function priceLabel(plan: Pick<Plan, "priceCents" | "currency">): string {
  return `${plan.currency} ${(plan.priceCents / 100).toLocaleString("en-KE")}`;
}

export function moneyLabel(cents: number, currency = CURRENCY): string {
  return `${currency} ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

/** The seat ceiling, stated plainly under the price. */
export function seatLabel(plan: Pick<Plan, "maxUsers">): string {
  return plan.maxUsers ? `Up to ${plan.maxUsers} agents` : "Unlimited agents";
}

/**
 * Onboarding is quoted per plan, not published.
 *
 * It covers the part no subscription can do by itself — importing the contacts
 * and open complaints you already have, setting your categories, SLA targets
 * and escalation paths to match the promises you actually make, and training
 * the people who will answer. A one-team inbox and a multi-department
 * escalation matrix are not the same job, so the fee follows the plan rather
 * than pretending otherwise.
 */
export const ONBOARDING_NOTE =
  "Every plan carries a one-off onboarding fee — importing your contacts and open cases, setting your categories, SLA targets and escalation paths, and training your team. It depends on the plan you take up, and we quote it in writing before you commit.";

/** How EDOS Centre actually takes the money, said once. */
export const PAYMENT_NOTE =
  "Invoiced monthly by EDOS Centre and paid by M-Pesa or bank transfer. Record the reference here once you have paid and the period extends from that date.";
