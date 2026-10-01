import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Your password" };

export default async function ChangePasswordPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Your password</h1>
        <p className="text-sm text-ink-faint">
          Signed in as {session.user.email}.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">
          Change your password
        </h2>
        <p className="mb-3 text-xs text-ink-faint">
          You will stay signed in here. Other devices will need the new
          password.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
