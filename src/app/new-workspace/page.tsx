import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function NewWorkspacePage() {
  const session = await resolveSession();
  if (session.kind === "anon") redirect("/login");
  if (session.kind === "ok") redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <p className="mb-1 text-center text-lg font-semibold text-ink">Create your workspace</p>
        <p className="mb-6 text-center text-sm text-ink-faint">
          One workspace per organisation — you can invite others to it once it exists.
        </p>
        <WorkspaceForm />
      </div>
    </div>
  );
}
