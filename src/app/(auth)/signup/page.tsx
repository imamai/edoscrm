import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { SignupForm } from "./signup-form";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Create your account",
  description: `Start a ${TRIAL_DAYS}-day free trial of EDOS CRM and run a real complaint from intake to resolution.`,
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  const session = await resolveSession();
  // Already signed in: the app layout sends anyone without a workspace on to
  // /new-workspace, so /dashboard is right for both cases.
  if (session.kind !== "anon") redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Start with your first complaint
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {TRIAL_DAYS} days free. No card, no commitment.
      </p>

      <div className="mt-7">
        <SignupForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        Already have a workspace?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
