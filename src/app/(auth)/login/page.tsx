import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { LoginForm } from "./login-form";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await resolveSession();
  // Already signed in: the app layout sends anyone without a workspace on to
  // /new-workspace, so /dashboard is the one destination that is right for
  // both cases. It is no longer "/" — that is the public landing page now.
  if (session.kind !== "anon") redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Sign in to see what is waiting on you.
      </p>

      <div className="mt-7">
        <LoginForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        New organisation?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Create a workspace
        </Link>{" "}
        <span className="text-ink-faint">— {TRIAL_DAYS} days free</span>
      </p>
    </div>
  );
}
